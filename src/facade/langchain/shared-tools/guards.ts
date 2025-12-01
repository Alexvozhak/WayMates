import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

export function phaseGuard<P extends string>(
  currentPhase: P | undefined,
  expectedPhase: P | P[],
  toolCallId: string,
): Command | null {
  const allowed = Array.isArray(expectedPhase) ? expectedPhase : [expectedPhase];

  if (currentPhase && allowed.includes(currentPhase)) {
    return null;
  }

  const expectedStr = allowed.join(" | ");

  console.warn(
    `[phaseGuard] LLM called tool in wrong phase. ` +
      `Current: "${currentPhase ?? "undefined"}", expected: "${expectedStr}".`,
  );

  return new Command({
    update: {
      /* eslint-disable @typescript-eslint/naming-convention -- LangChain API */
      messages: [
        new ToolMessage({
          content: `Cannot proceed. Current phase: "${currentPhase ?? "undefined"}", expected: "${expectedStr}".`,
          tool_call_id: toolCallId,
        }),
      ],
      /* eslint-enable @typescript-eslint/naming-convention */
    },
  });
}
