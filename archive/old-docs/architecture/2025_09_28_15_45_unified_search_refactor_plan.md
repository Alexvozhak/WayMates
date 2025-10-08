# План рефакторинга unified поиска когорты

## 1. Обзор изменений

### Текущее состояние
- Поиск только по `target_goal` (игнорируется `current_context`)
- Автотюнинг параметров в TypeScript циклах
- Разделенный поиск: сначала когорта, потом аватары
- `QueryResult` содержит только результаты по целевому контексту

### Новая архитектура
- **Unified поиск**: одновременно по `current_context` + `target_goal`
- **7-этапная фильтрация** в Cypher с четкой бизнес-логикой
- **Cypher Builder** для композируемых и типизированных запросов  
- **Smart Skill Categorization**: строгие навыки для отсева, лояльные для статистики
- **Precomputed поля** для мгновенных фильтров
- **Богатый результат** с детальными метриками совместимости

## 2. Smart Skill Categorization Strategy

### 2.1. Разделение навыков на категории строгости
```typescript
// Простая система: Set со строгими категориями
const STRICT_SKILL_CATEGORIES = new Set([
  'language',   // python ≠ javascript  
  'framework',  // react ≠ angular
  'runtime',    // nodejs ≠ .net
  'database'    // postgresql ≠ mongodb
]);

// Остальные категории автоматически гибкие:
// testing, tool, devops, cloud, competency, etc.

// Хелпер для категоризации
function getSkillsByType(skills: Skill[], type: 'strict' | 'flexible'): string[] {
  return skills
    .filter(skill => {
      const isStrict = STRICT_SKILL_CATEGORIES.has(skill.category);
      return type === 'strict' ? isStrict : !isStrict;
    })
    .map(skill => skill.name);
}
```

### 2.2. Обновленная фильтрация в Cypher
```cypher
// Строгие навыки - точное совпадение для отсева
AND size([s IN $strict_skills WHERE (context)-[:USES_SKILL]->(skill:Skill {name: s})]) = size($strict_skills)

// Лояльные навыки - только для scoring/статистики
WITH size([s IN $flexible_skills WHERE (context)-[:USES_SKILL]->(skill:Skill {name: s})]) AS flexible_matched_count
```

## 3. Cypher Builder Architecture

### 3.1. Fluent Builder Pattern (обновленный)
```typescript
class UnifiedAvatarSearchBuilder {
  private query: Cypher.Builder;

  constructor(private driver: Driver) {}

  findCurrentLikeContexts(context: SearchContext & SearchTiming) {
    // ЭТАП 1: Поиск пользователей с current-like контекстами
    // (строгие навыки + домены overlap + роль/грейд/work_type exact)
    return this;
  }
  
  findTargetLikeContexts(goal: SearchContext) {
    // ЭТАП 2: Точное совпадение с target-like контекстами (аватар)
    // (ВСЕ навыки цели + все домены + роль/грейд/work_type exact)
    return this;
  }
  
  filterByTimingRelevance(search_constraints: SearchConstraints) {
    // ЭТАП 3: Timing фильтрация (релевантность)
    return this;
  }
  
  calculateCompatibilityMetrics(profile: UserProfile, weights: ScoringWeights) {
    // ЭТАП 4: Расчет explicitScore по существующей системе весов
    // Подробно в разделе "Система весов" ниже
    return this;
  }
  
  orderByCompatibilityScore() {
    // ЭТАП 5: ORDER BY explicitScore DESC, matchedSkills DESC, coverage DESC, domainMatch DESC
    return this;
  }

  async execute(): Promise<UnifiedSearchResult[]> {
    const session = this.driver.session();
    const result = await session.run(this.query.build());
    session.close();
    return result.records.map(record => this.mapToResult(record));
  }
}
```

### 3.2. Типы через Pick/Omit + SystemSearchParams подход
```typescript
// Технические ограничения алгоритма
interface SearchConstraints {
  max_timing_diff_months: number;           // релевантность не более N месяцев 
  timing_diff_threshold_percent: number;    // процентный порог отсева по timing
  max_experience_diff_months: number;       // максимальная разница в стаже
  results_limit: number;                    // лимит результатов (для LIMIT в Cypher)
}

const DEFAULT_SEARCH_CONSTRAINTS: SearchConstraints = {
  max_timing_diff_months: 24,           // релевантность не более 2 лет
  timing_diff_threshold_percent: 30,    // процентный порог отсева по timing
  max_experience_diff_months: 36,       // максимальная разница в стаже (3 года)
  results_limit: 50                     // лимит результатов для производительности
};

```

### 3.3. Логика фильтрации: строгий отсев vs мягкий скоринг

#### **СТРОГИЙ ОТСЕВ** (кандидат исключается, если не проходит):
```typescript
// ДЛЯ CURRENT-LIKE контекстов:
- strict_skills: ALL required   // ВСЕ строгие навыки обязательны
- domains: ALL required         // ВСЕ домены current обязательны (как минимум столько же)
- role: exact match             // точная роль
- grade: exact match            // точный грейд
- work_type: exact match        // точный тип работы
- timing: <= max_timing_diff    // актуальность (не старше 2 лет)

// ДЛЯ TARGET-LIKE контекстов (аватар):
// ПОЛЬЗОВАТЕЛЬ ПОЛНОСТЬЮ КОНТРОЛИРУЕТ (указал в target_context = строго):

- IF role IS SET → role: exact match              // Senior Frontend ≠ Middle Frontend
- IF grade IS SET → grade: exact match            // Senior ≠ Middle  
- IF work_type IS SET → work_type: exact match    // Remote ≠ Office
- IF domains IS SET → domains: ALL required       // ВСЕ домены target обязательны
- IF skills IS SET → ALL skills: exact match      // ВСЕ навыки target строго (пользователь хочет именно это)
- IF country IS SET → country: exact match        // хочет в конкретную страну
- IF city IS SET → city: exact match              // хочет в конкретный город  
- IF company_size IS SET → company_size: exact match
- IF industry IS SET → industry: exact match

// Логика: указал в target_context = хочу именно это!
// Не указал = не важно для пользователя
```

#### **МЯГКИЙ СКОРИНГ** (ранжирование прошедших строгий отсев):
```typescript
interface ScoringWeights {
  // Скоринг по current context (для ранжирования похожести)
  currentFlexibleSkillsMatch: number;  // 0.45 (45%) - % покрытия лояльных навыков current
  
  // Остальные критерии совместимости
  experienceDelta: number;             // 0.22 (22%) - близость по стажу
  timingRelevance: number;             // 0.18 (18%) - актуальность контекста  
  countryMatch: number;                // 0.1 (10%) - совпадение страны
  cityMatch: number;                   // 0.05 (5%) - совпадение города
}

// Target навыки: все строгие (указал = хочу), гибких нет!
```

#### **Обновленная формула скоринга:**
```cypher
explicitScore = 
  current_flexible_skills_percent * 0.45 +     // % лояльных навыков current
  (1 - experience_diff_normalized) * 0.22 +    // близость стажа  
  timing_relevance_score * 0.18 +              // актуальность
  countryMatch * 0.1 +                         // совпадение страны
  cityMatch * 0.05                             // совпадение города
```


## 4. Изменения схем и структур

### 4.1. Схемы изменения (разделение ответственности)

```typescript
// ✅ UserContextSchema - пользовательские данные (что приходит от фронтенда)
export const UserContextSchema = Type.Object({
  // ✅ Добавляем универсальную дату события (точная дата/время)
  created_at: Type.String({
    format: "date-time",  // ISO 8601: 2024-12-01T10:30:00Z
    description: "When this context/event occurred (ISO 8601 format)"
  }),

  // ✅ Делаем creation_reason массивом (множественные события)
  creation_reason: Type.Array(
    Type.Union([
      Type.Literal("started_working"),
      Type.Literal("stopped_working"), 
      Type.Literal("skill_learning"),
      Type.Literal("role_change"),
      Type.Literal("goals_change"),
      Type.Literal("constraints_update"),
      Type.Literal("milestone_achieved"),
      Type.Literal("system_recommendation"),
      Type.Literal("other"),
    ]),
    { minItems: 1 }
  ),
  
  // ... остальные пользовательские поля (role, domains, skills, etc.)

  // ❌ УБИРАЕМ избыточные поля (все определяется по created_at + creation_reason[])
  // employment_period: ...   // рудимент, считается по триггерам
  // role_started_at: ...     // избыточен, = created_at для 'started_working'|'role_change' 
  // grade_awarded_at: ...    // избыточен, = created_at для соответствующего триггера
});

// ✅ ContextInputSchema - расширенная схема (что храним в базе данных)
export const ContextInputSchema = Type.Object({
  // Системные поля:
  context_id: Type.String({ description: "Unique context identifier" }),
  accumulated_work_experience_months: Type.Optional(Type.Number()),
  
  // Наследуем пользовательские данные:
  ...UserContextSchema.properties,
}, { additionalProperties: true });
```

### 4.2. Обновленные результаты (trails минимизированы)
```typescript

// Обновленный результат поиска
interface UnifiedSearchResult {
  user_id: string;
  current_like_context_id: string;      // контекст похожий на current
  target_like_context_id: string;       // контекст похожий на target
  trail_path?: Trail[];                 // ОПЦИОНАЛЬНО: пути развития (пока без бизнес-логики)
  
  // Timing отклонения (процент + месяцы)
  role_timing_diff_percent: number;     // % отклонения по role_started_at
  role_timing_diff_months: number;      // месяцы отклонения по role_started_at
  grade_timing_diff_percent: number;    // % отклонения по grade_awarded_at  
  grade_timing_diff_months: number;     // месяцы отклонения по grade_awarded_at
  
  // Skills отклонения (только для current) - ЛОЯЛЬНЫЕ НАВЫКИ
  current_flexible_skills_matched: number;  // лояльные навыки совпали  
  current_flexible_skills_total: number;    // общее количество лояльных навыков
  current_flexible_skills_percent: number;  // процент совпадения лояльных
  
  // Experience отклонение (только для current)
  current_experience_diff_months: number; // разница в стаже относительно current-like
  
  // Progression timing (время достижения цели)
  progression_duration_months: number;  // сколько месяцев от current-like до target-like
  
  // Geography (boolean
  country_match: boolean;               // та же страна
  city_match: boolean;                  // тот же город
  
  // Company статистика (для информации)
  company_size_match: boolean;          // совпадает ли размер компаний
  industry_match: boolean;              // совпадает ли индустрия
}
```

## 5. Cypher запросы - 7-этапный алгоритм (обновленный)

### 5.1. UNIFIED_COHORT_SEARCH_CYPHER (с Cypher Builder)

```cypher
// ===== ЭТАП 1: ПОИСК ПОЛЬЗОВАТЕЛЕЙ С ДВУМЯ ТИПАМИ КОНТЕКСТОВ =====
WITH $current_role AS current_role,
     $current_grade AS current_grade,
     $current_domains AS current_domains,
     $current_work_type AS current_work_type,
     $current_skills AS current_skills,
     $target_role AS target_role,
     $target_grade AS target_grade,
     $target_domains AS target_domains,
     $target_work_type AS target_work_type,
     $target_strict_skills AS target_strict_skills,
     $current_role_started_at AS current_role_started_at,
     $current_grade_awarded_at AS current_grade_awarded_at,
     $max_timing_diff_months AS max_timing_diff,
     $timing_threshold_percent AS timing_threshold,
     $user_experience_months AS user_experience_months,
     $user_country AS user_country,
     $user_city AS user_city,
     $user_company_size AS user_company_size,
     $user_industry AS user_industry

// Ищем пользователей с контекстами, похожими на current_context
MATCH (user:User)-[:HAS_CONTEXT]->(current_like:Context)-[:IN_ROLE]->(current_role_node:Role),
      (current_like)-[:HAS_GRADE]->(current_grade_node:Grade)
WHERE current_role_node.name = current_role
  AND current_grade_node.name = current_grade
  
// ОБЯЗАТЕЛЬНО: ВСЕ домены current должны быть у кандидата
  AND size([d IN current_domains WHERE EXISTS {
    MATCH (current_like)-[:IN_WORK_DOMAIN]->(wd:WorkDomain {name: d})
  }]) = size(current_domains)
  
// ОБЯЗАТЕЛЬНО: Work type должен совпадать  
  AND current_like.work_type = $current_work_type

// ===== ЭТАП 2: TIMING ФИЛЬТРАЦИЯ ДЛЯ CURRENT-LIKE =====
// Жесткий отсев по релевантности (не более 2 лет разницы)
WITH user, current_like,
     abs(duration.inMonths(
       date({year: toInteger(split(current_like.role_started_at,'-')[0]), 
             month: toInteger(split(current_like.role_started_at,'-')[1])}),
       date({year: toInteger(split(current_role_started_at,'-')[0]),
             month: toInteger(split(current_role_started_at,'-')[1])})
     ).months) AS current_role_timing_diff,
     abs(duration.inMonths(
       date({year: toInteger(split(current_like.grade_awarded_at,'-')[0]), 
             month: toInteger(split(current_like.grade_awarded_at,'-')[1])}),
       date({year: toInteger(split(current_grade_awarded_at,'-')[0]),
             month: toInteger(split(current_grade_awarded_at,'-')[1])})
     ).months) AS current_grade_timing_diff

WHERE current_role_timing_diff <= max_timing_diff
  AND current_grade_timing_diff <= max_timing_diff

// Процентная фильтрация (отсеиваем > 30% отклонения)
WITH user, current_like, current_role_timing_diff, current_grade_timing_diff,
     current_role_timing_diff * 100.0 / max_timing_diff AS current_role_timing_percent,
     current_grade_timing_diff * 100.0 / max_timing_diff AS current_grade_timing_percent

WHERE current_role_timing_percent <= timing_threshold
  AND current_grade_timing_percent <= timing_threshold

// ===== ЭТАП 3: ПОИСК TARGET-LIKE КОНТЕКСТОВ У ТЕХ ЖЕ ПОЛЬЗОВАТЕЛЕЙ =====
// Среди прошедших фильтрацию ищем контексты, похожие на target_goal
MATCH (user)-[:HAS_CONTEXT]->(target_like:Context)-[:IN_ROLE]->(target_role_node:Role),
      (target_like)-[:HAS_GRADE]->(target_grade_node:Grade)
WHERE target_role_node.name = target_role
  AND target_grade_node.name = target_grade
  AND target_like <> current_like  // разные контексты одного пользователя
  
// ОБЯЗАТЕЛЬНО: ВСЕ домены target должны быть у аватара (если указаны)
WITH target_domains
WHERE target_domains IS NULL OR size([d IN target_domains WHERE EXISTS {
  MATCH (target_like)-[:IN_WORK_DOMAIN]->(wd:WorkDomain {name: d})
}]) = size(target_domains)
  
// ОБЯЗАТЕЛЬНО: ВСЕ навыки target должны быть у аватара (пользователь решил что хочет именно их)
WITH target_skills
WHERE target_skills IS NULL OR size([s IN target_skills WHERE (target_like)-[:USES_SKILL]->(skill:Skill {name: s})]) = size(target_skills)
  
// ОБЯЗАТЕЛЬНО: Work type должен совпадать с target
  AND target_like.work_type = $target_work_type

// ===== ЭТАП 4: TIMING ФИЛЬТРАЦИЯ ДЛЯ TARGET-LIKE =====
WITH user, current_like, target_like,
     current_role_timing_percent, current_grade_timing_percent,
     abs(duration.inMonths(
       date({year: toInteger(split(target_like.role_started_at,'-')[0]), 
             month: toInteger(split(target_like.role_started_at,'-')[1])}),
       date({year: toInteger(split(current_role_started_at,'-')[0]),
             month: toInteger(split(current_role_started_at,'-')[1])})
     ).months) AS target_role_timing_diff,
     abs(duration.inMonths(
       date({year: toInteger(split(target_like.grade_awarded_at,'-')[0]), 
             month: toInteger(split(target_like.grade_awarded_at,'-')[1])}),
       date({year: toInteger(split(current_grade_awarded_at,'-')[0]),
             month: toInteger(split(current_grade_awarded_at,'-')[1])})
     ).months) AS target_grade_timing_diff

WHERE target_role_timing_diff <= max_timing_diff
  AND target_grade_timing_diff <= max_timing_diff

WITH user, current_like, target_like,
     current_role_timing_percent, current_grade_timing_percent,
     target_role_timing_diff * 100.0 / max_timing_diff AS target_role_timing_percent,
     target_grade_timing_diff * 100.0 / max_timing_diff AS target_grade_timing_percent

WHERE target_role_timing_percent <= timing_threshold
  AND target_grade_timing_percent <= timing_threshold

// ===== ЭТАП 5: ПОИСК ПУТЕЙ РАЗВИТИЯ =====
// Ищем trails между current_like и target_like контекстами
OPTIONAL MATCH path = (current_like)-[:STEPS_ON]->(:Trail)-[:STEPS_TO]->*->(target_like)

// ===== ЭТАП 6: РАСЧЕТ МЕТРИК СОВМЕСТИМОСТИ =====
WITH user, current_like, target_like, path,
     current_role_timing_percent, current_grade_timing_percent,
     target_role_timing_percent, target_grade_timing_percent,
     
     // Skills совпадения current (лояльные - строгие уже отсеяны)
     size([s IN $current_flexible_skills WHERE (current_like)-[:USES_SKILL]->(skill:Skill {name: s})]) AS current_flexible_matched,
     size($current_flexible_skills) AS current_flexible_total,
     
     // Target skills: уже на 100% совпали (иначе отсеялись на этапе строгой фильтрации)
     
     // Experience отклонение (только для current)
     abs(current_like.accumulated_work_experience_months - $user_experience_months) AS current_experience_diff,
     
     // Progression timing (время между контекстами аватара)
     abs(duration.inMonths(
       date({year: toInteger(split(current_like.role_started_at,'-')[0]), 
             month: toInteger(split(current_like.role_started_at,'-')[1])}),
       date({year: toInteger(split(target_like.role_started_at,'-')[0]),
             month: toInteger(split(target_like.role_started_at,'-')[1])})
     ).months) AS progression_months,
     
     // Geography совпадения
     CASE WHEN current_like.location_country = $user_country THEN true ELSE false END AS country_match,
     CASE WHEN current_like.location_city = $user_city THEN true ELSE false END AS city_match,
     
     // Company статистика
     CASE WHEN current_like.company_size = $user_company_size THEN true ELSE false END AS company_size_match,
     CASE WHEN current_like.company_industry = $user_industry THEN true ELSE false END AS industry_match,
     
     // Trail path
     CASE WHEN path IS NULL THEN [] 
          ELSE [rel IN relationships(path) WHERE type(rel) = 'STEPS_ON' | rel] END AS trail_rels

WITH user, current_like, target_like, trail_rels,
     current_role_timing_percent, current_grade_timing_percent,
     target_role_timing_percent, target_grade_timing_percent,
     current_flexible_matched, current_flexible_total,
     current_experience_diff, progression_months,
     country_match, city_match, company_size_match, industry_match

// ===== ЭТАП 7: ФИНАЛЬНОЕ РАНЖИРОВАНИЕ =====
// Без сложных скорингов - просто сортируем по timing diff

// ===== РЕЗУЛЬТАТ =====
RETURN user.user_id AS user_id,
      current_like.context_id AS current_like_context_id,
      target_like.context_id AS target_like_context_id,
       [rel IN trail_rels | startNode(rel)] AS trail_path,
       
       // Timing отклонения (процент + месяцы)
       current_role_timing_percent AS role_timing_diff_percent,
       CASE WHEN current_role_timing_percent > 0 
            THEN toInteger(current_role_timing_percent * 24.0 / 100.0) 
            ELSE 0 END AS role_timing_diff_months,
       current_grade_timing_percent AS grade_timing_diff_percent,
       CASE WHEN current_grade_timing_percent > 0
            THEN toInteger(current_grade_timing_percent * 24.0 / 100.0)
            ELSE 0 END AS grade_timing_diff_months,
       
       // Skills количество current (лояльные - строгие уже отсеяны 100%)
       current_flexible_matched AS current_flexible_skills_matched,
       current_flexible_total AS current_flexible_skills_total,
       CASE WHEN current_flexible_total = 0 THEN 0.0
            ELSE toFloat(current_flexible_matched) / current_flexible_total * 100.0 END AS current_flexible_skills_percent,
            
       // Skills количество target (информационно)
       
       // Experience отклонение (только для current)
       current_experience_diff AS current_experience_diff_months,
       
       // Progression timing (время достижения цели)
       progression_months AS progression_duration_months,
       
       // Geography
       country_match,
       city_match,
       
       // Company статистика
       company_size_match,
       industry_match

ORDER BY current_role_timing_percent ASC, current_grade_timing_percent ASC
LIMIT $results_limit;
```

## 6. Рефакторинг функций (с Cypher Builder)

### 6.0. Единая архитектура функций
```typescript
// Главная функция - максимально простой интерфейс
async function findUnifiedAvatars(
  currentContext: UserContext,
  targetGoal: TargetGoal,
  search_constraints: SearchConstraints = DEFAULT_SEARCH_CONSTRAINTS
): Promise<UnifiedSearchResult[]> {
  return new UnifiedAvatarSearchBuilder(driver)
    .findCurrentLikeContexts(currentContext)
    .findTargetLikeContexts(targetGoal) 
    .filterByTimingRelevance(search_constraints)
    .calculateCompatibilityMetrics(currentContext, DEFAULT_SCORING_WEIGHTS)
    .orderByCompatibilityScore()
    .execute();
}

```


### 6.2. Обновляемые функции
```typescript
// Замена processQuery - поддержка current_context
async function processUnifiedQuery(
  driver: Driver, 
  queryFile: QueryFile
): Promise<UnifiedSearchResult[]>

// Простой API - без оверинженеринга (KISS принцип)
// findUnifiedAvatars() возвращает просто UnifiedSearchResult[]
```

### 6.3. Устаревающие функции
- `autoTune()` - заменяется `unifiedCohortSearch()`
- `cohortCount()` - не нужен (считаем в одном запросе)
- `cohortQuery()` - не нужен (интегрирован в unified)
- `findAvatarWithTrails()` - интегрирован в unified запрос

## 7. Изменения в persist.ts
нужно дожать последни 7 8 9 пункты!!!

### 7.0. Обновление схемы Neo4j User узла
```cypher
// ✅ Добавляем поле для O(1) расчета опыта в User узел
MATCH (user:User)
SET user.current_context_id = null  // инициализируем для существующих пользователей

// В функциях создания User узла добавляем:
CREATE (user:User {
  user_id: $user_id,
  current_context_id: null,  // будет обновляться при добавлении контекстов
  // ... другие поля
})
```

### 7.1. Расчет accumulated_work_experience_months (упрощенный O(1) алгоритм)

**ВАЖНОЕ РЕШЕНИЕ:** `role_started_at` и `grade_awarded_at` НЕ сохраняем в БД!
- В БД: только факты (`created_at`, `creation_reason[]`)  
- В поиске: вычисляем динамически по триггерам `role_change`/`started_working`
- Преимущества: нет дублирования, нет ошибок, гибкость

```typescript
async function upsertStoryWithExperience(driver: Driver, story: StoryInput) {
  const session = driver.session();
  
  for (const newContext of story.contexts) {
    const triggers = newContext.creation_reason;
    
    // 1. Одним запросом получаем текущий опыт пользователя
    const currentExperienceQuery = `
      MATCH (user:User {user_id: $user_id})
      OPTIONAL MATCH (user)-[:HAS_CONTEXT]->(current:Context {context_id: user.current_context_id})
      RETURN current.accumulated_work_experience_months as current_experience,
             current.created_at as current_date
    `;
    
    const result = await session.run(currentExperienceQuery, { user_id: story.user_id });
    const record = result.records[0];
    
    let accumulated_experience = 0;
    
    if (record && record.get('current_experience') !== null) {
      // 2. Есть предыдущий контекст - добавляем время (если не stopped_working)
      const prevExperience = record.get('current_experience');
      const prevDate = new Date(record.get('current_date'));
      const newDate = new Date(newContext.created_at);
      
      if (!triggers.includes('stopped_working')) {
        const monthsDiff = Math.round(
          (newDate.getTime() - prevDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
        );
        accumulated_experience = prevExperience + Math.max(0, monthsDiff);
      } else {
        accumulated_experience = prevExperience; // пауза в карьере
      }
    }
    // Если record пустой = первый контекст, опыт = 0
    
    // 3. Создаем новый контекст с накопленным опытом
    const contextWithExperience = {
      ...newContext,
      accumulated_work_experience_months: accumulated_experience
    };
    
    await upsertContext(driver, contextWithExperience);
    
    // 4. Обновляем current_context_id одним запросом
    await session.run(`
      MATCH (user:User {user_id: $user_id})
      SET user.current_context_id = $context_id
    `, {
      user_id: story.user_id,
      context_id: newContext.context_id
    });
  }
  
  await session.close();
}
```

## 8. Обновление тестовых данных

### 8.1. Актуализировать trails_user_001.json под новую схему
```json
// Обновляем каждый контекст согласно новой UserContextSchema:
{
  "context_id": "ctx_001_1",
  "created_at": "2017-09-15T09:00:00Z",                    // ✅ точная дата вместо role_started_at
  "creation_reason": ["skill_learning"],                   // ✅ массив вместо строки
  "accumulated_work_experience_months": 0,                 // ✅ первый контекст - нет рабочего опыта
  // ❌ УБИРАЕМ: role_started_at, grade_awarded_at, employment_period
  // ... остальные поля (role, domains, skills, etc.) остаются
},
{
  "context_id": "ctx_001_2", 
  "created_at": "2019-07-01T08:30:00Z",                    // ✅ точная дата 
  "creation_reason": ["role_change", "started_working"],   // ✅ множественные триггеры
  "accumulated_work_experience_months": 0,                 // ✅ начал работать (до этого студент)
  // ❌ УБИРАЕМ избыточные поля
},
{
  "context_id": "ctx_001_3",
  "created_at": "2021-04-01T10:00:00Z",                    // ✅ точная дата
  "creation_reason": ["role_change"],                      // ✅ смена роли (работа продолжается)
  "accumulated_work_experience_months": 21,                // ✅ ~21 месяц от July 2019 до April 2021
  // ❌ УБИРАЕМ избыточные поля
}
```

### 8.2. Создать элегантный тест unified поиска (через ссылки)
```json
// test_unified_self_progression.json - БЕЗ дублирования данных!
{
  "id": "test_self_progression",
  "description": "Ищем путь развития от ctx_001_1 к ctx_001_3 того же пользователя",
  "current_context": {
    "user_id": "trails_user_001",
    "context_id": "ctx_001_1"     // Computer Science Student → система подтянет данные из БД
  },
  "target_context": {
    "user_id": "trails_user_001", 
    "context_id": "ctx_001_3"     // Middle Frontend Engineer → система подтянет данные из БД
  },
  "expected_results": {
    "should_find_self": true,                             // Должен найти самого себя
    "trail_path": ["trail_001_1", "trail_001_2"]         // Ожидаемый путь React→TypeScript
  }
}
```

## 9. План реализации (Production-First подход)

### 🏗️ **ЭТАП 1: Архитектурная подготовка**

1. **📦 Установить @neo4j/cypher-builder** - `npm install @neo4j/cypher-builder`

2. **🔄 Обновить схемы TypeBox** - полная актуализация:
   - `UserContextSchema`: добавить `created_at`, `creation_reason[]`
   - `ContextInputSchema`: добавить `accumulated_work_experience_months`
   - Убрать избыточные поля: `employment_period`, `role_started_at`, `grade_awarded_at`

3. **🔄 Переименовать target_goal в target_context** - консистентность именования:
   - `TargetGoal` → `TargetContext`, `TargetGoalSchema` → `TargetContextSchema`
   - `targetGoal` → `targetContext` в параметрах функций
   - `QueryFile.target_goal` → `target_context`

### 🎯 **ЭТАП 2: Продакшн реализация**

4. **🆕 Обновить Neo4j схему User узла** - добавить `current_context_id` для O(1) расчета опыта

5. **🔄 Обновить persist.ts** - упрощенный O(1) алгоритм расчета опыта через `current_context_id`

6. **🔧 Создать Skill Categorization** - система `STRICT_SKILL_CATEGORIES` (Set) + функция `getSkillsByType()`

7. **📊 Создать новые интерфейсы** - `UnifiedSearchResult`, `SearchConstraints`, обновленные типы

8. **🏗️ Создать Cypher Builder классы** - `UnifiedAvatarSearchBuilder` с Fluent паттерном

9. **🎯 Реализовать unified поиск** - 7-этапный алгоритм с двухуровневой фильтрацией

10. **🔄 Рефакторинг search_cohort_simple.ts** - функция `findUnifiedAvatars()` как основная точка входа

11. **🚀 Обновить main()** - переключение на новый алгоритм

### 🧪 **ЭТАП 3: Тестирование (после продакшн части)**

12. **📝 Актуализировать trails_user_001.json** - обновить под новую схему

13. **🧪 Создать элегантный тест** - `test_unified_self_progression.json` через ссылки на контексты

14. **🔗 Интеграционное тестирование** - проверка полной цепочки unified поиска

### 9.1. Будущие улучшения (после MVP)
- **Trail Quality Scoring** - рейтинги и количество троп в результатах
- **Advanced Skill Matching** - семантическое сходство навыков внутри категорий  
- **Performance Optimization** - индексы, кеширование, пагинация
- **A/B Testing** - сравнение качества результатов old vs new алгоритм

## 10. Риски и ограничения (обновленные)

- **Cypher Builder Learning Curve** - команда должна изучить новую библиотеку
- **Skill Categorization Accuracy** - нужна валидация правильности разделения strict/flexible
- **Performance Impact** - двойная фильтрация (строгая + статистика) может быть медленной
- **Миграция данных** - нужно пересчитать accumulated_work_experience_months для существующих контекстов  
- **Breaking changes** - кардинальное изменение интерфейсов QueryResult
- **Trail Logic Uncertainty** - пока нет четкой бизнес-логики для использования путей развития
- **Тестирование** - нужны новые тесты для unified логики и skill categorization
