
import { createGoalInputSchema } from '../../shared/schemas.js';

import { retryWithValidation } from './helpers.js';

import type { MapperContext, MapperOptions, ValidationResult } from './types.js';
import type { z } from 'zod';

const GOAL_PROMPT = `Extract career goal from user query with included/excluded logic.

Extract:
- userId (provided)
- targetPositions (object with included/excluded arrays)
- targetCountries (object with included/excluded arrays, optional)
- targetDomains (object with included/excluded arrays, optional)
- targetSkills (object with included/excluded arrays, optional)

Return JSON:
{
  "userId": "provided_user_id",
  "targetPositions": {
    "included": ["Staff Engineer", "Principal Engineer"],
    "excluded": ["Junior Engineer"]  // optional
  },
  "targetCountries": {
    "included": ["Germany", "Netherlands"],
    "excluded": ["China"]  // optional
  },  // optional
  "targetDomains": {
    "included": ["Backend", "Infrastructure"]
  },  // optional
  "targetSkills": {
    "included": ["Kubernetes", "Go"],
    "excluded": ["PHP"]  // optional
  }  // optional
}

CRITICAL: Return ONLY valid JSON, no explanations. Use 'included' for desired values, 'excluded' for unwanted values.`;

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
): Promise<ValidationResult<z.infer<typeof createGoalInputSchema>>> {
  const { maxRetries = 2 } = options;

  return retryWithValidation(
    async () => {
      const prompt = `${GOAL_PROMPT}\n\nUser ID: ${ctx.userId}\n\nUser query: "${ctx.query}"`;
      const response = await callLLM(ctx, prompt, options);
      return JSON.parse(response);
    },
    createGoalInputSchema,
    maxRetries
  );
}
