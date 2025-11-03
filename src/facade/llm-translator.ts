import type { OpenAI } from 'openai';
import { IntentSchema, type Intent, type FacadeResponse } from './types.js';
import { mapSearchParams } from './mappers/search-mapper.js';
import { mapStoryParams } from './mappers/story-mapper.js';
import { mapGoalParams } from './mappers/goal-mapper.js';

const SYSTEM_PROMPT = `You are WayMates career advisor. Your role:
1. Extract user intent from natural language queries
2. Map intent to structured parameters for career search
3. Format search results into user-friendly messages

User intent types:
- "search" (find career paths) → mode: "fromCurrent" | "toTarget"
- "story" (save career history)
- "goal" (manage career goals) → operation: "create" | "get"

Context schema structure (for reference):
- position: string (job title)
- domains: string[] (work areas)
- skills: string[] (technical skills)
- industry: string (company industry)
- company_size: string (employee count range)
- country_code: string (ISO alpha-2)
- city_name: string (city name)
- citizenships: string[] (ISO alpha-2 codes)
- birth_year: number (user's birth year)
- created_at: string (ISO 8601 timestamp)
- creation_reason: string[] (e.g., ["started_working"])

Return JSON only. No explanations.`;

export class LLMTranslator {
  constructor(
    private openai: OpenAI,
    private systemPrompt: string = SYSTEM_PROMPT
  ) {}

  async extractIntent(query: string): Promise<Intent> {
    const prompt = `Extract intent from user query: "${query}"

Return JSON in one of these formats:
- For search: {"action": "search", "mode": "fromCurrent" | "toTarget"}
- For story: {"action": "story"}
- For goal: {"action": "goal", "operation": "create" | "get"}

CRITICAL: Return ONLY valid JSON, no explanations.`;

    const response = await this.callLLM(prompt);
    const parsed = JSON.parse(response);

    return IntentSchema.parse(parsed);
  }

  async mapToParams(intent: Intent, query: string, userId: string): Promise<Record<string, unknown>> {
    const mapperContext = {
      openai: this.openai,
      userId,
      query,
      systemPrompt: this.systemPrompt,
    };

    if (intent.action === 'search') {
      const result = await mapSearchParams(mapperContext);

      if (!result.success) {
        throw new Error(`Failed to extract search params: ${result.errors.join(', ')}`);
      }

      return Object.assign({}, result.data.context, { userId });
    }

    if (intent.action === 'story') {
      const result = await mapStoryParams(mapperContext);

      if (!result.success) {
        throw new Error(`Failed to extract story params: ${result.errors.join(', ')}`);
      }

      return result.data;
    }

    if (intent.action === 'goal') {
      const result = await mapGoalParams(mapperContext);

      if (!result.success) {
        throw new Error(`Failed to extract goal params: ${result.errors.join(', ')}`);
      }

      return result.data;
    }

    throw new Error(`Unknown intent action: ${JSON.stringify(intent)}`);
  }

  async formatResponse(coreResult: unknown, intent: Intent): Promise<FacadeResponse> {
    const prompt = `Format search results for user in Russian:

Results: ${JSON.stringify(coreResult, null, 2)}
Intent: ${intent.action}

Generate a friendly, concise message (2-3 sentences) in Russian explaining:
- How many results found
- What they represent (candidates, paths, goals, etc.)
- Key insight or next step

Keep it conversational and helpful.
CRITICAL: Return ONLY the message text, no JSON, no markdown.`;

    const message = await this.callLLM(prompt);

    return {
      message: message.trim(),
      data: coreResult,
    };
  }

  private async callLLM(userMessage: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }
    return content;
  }
}
