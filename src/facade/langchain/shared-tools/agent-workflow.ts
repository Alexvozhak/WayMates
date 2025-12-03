import { Command } from "@langchain/langgraph";
import { createAgent } from "langchain";

import { postgresService } from "../../infrastructure/postgres.service.js";

import { sequentialToolCallsMiddleware } from "./models.js";

import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type { HumanMessage } from "@langchain/core/messages";
import type { StructuredTool } from "@langchain/core/tools";
import type { z } from "zod";

type AgentInput = { messages: HumanMessage[] } & Record<string, unknown>;

export abstract class AgentWorkflow<TState extends { phase: TPhase }, TResponse, TPhase extends string> {
  protected abstract readonly stateSchema: z.ZodObject<z.ZodRawShape, "strip", z.ZodTypeAny, TState>;
  protected abstract readonly terminalPhases: readonly TPhase[];
  protected abstract readonly tools: StructuredTool[];
  protected abstract readonly systemPrompt: string;
  protected abstract readonly responseBuilders: Record<TPhase, (state: TState) => TResponse>;
  protected abstract readonly failedResponse: TResponse;
  protected abstract readonly model: LanguageModelLike;

  async run(message: string, threadId: string): Promise<TResponse> {
    const agent = this.createAgent();
    const existingState = await this.getExistingState(threadId);
    const input = await this.resolveInput(message, threadId, existingState);

    const result = await agent.invoke(
      input,
      /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API */
      { configurable: { thread_id: threadId } },
      /* eslint-enable @typescript-eslint/naming-convention */
    );

    return this.buildResponse(result);
  }

  protected abstract buildInitialInput(message: string): AgentInput;

  protected buildResponse(result: unknown): TResponse {
    const parsed = this.stateSchema.safeParse(result);
    if (!parsed.success) return this.failedResponse;
    return this.responseBuilders[parsed.data.phase](parsed.data);
  }

  protected createAgent(): ReturnType<typeof createAgent> {
    return createAgent({
      model: this.model,
      tools: this.tools,
      checkpointer: postgresService.getCheckpointer(),
      stateSchema: this.stateSchema,
      systemPrompt: this.systemPrompt,
      middleware: [sequentialToolCallsMiddleware],
    });
  }

  protected async getExistingState(threadId: string): Promise<TState | null> {
    const checkpointState = await postgresService.getCheckpointState(threadId);

    if (!checkpointState || Object.keys(checkpointState).length === 0) {
      return null;
    }

    const parsed = this.stateSchema.safeParse(checkpointState);
    return parsed.success ? parsed.data : null;
  }

  protected isTerminalPhase(state: TState | null): boolean {
    if (!state) return false;
    const terminalSet: ReadonlySet<string> = new Set(this.terminalPhases);
    return terminalSet.has(state.phase);
  }

  protected async resolveInput(
    message: string,
    threadId: string,
    existingState: TState | null,
  ): Promise<AgentInput | Command> {
    if (this.isTerminalPhase(existingState)) {
      await postgresService.deleteCheckpoint(threadId);
    } else if (await postgresService.hasPendingInterrupt(threadId)) {
      return new Command({ resume: message });
    }

    return this.buildInitialInput(message);
  }
}
