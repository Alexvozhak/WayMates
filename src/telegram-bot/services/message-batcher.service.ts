import { type BatcherOptions, Batcher } from "promise-batcher";

/**
 * Message batching service for Telegram Bot.
 *
 * Solves race condition: when user sends rapid messages ("Я", "backend", "разработчик"),
 * they get combined into single request "Я backend разработчик".
 *
 * Uses promise-batcher with debounce:
 * - First message starts timer (delayMs)
 * - Subsequent messages reset timer
 * - After timeout — batch is processed
 *
 * Leader/Follower pattern:
 * - First caller (leader) gets actual response
 * - Other callers (followers) get null — handler skips reply
 */
export class MessageBatcherService<T> {
  private readonly batchers = new Map<number, Batcher<string, T | null>>();

  constructor(
    private readonly delayMs: number,
    private readonly maxSize: number,
  ) {}

  /**
   * Enqueue message for batching.
   *
   * @param telegramUserId - Telegram user ID (per-user isolation)
   * @param message - User message text
   * @param process - Async function to process combined message
   * @returns Response for leader, null for followers
   */
  async enqueue(telegramUserId: number, message: string, process: (combined: string) => Promise<T>): Promise<T | null> {
    const batcher = this.getOrCreateBatcher(telegramUserId, process);
    return batcher.getResult(message);
  }

  private getOrCreateBatcher(
    telegramUserId: number,
    process: (combined: string) => Promise<T>,
  ): Batcher<string, T | null> {
    const existing = this.batchers.get(telegramUserId);
    if (existing) return existing;

    const options = this.createOptions(process);
    const batcher = new Batcher(options);
    this.batchers.set(telegramUserId, batcher);
    return batcher;
  }

  private createOptions(process: (combined: string) => Promise<T>): BatcherOptions<string, T | null> {
    return {
      batchingFunction: (messages) => this.processBatch(messages, process),
      queuingDelay: this.delayMs,
      maxBatchSize: this.maxSize,
    };
  }

  /**
   * Process batch of messages.
   *
   * promise-batcher requires array of results matching input length.
   * Only first caller (leader) gets response to avoid duplicate messages in Telegram.
   * Followers get null — handler checks and skips reply.
   */
  private async processBatch(
    messages: readonly string[],
    process: (combined: string) => Promise<T>,
  ): Promise<(T | null)[]> {
    const combined = messages.join(" ");
    const response = await process(combined);

    return messages.map((_, i) => (i === 0 ? response : null));
  }
}
