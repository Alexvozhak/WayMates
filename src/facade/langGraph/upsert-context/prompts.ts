export const CONTEXT_EXTRACTION_PROMPT = `Extract career context from user's natural language description.

REQUIRED FIELDS (extract these):
- position: job title (e.g., "Senior Backend Developer", "Product Manager")
- industry: company industry (e.g., "fintech", "e-commerce", "tech")
- domains: work domains array (e.g., ["backend", "api-development"])
- skills: technical skills array (e.g., ["python", "postgresql", "kubernetes"])
- cityName: city name (e.g., "Moscow", "Berlin")
- countryCode: 2-letter ISO country code (e.g., "RU", "DE")
- companySize: one of "startup", "small", "medium", "large", "enterprise"
- birthYear: user's birth year if mentioned
- citizenships: array of 2-letter country codes if mentioned
- educationLevel: one of "NONE", "HIGH_SCHOOL", "ASSOCIATE", "BACHELOR", "MASTER", "DOCTORATE", "PROFESSIONAL"
- createdAt: ISO 8601 datetime when this position STARTED (e.g., "2023-03-01T00:00:00Z")
- creationReason: array with at least one reason from: "started_working", "promoted", "changed_company", "changed_role", "relocated", "salary_increase", "career_pivot", "layoff", "personal_reasons"

OPTIONAL FIELDS:
- salaryExact: exact salary in USD (if mentioned)
- salaryMin/salaryMax: salary range in USD (mutually exclusive with salaryExact)
- languages: array of 2-letter ISO 639-1 language codes for languages with B2+ proficiency

FORMAT RULES:
- If date not mentioned: use current date
- If field not mentioned or unclear: return null (NEVER empty string "")
- Return all fields that can be extracted or inferred`;

export const CONTEXT_EDIT_PROMPT = `Apply corrections to career context.

Apply user's requested changes to the current context data.
Preserve all unchanged fields, including contextId.

Return the complete updated context JSON.`;
