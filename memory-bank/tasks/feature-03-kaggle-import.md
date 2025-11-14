# Feature #3: Import Kaggle Synthetic Dataset

**Status**: TODO
**Priority**: 🔴 P0 (Critical)
**Component**: Admin CLI, Core schemas, LLM enrichment
**Date**: 2025-11-12

---

## 📋 Summary

Import 297 high-context IT professionals from Kaggle dataset (12.73 contexts/person avg, 3,780 total contexts) into Neo4j for WayMates MVP cold start.

**Key Decision**: CLI script in `src/admin/` using OpenAI for enrichment, calling `StoryManager.upsertStory()` for persistence.

---

## 🏗️ Architecture

### Directory Structure

```
src/core/
├── schemas.ts                  # Add SyntheticContextInput (optional fields)
└── admin/
    ├── import-kaggle.ts        # CLI entrypoint (npx tsx src/admin/import-kaggle.ts)
    └── services/
        ├── llm-enrichment.ts   # OpenAI inference (domains, creationReasons)
        ├── kaggle-loader.ts    # CSV reading + transformation
        └── location-parser.ts  # Location string → country/city
```

### Why `src/admin/` not `scripts/`?

- ✅ Part of core logic (uses `StoryManager`, core schemas)
- ✅ Will be compiled with `npm run build` (TypeScript)
- ✅ Can import from `src/core/` without relative paths
- ✅ Cleanly separated admin functionality

---

## 📊 Data Flow

```
┌──────────────────────────────────────┐
│ 1. Read Kaggle CSV                   │
├──────────────────────────────────────┤
│ kaggle-high-context-candidates.txt   │ (297 person IDs)
│ ├─ 04_experience.csv                 │ (title, location, dates)
│ └─ 05_person_skills.csv              │ (skills)
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 2. Transform + Validate              │
├──────────────────────────────────────┤
│ • Join by person_id                  │
│ • Sort by start_date ASC             │
│ • Generate UUIDs (usr_, ctx_)        │
│ • Parse dates → ISO 8601             │
│ • Link NEXT/PREVIOUS contexts        │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 3. LLM Enrichment (OpenAI)           │
├──────────────────────────────────────┤
│ For each job:                        │
│ • title → domains[] (inference)      │
│ • compare contexts → creationReason[]│
│ • First job → ["started_working"]    │
│ • Default industry = "Technology"    │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 4. Parse Location                    │
├──────────────────────────────────────┤
│ "San Francisco, CA" → US + SF        │
│ "London, UK" → GB + London           │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 5. Validate SyntheticStoryInput      │
├──────────────────────────────────────┤
│ Zod schema validation                │
│ Optional fields: companySize, etc.   │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 6. Import to Neo4j                   │
├──────────────────────────────────────┤
│ Call: StoryManager.upsertStory()     │
│ Labels: :User:Synthetic              │
│         :Context:Synthetic           │
└──────────────────────────────────────┘
```

---

## 🗂️ Schemas & Types

### SyntheticContextInput (in `src/core/schemas.ts`)

```typescript
import { userContextSchema } from '../shared/schemas.js';

/**
 * Synthetic context input for Kaggle import
 * Extends UserContext with optional fields for missing data
 */
export const syntheticContextInputSchema = userContextSchema.extend({
  // Override required → optional for fields without data in Kaggle
  companySize: z.string().optional(),           // No data
  citizenships: z.array(z.string()).optional(), // No data
  birthYear: z.number().min(1950).optional(),   // No data

  // Future features (not filled yet, but schema-ready)
  salaryMin: z.number().optional(),             // Feature #1
  salaryMax: z.number().optional(),             // Feature #1
  educationLevel: z.string().optional(),        // Feature #2
});

export type SyntheticContextInput = z.infer<typeof syntheticContextInputSchema>;

/**
 * Synthetic story input for batch import
 */
export const syntheticStoryInputSchema = z.object({
  userId: userIdSchema,
  contexts: z.array(syntheticContextInputSchema).min(1),
  trails: z.array(trailSchema).default([]),  // Always empty for synthetic
});

export type SyntheticStoryInput = z.infer<typeof syntheticStoryInputSchema>;
```

### Import CLI Parameters

```typescript
interface ImportOptions {
  /** Person IDs to import (default: all 297 from file) */
  candidateIds?: string[];

  /** Number of candidates to import (for testing) */
  limit?: number;

  /** Enrichment mode */
  mode: 'llm' | 'simple';  // llm = OpenAI, simple = rule-based

  /** Batch size for processing */
  batchSize: number;  // default: 10
}
```

### Kaggle Data Types

```typescript
// Raw Kaggle CSV row
interface KaggleExperience {
  person_id: string;
  title: string;
  firm: string;       // Company name (not stored - privacy)
  start_date: string; // "2018-06"
  end_date: string;   // "2020-03" or "Present"
  location: string;   // "San Francisco, CA"
}

interface KaggleSkill {
  person_id: string;
  skill: string;      // "Python", "React", etc.
}

// Transformed candidate
interface KaggleCandidate {
  personId: string;
  jobs: KaggleExperience[];
  skills: string[];
}
```

---

## 🔄 Field Mapping: Kaggle → WayMates

| Kaggle Field | WayMates Field | Status | Transformation |
|--------------|----------------|--------|----------------|
| `person_id` | `userId` | 🟡 Generate | UUID v7: `usr_{uuid}` |
| `person_id` + index | `contextId` | 🟡 Generate | UUID v7: `ctx_{uuid}` per job |
| — | `previousContextId` | 🟡 Calculate | Link to prev context (chronological) |
| — | `nextContextId` | 🟡 Calculate | Link to next context |
| `start_date` | `createdAt` | 🟡 Parse | "2018-06" → "2018-06-01T00:00:00Z" |
| — | `creationReason` | 🟢 **LLM inference** | First = `["started_working"]`, rest = compare |
| `title` | `position` | ✅ Direct | Trim + validate |
| — | `domains` | 🟢 **LLM inference** | "Backend Engineer" → ["Backend"] |
| `skill` (from 05_*.csv) | `skills` | ✅ Join | Aggregate by person_id |
| — | `industry` | ✅ Default | "Technology" for all IT |
| `location` | `countryCode` + `cityName` | 🟡 Parse | "San Francisco, CA" → "US", "San Francisco" |
| — | `companySize` | ⚠️ Optional | `undefined` (no data) |
| — | `citizenships` | ⚠️ Optional | `undefined` (no data) |
| — | `birthYear` | ⚠️ Optional | `undefined` (no data) |
| — | `salaryMin/Max` | ⚠️ Optional | `undefined` (Feature #1) |
| — | `educationLevel` | ⚠️ Optional | `undefined` (Feature #2) |

**Legend**:
- ✅ Direct mapping (no transformation)
- 🟡 Requires parsing/generation
- 🟢 Requires LLM inference
- ⚠️ Optional (missing data in Kaggle)

---

## 🤖 LLM Enrichment

### 1. Domains Inference

**Input**: Job title
**Output**: Domain tags (Backend, Frontend, Mobile, etc.)

**Prompt**:
```typescript
const DOMAINS_PROMPT = `
Job title: "{title}"

Identify which technical domains this role involves. Choose all applicable from:
- Backend
- Frontend
- Mobile
- DevOps
- Database
- Data Science
- Security
- QA
- Design
- Product

Return ONLY a JSON array of domain names, no explanation.
Example: ["Backend", "Database"]
`;
```

**OpenAI Call**:
```typescript
async function inferDomains(title: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: DOMAINS_PROMPT.replace('{title}', title) }],
    temperature: 0.3,  // Low temp for consistency
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content);
  return result.domains || [];
}
```

**Fallback (rule-based mode)**:
```typescript
const DOMAIN_RULES: Record<string, string[]> = {
  'backend': ['Backend'],
  'frontend': ['Frontend'],
  'fullstack': ['Frontend', 'Backend'],
  'full stack': ['Frontend', 'Backend'],
  'devops': ['DevOps'],
  'data scientist': ['Data Science'],
  'data engineer': ['Data Science', 'Database'],
  'mobile': ['Mobile'],
  'ios': ['Mobile'],
  'android': ['Mobile'],
  'qa': ['QA'],
  'test': ['QA'],
  'security': ['Security'],
  'database': ['Database'],
  'dba': ['Database'],
};

function inferDomainsSimple(title: string): string[] {
  const lower = title.toLowerCase();
  for (const [keyword, domains] of Object.entries(DOMAIN_RULES)) {
    if (lower.includes(keyword)) return domains;
  }
  return ['Backend'];  // Default for unclear titles
}
```

### 2. Creation Reason Inference

**Input**: Current job + Previous job
**Output**: Reason tags (position_changed, location_changed, etc.)

**Prompt**:
```typescript
const REASONS_PROMPT = `
Previous job:
- Position: "{prev_position}"
- Location: "{prev_location}"
- Company: "{prev_company}"

Current job:
- Position: "{curr_position}"
- Location: "{curr_location}"
- Company: "{curr_company}"

What changed between these jobs? Choose all applicable reasons:
- position_changed (if role/title changed)
- location_changed (if city/country changed)
- company_changed (if company changed)

Return ONLY a JSON array of reason IDs, no explanation.
Example: ["position_changed", "company_changed"]
`;
```

**OpenAI Call**:
```typescript
async function detectReasons(prev: Job, curr: Job): Promise<string[]> {
  const prompt = REASONS_PROMPT
    .replace('{prev_position}', prev.title)
    .replace('{curr_position}', curr.title)
    .replace('{prev_location}', prev.location)
    .replace('{curr_location}', curr.location)
    .replace('{prev_company}', prev.firm)
    .replace('{curr_company}', curr.firm);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,  // Very low temp for accuracy
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content);
  return result.reasons || [];
}
```

**Fallback (simple comparison)**:
```typescript
function detectReasonsSimple(prev: Job, curr: Job): string[] {
  const reasons: string[] = [];

  if (prev.title !== curr.title) reasons.push('position_changed');
  if (prev.location !== curr.location) reasons.push('location_changed');
  if (prev.firm !== curr.firm) reasons.push('company_changed');

  return reasons.length > 0 ? reasons : ['company_changed'];  // Default
}
```

### Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      const delay = Math.pow(2, attempt) * 1000;  // Exponential backoff
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry failed');
}

// Usage
const domains = await withRetry(() => inferDomains(job.title));
```

---

## 🌍 Location Parser

**Challenge**: Kaggle locations are inconsistent:
- "San Francisco, CA"
- "New York, NY"
- "London, UK"
- "Berlin, Germany"
- "Remote"

**Strategy**: Rule-based parser (no LLM - simple and fast)

```typescript
interface ParsedLocation {
  countryCode: string;
  cityName: string;
}

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]);

const COUNTRY_CODES: Record<string, string> = {
  'UK': 'GB',
  'United Kingdom': 'GB',
  'USA': 'US',
  'United States': 'US',
  'Germany': 'DE',
  'France': 'FR',
  'Canada': 'CA',
  'India': 'IN',
  'China': 'CN',
  'Japan': 'JP',
  // ... add more as needed
};

function parseLocation(location: string): ParsedLocation {
  // Handle "Remote"
  if (location.toLowerCase().includes('remote')) {
    return { countryCode: 'REMOTE', cityName: 'Remote' };
  }

  // Parse "City, State" or "City, Country"
  const parts = location.split(',').map(s => s.trim());

  if (parts.length === 2) {
    const [city, regionOrCountry] = parts;

    // Check if US state code
    if (US_STATES.has(regionOrCountry)) {
      return { countryCode: 'US', cityName: city };
    }

    // Check if known country
    const countryCode = COUNTRY_CODES[regionOrCountry] || regionOrCountry;
    return { countryCode, cityName: city };
  }

  // Fallback: unknown format
  return { countryCode: 'UNKNOWN', cityName: location };
}
```

---

## 📝 CLI Implementation

### Entrypoint (`src/admin/import-kaggle.ts`)

```typescript
import { Command } from 'commander';
import { importKaggleDataset } from './services/kaggle-loader.js';

const program = new Command();

program
  .name('import-kaggle')
  .description('Import Kaggle synthetic dataset to Neo4j')
  .option('--limit <number>', 'Number of candidates to import', parseInt)
  .option('--mode <mode>', 'Enrichment mode: llm|simple', 'llm')
  .option('--batch-size <number>', 'Processing batch size', parseInt, 10)
  .parse();

const options = program.opts();

console.log('🚀 Starting Kaggle import...');
console.log(`Mode: ${options.mode}`);
console.log(`Batch size: ${options.batchSize}`);
if (options.limit) console.log(`Limit: ${options.limit} candidates`);

await importKaggleDataset({
  limit: options.limit,
  mode: options.mode as 'llm' | 'simple',
  batchSize: options.batchSize
});

console.log('✅ Import complete!');
```

### Usage Examples

```bash
# Build first
npm run build

# Import all 297 (production)
npx tsx src/admin/import-kaggle.ts --mode=llm

# Test with 10 candidates
npx tsx src/admin/import-kaggle.ts --limit=10 --mode=llm

# Fast import without LLM (for testing)
npx tsx src/admin/import-kaggle.ts --limit=10 --mode=simple --batch-size=20
```

---

## ⚠️ Error Handling

### Strategy

1. **Per-candidate errors**: Skip failed, continue import
2. **LLM errors**: Retry 3x with backoff, fallback to simple mode
3. **Validation errors**: Log details, skip candidate
4. **Fatal errors**: Stop import, report progress

### Implementation

```typescript
async function importKaggleDataset(options: ImportOptions) {
  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    errors: [] as Array<{ personId: string; error: string }>
  };

  const candidates = loadCandidates(options);
  stats.total = candidates.length;

  for (const candidate of candidates) {
    try {
      await importCandidate(candidate, options.mode);
      stats.success++;
      console.log(`✅ Imported ${candidate.personId} (${stats.success}/${stats.total})`);
    } catch (error) {
      stats.failed++;
      stats.errors.push({
        personId: candidate.personId,
        error: error.message
      });
      console.error(`❌ Failed ${candidate.personId}: ${error.message}`);
    }
  }

  // Final report
  console.log('\n📊 Import Summary:');
  console.log(`Total: ${stats.total}`);
  console.log(`Success: ${stats.success} (${(stats.success/stats.total*100).toFixed(1)}%)`);
  console.log(`Failed: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(e => console.log(`  ${e.personId}: ${e.error}`));
  }
}
```

---

## 🧪 Testing Strategy

### Manual Testing

```bash
# 1. Test with 1 candidate (minimal)
npx tsx src/admin/import-kaggle.ts --limit=1 --mode=simple

# 2. Check Neo4j
cypher-shell -u neo4j -p testpassword123 -d neo4j
MATCH (u:User:Synthetic) RETURN count(u);
MATCH (c:Context:Synthetic) RETURN count(c);

# 3. Test LLM enrichment (10 candidates)
npx tsx src/admin/import-kaggle.ts --limit=10 --mode=llm

# 4. Verify domains inference
MATCH (c:Context:Synthetic)-[:HAS_DOMAIN]->(d:Domain)
RETURN c.context_id, collect(d.name) AS domains
LIMIT 5;

# 5. Full import (297 candidates)
npx tsx src/admin/import-kaggle.ts --mode=llm
```

### Validation Queries

```cypher
// 1. Check synthetic labels
MATCH (u:Synthetic) RETURN labels(u), count(*);

// 2. Verify context links
MATCH (c1:Context:Synthetic)-[:NEXT]->(c2:Context:Synthetic)
RETURN count(*);

// 3. Check started_working
MATCH (c:Context:Synthetic)
WHERE 'started_working' IN c.creation_reason
RETURN count(*);
// Expected: 297 (one per user)

// 4. Average contexts per user
MATCH (u:User:Synthetic)-[:HAS_CONTEXT]->(c:Context)
RETURN avg(count(c));
// Expected: ~12.73
```

---

## 📦 Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "openai": "^4.77.0",
    "csv-parse": "^5.5.3",
    "commander": "^12.0.0"
  }
}
```

Install:
```bash
npm install openai csv-parse commander
```

---

## 🔐 Environment Variables

Required in `.env`:

```bash
# OpenAI API Key (for LLM enrichment)
OPENAI_API_KEY=sk-...

# Neo4j connection (already exists)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j
```

---

## 📈 Expected Performance

| Metric | Value | Notes |
|--------|-------|-------|
| Total candidates | 297 | High-context subset |
| Total contexts | ~3,780 | 12.73 avg/person |
| LLM calls | ~7,560 | 2 per context (domains + reasons) |
| Processing time | ~45-60 min | With rate limits |
| Cost | ~$5-10 | gpt-4o-mini pricing |
| Neo4j import | <5 min | Batch upserts via StoryManager |

**Rate Limits** (OpenAI Tier 1):
- gpt-4o-mini: 3,000 RPM
- Need ~126 requests/min for 60min completion
- Well within limits (no throttling needed)

---

## 🚀 Next Steps

1. ✅ Add `SyntheticContextInput` schema to `src/core/schemas.ts`
2. ✅ Create `src/admin/` structure (import-kaggle.ts + services/)
3. ✅ Implement LLM enrichment service (OpenAI)
4. ✅ Implement location parser
5. ✅ Implement Kaggle loader (CSV reading + join)
6. ✅ Add CLI with commander
7. ✅ Test with --limit=10 candidates
8. ✅ Full import (297 candidates)
9. ✅ Validate in Neo4j (queries above)
10. ✅ Document usage in main README

---

**Last updated**: 2025-11-12
**Feature**: #3 - Import Kaggle synthetic dataset
**Status**: TODO (ready for implementation)
