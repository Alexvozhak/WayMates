
import { StoryInputSchema } from '../../shared/schemas.js';

import { retryWithValidation } from './helpers.js';

import type { MapperContext, MapperOptions, ValidationResult } from './types.js';
import type { z } from 'zod';

const STORY_PROMPT = `Extract career story from user narrative.

Extract array of Context objects (chronologically ordered) with:
- position (string, required)
- domains (array of strings)
- skills (array of strings)
- industry (string)
- company_size (string)
- country_code (ISO alpha-2)
- city_name (string)
- citizenships (array of ISO alpha-2)
- birth_year (number, user's birth year - same for all contexts)
- created_at (ISO 8601 timestamp when this job started)
- creation_reason (array, e.g., ["started_working"], ["promotion"], ["job_change"])

Return JSON:
{
  "user_id": "provided_user_id",
  "contexts": [ /* array of Context objects */ ],
  "trails": []
}

CRITICAL:
- Return ONLY valid JSON
- contexts must be chronologically ordered (oldest first)
- Each context must have at least: position, domains (min 1), skills (min 1), created_at, creation_reason
- Use "started_working" for first job, "job_change" for transitions`;

async function callLLM(
  ctx: MapperContext,
  userPrompt: string,
  options: MapperOptions = {}
): Promise<string> {
  const { temperature = 0.3 } = options;

  const completion = await ctx.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: ctx.systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from LLM');
  }
  return content;
}

export async function mapStoryParams(
  ctx: MapperContext,
  options: MapperOptions = {}
): Promise<ValidationResult<z.infer<typeof StoryInputSchema>>> {
  const { maxRetries = 2 } = options;

  return retryWithValidation(
    async () => {
      const prompt = `${STORY_PROMPT}\n\nUser ID: ${ctx.userId}\n\nUser story: "${ctx.query}"`;
      const response = await callLLM(ctx, prompt, options);
      return JSON.parse(response);
    },
    StoryInputSchema,
    maxRetries
  );
}
