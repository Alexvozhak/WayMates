# FEAT-052: TargetContext Missing Fields

**Component**: Goal schema, Search filters, Cypher queries
**Priority**: P1
**Status**: READY_FOR_WORK

---

## Problem

TargetContext (goal) не содержит поля которые есть в AdhocContext:
- `industry` → `industries`
- `cityName` → `cities`
- `citizenships` → `citizenships`
- `educationLevel` → `educationLevels`

Также `position` не наследуется от adhocContext (bug).

---

## Scope

**Добавить 4 поля FieldFilter + fix position inheritance:**
- `industries` — смена индустрии ("хочу в healthcare")
- `cities` — релокация ("хочу в Berlin")
- `citizenships` — visa requirements ("нужен EU passport")
- `educationLevels` — career gates ("нужен MBA")
- FIX: `position` теперь наследуется как остальные поля

**Исключены:**
- `companySize` — не нужен
- `birthYear` — не нужен

---

## Type Schema

### ADHOC_TO_TARGET_MAPPING (single source of truth)

```typescript
// src/shared/schemas.ts

export const ADHOC_TO_TARGET_MAPPING = {
  position: "position",
  role: "role",
  domains: "domains",
  skills: "skills",
  countryCode: "countries",
  languages: "languages",
  // NEW
  industry: "industries",
  cityName: "cities",
  citizenships: "citizenships",
  educationLevel: "educationLevels",
} as const;

export type MappableAdhocField = keyof typeof ADHOC_TO_TARGET_MAPPING;
```

### TargetContext schema (расширенный)

```typescript
export const targetContextSchema = z.object({
  position: fieldFilterSchema.nullable().default(null),
  role: fieldFilterSchema.nullable().default(null),
  countries: fieldFilterSchema.nullable().default(null),
  domains: fieldFilterSchema.nullable().default(null),
  skills: fieldFilterSchema.nullable().default(null),
  languages: fieldFilterSchema.nullable().default(null),
  // NEW
  industries: fieldFilterSchema.nullable().default(null),
  cities: fieldFilterSchema.nullable().default(null),
  citizenships: fieldFilterSchema.nullable().default(null),
  educationLevels: fieldFilterSchema.nullable().default(null),
});
```

### INHERITABLE_GOAL_FIELDS (все поля)

```typescript
// Выводится из mapping — все поля наследуются
export const INHERITABLE_GOAL_FIELDS = Object.values(ADHOC_TO_TARGET_MAPPING);
export type InheritableGoalField = keyof TargetContext;
```

---

## Implementation Plan

### 1. schemas.ts (~25 LOC)

- [ ] Добавить `ADHOC_TO_TARGET_MAPPING`
- [ ] Добавить `MappableAdhocField` type
- [ ] Расширить `targetContextSchema` (+4 поля)
- [ ] Обновить `INHERITABLE_GOAL_FIELDS` (вывод из mapping)
- [ ] Обновить `InheritableGoalField` type

### 2. extract-goal.ts (~15 LOC)

- [ ] Импорт `ADHOC_TO_TARGET_MAPPING`, `MappableAdhocField`
- [ ] Рефакторинг `fillFromContext` → loop по mapping
- [ ] Добавить `position` в наследование

```typescript
function fillFromContext(
  goal: TargetContext,
  ctx: AdhocContextBase | null,
): { filled: TargetContext; inherited: InheritableGoalField[] } {
  if (!ctx) return { filled: goal, inherited: [] };

  const inherited: InheritableGoalField[] = [];
  const filled = { ...goal };

  for (const adhocKey of Object.keys(ADHOC_TO_TARGET_MAPPING) as MappableAdhocField[]) {
    const targetKey = ADHOC_TO_TARGET_MAPPING[adhocKey];
    if (filled[targetKey] == null) {
      const value = ctx[adhocKey];
      if (value != null) {
        filled[targetKey] = toFilter(value);
        inherited.push(targetKey);
      }
    }
  }

  return { filled, inherited };
}
```

### 3. extraction.ts (~10 LOC)

- [ ] Добавить 4 поля в `GOAL_FIELD_DESCRIPTIONS`

```typescript
const GOAL_FIELD_DESCRIPTIONS: Record<keyof TargetContext, string> = {
  // existing...
  industries: "target business sector — KNOWN INDUSTRIES",
  cities: "target city for relocation — city names",
  citizenships: "required passports — ISO country codes",
  educationLevels: "required degree — NONE/HIGH_SCHOOL/ASSOCIATE/BACHELOR/MASTER/DOCTORATE/PROFESSIONAL",
};
```

### 4. normalizer.ts (~10 LOC)

- [ ] Добавить `industries`, `cities` в `normalizeTargetContext`
- [ ] Pass-through для `citizenships` (ISO), `educationLevels` (enum)

```typescript
async normalizeTargetContext(context: TargetContext, userId: UserId): Promise<TargetContext> {
  const [role, position, skills, domains, industries, cities] = await Promise.all([
    this.normalizeTargetField("role", context.role, userId),
    this.normalizeTargetField("position", context.position, userId),
    this.normalizeTargetField("skill", context.skills, userId),
    this.normalizeTargetField("domain", context.domains, userId),
    this.normalizeTargetField("industry", context.industries, userId),
    this.normalizeTargetField("city", context.cities, userId),
  ]);

  return {
    position, role, skills, domains, industries, cities,
    languages: context.languages ?? null,
    countries: context.countries ?? null,
    citizenships: context.citizenships ?? null,
    educationLevels: context.educationLevels ?? null,
  };
}
```

### 5. relationships.ts (~5 LOC)

- [ ] Добавить `CITIZEN_OF` в `buildOptionalMatchRelationships`

```cypher
OPTIONAL MATCH (${contextVar})-[:CITIZEN_OF]->(${prefix}Citizenship:Country)
```

### 6. search.ts (~40 LOC)

- [ ] Добавить collect для citizenships
- [ ] Добавить 4 фильтра в `buildReversePathfinderSearchQuery`

```cypher
// Industries
CASE WHEN $industries IS NULL THEN true
  WHEN $industries.mode = 'desired' THEN matchedIndustry.canonicalName IN $industries.values
  WHEN $industries.mode = 'undesired' THEN NOT matchedIndustry.canonicalName IN $industries.values
END

// Cities
CASE WHEN $cities IS NULL THEN true
  WHEN $cities.mode = 'desired' THEN matchedCity.canonicalName IN $cities.values
  WHEN $cities.mode = 'undesired' THEN NOT matchedCity.canonicalName IN $cities.values
END

// Citizenships (через CITIZEN_OF relationship)
CASE WHEN $citizenships IS NULL THEN true
  WHEN $citizenships.mode = 'desired' THEN ANY(c IN matchedCitizenships WHERE c IN $citizenships.values)
  WHEN $citizenships.mode = 'undesired' THEN NONE(c IN matchedCitizenships WHERE c IN $citizenships.values)
END

// EducationLevels (свойство Context)
CASE WHEN $educationLevels IS NULL THEN true
  WHEN $educationLevels.mode = 'desired' THEN matchedContext.educationLevel IN $educationLevels.values
  WHEN $educationLevels.mode = 'undesired' THEN NOT matchedContext.educationLevel IN $educationLevels.values
END
```

---

## Business Logic

| Поле | Семантика | Нормализация |
|------|-----------|--------------|
| `industries` | Целевая индустрия | LLM → dictionary |
| `cities` | Целевой город | LLM → dictionary |
| `citizenships` | Кандидат ИМЕЕТ гражданство | ISO codes (pass-through) |
| `educationLevels` | Точное совпадение уровня | Enum (pass-through) |

---

## Neo4j Schema

| Поле | Источник | Relationship |
|------|----------|--------------|
| `industries` | `Industry.canonicalName` | `IN_INDUSTRY` (уже есть) |
| `cities` | `City.canonicalName` | `IN_CITY` (уже есть) |
| `citizenships` | `Country.name` | `CITIZEN_OF` (добавить в helper) |
| `educationLevels` | `Context.educationLevel` | Property (не relationship) |

---

## Constraints

- [x] Backward compatible — все новые поля `.nullable().default(null)`
- [x] Migration не нужна — старые Goal работают
- [x] Type-safe — mapping проверяется через `as const`

---

## Acceptance Criteria

- [ ] Пользователь может указать в Goal: industries, cities, citizenships, educationLevels
- [ ] position наследуется от adhocContext если не указан
- [ ] Все поля наследуются через единый mapping
- [ ] Cypher фильтры работают для всех 4 новых полей
- [ ] NLP extraction корректно извлекает новые поля
- [ ] Тесты проходят (lint + tsc + integration)

---

## Files to Change

| Файл | LOC |
|------|-----|
| `src/shared/schemas.ts` | ~25 |
| `src/facade/langGraph/search-graph/nodes/extract-goal.ts` | ~15 |
| `src/facade/langGraph/search-graph/prompts/extraction.ts` | ~10 |
| `src/facade/services/normalizer.ts` | ~10 |
| `src/cypher/helpers/relationships.ts` | ~5 |
| `src/cypher/queries/search.ts` | ~40 |

**Total: ~105 LOC**

---

**Date**: 2025-12-29
**Designed by**: Claude + Alex
**Ready for**: /mvp-implement
