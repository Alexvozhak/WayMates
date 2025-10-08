# 🔄 Migration Guide: Role + Grade → Position

## 📋 **Обзор изменений**

Переход от раздельных полей `role` и `grade` к единому полю `position` + добавление навигации по timeline контекстов.

## 🎯 **Основные изменения схемы**

### **1. Объединение Role + Grade → Position**

```diff
// БЫЛО:
- role: z.string().describe("Role title"),
- grade: z.enum(["Intern", "Junior", "Middle", "Senior"]),

// СТАЛО:
+ position: PositionSchema, // enum с 20+ позициями
```

**Новые позиции:**
- `"Intern"`, `"Junior"`, `"Middle"`, `"Senior"`
- `"TeamLead"`, `"TechLead"`, `"Engineering Manager"`  
- `"Project Manager"`, `"Senior Project Manager"`, `"Program Manager"`
- `"Product Manager"`, `"Engineering Director"`, `"Head of Engineering"`
- `"VP of Engineering"`, `"CTO"`, `"CEO"`

### **2. Добавление навигации по timeline**

```diff
+ previous_context_id: ContextIdSchema.optional(),
+ next_context_id: ContextIdSchema.optional(),
```

### **3. Перенос полей в контекст**

```diff
// БЫЛО в StoryInputSchema:
- birth_year: z.number().optional(),
- citizenships: z.array(z.string()),

// СТАЛО в UserContextSchema:
+ birth_year: z.number().min(1950).describe("Birth year"),
+ citizenships: z.array(z.string()),
```

### **4. Упрощение схем**

```diff
// УДАЛЕННЫЕ СХЕМЫ:
- ContextInputSchema (заменен на UserContextSchema)
- PeriodSchema, CompanyInfoSchema
- SearchModeSchema, TimePeriodSchema  
- DevelopmentAnalysisRequestSchema
- TargetSearchResultSchema

// ПЕРЕИМЕНОВАНИЯ:
- AvatarProgressionResult → AvatarResearchResult
- timePeriod → lookAheadMonths
```

### **5. Упрощение функций**

```diff
// validateSchema упрощена:
- validateSchema(data, schema, source)
+ validateSchema(data, schema)

// StoryInputSchema упрощена:
- contexts: z.array(ContextInputSchema)
+ contexts: z.array(UserContextSchema)
```

## 💥 **Что сломалось и нужно исправить**

### **🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ**

#### **1. upsert-story.ts использует старые типы**

```typescript
// ❌ СЛОМАНО:
import { type ContextInput } from "./schemas-zod.js";

function calculateNewExperience(
  currentExp: { experience: number; date: Date } | null,
  newContext: ContextInput  // ← этот тип больше не существует
): number {

async function upsertContext(
  session: Session,
  contextWithExperience: ContextInput,  // ← не существует
  story: StoryInput
): Promise<ContextId> {

// ✅ ИСПРАВИТЬ НА:
import { type UserContext } from "./schemas-zod.js";

function calculateNewExperience(
  currentExp: { experience: number; date: Date } | null,
  newContext: UserContext
): number {

async function upsertContext(
  session: Session,
  contextWithExperience: UserContext,
  story: StoryInput
): Promise<ContextId> {
```

#### **2. Поле accumulated_work_experience_months больше не в схеме**

```typescript
// ❌ СЛОМАНО в upsert-story.ts строка 126:
newContext.accumulated_work_experience_months = newAccumulatedExperience;

// ✅ ИСПРАВИТЬ: 
// Либо добавить это поле в UserContextSchema как optional,
// Либо передавать отдельно в Cypher запрос
```

#### **3. Обращения к story.birth_year и story.citizenships**

```typescript
// ❌ СЛОМАНО в upsert-story.ts строки 85-86:
original_user: {
  birth_year: story.birth_year ?? null,    // ← поля больше нет в StoryInputSchema
  citizenships: story.citizenships,        // ← поля больше нет в StoryInputSchema
}

// ✅ ИСПРАВИТЬ:
// Взять из первого контекста или обработать по-другому
original_user: {
  birth_year: story.contexts[0]?.birth_year ?? null,
  citizenships: story.contexts[0]?.citizenships ?? [],
}
```

### **🔶 СРЕДНИЕ ПРОБЛЕМЫ**

#### **4. Cypher запросы с Role/Grade узлами**

**Файлы для обновления:**
- `src/cypher/unified/blocks/find-current-contexts.cypher`
- `src/cypher/unified/blocks/find-target-for-current.cypher`  
- `src/cypher/unified/blocks/map-target-to-search-result.cypher`
- `src/cypher/blocks/load-current-context.cypher`
- `src/cypher/queries.ts`

```cypher
// ❌ СЛОМАНО:
MATCH (dbCurrentContext:Context)-[:IN_ROLE]->(dbRole:Role),
      (dbCurrentContext)-[:HAS_GRADE]->(dbGrade:Grade)
WHERE dbRole.name = requestedContext.role AND
      dbGrade.name = requestedContext.grade

// ✅ ИСПРАВИТЬ НА:
MATCH (dbCurrentContext:Context)-[:HAS_POSITION]->(dbPosition:Position)
WHERE dbPosition.name = requestedContext.position
```

#### **5. persist.ts с role_name/grade_name**

```typescript
// ❌ СЛОМАНО в persist.ts строки 102-103:
const linkParams = {
  context_id: contextId,
  role_name: contextWithExperience.role,     // ← поле больше нет
  grade_name: contextWithExperience.grade,   // ← поле больше нет
}

// ✅ ИСПРАВИТЬ НА:
const linkParams = {
  context_id: contextId,
  position_name: contextWithExperience.position,
}
```

### **🔵 МЕЛКИЕ ПРОБЛЕМЫ**

#### **6. Анализ переходов role_changed/grade_changed**

```typescript
// ❌ ТРЕБУЕТ ОБНОВЛЕНИЯ логики:
"role_changed", "grade_changed" → "position_changed"

// В NewContextReasonSchema можно:
// А) Оставить оба для обратной совместимости  
// Б) Добавить "position_changed" и deprecated старые
```

#### **7. Тесты используют старые схемы**

**Файлы для проверки:**
- `tests/unit/trailValidation.test.ts`
- `tests/integration/unifiedSearchRouter.test.ts`
- Все тесты с `role`/`grade` полями

## 🔧 **План миграции (пошагово)**

### **Шаг 1: Исправить upsert-story.ts**
```bash
# Заменить ContextInput → UserContext
# Исправить обращения к story.birth_year/citizenships  
# Обработать accumulated_work_experience_months
```

### **Шаг 2: Обновить Cypher запросы**
```bash
# Заменить Role/Grade ноды на Position ноды
# Обновить LINK_REFS_CYPHER в queries.ts
# Обновить все unified блоки
```

### **Шаг 3: Исправить persist.ts**
```bash
# Заменить role_name/grade_name на position_name
# Обновить логику работы с контекстами
```

### **Шаг 4: Обновить тесты**
```bash
# Заменить все role/grade на position в тестах
# Обновить моки и фикстуры
# Обновить expected результаты
```

### **Шаг 5: Обновить данные в БД (если есть)**
```cypher
# Скрипт миграции:
MATCH (c:Context)-[:IN_ROLE]->(r:Role), (c)-[:HAS_GRADE]->(g:Grade)
MERGE (p:Position {name: g.name + " " + r.name})
MERGE (c)-[:HAS_POSITION]->(p)
```

## ✅ **Чеклист проверки**

- [ ] `upsert-story.ts` компилируется без ошибок
- [ ] `persist.ts` обновлен на новые поля
- [ ] Все Cypher запросы используют Position вместо Role/Grade  
- [ ] Тесты проходят с новыми схемами
- [ ] MCP server работает с новыми типами
- [ ] Данные в БД мигрированы (если есть существующие)

## 🎯 **Результат после миграции**

✅ **Единообразная схема позиций** вместо путаницы role/grade  
✅ **Timeline навигация** через previous/next контексты  
✅ **Упрощенная архитектура** без дублирующих схем  
✅ **Консистентные данные** birth_year/citizenships в контексте  
✅ **Все тесты проходят** 🎉




