import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command, MessagesZodState } from "@langchain/langgraph";
import { createAgent, tool } from "langchain";
import { z } from "zod";

import { trailSchema, userContextSchema, userContextSchemaPartial } from "../../shared/schemas.js";
import { config } from "../env.js";
import { postgresService } from "../infrastructure/postgres.service.js";

import {
  askClarificationTool,
  confirmDataTool,
  extractSingleContextTool,
} from "./shared-tools/index.js";

import type {
  AdhocUserContext,
  Trail,
  UserContext,
  UserContextPartial,
  UserId,
} from "../../shared/schemas.js";

export type CollectorStatus =
  | "collecting"
  | "awaiting_clarification"
  | "awaiting_confirmation"
  | "complete";

export type CollectorResult = {
  status: CollectorStatus;
  message: string;
  contexts?: UserContext[];
  trails?: Trail[];
};

/**
 * MCP Normalizer interface (works with partial AdhocUserContext).
 * Used by Career Collector with explicit UserContext → AdhocUserContext conversion.
 */
export type Normalizer = {
  normalizeUserContext(context: AdhocUserContext, userId: UserId): Promise<AdhocUserContext>;
};

export type CareerCollectorDeps = {
  normalizer: Normalizer;
  userId: UserId;
};

/**
 * User intent schema for confirmation response classification (confirm/correction).
 * Used inline in handleConfirmationIntent (not a shared tool).
 */
const userIntentSchema = z.object({
  action: z.enum(["confirm", "correction"]).describe("User's intended action"),
});

/**
 * Maps Zod validation error field paths to user-friendly clarification questions.
 */
const FIELD_TO_QUESTION: Record<string, string> = {
  position: "What was your job title?",
  skills: "What technologies/skills did you use? (list them)",
  industry: "What industry/sector was this in?",
  cityName: "Which city were you working in?",
  countryCode: "Which country? (provide 2-letter code like US, UK, DE)",
  domains: "What work domains/areas did you work in? (e.g., frontend, backend, mobile)",
  companySize: "What was the company size? (startup/small/medium/large/enterprise)",
};

/**
 * Builds user-friendly clarification questions from Zod validation errors.
 * Max 5 questions per batch (as per specification).
 */
function buildClarificationQuestions(error: z.ZodError): string[] {
  const questions: string[] = [];
  const seen = new Set<string>();

  for (const err of error.errors) {
    const field = err.path.join(".");

    // Avoid duplicate questions for the same field
    if (seen.has(field)) {
      continue;
    }
    seen.add(field);

    // Map field to question or use generic
    const question = FIELD_TO_QUESTION[field] || `Please provide: ${field}`;
    questions.push(question);

    // Max 5 questions per batch
    if (questions.length >= 5) {
      break;
    }
  }

  return questions;
}

/**
 * Merges partial contexts during clarification workflow.
 * New partial takes precedence, preserving original contextId.
 * Note: extractSingleContextTool filters out undefined values, so simple spread is safe.
 */
function mergePartialWithAnswers(
  existingPartial: UserContextPartial,
  newPartial: UserContextPartial,
): UserContextPartial {
  // Preserve original contextId (must exist in at least one partial)
  const contextId = existingPartial.contextId ?? newPartial.contextId;
  if (!contextId) {
    throw new Error("Cannot merge partials without contextId");
  }

  // Simple spread - newPartial doesn't contain undefined (filtered in extractSingleContextTool)
  return {
    ...existingPartial,
    ...newPartial,
    contextId,
  };
}

/**
 * DRY Helper: Validates partial context, normalizes if valid, or asks clarification if invalid.
 * Used in all workflow paths (initial extraction, clarification answers, user corrections).
 */
async function validateNormalizeConfirm(
  partial: UserContextPartial,
  deps: CareerCollectorDeps,
): Promise<Command> {
  const validation = userContextSchema.safeParse(partial);

  if (!validation.success) {
    const questions = buildClarificationQuestions(validation.error);
    const clarificationCommand = await askClarificationTool.invoke({ questions });
    return new Command({
      update: {
        ...clarificationCommand.update,
        partialContext: partial,
      },
    });
  }

  const normalized = await normalizeValidatedContext(validation.data, deps.normalizer, deps.userId);
  return confirmDataTool.invoke({ contexts: [normalized], trails: [] });
}

/**
 * Handles user correction after confirmation preview.
 * Parses correction, merges with existing context, re-validates and confirms.
 */
async function handleUserCorrection(
  text: string,
  existingContexts: UserContext[] | undefined,
  deps: CareerCollectorDeps,
): Promise<Command> {
  const correctionPartial = await extractSingleContextTool.invoke({ text });
  if (!correctionPartial) {
    return new Command({
      update: {
        status: "awaiting_clarification",
        message: "Could not parse correction. Please provide corrections clearly.",
      },
    });
  }

  if (!existingContexts || existingContexts.length === 0) {
    return new Command({
      update: {
        status: "awaiting_clarification",
        message: "No existing context found for correction. Please start over.",
      },
    });
  }

  // MVP: Only first context is corrected (multi-position correction = P2)
  // TypeScript can't infer non-empty after length check - use assertion
  const merged = mergePartialWithAnswers(existingContexts[0]!, correctionPartial);
  return await validateNormalizeConfirm(merged, deps);
}

/**
 * Handles clarification answers by merging with partial context.
 * Re-validates and either asks more questions or shows confirmation.
 */
async function handleClarificationAnswers(
  text: string,
  partialContext: UserContextPartial,
  deps: CareerCollectorDeps,
): Promise<Command> {
  console.log("📝 Processing clarification answers");

  const newPartial = await extractSingleContextTool.invoke({ text });
  if (!newPartial) {
    return new Command({
      update: {
        status: "awaiting_clarification",
        message: "Could not understand your answers. Please try again.",
        partialContext,
      },
    });
  }

  const merged = mergePartialWithAnswers(partialContext, newPartial);
  return await validateNormalizeConfirm(merged, deps);
}

/**
 * Handles user intent after showing confirmation preview.
 * Parses intent (confirm/correction) using LLM structured output inline.
 */
async function handleConfirmationIntent(
  text: string,
  existingContexts: UserContext[] | undefined,
  deps: CareerCollectorDeps,
): Promise<Command> {
  console.log("🔍 Parsing user intent via LLM");

  // Inline LLM structured output (not a shared tool - used only here)
  const model = new ChatGoogleGenerativeAI({
    model: config.LANGCHAIN_MODEL_NAME,
    temperature: config.LANGCHAIN_TEMP_INTENT,
  }).withStructuredOutput(userIntentSchema);

  const prompt = `Classify confirmation response: "${text}"

Options:
- "confirm": yes/да/ok/correct/good
- "correction": changes/but/fix/wrong

Default: "correction"`;

  try {
    const intent = await model.invoke([{ role: "user", content: prompt }]);
    console.log(`📊 Intent: ${intent.action}`);

    // User confirmed - complete workflow
    if (intent.action === "confirm") {
      console.log("✅ User confirmed data");
      return new Command({ update: { status: "complete" } });
    }

    // User wants corrections
    console.log("🔄 User provided correction");
    return await handleUserCorrection(text, existingContexts, deps);
  } catch (error) {
    console.error("❌ LLM intent parsing failed:", error);
    // Fallback: treat as correction to preserve user input
    console.log("🔄 Fallback: treating as correction");
    return await handleUserCorrection(text, existingContexts, deps);
  }
}

/**
 * Handles initial extraction from user's career history text.
 * Validates and either asks clarification questions or shows confirmation.
 */
async function handleInitialExtraction(text: string, deps: CareerCollectorDeps): Promise<Command> {
  console.log("🆕 Initial extraction");

  const extractedPartial = await extractSingleContextTool.invoke({ text });
  if (!extractedPartial) {
    return new Command({
      update: {
        status: "awaiting_clarification",
        message: "No career positions found. Please describe your work experience.",
      },
    });
  }

  return await validateNormalizeConfirm(extractedPartial, deps);
}

/**
 * Normalizes validated UserContext using MCP Normalizer.
 * Converts UserContext → AdhocUserContext → normalize → merge back.
 * Falls back to original data if normalization fails (graceful degradation).
 */
async function normalizeValidatedContext(
  validatedContext: UserContext,
  normalizer: Normalizer,
  userId: UserId,
): Promise<UserContext> {
  // Convert UserContext → AdhocUserContext для MCP Normalizer
  const adhocContext: AdhocUserContext = {
    position: validatedContext.position,
    skills: validatedContext.skills,
    domains: validatedContext.domains,
    industry: validatedContext.industry,
    cityName: validatedContext.cityName,
  };

  try {
    // Normalize using MCP Normalizer (exact → fuzzy → create unverified)
    const normalizedAdhoc = await normalizer.normalizeUserContext(adhocContext, userId);

    // Merge normalized fields back into validated UserContext (only defined values)
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
    // Graceful degradation: Continue with unnormalized data
    // Data will be saved as-is, search may be less optimal but functional
    return validatedContext;
  }
}

/**
 * Orchestrator tool для извлечения полной карьерной истории (MANY contexts + MANY trails).
 * Композирует atomic tools: extract → validate → ask → merge → normalize → confirm.
 *
 * Current MVP scope: SINGLE position extraction (multi-position = P2).
 */

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Return type is inferred from tool() factory
function createExtractCareerDataTool(deps: CareerCollectorDeps) {
  return tool(
    async ({ text }: { text: string }, config: { state: AgentState }) => {
      // ✅ Read state from config (injected by LangGraph runtime)
      const state = config.state;
      const { partialContext, contexts: existingContexts, status: currentStatus } = state;

      console.log(`🔧 extract_career_data: ${text.length} chars, status=${currentStatus}`);
      try {
        // Handle confirmation response
        if (currentStatus === "awaiting_confirmation") {
          return await handleConfirmationIntent(text, existingContexts, deps);
        }
        // Clarification answers (merge with partial)
        if (partialContext) {
          return await handleClarificationAnswers(text, partialContext, deps);
        }
        // Initial extraction
        return await handleInitialExtraction(text, deps);
      } catch (error) {
        console.error("❌ Orchestration failed:", error);
        return new Command({
          update: {
            status: "awaiting_clarification",
            message: "Failed to process career data. Please try rephrasing.",
          },
        });
      }
    },
    {
      name: "extract_career_data",
      description:
        "Orchestrator для извлечения полной карьерной истории (contexts + trails). " +
        "Композирует atomic tools: extract → validate → ask clarification → merge → normalize → confirm. " +
        "Handles: initial extraction, clarification, confirmation, corrections. " +
        "Tool reads state internally (partialContext, contexts, status) via config.state. " +
        "Returns Command with status update.",
      schema: z.object({
        text: z.string().describe("User message with career history, answers, or corrections"),
      }),
    },
  );
}

const model = new ChatGoogleGenerativeAI({
  model: config.LANGCHAIN_MODEL_NAME,
  temperature: config.LANGCHAIN_TEMP_AGENT,
});

const stateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  contexts: z.array(userContextSchema).optional(), // ✅ С salary refine validation!
  trails: z.array(trailSchema).optional(),
  status: z
    .enum(["collecting", "awaiting_clarification", "awaiting_confirmation", "complete"])
    .optional(),
  message: z.string().optional(),
  partialContext: userContextSchemaPartial.optional(), // Preserves partial extracted data during clarification
});

export function createCareerCollectorAgent(
  deps: CareerCollectorDeps,
): ReturnType<typeof createAgent> {
  return createAgent({
    model,
    tools: [
      // ✅ ТОЛЬКО orchestrator tool (agent видит ТОЛЬКО его!)
      // Atomic tools композируются ВНУТРИ extractCareerDataTool
      createExtractCareerDataTool(deps),
    ],
    checkpointer: postgresService.getCheckpointer(),
    stateSchema,
    systemPrompt: `You are a career history extraction assistant.

CRITICAL RULES:

1. **ALWAYS call extract_career_data tool with ONLY user message**:
   extract_career_data({ text: user_message })

   The tool reads state internally (partialContext, contexts, status) via LangGraph runtime.
   You DON'T pass state fields - just relay user messages!

2. **Your role**: Message relay + Response display
   - Relay user messages to extract_career_data tool
   - Show tool responses to user (questions, previews, completion)
   - DO NOT parse or validate data yourself - tool handles ALL logic

3. **Handle tool responses**:
   - awaiting_clarification: Show questions to user, wait for answers
   - awaiting_confirmation: Show preview to user, wait for confirmation or corrections
   - complete: Done! (ColdStartTool will save to Neo4j automatically)

4. **Batch Clarification**: Tool asks ALL questions in ONE batch (max 5)
   - You only relay questions to user and collect answers
   - Do NOT generate your own questions

5. **Workflow example**:
   - User: "I worked as Software Engineer in Berlin"
   - You: Call extract_career_data({ text: "I worked as Software Engineer in Berlin" })
   - Tool: status="awaiting_clarification", message="Please answer these questions:\n1. What was your job title?\n..."
   - You: Show questions to user
   - User: "Senior Software Engineer, TypeScript, React, ..."
   - You: Call extract_career_data({ text: "Senior Software Engineer, TypeScript, React, ..." })
   - Tool: status="awaiting_confirmation", message="**Extracted Career Data:**\n..."
   - You: Show preview to user
   - User: "yes"
   - You: Call extract_career_data({ text: "yes" })
   - Tool: status="complete"
   - You: Confirm completion

ALWAYS trust extract_career_data tool flow. Do NOT try to extract data yourself.`,
  });
}

type AgentState = z.infer<typeof stateSchema>;

async function getExistingState(
  agent: ReturnType<typeof createAgent>,
  threadId: string,
): Promise<AgentState | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- LangGraph API requires thread_id
    const state = await agent.getState({ configurable: { thread_id: threadId } });
    return state as unknown as AgentState;
  } catch {
    return null;
  }
}

function createInitialState(existingState: AgentState | null, message: string): AgentState {
  // New thread or no existing state
  if (!existingState) {
    console.log(`Creating new thread state`);
    return {
      messages: [new HumanMessage(message)],
      contexts: undefined,
      trails: undefined,
      status: undefined,
      message: undefined,
      partialContext: undefined,
    };
  }

  // Thread already complete - start fresh
  if (existingState.status === "complete") {
    console.log(`Thread already complete, starting new import`);
    return {
      messages: [new HumanMessage(message)],
      contexts: undefined,
      trails: undefined,
      status: undefined,
      message: undefined,
      partialContext: undefined,
    };
  }

  // Continue existing thread
  console.log(`Continuing existing thread, status: ${existingState.status}`);
  return {
    messages: [...(existingState.messages || []), new HumanMessage(message)],
    contexts: existingState.contexts,
    trails: existingState.trails,
    status: existingState.status,
    message: existingState.message,
    partialContext: existingState.partialContext,
  };
}

function buildCollectorResult(state: AgentState): CollectorResult {
  const result: CollectorResult = {
    status: state.status ?? "collecting",
    message: state.message ?? "Processing career data",
  };

  if (state.contexts !== undefined) {
    result.contexts = state.contexts; // Already validated by state schema
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
  const existingState = await getExistingState(agent, threadId);
  const initialState = createInitialState(existingState, message);

  const result = await agent.invoke(
    initialState,
    // eslint-disable-next-line @typescript-eslint/naming-convention -- LangGraph API requires thread_id
    { configurable: { thread_id: threadId } },
  );

  const state = result as unknown as AgentState;
  console.log(`CollectorAgent result status: ${state.status}`);

  return buildCollectorResult(state);
}
