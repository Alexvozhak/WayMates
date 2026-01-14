import { type BatcherOptions, Batcher } from "promise-batcher";

/**
 * Message batching service for Telegram Bot.
 *
 * Solves race condition: when user sends rapid messages ("I", "am", "backend developer"),
 * they get combined into single request "I am backend developer".
 *
 * Uses promise-batcher with debounce:
 * - First message starts timer (delayMs)
 * - Subsequent messages reset timer
 * - After timeout — batch is processed
 *
 * Leader/Follower pattern:
 * - First caller (leader) gets actual response
 * - Other callers (followers) get null — handler skips reply
 *
 * IMPORTANT: Process callback is UPDATED on every enqueue() call to ensure
 * fresh sessionId. This prevents stale sessionId in closure after user cleanup/re-register.
 */
export class MessageBatcherService<T> {
  private readonly batchers = new Map<number, Batcher<string, T | null>>();
  private readonly processors = new Map<number, (combined: string) => Promise<T>>();

  constructor(
    private readonly delayMs: number,
    private readonly maxSize: number,
  ) {}

  /**
   * Enqueue message for batching.
   *
   * @param telegramUserId - Telegram user ID (per-user isolation)
   * @param message - User message text
   * @param process - Async function to process combined message (UPDATED each call)
   * @returns Response for leader, null for followers
   */
  async enqueue(telegramUserId: number, message: string, process: (combined: string) => Promise<T>): Promise<T | null> {
    // Always update processor to ensure fresh sessionId from ctx.userInfo
    this.processors.set(telegramUserId, process);

    const batcher = this.getOrCreateBatcher(telegramUserId);
    return batcher.getResult(message);
  }

  /**
   * Clear cached batcher for user.
   * Call on /start for clean state.
   */
  clear(telegramUserId: number): void {
    this.batchers.delete(telegramUserId);
    this.processors.delete(telegramUserId);
  }

  private getOrCreateBatcher(telegramUserId: number): Batcher<string, T | null> {
    const existing = this.batchers.get(telegramUserId);
    if (existing) return existing;

    const options: BatcherOptions<string, T | null> = {
      batchingFunction: (messages) => this.processBatch(telegramUserId, messages),
      queuingDelay: this.delayMs,
      maxBatchSize: this.maxSize,
    };

    const batcher = new Batcher(options);
    this.batchers.set(telegramUserId, batcher);
    return batcher;
  }

  /**
   * Process batch of messages.
   *
   * Uses LATEST processor from Map (not captured in closure).
   * This ensures fresh sessionId even if user was re-registered.
   */
  private async processBatch(telegramUserId: number, messages: readonly string[]): Promise<(T | null)[]> {
    const process = this.processors.get(telegramUserId);
    if (!process) {
      throw new Error(`No processor for telegramUserId ${telegramUserId}`);
    }

    const combined = messages.join(" ");
    const response = await process(combined);

    return messages.map((_, i) => (i === 0 ? response : null));
  }
}
