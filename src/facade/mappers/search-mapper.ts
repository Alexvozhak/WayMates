import { z } from 'zod';
import { UserContextSchema } from '../../shared/schemas.js';
import type { MapperContext, ValidationResult, MapperOptions } from './types.js';
import { retryWithValidation } from './helpers.js';

const SEARCH_PROMPT = `Extract search parameters from user query.

Extract Context fields (only those mentioned in query):
- position (string, e.g., "Middle Python Developer")
- domains (array, e.g., ["Backend", "API"])
- skills (array, e.g., ["Python", "FastAPI", "PostgreSQL"])
- industry (string, e.g., "IT")
- company_size (string, e.g., "51-200")
- country_code (ISO alpha-2, e.g., "RU")
- city_name (string, e.g., "Moscow")
- citizenships (array of ISO alpha-2, e.g., ["RU"])
- birth_year (number, e.g., 1995)

Return JSON:
{
  "context": { /* only extracted fields */ }
}

If field not mentioned in query, OMIT it from response.
CRITICAL: Return ONLY valid JSON, no explanations.`;

const SearchParamsSchema = z.object({
  context: UserContextSchema.partial().required({ position: true }),
});

type SearchParams = z.infer<typeof SearchParamsSchema>;

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

export async function mapSearchParams(
  ctx: MapperContext,
  options: MapperOptions = {}
): Promise<ValidationResult<SearchParams>> {
  const { maxRetries = 2 } = options;

  return retryWithValidation(
    async () => {
      const prompt = `${SEARCH_PROMPT}\n\nUser query: "${ctx.query}"`;
      const response = await callLLM(ctx, prompt, options);
      return JSON.parse(response);
    },
    SearchParamsSchema,
    maxRetries
  );
}
