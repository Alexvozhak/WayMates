# План импорта Kaggle данных (FEAT-003)

**Дата**: 2025-12-17
**Статус**: READY FOR IMPLEMENTATION
**Цель**: Импорт 297 IT траекторий для решения проблемы холодного старта

---

## ✅ Принятые решения

### Архитектура
- **Entry Point**: Core StoryManager (direct call) — Вариант 2
- **Скрипт локация**: `scripts/` (останется в приватном Core repo после split)
- **Pattern**: `tests/core/helpers/import-stories.ts`

### Enrichment стратегия (БЕЗ LLM)

| Поле | Метод | Coverage | Статус |
|------|-------|----------|--------|
| domains | Keyword matching (title + skills) | 95%+ | ✅ Детерминированный |
| industry | Static JSON (company → industry) | 90% | ✅ Создаёт user |
| companySize | Static JSON (company → size) | 85% | ✅ Optional field |
| countryCode, cityName | Regex parsing location | 83% | ✅ Skip 17% без location |
| birthYear | N/A | N/A | ✅ Optional field |
| citizenships | Infer from location | 100% | ✅ US state → ["US"], else [] |
| creationReason | Программный inference | 100% | ✅ Diff analysis |

### Schema изменения

```typescript
// src/shared/schemas.ts

// BEFORE:
companySize: z.string().describe("Company size"),
birthYear: z.number().min(1950).describe("Birth year"),

// AFTER:
companySize: z.string().optional().describe("Company size (optional for synthetic users)"),
birthYear: z.number().min(1950).optional().describe("Birth year (optional for synthetic users)"),
```

**Cypher impact**: ✅ Оба поля только в strict filters — optional безопасно

---

## 📁 Структура данных

### Input (Kaggle CSV)
```
/home/alex/Downloads/kaggle/
├── 01_people.csv         # person_id, name (дубликат title)
├── 04_experience.csv     # person_id, title, firm, start_date, end_date, location
├── 05_person_skills.csv  # person_id, skill (many-to-many)
└── 06_skills.csv         # skill dictionary (unused, direct join 05_)
```

### Intermediate (Enriched JSON)
```json
// data/kaggle-enriched.json
[
  {
    "personId": "1214",
    "contexts": [
      {
        "position": "Database Administrator",
        "domains": ["Backend", "Data"],
        "skills": ["SQL", "Database", "Ms sql server"],
        "industry": "Finance",
        "companySize": "enterprise",
        "countryCode": "US",
        "cityName": "Roswell",
        "citizenships": ["US"],
        "createdAt": "2017-04-01T00:00:00Z",
        "creationReason": ["started_working"]
      }
    ]
  }
]
```

### Output (Neo4j)
```typescript
// StoryInput для каждого кандидата
{
  userId: "usr_<uuid>",  // generated
  contexts: [UserContext, ...],
  trails: []  // empty for Kaggle
}
```

---

## 🔧 Enrichment логика

### 1. domains — Keyword Matching

```typescript
const domainKeywords = {
  "Backend": ["backend", "server", "api", "database", "dba", "sql"],
  "Frontend": ["frontend", "ui", "ux", "react", "angular", "vue"],
  "Mobile": ["mobile", "android", "ios", "swift", "kotlin"],
  "DevOps": ["devops", "infrastructure", "kubernetes", "docker"],
  "Data": ["data scientist", "ml", "machine learning", "ai"],
  "Security": ["security", "cybersecurity", "infosec"],
  "QA": ["qa", "test", "quality assurance"],
};

function inferDomains(title: string, skills: string[]): string[] {
  const text = `${title} ${skills.join(" ")}`.toLowerCase();
  return Object.entries(domainKeywords)
    .filter(([_, keywords]) => keywords.some(kw => text.includes(kw)))
    .map(([domain, _]) => domain);
}
```

**Coverage**: 95%+ (протестировано на 5 примерах)

---

### 2. industry + companySize — Static JSON

```typescript
// data/company-enrichment.json (создаёт user из Fortune 500)
{
  "Bank of America": { "industry": "Finance", "size": "enterprise" },
  "Wells Fargo": { "industry": "Finance", "size": "enterprise" },
  "Google": { "industry": "Technology", "size": "enterprise" },
  "IBM": { "industry": "Technology", "size": "large" },
  // ... ~100 top companies
}

function enrichCompany(firmName: string) {
  const normalized = firmName.toLowerCase().trim();
  const company = KNOWN_COMPANIES[normalized];

  if (company) {
    return { industry: company.industry, size: company.size };
  }

  // Fallback: keyword matching
  if (firmName.includes("Tech") || firmName.includes("Software")) {
    return { industry: "Technology", size: null };
  }

  return { industry: null, size: null };
}
```

**Coverage**:
- industry: ~90% (топ 100 компаний + keyword fallback)
- companySize: ~85% (топ 100 компаний, остальные null)

**Топ компании в selected 297**:
- Finance: Bank of America, Wells Fargo, Goldman Sachs, CIBC, PNC Bank, TIAA
- Tech: IBM, Cisco, Google, Adobe, Nike, Uber, Pinterest
- Telecom: AT&T, Verizon
- Industry: General Electric, Duke Energy, Cargill

---

### 3. location — Regex Parsing

```typescript
function parseLocation(location: string) {
  if (!location) return null; // Skip 17% без location

  const parts = location.split(",").map(s => s.trim());

  if (parts.length === 2) {
    const cityName = parts[0];
    const region = parts[1];

    // US states
    const US_STATES = ["CA", "NY", "TX", "FL", "MD", "VA", "WA", "GA", ...];
    if (US_STATES.includes(region)) {
      return { countryCode: "US", cityName };
    }

    // Indian states
    const INDIAN_STATES = ["Telangana", "Karnataka", "Maharashtra", ...];
    if (INDIAN_STATES.includes(region)) {
      return { countryCode: "IN", cityName };
    }

    // Country mapping
    const COUNTRY_CODES = {
      "Ecuador": "EC", "Nigeria": "NG", "Germany": "DE", ...
    };

    return {
      countryCode: COUNTRY_CODES[region] ?? null,
      cityName
    };
  }

  return null;
}
```

**Coverage**: 83% (17% missing location — скипаем кандидатов)

---

### 4. citizenships — Infer from location

```typescript
function inferCitizenships(countryCode: string | null): string[] {
  return countryCode ? [countryCode] : [];
}
```

**Coverage**: 100% (empty array допустим по схеме)

---

### 5. creationReason — Программный inference

```typescript
function inferCreationReason(
  prevContext: Context | null,
  currContext: Context
): NewContextReason[] {
  if (!prevContext) {
    return ["started_working"];
  }

  const reasons: NewContextReason[] = [];

  // Company change
  if (prevContext.firm !== currContext.firm) {
    reasons.push("company_changed");
  }

  // Position change (same company)
  if (prevContext.firm === currContext.firm &&
      prevContext.title !== currContext.title) {
    reasons.push("position_changed");
  }

  // Location change
  if (prevContext.location !== currContext.location) {
    reasons.push("location_changed");
  }

  // Default fallback
  return reasons.length > 0 ? reasons : ["company_changed"];
}
```

**Coverage**: 100% (детерминированный алгоритм)

---

### 6. Quality Gate

```typescript
function passesQualityGate(context) {
  return context.skills.length >= 3 &&
         context.domains.length >= 1 &&
         context.countryCode !== null &&
         context.industry !== null;
}

// Import только те, кто прошёл
const toImport = enrichedData
  .map(person => ({
    ...person,
    contexts: person.contexts.filter(passesQualityGate)
  }))
  .filter(person => person.contexts.length >= 3); // Min 3 contexts
```

**Ожидаемый результат**:
- Из 297 кандидатов × 12.73 контекста = 3,780 контекстов
- После quality gate: ~75-80% прохождение
- Итого: **~2,500-3,000 contexts для импорта**

---

## 📋 План реализации (5 шагов)

### Шаг 1: Schema update (~5 мин)

**Файл**: `src/shared/schemas.ts`

```diff
- companySize: z.string().describe("Company size"),
+ companySize: z.string().optional().describe("Company size (optional for synthetic users)"),

- birthYear: z.number().min(1950).describe("Birth year"),
+ birthYear: z.number().min(1950).optional().describe("Birth year (optional for synthetic users)"),
```

**Проверить**:
```bash
npm run lint:fix
npx tsc --noEmit
```

---

### Шаг 2: company-enrichment.json (~30 мин, делает user)

**Файл**: `data/company-enrichment.json`

**Источники**:
- `/tmp/selected-top-companies.json` (топ 100 из отобранных 297)
- Fortune 500 2025 (скачать CSV)
- Вручную добавить IT компании (Google, Microsoft, Amazon, etc.)

**Формат**:
```json
{
  "Bank of America": {
    "industry": "Finance",
    "size": "enterprise"
  },
  "Google": {
    "industry": "Technology",
    "size": "enterprise"
  }
}
```

**Валидация**:
- Проверить что покрывает топ 100 из `/tmp/selected-top-companies.json`
- Добавить нормализацию (lowercase, trim)

---

### Шаг 3: Enrichment script (~1-2 часа)

**Файл**: `scripts/enrich-kaggle.ts`

**Структура**:
```typescript
// 1. Load selected candidates (297 IDs from /tmp/kaggle-candidates.txt)
// 2. Load CSV files (experience + person_skills)
// 3. For each candidate:
//    - Group experiences by person_id
//    - Join skills from person_skills
//    - For each experience:
//      a) inferDomains(title, skills) → domains
//      b) enrichCompany(firm) → industry, size
//      c) parseLocation(location) → countryCode, cityName
//      d) inferCitizenships(countryCode) → citizenships
//      e) inferCreationReason(prev, curr) → creationReason
//      f) Quality gate check
// 4. Save to data/kaggle-enriched.json
```

**Тестирование**:
- Запустить на 10 кандидатах
- Вручную проверить результат
- Проверить quality gate pass rate

---

### Шаг 4: Import script (~30 мин)

**Файл**: `scripts/import-kaggle.ts`

**Реализация**:
```typescript
import { withDriver } from "../src/core/neo4j.js";
import { DatabaseContext } from "../src/core/database-context.js";
import { StoryManager } from "../src/core/story-manager.js";
import { uuidv7 } from "uuidv7";
import enrichedData from "../data/kaggle-enriched.json" with { type: "json" };

await withDriver(async (driver) => {
  const db = new DatabaseContext(driver);
  const storyManager = new StoryManager(db);

  for (const person of enrichedData) {
    const userId = `usr_${uuidv7()}`;

    // Add contextId, userId, linkedList structure
    const contexts = addContextMetadata(person.contexts);

    const story = {
      userId,
      contexts,
      trails: []
    };

    console.log(`[Import] ${userId}, contexts: ${contexts.length}`);
    await storyManager.upsertStory(story);
  }
});
```

**Pattern**: Копипаста из `tests/core/helpers/import-stories.ts`

---

### Шаг 5: Execution + QA (~30 мин)

```bash
# 1. Schema update
npm run lint:fix
npx tsc --noEmit

# 2. Enrichment
npx tsx scripts/enrich-kaggle.ts

# 3. Review результат
cat data/kaggle-enriched.json | jq '.stats'

# 4. Import
npx tsx scripts/import-kaggle.ts

# 5. Verification
# MATCH (u:User:Synthetic) RETURN count(u);
# MATCH (u:User:Synthetic)-[:HAS_CONTEXT]->(c:Context) RETURN count(c);
```

---

## 📊 Оценка времени

| Задача | Время |
|--------|-------|
| Шаг 1: Schema update | 5 мин |
| Шаг 2: company-enrichment.json (user) | 30 мин |
| Шаг 3: enrich-kaggle.ts | 1-2 часа |
| Шаг 4: import-kaggle.ts | 30 мин |
| Шаг 5: Execution + QA | 30 мин |
| **TOTAL** | **3-4 часа** |

---

## 📁 Артефакты

**Созданные файлы**:
- `/tmp/kaggle-top-companies.json` — топ 100 компаний всего датасета
- `/tmp/selected-top-companies.json` — топ 100 компаний отобранных 297
- `/tmp/kaggle-candidates.txt` — 297 person_id
- `/tmp/test_domain_inference.ts` — тест keyword matching

**Git commits для reference**:
- `9e9ed33` — Kaggle analysis + candidate selection (297 IDs)
- `706a9e6` — Cleanup (scripts удалены)

**Документация**:
- `docs/TZ_COLD_START_KAGGLE_IMPORT.md` — исходный план (частично устарел)
- `tasks/features/FEAT-003-kaggle-import.md` — feature spec

---

## ✅ Готовность к реализации

**Статус**: 🟢 READY

**Блокеры**: НЕТ

**Зависимости**:
- ✅ Kaggle CSV данные скачаны (`/home/alex/Downloads/kaggle/`)
- ✅ Candidate IDs восстановлены (commit 9e9ed33)
- ✅ Архитектурное решение принято (StoryManager)
- ✅ Enrichment strategy определена (keywords + static JSON + regex)
- ✅ Schema изменения согласованы (companySize, birthYear → optional)

**Следующая сессия**: Можно сразу начинать с Шага 1 (Schema update)

---

**End of Plan**
