import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

import type pg from "pg";

export class CheckpointService {
  static async create(pool: pg.Pool): Promise<CheckpointService> {
    const checkpointer = new PostgresSaver(pool, undefined, { schema: "facade" });
    await checkpointer.setup();
    return new CheckpointService(checkpointer);
  }

  private constructor(private readonly checkpointer: PostgresSaver) {}

  getCheckpointer(): PostgresSaver {
    return this.checkpointer;
  }

  async delete(threadId: string): Promise<void> {
    await this.checkpointer.deleteThread(threadId);
  }

  async getState(threadId: string): Promise<Record<string, unknown> | null> {
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API */
    const tuple = await this.checkpointer.getTuple({ configurable: { thread_id: threadId } });
    /* eslint-enable @typescript-eslint/naming-convention */

    if (!tuple?.checkpoint?.channel_values) {
      return null;
    }

    return tuple.checkpoint.channel_values;
  }

  async hasPendingInterrupt(threadId: string): Promise<boolean> {
    /* eslint-disable @typescript-eslint/naming-convention -- LangGraph API */
    const tuple = await this.checkpointer.getTuple({ configurable: { thread_id: threadId } });
    /* eslint-enable @typescript-eslint/naming-convention */

    if (!tuple) {
      return false;
    }

    return tuple.pendingWrites !== undefined && tuple.pendingWrites.length > 0;
  }
}
