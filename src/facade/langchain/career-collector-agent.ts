import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command, END, MessagesZodState } from "@langchain/langgraph";
import { createAgent, humanInTheLoopMiddleware, tool } from "langchain";
import { z } from "zod";

import { trailSchema, userContextSchema, userContextSchemaPartial } from "../../shared/schemas.js";
import { config } from "../env.js";
import { postgresService } from "../infrastructure/postgres.service.js";

import {
  askClarificationTool,
  confirmDataTool as confirmCareerDataTool,
  extractSingleContextTool,
  formatPreview,
  formatQuestions,
} from "./shared-tools/index.js";

import type {
  AdhocUserContext,
  Trail,
  UserContext,
  UserContextPartial,
  UserId,
} from "../../shared/schemas.js";
import type { CoreTRPCClient } from "../core-client/core-trpc-client.js";

export type CollectorStatus =
  | "collecting"
  | "awaiting_clarification"
  | "awaiting_confirmation"
  | "complete"
  | "failed";

export type CollectorResult = {
  status: CollectorStatus;
  message: string;
  contexts?: UserContext[];
  trails?: Trail[];
};

export type Normalizer = {
  normalizeUserContext(context: AdhocUserContext, userId: UserId): Promise<AdhocUserContext>;
};

export type CareerCollectorDeps = {
  normalizer: Normalizer;
  userId: UserId;
  coreClient: CoreTRPCClient;
};

const FIELD_TO_QUESTION: Record<string, string> = {
  position: "What was your job title?",
  skills: "What technologies/skills did you use? (list them)",
  industry: "What industry/sector was this in?",
  cityName: "Which city were you working in?",
  countryCode: "Which country? (provide 2-letter code like US, UK, DE)",
  domains: "What work domains/areas did you work in? (e.g., frontend, backend, mobile)",
  companySize: "What was the company size? (startup/small/medium/large/enterprise)",
};

function buildClarificationQuestions(error: z.ZodError): string[] {
  const questions: string[] = [];
  const seen = new Set<string>();

  for (const err of error.errors) {
    const field = err.path.join(".");

    if (seen.has(field)) {
      continue;
    }
    seen.add(field);

    const question = FIELD_TO_QUESTION[field] || `Please provide: ${field}`;
    questions.push(question);

    if (questions.length >= 5) {
      break;
    }
  }

  return questions;
}

function mergePartialWithAnswers(
  existingPartial: UserContextPartial,
  newPartial: UserContextPartial,
): UserContextPartial {
  const contextId = existingPartial.contextId ?? newPartial.contextId;
  if (!contextId) {
    throw new Error("Cannot merge partials without contextId");
  }

  return {
    ...existingPartial,
    ...newPartial,
    contextId,
  };
}

async function normalizeValidatedContext(
  validatedContext: UserContext,
  normalizer: Normalizer,
  userId: UserId,
): Promise<UserContext> {
  const adhocContext: AdhocUserContext = {
    position: validatedContext.position,
    skills: validatedContext.skills,
    domains: validatedContext.domains,
    industry: validatedContext.industry,
    cityName: validatedContext.cityName,
  };

  try {
    const normalizedAdhoc = await normalizer.normalizeUserContext(adhocContext, userId);

    return {
      ...validatedContext,
      ...(normalizedAdhoc.position != null && { position: normalizedAdhoc.position }),
      ...(normalizedAdhoc.skills != null && { skills: normalizedAdhoc.skills }),
      ...(normalizedAdhoc.domains != null && { domains: normalizedAdhoc.domains }),
      ...(normalizedAdhoc.industry != null && { industry: normalizedAdhoc.industry }),
      ...(normalizedAdhoc.cityName != null && { cityName: normalizedAdhoc.cityName }),
    };
  } catch (error) {
    console.error("❌ Normalization failed, using original data:", error);
    return validatedContext;
  }
}

// Formatting helpers imported from shared-tools (see imports above)

function handleMaxRoundsExceeded(maxRounds: number): Command {
  console.log(`❌ Max clarification rounds (${maxRounds}) exceeded`);
  return new Command({
    update: {
      status: "failed" as const,
      message:
        "Could not collect valid data after multiple attempts. Please try again with more complete information.",
    },
    goto: END,
  });
}

function handleValidationFailed(
  merged: UserContextPartial,
  round: number,
  error: z.ZodError,
): Command {
  const questions = buildClarificationQuestions(error);
  console.log(`📝 Validation failed, asking ${questions.length} questions (round ${round})`);

  return new Command({
    update: {
      partialContext: merged,
      clarificationRound: round,
      status: "awaiting_clarification" as const,
      message: formatQuestions(questions),
    },
    goto: "ask_clarification",
  });
}

async function handleValidationSuccess(
  validated: UserContext,
  deps: CareerCollectorDeps,
): Promise<Command> {
  console.log("✅ Validation passed, normalizing context");
  const normalized = await normalizeValidatedContext(validated, deps.normalizer, deps.userId);

  return new Command({
    update: {
      contexts: [normalized],
      clarificationRound: 0,
      status: "awaiting_confirmation" as const,
      message: formatPreview([normalized], []),
    },
    goto: "confirm_career_data",
  });
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Return type is inferred from tool() factory
function createExtractUserContextTool(deps: CareerCollectorDeps) {
  return tool(
    async ({ text }: { text: string }, toolConfig: { state: AgentState }) => {
      const { partialContext, clarificationRound = 0 } = toolConfig.state;
      console.log(`🔧 extract_user_context: ${text.length} chars, round=${clarificationRound}`);

      const newPartial = await extractSingleContextTool.invoke({ text });
      if (!newPartial) {
        return new Command({
          update: {
            status: "awaiting_clarification" as const,
            message: "Could not parse career data. Please describe your work experience.",
          },
          goto: "ask_clarification",
        });
      }

      const merged = partialContext
        ? mergePartialWithAnswers(partialContext, newPartial)
        : newPartial;
      const validation = userContextSchema.safeParse(merged);

      if (!validation.success) {
        const round = clarificationRound + 1;
        const maxRounds = config.LANGCHAIN_MAX_CLARIFICATION_ROUNDS;
        if (round > maxRounds) return handleMaxRoundsExceeded(maxRounds);
        return handleValidationFailed(merged, round, validation.error);
      }

      return handleValidationSuccess(validation.data, deps);
    },
    {
      name: "extract_user_context",
      description:
        "Extract and validate career context from user text. " +
        "Parses text, validates with Zod, normalizes terms. " +
        "Returns Command with deterministic goto routing.",
      schema: z.object({
        text: z.string().describe("User message with career data or answers"),
      }),
    },
  );
}

// Tools imported from shared-tools (see imports above)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Return type is inferred from tool() factory
function createSaveCareerDataTool(deps: { coreClient: CoreTRPCClient }) {
  return tool(
    async (_params: Record<string, never>, toolConfig: { state: AgentState }) => {
      const { contexts, trails, userId } = toolConfig.state;

      console.log(`🔧 save_career_data called`);

      if (!contexts || contexts.length === 0) {
        console.error("❌ No contexts to save");
        return new Command({
          update: {
            status: "failed" as const,
            message: "No career data to save. Please provide your work experience first.",
          },
          goto: END,
        });
      }

      if (!userId) {
        console.error("❌ No userId in state");
        return new Command({
          update: {
            status: "failed" as const,
            message: "Internal error: User ID not found.",
          },
          goto: END,
        });
      }

      // ✅ SAVE ЗДЕСЬ (NOT in ColdStartTool!)
      console.log(`💾 Saving ${contexts.length} contexts to Neo4j via Core API`);
      const upsertResult = await deps.coreClient.client.story.upsertStory.mutate({
        userId,
        contexts,
        trails: trails || [],
      });

      const contextsCount = upsertResult.contexts.contextIds.length;
      const trailsCount = upsertResult.trails.trailIds.length;

      // ✅ Human-friendly message (LibreChat LLM will show to user)
      const positionText = `${contextsCount} position${contextsCount > 1 ? "s" : ""}`;
      const transitionText =
        trailsCount > 0 ? ` and ${trailsCount} transition${trailsCount > 1 ? "s" : ""}` : "";

      return new Command({
        update: {
          status: "complete" as const,
          message: `✅ Successfully imported ${positionText}${transitionText}. Your career history has been saved!`,
        },
        goto: END,
      });
    },
    {
      name: "save_career_data",
      description:
        "Save confirmed career data to Neo4j database via Core API. " +
        "Reads contexts/trails/userId from state (NO parameters). " +
        "Returns Command with goto END.",
      schema: z.object({}),
    },
  );
}

const model = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_AGENT,
});

const stateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  partialContext: userContextSchemaPartial.optional(),
  contexts: z.array(userContextSchema).optional(),
  trails: z.array(trailSchema).optional(),
  status: z
    .enum(["collecting", "awaiting_clarification", "awaiting_confirmation", "complete", "failed"])
    .optional(),
  message: z.string().optional(),
  clarificationRound: z.number().default(0),
  userId: z.string().optional(),
});

type AgentState = z.infer<typeof stateSchema>;

const SYSTEM_PROMPT = `You are a career history extraction assistant.

WORKFLOW (Hybrid Routing):
1. User provides career text → call extract_user_context
2. Tool routes via goto:
   - Validation failed → ask_clarification (deterministic)
   - Validation success → confirm_career_data (deterministic)
3. After interrupt resume → YOU decide next step (see below)

YOUR ROLE: Interpret user intent + follow tool routing

═══════════════════════════════════════════════════
CANCEL DETECTION (AT ANY POINT)
═══════════════════════════════════════════════════

If user says "cancel"/"stop"/"quit"/"abort"/"отмена":
1. Respond: "Workflow cancelled. Your data was not saved."
2. DO NOT call any tools
3. Stop workflow

Examples:
- User: "cancel" → YOU: "Workflow cancelled."
- User: "stop this" → YOU: "Workflow cancelled."
- User: "отмена" → YOU: "Workflow cancelled."

═══════════════════════════════════════════════════
AFTER CLARIFICATION (status="awaiting_clarification")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CANCEL intent:
   - Keywords: "cancel", "stop", "quit", "abort"
   - Action: Cancel workflow (see above)

2. ANSWERS intent:
   - User provides answers to questions
   - Action: Call extract_user_context with their answers

Examples:
- User: "Python, React, Tech startup" → Call extract_user_context
- User: "cancel this" → Cancel workflow

═══════════════════════════════════════════════════
AFTER CONFIRMATION (status="awaiting_confirmation")
═══════════════════════════════════════════════════

User response → interpret intent:

1. CONFIRM intent:
   - Keywords: "yes", "да", "ok", "correct", "good", "looks good", "👍"
   - Action: Call save_career_data

2. CORRECTION intent:
   - User provides changes: "change X to Y", "update position", etc.
   - Action: Call extract_user_context with correction text

3. CANCEL intent:
   - Keywords: "cancel", "stop"
   - Action: Cancel workflow (see above)

Examples:
- User: "yes" → Call save_career_data
- User: "looks good" → Call save_career_data
- User: "change position to Senior Engineer" → Call extract_user_context
- User: "cancel" → Cancel workflow

═══════════════════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════════════════

1. ALWAYS follow tool goto routing (deterministic business logic)
2. Interpret user intent through natural language (cancel, confirm, correct)
3. When in doubt about intent:
   - Clarification context → treat as answers
   - Confirmation context → treat as correction (safe default)
4. DO NOT generate your own questions - tools handle that
5. DO NOT parse/validate data yourself - tools handle that

Your job: Relay messages to tools + interpret user intent + display results.
`;

export function createCareerCollectorAgent(
  deps: CareerCollectorDeps,
): ReturnType<typeof createAgent> {
  return createAgent({
    model,
    tools: [
      createExtractUserContextTool(deps),
      askClarificationTool,
      confirmCareerDataTool,
      createSaveCareerDataTool({ coreClient: deps.coreClient }),
    ],
    middleware: [
      humanInTheLoopMiddleware({
        // eslint-disable-next-line @typescript-eslint/naming-convention -- LangGraph API requires tool names with underscores
        interruptOn: { ask_clarification: true, confirm_career_data: true },
      }),
    ],
    checkpointer: postgresService.getCheckpointer(),
    stateSchema,
    systemPrompt: SYSTEM_PROMPT,
  });
}

function getExistingState(
  agent: ReturnType<typeof createAgent>,
  threadId: string,
): AgentState | null {
  try {
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API requires thread_id */
    const state = agent.getState({ configurable: { thread_id: threadId } });
    /* eslint-enable @typescript-eslint/naming-convention */
    return state as unknown as AgentState;
  } catch {
    return null;
  }
}

function createInitialState(
  existingState: AgentState | null,
  message: string,
  userId: UserId,
): AgentState {
  if (!existingState) {
    console.log(`Creating new thread state`);
    return {
      messages: [new HumanMessage(message)],
      contexts: undefined,
      trails: undefined,
      status: undefined,
      message: undefined,
      partialContext: undefined,
      clarificationRound: 0,
      userId,
    };
  }

  if (existingState.status === "complete" || existingState.status === "failed") {
    console.log(`Thread finished (status=${existingState.status}), starting new import`);
    return {
      messages: [new HumanMessage(message)],
      contexts: undefined,
      trails: undefined,
      status: undefined,
      message: undefined,
      partialContext: undefined,
      clarificationRound: 0,
      userId,
    };
  }

  console.log(`Continuing existing thread, status: ${existingState.status}`);
  return {
    messages: [...(existingState.messages || []), new HumanMessage(message)],
    contexts: existingState.contexts,
    trails: existingState.trails,
    status: existingState.status,
    message: existingState.message,
    partialContext: existingState.partialContext,
    clarificationRound: existingState.clarificationRound ?? 0,
    userId: existingState.userId ?? userId,
  };
}

function buildCollectorResult(state: AgentState): CollectorResult {
  const result: CollectorResult = {
    status: state.status ?? "collecting",
    message: state.message ?? "Processing career data",
  };

  if (state.contexts !== undefined) {
    result.contexts = state.contexts;
  }
  if (state.trails !== undefined) {
    result.trails = state.trails;
  }

  return result;
}

export async function collectContexts(
  message: string,
  threadId: string,
  deps: CareerCollectorDeps,
): Promise<CollectorResult> {
  console.log(`CollectorAgent invoked with threadId: ${threadId}`);

  const agent = createCareerCollectorAgent(deps);
  const existingState = getExistingState(agent, threadId);
  const initialState = createInitialState(existingState, message, deps.userId);

  const result = await agent.invoke(
    initialState,
    // eslint-disable-next-line @typescript-eslint/naming-convention -- LangGraph API requires thread_id
    { configurable: { thread_id: threadId } },
  );

  const state = result as unknown as AgentState;
  console.log(`CollectorAgent result status: ${state.status}`);

  return buildCollectorResult(state);
}
