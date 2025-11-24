import { HumanMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Command, MessagesZodState } from "@langchain/langgraph";
import { createAgent, tool } from "langchain";
import { z } from "zod";

import { adhocUserContextSchema, trailSchema } from "../../shared/schemas.js";
import { postgresService } from "../infrastructure/postgres.service.js";

import type { AdhocUserContext, Trail, UserId } from "../../shared/schemas.js";

export type CollectorStatus =
  | "collecting"
  | "awaiting_clarification"
  | "awaiting_confirmation"
  | "complete";

export type CollectorResult = {
  status: CollectorStatus;
  message: string;
  contexts?: AdhocUserContext[];
  trails?: Trail[];
};

export type Normalizer = {
  normalizeUserContext(context: AdhocUserContext, userId: UserId): Promise<AdhocUserContext>;
};

export type CareerCollectorDeps = {
  normalizer: Normalizer;
  userId: UserId;
};

type ExtractedData = {
  contexts?: Partial<AdhocUserContext>[];
  trails?: Partial<Trail>[];
};

const extractionModel = new ChatGoogleGenerativeAI({
  model: "models/gemini-2.0-flash",
  temperature: 0.2,
});

async function extractCareerData(text: string): Promise<ExtractedData | null> {
  const prompt = `Extract career history from the following text. Return a JSON object with:
- contexts: array of career positions with { position, skills }
- trails: array of transitions with { reason, skill, platform, course }

Parse naturally from markdown, bullet lists, or plain text.

Text:
${text}

Return ONLY valid JSON, no explanation.`;

  const response = await extractionModel.invoke([{ role: "user", content: prompt }]);
  const content = typeof response.content === "string" ? response.content : "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return null;
  }

  return JSON.parse(jsonMatch[0]) as ExtractedData;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Return type is inferred from tool() factory
function createExtractCareerDataTool(deps: CareerCollectorDeps) {
  return tool(
    async ({ text }: { text: string }) => {
      console.log(`🔧 extract_career_data called with ${text.length} chars`);

      try {
        const extracted = await extractCareerData(text);

        if (!extracted || !extracted.contexts || extracted.contexts.length === 0) {
          return new Command({
            update: {
              status: "awaiting_clarification",
              message: "No career positions found. Please describe your work experience.",
            },
          });
        }

        const contexts = extracted.contexts as AdhocUserContext[];
        const trails = (extracted.trails ?? []) as Trail[];

        const normalizedContexts = await Promise.all(
          contexts.map((ctx) => deps.normalizer.normalizeUserContext(ctx, deps.userId)),
        );

        const message = `Extracted ${normalizedContexts.length} positions`;

        return new Command({
          update: {
            contexts: normalizedContexts,
            trails,
            status: "awaiting_confirmation",
            message,
          },
        });
      } catch (error) {
        console.error("❌ Extraction failed:", error);
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
      description: "Extract complete career history (contexts + transitions) from user message",
      schema: z.object({ text: z.string() }),
    },
  );
}

const askClarificationTool = tool(
  ({ questions }: { questions: string[] }) => {
    console.log(`🔧 ask_clarification called with ${questions.length} questions`);

    return new Command({
      update: {
        status: "awaiting_clarification",
        message: `Please answer these questions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
      },
    });
  },
  {
    name: "ask_clarification",
    description: "Ask batch of clarifying questions (NOT one-by-one!)",
    schema: z.object({ questions: z.array(z.string()).min(1).max(5) }),
  },
);

const confirmCareerDataTool = tool(
  ({ contexts, trails }: { contexts: AdhocUserContext[]; trails: Trail[] }) => {
    console.log(
      `🔧 confirm_career_data called: ${contexts.length} contexts, ${trails.length} trails`,
    );

    return new Command({
      update: {
        status: "complete",
        contexts,
        trails,
      },
    });
  },
  {
    name: "confirm_career_data",
    description: "Show extracted career data for user confirmation",
    schema: z.object({
      contexts: z.array(adhocUserContextSchema),
      trails: z.array(trailSchema),
    }),
  },
);

const model = new ChatGoogleGenerativeAI({
  model: "models/gemini-2.0-flash",
  temperature: 0.3,
});

const stateSchema = z.object({
  messages: MessagesZodState.shape.messages,
  contexts: z.array(adhocUserContextSchema).optional(),
  trails: z.array(trailSchema).optional(),
  status: z
    .enum(["collecting", "awaiting_clarification", "awaiting_confirmation", "complete"])
    .optional(),
  message: z.string().optional(),
});

export function createCareerCollectorAgent(
  deps: CareerCollectorDeps,
): ReturnType<typeof createAgent> {
  return createAgent({
    model,
    tools: [createExtractCareerDataTool(deps), askClarificationTool, confirmCareerDataTool],
    checkpointer: postgresService.getCheckpointer(),
    stateSchema,
    systemPrompt: `You are a career history extraction assistant. Your goal is to collect complete career history from the user.

CRITICAL RULES:

1. **Batch Clarification**: Ask ALL questions in ONE batch (max 5), NOT one-by-one
   - Bad: Ask "Start date?" → wait → Ask "Company?"
   - Good: Ask ["Start date?", "Company?", "Skills?"] in ONE call

2. **Markdown Parsing**: Handle various formats naturally:
   - ## Company - Position
   - ### Position at Company
   - Bullet lists: - **Position** | Company | Dates
   - Tables: | Position | Company | Dates |

3. **Extract BOTH**: contexts (positions) + trails (transitions)
   - Contexts: position, company, skills, dates, description
   - Trails: reason for change, courses taken, platforms used

4. **Workflow**:
   - Step 1: Extract career data → normalize (FacadeNormalizer handles unknown skills automatically)
   - Step 2: IF incomplete → ask_clarification batch
   - Step 3: Show preview of extracted data → confirm_career_data
   - Step 4: User confirms → status: complete

ALWAYS call confirm_career_data before marking complete.`,
  });
}

export async function collectContexts(
  message: string,
  threadId: string,
  deps: CareerCollectorDeps,
): Promise<CollectorResult> {
  console.log(`CollectorAgent invoked with threadId: ${threadId}`);

  const agent = createCareerCollectorAgent(deps);

  const result = await agent.invoke(
    {
      messages: [new HumanMessage(message)],
      contexts: undefined,
      trails: undefined,
      status: undefined,
      message: undefined,
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- LangGraph API requires thread_id
    { configurable: { thread_id: threadId } },
  );

  // Type assertion to access custom state fields
  const state = result as unknown as z.infer<typeof stateSchema>;

  console.log(`CollectorAgent result status: ${state.status}`);

  const collectorResult: CollectorResult = {
    status: state.status ?? "collecting",
    message: state.message ?? "Processing career data",
  };

  // Only include optional fields if they're defined
  if (state.contexts !== undefined) {
    collectorResult.contexts = state.contexts;
  }
  if (state.trails !== undefined) {
    collectorResult.trails = state.trails;
  }

  return collectorResult;
}
