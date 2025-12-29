# TargetContext missing fields from AdhocContext

**Component**: Goal schema, Search filters

**Priority**: 🟡 P1

---

## Problem

TargetContext (goal) не содержит поля которые есть в AdhocContext:
- `industry` — индустрия
- `cityName` — город
- `citizenships` — гражданства
- `educationLevel` — уровень образования

Также несоответствие naming: `countryCode` (adhoc) vs `countries` (goal).

---

## AS IS

```typescript
// AdhocContext — полный профиль
position, role, domains, skills, countryCode,
industry, companySize, cityName, citizenships, birthYear, educationLevel, languages

// TargetContext — урезанная цель
position, role, domains, skills, countries, languages
```

Пользователь не может указать в цели:
- "хочу в healthcare industry"
- "хочу в Berlin"
- "нужно EU citizenship"

---

## Open Questions

1. **Почему TargetContext урезан?** By design или упущение при создании?

2. **Какие поля добавить?**
   - industry — логично для смены индустрии
   - cityName — логично для релокации
   - citizenships — нужно ли? (visa requirements)
   - educationLevel — нужно ли? (career gates)
   - companySize — нужно ли?
   - birthYear — точно нет (дискриминация)

3. **Naming consistency:** переименовать `countries` → `countryCode` или наоборот?

4. **FieldFilter для всех?** Сейчас goal использует FieldFilter (mode + values[]). Adhoc использует простые типы. Унифицировать?

5. **Влияние на Cypher queries:** Какие query builders нужно обновить?

---

## TO BE

TBD после ответов на вопросы.

---

## Implementation Notes

**Date**: 2025-12-29
**Status**: PENDING
**Discovered during**: Bug #2 fix (showing_goal inheritance)
