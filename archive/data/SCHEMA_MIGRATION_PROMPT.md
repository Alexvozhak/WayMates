# 🤖 ПРОМПТ ДЛЯ ИИ: Миграция схемы role+grade → position

## 🎯 **ЗАДАЧА**
Перевести проект WayMates на новую схему данных. Основное изменение: объединить раздельные поля `role` и `grade` в единое поле `position` + исправить все связанные поломки.

## 📋 **ЧТО НУЖНО СДЕЛАТЬ**

### **ЭТАП 1: Исправить TypeScript типы**

#### **1.1. upsert-story.ts**
```typescript
// ❌ НАЙТИ И ЗАМЕНИТЬ:
import { type ContextInput } from "./schemas-zod.js";

// ✅ НА:
import { type UserContext } from "./schemas-zod.js";

// ❌ НАЙТИ И ЗАМЕНИТЬ все вхождения типа:
ContextInput → UserContext

// ❌ НАЙТИ строку ~126:
newContext.accumulated_work_experience_months = newAccumulatedExperience;

// ✅ УБРАТЬ эту строку полностью - больше не используем eager метрики

// ❌ НАЙТИ функцию calculateNewExperience и все связанные вызовы:
// ✅ УБРАТЬ полностью - больше не считаем опыт при импорте

// ❌ НАЙТИ строки ~85-86:
original_user: {
  birth_year: story.birth_year ?? null,
  citizenships: story.citizenships,
}

// ✅ ЗАМЕНИТЬ НА:
original_user: {
  birth_year: story.contexts[0]?.birth_year ?? null,
  citizenships: story.contexts[0]?.citizenships ?? [],
}
```

#### **1.2. persist.ts**
```typescript
// ❌ НАЙТИ строки ~102-103:
role_name: contextWithExperience.role,
grade_name: contextWithExperience.grade,

// ✅ ЗАМЕНИТЬ НА:
position_name: contextWithExperience.position,
```

### **ЭТАП 2: Обновить Cypher запросы**

#### **2.1. find-current-contexts.cypher**
```cypher
// ❌ НАЙТИ:
MATCH
  (dbCurrentUser:User)-[:HAS_CONTEXT]->(dbCurrentContext:Context)-[:IN_ROLE]->(dbRole:Role),
  (dbCurrentContext)-[:HAS_GRADE]->(dbGrade:Grade)

// ✅ ЗАМЕНИТЬ НА:
MATCH
  (dbCurrentUser:User)-[:HAS_CONTEXT]->(dbCurrentContext:Context)-[:HAS_POSITION]->(dbPosition:Position)

// ❌ НАЙТИ:
dbRole.name = requestedContext.role AND
dbGrade.name = requestedContext.grade AND

// ✅ ЗАМЕНИТЬ НА:
dbPosition.name = requestedContext.position AND
```

#### **2.2. find-target-for-current.cypher**
```cypher
// ❌ НАЙТИ:
MATCH
  (targetUser:User)-[:HAS_CONTEXT]->
  (dbTargetContext:Context)-[:IN_ROLE]->
  (dbTargetRole:Role),
  (dbTargetContext)-[:HAS_GRADE]->(dbTargetGrade:Grade)

// ✅ ЗАМЕНИТЬ НА:
MATCH
  (targetUser:User)-[:HAS_CONTEXT]->
  (dbTargetContext:Context)-[:HAS_POSITION]->(dbTargetPosition:Position)

// ❌ НАЙТИ:
(requestedTargetContext.role IS NULL OR dbTargetRole.name = requestedTargetContext.role) AND
(requestedTargetContext.grade IS NULL OR dbTargetGrade.name = requestedTargetContext.grade) AND

// ✅ ЗАМЕНИТЬ НА:
(requestedTargetContext.position IS NULL OR dbTargetPosition.name = requestedTargetContext.position) AND
```

#### **2.3. find-target-standalone.cypher**
```cypher
// Аналогично заменить Role/Grade на Position
```

#### **2.4. map-target-to-search-result.cypher**
```cypher
// ❌ НАЙТИ:
MATCH (dbTargetContext)-[:IN_ROLE]->(role:Role)
MATCH (dbTargetContext)-[:HAS_GRADE]->(grade:Grade)

// ✅ ЗАМЕНИТЬ НА:
MATCH (dbTargetContext)-[:HAS_POSITION]->(position:Position)

// ❌ НАЙТИ в RETURN секции:
role: role.name,
grade: grade.name,

// ✅ ЗАМЕНИТЬ НА:
position: position.name,
```

#### **2.5. load-current-context.cypher**
```cypher
// ❌ НАЙТИ:
MATCH (user:User {user_id: $user_id})-[:HAS_CONTEXT]->(context:Context {context_id: $context_id})-[:IN_ROLE]->(role:Role),
      (context)-[:HAS_GRADE]->(grade:Grade)

// ✅ ЗАМЕНИТЬ НА:
MATCH (user:User {user_id: $user_id})-[:HAS_CONTEXT]->(context:Context {context_id: $context_id})-[:HAS_POSITION]->(position:Position)

// ❌ НАЙТИ в RETURN:
role: role.name,
grade: grade.name,

// ✅ ЗАМЕНИТЬ НА:
position: position.name,
```

#### **2.6. queries.ts - LINK_REFS_CYPHER**
```cypher
// ❌ НАЙТИ:
// Role
MERGE (r:Role {name: $role_name})
MERGE (c)-[ir:IN_ROLE]->(r)

// Grade
MERGE (g:Grade {name: $grade_name})
MERGE (c)-[hg:HAS_GRADE]->(g)

// ✅ ЗАМЕНИТЬ НА:
// Position
MERGE (p:Position {name: $position_name})
MERGE (c)-[:HAS_POSITION]->(p)
```

#### **2.7. analyze-progression.cypher**
```cypher
// ❌ НАЙТИ И УДАЛИТЬ ВСЕ упоминания:
'role_changed', 'grade_changed'

// ✅ ЗАМЕНИТЬ НА:
'position_changed'

// ❌ НАЙТИ И УДАЛИТЬ блоки:
// === РОЛЬ ===
CASE WHEN 'role_changed' IN relevantTriggers
// === ГРЕЙД ===  
CASE WHEN 'grade_changed' IN relevantTriggers

// ✅ ЗАМЕНИТЬ НА ОДИН БЛОК:
// === ПОЗИЦИЯ ===
CASE WHEN 'position_changed' IN relevantTriggers
```

### **ЭТАП 3: Обновить схемы данных**

#### **3.1. Обновить NewContextReasonSchema**
```typescript
// ❌ НАЙТИ И УДАЛИТЬ:
"role_changed",
"grade_changed",

// ✅ ДОБАВИТЬ ВМЕСТО НИХ:
"position_changed",
```

### **ЭТАП 4: Исправить тесты**

#### **4.1. Найти все тестовые файлы с role/grade**
```bash
# Команда для поиска:
grep -r "role.*:" tests/
grep -r "grade.*:" tests/
```

#### **4.2. В найденных файлах заменить**
```typescript
// ❌ ЗАМЕНИТЬ:
role: "Software Developer",
grade: "Senior",

// ✅ НА:
position: "Senior",
```

### **ЭТАП 5: Обновить JSON тестовые данные (ДЕЛАТЬ ПЕРВЫМ!)**

#### **5.1. Найти все JSON файлы с role/grade**
```bash
# Команды для поиска JSON файлов:
find data/ -name "*.json" -exec grep -l "role.*:" {} \;
find tests/ -name "*.json" -exec grep -l "role.*:" {} \;
```

#### **5.2. В data/trails/generated_migrated/ (49 файлов)**
```json
// ❌ НАЙТИ И ЗАМЕНИТЬ во ВСЕХ JSON файлах:
"role": "Junior Frontend Developer",
"grade": "Junior",

// ✅ НА:
"position": "Junior",

// ❌ ПРИМЕРЫ других замен:
"role": "Middle Backend Engineer", "grade": "Middle" → "position": "Middle"
"role": "Senior Engineering Lead", "grade": "Senior" → "position": "Senior" 
"role": "TeamLead", "grade": "Senior" → "position": "TeamLead"
```

#### **5.3. Обновить тестовые моки в tests/**
```typescript
// Найти все моки в тестах и заменить аналогично:
// ❌ role: "...", grade: "..."
// ✅ position: "..."
```

#### **5.4. Автоматизация замены JSON**
```bash
# Можно использовать sed для массовой замены:
find data/ -name "*.json" -exec sed -i 's/"role": "Junior[^"]*", *"grade": "Junior"/"position": "Junior"/g' {} \;
find data/ -name "*.json" -exec sed -i 's/"role": "Middle[^"]*", *"grade": "Middle"/"position": "Middle"/g' {} \;
find data/ -name "*.json" -exec sed -i 's/"role": "Senior[^"]*", *"grade": "Senior"/"position": "Senior"/g' {} \;
```

## 🔍 **ФАЙЛЫ ДЛЯ ОБЯЗАТЕЛЬНОЙ ПРОВЕРКИ**

**TypeScript файлы:**
- [ ] `src/upsert-story.ts` - основные типы и логика
- [ ] `src/persist.ts` - параметры для Cypher

**Cypher файлы:**
- [ ] `src/cypher/unified/blocks/find-current-contexts.cypher`
- [ ] `src/cypher/unified/blocks/find-target-for-current.cypher`  
- [ ] `src/cypher/unified/blocks/find-target-standalone.cypher`
- [ ] `src/cypher/unified/blocks/map-target-to-search-result.cypher`
- [ ] `src/cypher/unified/blocks/analyze-progression.cypher`
- [ ] `src/cypher/blocks/load-current-context.cypher`
- [ ] `src/cypher/queries.ts`

**Тестовые файлы:**
- [ ] `tests/unit/trailValidation.test.ts`
- [ ] `tests/integration/unifiedSearchRouter.test.ts`
- [ ] Все JSON файлы в `data/trails/generated_migrated/`

## ✅ **КРИТЕРИИ УСПЕХА**

1. **Компиляция TypeScript:** `npm run build` проходит без ошибок
2. **Тесты проходят:** `npm test` выполняется успешно  
3. **Линтер чист:** `npm run lint` без ошибок
4. **MCP server запускается:** без runtime ошибок

## 🚨 **ВАЖНЫЕ ПРИМЕЧАНИЯ**

- **ПОЛНОСТЬЮ УДАЛИТЬ** поля `role_changed`/`grade_changed` из NewContextReasonSchema
- **ЗАМЕНИТЬ НА** новое поле `position_changed` 
- **УБРАТЬ** все eager метрики типа `accumulated_work_experience_months` - больше не используем
- **ПРОВЕРИТЬ** что все импорты TypeScript корректны после изменений

## 🎯 **ПОРЯДОК ВЫПОЛНЕНИЯ**

**🚨 КРИТИЧЕСКИ ВАЖНО: Исправить JSON данные ПЕРЕД запуском тестов!**

1. **ПЕРВЫМ ДЕЛОМ** исправить JSON данные (ЭТАП 5) - иначе тесты упадут на валидации схемы
2. Затем исправить TypeScript типы (ЭТАП 1)
3. Потом Cypher запросы (ЭТАП 2)  
4. После этого схемы данных (ЭТАП 3)
5. **НАКОНЕЦ** запускать тесты (ЭТАП 4)

Такой порядок предотвращает падения тестов из-за невалидных JSON данных.
