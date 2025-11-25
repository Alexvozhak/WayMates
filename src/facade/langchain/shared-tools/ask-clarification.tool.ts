import { Command } from "@langchain/langgraph";
import { tool } from "langchain";
import { z } from "zod";

/**
 * Ask batch of clarifying questions to the user.
 * CRITICAL: Ask ALL questions in ONE batch, NOT one-by-one!
 * Follows best practice of batching user interactions.
 */
export const askClarificationTool = tool(
  ({ questions }: { questions: string[] }) => {
    console.log(`🔧 ask_clarification called with ${questions.length} questions`);

    // Format questions as numbered list for better UX
    const formattedMessage = `Please answer these questions:\n${questions
      .map((q, i) => `${i + 1}. ${q}`)
      .join("\n")}`;

    return new Command({
      update: {
        status: "awaiting_clarification",
        message: formattedMessage,
      },
    });
  },
  {
    name: "ask_clarification",
    description: "Ask batch of clarifying questions (NOT one-by-one!)",
    schema: z.object({
      questions: z
        .array(z.string())
        .min(1)
        .max(5)
        .describe("Array of questions to ask (1-5 questions, ask ALL at once)"),
    }),
  },
);
