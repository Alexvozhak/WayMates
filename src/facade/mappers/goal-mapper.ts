import { z } from 'zod';
import { CreateGoalInputSchema } from '../../shared/schemas.js';
import type { MapperContext, ValidationResult, MapperOptions } from './types.js';
import { retryWithValidation } from './helpers.js';

const GOAL_PROMPT = `Extract career goal from user query.

Extract:
- userId (provided)
- targetContextId (Context ID of target position - will be found/created later)
- targetPosition (string, target position title)
- targetSkills (array of strings, optional - skills user wants to acquire)
- deadline (ISO 8601 date, optional)

Return JSON:
{
  "userId": "provided_user_id",
  "targetPosition": "extracted position",
  "targetSkills": ["skill1", "skill2"],  // optional
  "deadline": "2025-12-31T00:00:00.000Z"  // optional
}

CRITICAL: Return ONLY valid JSON, no explanations.`;

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

export async function mapGoalParams(
  ctx: MapperContext,
  options: MapperOptions = {}
): Promise<ValidationResult<z.infer<typeof CreateGoalInputSchema>>> {
  const { maxRetries = 2 } = options;

  return retryWithValidation(
    async () => {
      const prompt = `${GOAL_PROMPT}\n\nUser ID: ${ctx.userId}\n\nUser query: "${ctx.query}"`;
      const response = await callLLM(ctx, prompt, options);
      return JSON.parse(response);
    },
    CreateGoalInputSchema,
    maxRetries
  );
}
