import { tool } from "langchain";
import { z } from "zod";

/**
 * Ask batch of clarifying questions to the user.
 * CRITICAL: Ask ALL questions in ONE batch, NOT one-by-one!
 *
 * NOTE: This tool is used with humanInTheLoopMiddleware - it interrupts BEFORE execution.
 * The tool body NEVER executes. Calling code must format message using formatQuestions
 * helper and set it in state BEFORE calling this tool.
 */
export const askClarificationTool = tool(
  () => {
    // This body NEVER executes due to humanInTheLoopMiddleware interrupt.
    // Calling code handles message formatting and state update.
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
