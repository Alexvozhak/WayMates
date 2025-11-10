import type { AuthService } from './auth-service.js';
import type { LLMTranslator } from './llm-translator.js';
import type { RateLimiter } from './rate-limiter.js';
import type { FacadeResponse, Intent } from './types.js';
import type { AxiosInstance } from 'axios';

export class FacadeOrchestrator {
  constructor(
    private auth: AuthService,
    private translator: LLMTranslator,
    private rateLimiter: RateLimiter,
    private coreClient: AxiosInstance
  ) {}

  async processQuery(query: string, token?: string): Promise<FacadeResponse> {
    const userId = token
      ? this.auth.authenticate(token)
      : this.auth.createUser().userId;

    const intent = await this.translator.extractIntent(query);

    const allowed = await this.rateLimiter.checkLimit(userId, intent.action);
    if (!allowed) {
      throw new Error('Rate limit exceeded');
    }

    const coreParams = await this.translator.mapToParams(intent, query, userId);

    const coreResult = await this.callCore(intent, coreParams, userId);

    await this.rateLimiter.incrementCounter(userId, intent.action);

    return this.translator.formatResponse(coreResult, intent);
  }

  private async callCore(
    intent: Intent,
    params: unknown,
    userId: string
  ): Promise<unknown> {
    if (intent.action === 'search') {
      const endpoint = intent.mode === 'fromCurrent'
        ? '/search/saved-current'
        : '/search/target-only';
      const { data } = await this.coreClient.post(endpoint, params);
      return data;
    }

    if (intent.action === 'story') {
      const { data } = await this.coreClient.post('/story/upsert', params);
      return data;
    }

    if (intent.action === 'goal') {
      if (intent.operation === 'create') {
        const { data } = await this.coreClient.post('/goal/create', params);
        return data;
      }
      const { data } = await this.coreClient.get(`/goal/${userId}`);
      return data;
    }

    const _exhaustive: never = intent;
    throw new Error(`Unhandled intent: ${JSON.stringify(_exhaustive)}`);
  }
}
