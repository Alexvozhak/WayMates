// Auto-generated from .cypher files - DO NOT EDIT MANUALLY
// Generated at: 2025-10-09T20:26:00.570Z
// Run: npm run build:cypher to regenerate

// Upserts domain
export const Upserts = {
  CREATE_CONTEXT: `MERGE (u:User {user_id: $user_id})
ON CREATE SET u.current_context_id = null

// User demographics from context
SET u.birth_year = coalesce($context.birth_year, u.birth_year)

MERGE (c:Context {context_id: $context.context_id})
  ON CREATE SET c.created_at = datetime($context.created_at)
SET c.created_at = datetime($context.created_at),
    c.position = $context.position,
    c.domains = $context.domains,
    c.skills = [s IN $context.skills | s.name],
    c.industry = $context.industry,
    c.company_size = $context.company_size,
    c.country_code = $context.country_code,
    c.city_name = $context.city_name,
    c.work_type = $context.work_type,
    c.citizenships = $context.citizenships,
    c.team_size = $context.team_size,
    c.creation_reason = $context.creation_reason,
    c.previous_context_id = $context.previous_context_id,
    c.next_context_id = $context.next_context_id

MERGE (u)-[:HAS_CONTEXT]->(c)
SET u.current_context_id = c.context_id

// Position
MERGE (p:Position {name: $context.position})
MERGE (c)-[:HAS_POSITION]->(p)

// Industry (direct link from Context for MVP)
MERGE (i:Industry {name: $context.industry})
MERGE (c)-[:IN_INDUSTRY]->(i)

// Work domains
WITH c, $context.domains AS work_domains
UNWIND work_domains AS wdName
  MERGE (wd:WorkDomain {name: wdName})
  MERGE (c)-[:IN_WORK_DOMAIN]->(wd)

// Skills and categories
WITH c, $context.skills AS skills
UNWIND skills AS sk
  MERGE (sc:SkillCategory {name: sk.category})
  MERGE (s:Skill {name: sk.name})
  MERGE (s)-[:IN_CATEGORY]->(sc)
  MERGE (c)-[:USES_SKILL]->(s)

// Location nodes - УНИФИЦИРОВАННАЯ СХЕМА (name для всех)
WITH c
MERGE (cty:Country {name: $context.country_code})  // ✅ country_code КАК name
MERGE (ci:City {name: $context.city_name})         // ✅ убрали country_code из City
MERGE (ci)-[:IN_COUNTRY]->(cty)
MERGE (c)-[:IN_CITY]->(ci)
MERGE (c)-[:IN_COUNTRY]->(cty)  // ✅ ПРЯМАЯ СВЯЗЬ!

// Temporal context links - создаем связи между контекстами
WITH c
OPTIONAL MATCH (prev:Context {context_id: c.previous_context_id})
FOREACH (_ IN CASE WHEN prev IS NOT NULL THEN [1] ELSE [] END |
  MERGE (prev)-[:NEXT_CONTEXT]->(c)
  SET prev.next_context_id = c.context_id
)

// Citizenship relations from context - УНИФИЦИРОВАННАЯ СХЕМА
WITH c
FOREACH (code IN $context.citizenships |
  MERGE (ct:Country {name: code})  // ✅ code КАК name
  MERGE (c)-[:CITIZEN_OF]->(ct)   // ✅ СВЯЗЬ ОТ CONTEXT, НЕ ОТ USER
)

RETURN c.context_id AS context_id;`,
  CREATE_TRAIL: `MERGE (t:Trail {trail_id: $trail_id})
SET t.skill = $trail.skill,
    t.platform = $trail.platform,
    t.from_context_id = $trail.from_context_id,
    t.to_context_id = $trail.to_context_id,
    t.total_duration_weeks = $trail.total_duration_weeks,
    t.sessions_per_week = $trail.schedule.sessions_per_week,
    t.hours_per_session = $trail.schedule.hours_per_session,
    t.cost_usd = $trail.cost_usd,
    t.rating_course = $trail.rating_course,
    t.rating_platform = $trail.rating_platform,
    t.rating_schedule = $trail.rating_schedule,
    t.course_name = $trail.course_name,
    t.course_link = $trail.course_link,
    t.user_feedback = $trail.user_feedback

MERGE (p:Platform {name: $trail.platform})
MERGE (spn:SkillPlatformNode {skill: $trail.skill, platform: $trail.platform})
MERGE (spn)-[:ON_PLATFORM]->(p)
MERGE (t)-[:DEVELOPS]->(spn)

WITH t
MERGE (from_ctx:Context {context_id: $from_context_id})
MERGE (from_ctx)-[:STEPS_ON]->(t)

// Create direct User-Trail relationship for better query performance
MERGE (u:User {user_id: $user_id})
MERGE (u)-[:HAS_TRAIL]->(t)

// Handle optional to_context_id (null for ongoing trails)
FOREACH (_ IN CASE WHEN $to_context_id IS NULL THEN [] ELSE [1] END |
  MERGE (to_ctx:Context {context_id: $to_context_id})
  MERGE (t)-[:STEPS_TO]->(to_ctx)
)
RETURN t.trail_id AS trail_id;`,
  LINK_REFERENCES: `/* ============================================
 * БЛОК: LINK CONTEXT REFERENCES
 * ============================================
 *
 * 🎯 НАЗНАЧЕНИЕ:
 * Связывание контекста с позициями, навыками, доменами и локацией
 *
 * 📥 ПАРАМЕТРЫ:
 * - $context_id - ID контекста для связывания
 * - $position_name - название позиции
 * - $industry_name - название индустрии
 * - $work_domains - массив доменов работы
 * - $skills - массив навыков с категориями
 * - $original_context - данные контекста для локации
 * - $original_user - данные пользователя для гражданства
 *
 * 📤 ВОЗВРАЩАЕТ:
 * - Ничего (выполняет связывание)
 */

MATCH (c:Context {context_id: $context_id})

// Position
MERGE (p:Position {name: $position_name})
MERGE (c)-[:HAS_POSITION]->(p)

// Industry (direct link from Context for MVP)
MERGE (i:Industry {name: $industry_name})
MERGE (c)-[:IN_INDUSTRY]->(i)

// Work domains
WITH c, $work_domains AS work_domains
UNWIND work_domains AS wdName
  MERGE (wd:WorkDomain {name: wdName})
  MERGE (c)-[:IN_WORK_DOMAIN]->(wd)

// Skills and categories
WITH c, $skills AS skills
UNWIND skills AS sk
  MERGE (sc:SkillCategory {name: sk.category})
  MERGE (s:Skill {name: sk.name})
  MERGE (s)-[:IN_CATEGORY]->(sc)
  MERGE (c)-[:USES_SKILL]->(s)

// Location nodes - УНИФИЦИРОВАННАЯ СХЕМА (name для всех)
MERGE (cty:Country {name: $original_context.country_code})  // ✅ country_code КАК name
MERGE (ci:City {name: $original_context.city_name})         // ✅ убрали country_code из City
MERGE (ci)-[:IN_COUNTRY]->(cty)
MERGE (c)-[:IN_CITY]->(ci)
MERGE (c)-[:IN_COUNTRY]->(cty)  // ✅ ПРЯМАЯ СВЯЗЬ!

// Citizenship relations (optional, on Context) - УНИФИЦИРОВАННАЯ СХЕМА
WITH c
FOREACH (code IN $original_user.citizenships |
  MERGE (ct:Country {name: code})  // ✅ code КАК name
  MERGE (c)-[:CITIZEN_OF]->(ct)   // ✅ СВЯЗЬ ОТ CONTEXT, НЕ ОТ USER
)`,
  UPDATE_CURRENT_CONTEXT: `/* ============================================
 * БЛОК: UPDATE CURRENT CONTEXT ID
 * ============================================
 *
 * 🎯 НАЗНАЧЕНИЕ:
 * Обновление current_context_id у пользователя
 *
 * 📥 ПАРАМЕТРЫ:
 * - $user_id - ID пользователя
 * - $context_id - новый ID текущего контекста
 *
 * 📤 ВОЗВРАЩАЕТ:
 * - Ничего (выполняет обновление)
 */

MATCH (user:User {user_id: $user_id})
SET user.current_context_id = $context_id`,
} as const;

// Finders domain
export const Finders = {
  COHORT_MATCHES: `/* ============================================
 * БЛОК: SHARED COHORT SEARCH
 * ============================================
 *
 * 🎯 НАЗНАЧЕНИЕ:
 * Поиск пользователей с похожими характеристиками (cohort search)
 *
 * 📥 ПАРАМЕТРЫ:
 * - $position - целевая позиция
 * - $userDomains - домены пользователя
 * - $userSkills - навыки пользователя
 * - $userRoleExp - опыт в роли (годы)
 * - $minCoverage - минимальный процент совпадения навыков
 * - $expTolerance - допустимое отклонение по опыту (годы)
 * - $requireDomain - требовать совпадение доменов
 * - $desiredCountry - желаемая страна
 * - $desiredCity - желаемый город
 * - $requireCountry - требовать совпадение страны
 * - $requireCity - требовать совпадение города
 *
 * 📤 ВОЗВРАЩАЕТ:
 * - ctx - найденные контексты
 * - matchedSkills - количество совпавших навыков
 * - coverage - процент совпадения навыков
 * - domainMatch - совпадение доменов (0/1)
 * - expDelta - разница в опыте
 * - domainOverlap - количество совпавших доменов
 * - countryMatch - совпадение страны (0/1)
 * - cityMatch - совпадение города (0/1)
 */

WITH $position AS position,
     $userDomains AS userDomains,
     $userSkills AS userSkills,
     $userRoleExp AS userRoleExp,
     $minCoverage AS minCoverage,
     $expTolerance AS expTolerance,
     $requireDomain AS requireDomain,
     $desiredCountry AS desiredCountry,
     $desiredCity AS desiredCity,
     $requireCountry AS requireCountry,
     $requireCity AS requireCity
CALL {
  WITH position, userDomains, userSkills, userRoleExp, desiredCountry, desiredCity
  MATCH (c:Context)-[:HAS_POSITION]->(:Position {name: position})
  WITH c, userSkills, userDomains, userRoleExp, desiredCountry, desiredCity,
       size([ s IN [ (c)-[:USES_SKILL]->(sx) | sx.name ] WHERE s IN userSkills ]) AS matchedSkills,
       size(userSkills) AS userSkillsCount,
       size([ d IN [ (c)-[:IN_WORK_DOMAIN]->(wd) | wd.name ] WHERE d IN userDomains ]) AS domainOverlap,
       toFloat(duration.inMonths(
         date({year: toInteger(split(c.position_started_at,'-')[0]), month: toInteger(split(c.position_started_at,'-')[1])}),
         date()
       ).months) / 12.0 AS candidateExpYears
  OPTIONAL MATCH (c)-[:IN_CITY]->(ci:City)-[:IN_COUNTRY]->(ct:Country)
  WITH c AS ctx, matchedSkills, userSkillsCount, domainOverlap, ci, ct, desiredCountry, desiredCity,
       CASE WHEN userSkillsCount = 0 THEN 0.0 ELSE toFloat(matchedSkills)/userSkillsCount END AS coverage,
       CASE WHEN domainOverlap > 0 THEN 1 ELSE 0 END AS domainMatch,
       abs(candidateExpYears - userRoleExp) AS expDelta
  WITH ctx, matchedSkills, coverage, domainMatch, expDelta, domainOverlap,
       CASE WHEN desiredCountry IS NULL OR ct.name IS NULL THEN 0
            WHEN ct.name = desiredCountry THEN 1 ELSE 0 END AS countryMatch,
       CASE WHEN desiredCity IS NULL OR ci.name IS NULL THEN 0
            WHEN ci.name = desiredCity AND (desiredCountry IS NULL OR ct.name = desiredCountry) THEN 1 ELSE 0 END AS cityMatch
  RETURN ctx, matchedSkills, coverage, domainMatch, expDelta, domainOverlap, countryMatch, cityMatch
}
WITH ctx, matchedSkills, coverage, domainMatch, expDelta, domainOverlap, countryMatch, cityMatch,
     minCoverage, expTolerance, requireDomain, requireCountry, requireCity
WHERE coverage >= minCoverage
  AND expDelta <= expTolerance
  AND (requireDomain = false OR domainOverlap >= 1)
  AND (requireCountry = false OR countryMatch = 1)
  AND (requireCity = false OR cityMatch = 1)`,
  CONTEXT_DETAILS: `MATCH (user:User {user_id: $user_id})-[:HAS_CONTEXT]->(context:Context {context_id: $context_id})-[:HAS_POSITION]->(position:Position)
OPTIONAL MATCH (context)-[:IN_WORK_DOMAIN]->(domain:WorkDomain)
OPTIONAL MATCH (context)-[:USES_SKILL]->(skill:Skill)
OPTIONAL MATCH (context)-[:IN_INDUSTRY]->(industry:Industry)
OPTIONAL MATCH (context)-[:IN_CITY]->(city:City)-[:IN_COUNTRY]->(country:Country)

RETURN {
  // Системные поля
  context_id: context.context_id,

  // Обязательные поля
  created_at: context.created_at,
  creation_reason: context.creation_reason,
  position: position.name,
  domains: collect(DISTINCT domain.name),
  skills: collect(DISTINCT {name: skill.name, category: skill.category}),

  // Плоская структура
  industry: industry.name,
  company_size: context.company_size,
  country_code: country.name,  // ✅ Теперь country.name содержит код
  city_name: city.name,
  work_type: context.work_type,
  team_size: context.team_size
} as currentContext`,
  CONTEXT_TRAILS: `MATCH (from_ctx:Context {context_id: $from_context_id})
-[:STEPS_ON]->(trail:Trail)-[:STEPS_TO]->(to_ctx:Context {context_id: $to_context_id})
OPTIONAL MATCH (trail)-[:DEVELOPS]->(spn:SkillPlatformNode)-[:ON_PLATFORM]->(platform:Platform)
RETURN trail, collect(spn.skill) AS skills_developed, collect(platform.name) AS platforms_used;`,
  SIMILAR_CONTEXTS: `/* ============================================
 * БЛОК 1: ПОИСК CURRENT КОНТЕКСТОВ
 * ============================================
 * *
 * 📥 ВХОДНЫЕ ДАННЫЕ (параметры):
 * - $currentContext - текущий контекст для поиска похожих
 * - $strictSkills - обязательные навыки для фильтрации
 * - $searchConstraints - ограничения поиска
 *
 * 📤 ВЫХОДНЫЕ ДАННЫЕ (передаются следующему блоку):
 * - dbCurrentUser: User - пользователь из БД с похожим контекстом
 * - dbCurrentContext: Context - найденный контекст похожий на запрошенный
 * - compatibilityPercent: Float - процент совместимости навыков (0-100)
 *
 * ---
 *
 * 💡 ЛОГИКА РАБОТЫ:
TODO
 */

/* === РЕАЛИЗАЦИЯ: УНИВЕРСАЛЬНЫЙ ПОИСК === */

// ШАГ 1: Используем единый параметр currentContext
WITH $currentContext AS requestedContext

// ШАГ 2: Ищем пользователей с подходящими контекстами в графе
// Паттерн поиска: User → HAS_CONTEXT → Context → HAS_POSITION → Position
MATCH
  (dbCurrentUser:User)-[:HAS_CONTEXT]->(dbCurrentContext:Context)-[:HAS_POSITION]->(dbPosition:Position)
WHERE
  requestedContext IS NOT NULL AND

  /* ============================================
   * СЕКЦИЯ 1: ОБЯЗАТЕЛЬНОЕ ПОЛЕ
   *
   * Это поле проверяется ВСЕГДА
   * Без совпадения по этому полю контекст не подходит
   *
   * Паттерн: db.field = requested.field
   * ============================================ */
  dbPosition.name = requestedContext.position AND

  /* ============================================
   * СЕКЦИЯ 2: ОПЦИОНАЛЬНЫЕ ПРОСТЫЕ ПОЛЯ
   *
   * Эти поля проверяются ТОЛЬКО если они заполнены в requestedContext
   * Если поле IS NULL → пропускаем проверку (считаем что подходит любое значение)
   *
   * Паттерн: (requested.field IS NULL OR db.field = requested.field)
   * ============================================ */

  // Условия работы: удаленка/офис/гибрид (плоская схема)
  (requestedContext.work_type IS NULL OR
   dbCurrentContext.work_type = requestedContext.work_type) AND


  /* ============================================
   * СЕКЦИЯ 3: ОПЦИОНАЛЬНЫЕ МАССИВЫ
   *
   * Эти поля содержат массивы/списки значений
   * Проверяем что ВСЕ элементы из запроса есть у контекста в БД
   *
   * Паттерн: (array IS NULL OR all(item IN array WHERE EXISTS {...}))
   *
   * Логика:
   * - Если массив IS NULL или пустой → пропускаем проверку
   * - Если массив заполнен → проверяем каждый элемент через all()
   * - all() = true только если ВСЕ элементы найдены в графе
   * ============================================ */

  // Домены работы (например: backend, frontend, mobile)
  (requestedContext.domains IS NULL OR
   all(
     d IN requestedContext.domains
     WHERE EXISTS {
       MATCH (dbCurrentContext)-[:IN_WORK_DOMAIN]->(wd:WorkDomain {name: d})
     }
   )) AND

  /* ============================================
   * СЕКЦИЯ 4: STRICT SKILLS (ОБЯЗАТЕЛЬНЫЕ НАВЫКИ)
   *
   * Это особая категория навыков из параметра $strictSkills
   * Они ВСЕГДА обязательны
   *
   * Используется для жесткой фильтрации по ключевым навыкам
   * Например: "обязательно Python" или "обязательно опыт с Kubernetes"
   * ============================================ */
  all(
    s IN $strictSkills
    WHERE EXISTS {
      MATCH (dbCurrentContext)-[:USES_SKILL]->(skill:Skill {name: s})
    }
  )

// ШАГ 3: Вычисляем процент совместимости по навыкам
// Это метрика качества совпадения навыков из requestedContext с навыками найденного контекста
WITH dbCurrentUser, dbCurrentContext, requestedContext,
     CASE
       // Если навыки не указаны → считаем 100% совместимость (нет требований)
       WHEN requestedContext.skills IS NULL OR size(requestedContext.skills) = 0
       THEN 100.0

       // Иначе считаем процент: (найденные навыки / запрошенные навыки) * 100
       ELSE toFloat(size([
         skill IN requestedContext.skills
         WHERE EXISTS {
           MATCH (dbCurrentContext)-[:USES_SKILL]->(s:Skill {name: skill.name})
         }
       ])) / size(requestedContext.skills) * 100.0
     END AS compatibilityPercent

// 🔄 Передаем данные следующему блоку через WITH
// Отфильтровываем NULL значения (на случай если ничего не нашлось)
WITH dbCurrentUser, dbCurrentContext, compatibilityPercent
WHERE dbCurrentUser IS NOT NULL`,
  TARGET_ACHIEVERS: `/* ============================================
 * БЛОК 2b: ПОИСК TARGET КОНТЕКСТОВ (STANDALONE)
 * ============================================
 *
 * 📍 ПОЗИЦИЯ В ЦЕПОЧКЕ ВЫЗОВОВ:
 *
 * REAL_CURRENT_TO_TARGET:   не используется
 * UNREAL_CURRENT_TO_TARGET: не используется
 * CURRENT_ONLY:             не используется
 * TARGET_ONLY:              [2b standalone] → 5 (analyze-career-paths)
 * TARGET_SEARCH:            [2b standalone] → 2c (map-target-to-search-result)
 *
 * ---
 *
 * 🎯 НАЗНАЧЕНИЕ:
 * Найти ВСЕХ пользователей кто достиг целевой позиции
 * Независимый поиск без привязки к current контексту
 *
 * Универсальный блок для:
 * - TARGET_ONLY: поиск для аналитики путей
 * - TARGET_SEARCH: поиск конкретных людей с фильтрацией
 *
 * ---
 *
 * 📥 ВХОДНЫЕ ДАННЫЕ:
 * Параметры:
 * - $targetContext (optional) - целевой контекст (позиция, навыки и т.д.)
 * - $searchConstraints - ограничения поиска и дополнительные фильтры
 *   - results_limit: лимит результатов
 *   - min_experience_months: минимальный опыт (для TARGET_SEARCH)
 *   - max_experience_months: максимальный опыт (для TARGET_SEARCH)
 *   - required_skills: обязательные навыки (для TARGET_SEARCH)
 *
 * 📤 ВЫХОДНЫЕ ДАННЫЕ (передаются следующему блоку):
 * - dbCurrentUser: User - NULL (для совместимости)
 * - dbCurrentContext: Context - NULL (для совместимости)
 * - compatibilityPercent: Float - 0.0 (для совместимости)
 * - dbTargetContext: Context - найденный целевой контекст
 * - targetUser: User - пользователь достигший цели
 */

/* === РЕАЛИЗАЦИЯ: НЕЗАВИСИМЫЙ ПОИСК ВСЕХ С TARGET === */

WITH $targetContext AS requestedTargetContext

// Для TARGET_ONLY ищем всех с целевой позицией независимо от текущих пользователей
MATCH
  (targetUser:User)-[:HAS_CONTEXT]->
  (dbTargetContext:Context)-[:HAS_POSITION]->(dbTargetPosition:Position)
WHERE
  // Используем constraints из searchConstraints если target_context не задан
  (requestedTargetContext IS NOT NULL AND (
    (requestedTargetContext.position IS NULL OR dbTargetPosition.name = requestedTargetContext.position)
  )) OR
  (requestedTargetContext IS NULL AND (
    // Базовые ограничения если target не задан
    TRUE // будет фильтроваться в следующих блоках
  ))

  // === ДОПОЛНИТЕЛЬНЫЕ ФИЛЬТРЫ ИЗ searchConstraints (для TARGET_SEARCH) ===

  // Обязательные навыки (если указаны, дополнительно к targetContext.skills)
  AND ($searchConstraints.required_skills IS NULL OR
       size($searchConstraints.required_skills) = 0 OR
       all(
         requiredSkill IN $searchConstraints.required_skills
         WHERE EXISTS {
           MATCH (dbTargetContext)-[:USES_SKILL]->(s:Skill {name: requiredSkill})
         }
       ))

// 🔄 Передаем данные следующему блоку через WITH
// dbCurrentUser и dbCurrentContext = NULL т.к. нет привязки к current
WITH NULL AS dbCurrentUser, NULL AS dbCurrentContext, 0.0 AS compatibilityPercent, dbTargetContext, targetUser`,
} as const;

// Processors domain
export const Processors = {
  ACHIEVEMENT_PATHS: `/* ============================================
 * БЛОК 5: АНАЛИЗ КАРЬЕРНЫХ ПУТЕЙ (TARGET_ONLY)
 * ============================================
 *
 * 📍 ПОЗИЦИЯ В ЦЕПОЧКЕ ВЫЗОВОВ:
 *
 * REAL_CURRENT_TO_TARGET:   skip (не используется)
 * UNREAL_CURRENT_TO_TARGET: skip (не используется)
 * CURRENT_ONLY:             skip (не используется)
 * TARGET_ONLY:              2 → [5] ✅ ВОЗВРАТ РЕЗУЛЬТАТА
 *
 * ---
 *
 * 🎯 НАЗНАЧЕНИЕ:
 * Проанализировать карьерные пути достижения целевой позиции
 * Показывает: откуда люди пришли, сколько времени заняло, статистику по группам
 *
 * Логика: находим всех с target позицией, смотрим на их started_working контекст,
 * группируем по начальным условиям и считаем статистику
 *
 * ---
 *
 * 📥 ВХОДНЫЕ ДАННЫЕ (от предыдущего блока):
 * - dbTargetContext: Context - целевые контексты (кто достиг цели)
 * - targetUser: User - пользователи достигшие цели
 *
 * Параметры:
 * - $targetContext - целевая позиция для анализа
 *
 * 📤 ВЫХОДНЫЕ ДАННЫЕ:
 * 🎯 ВОЗВРАЩАЕТ готовый объект TargetAnalysisResult через literal map:
 * {
 *   targetPosition, totalAvatarsFound,
 *
 *   achievementPaths: [{ // группировка по начальным условиям
 *     fromPosition, startingIndustry, startingCompanySize,
 *     percentage_of_achievers, average_transition_months, totalMonthsFromStart,
 *     success_rate, avatarCount, avgPositionChanges, avgCompanyChanges, firstPromotionMonths
 *   }],
 *
 *   timing_insights: { // общая статистика по времени
 *     medianMonths, percentile25Months, percentile75Months,
 *     averageAgeAtAchievement, averageStartingAge
 *   }
 * } AS result
 *
 * ❌ НЕ возвращает отдельные поля - только готовый literal map
 */

/* === РЕАЛИЗАЦИЯ: АНАЛИЗ КАРЬЕРНЫХ ПУТЕЙ ДЛЯ TARGET_ONLY === */

// 🎯 ЭТАП 1: ПОЛУЧЕНИЕ ВХОДНЫХ ДАННЫХ
// Получаем данные от find-target-contexts блока
WITH dbTargetContext, targetUser
WHERE dbTargetContext IS NOT NULL AND targetUser IS NOT NULL

// 🔍 ЭТАП 2: ПОИСК СТАРТОВЫХ КОНТЕКСТОВ
// Находим стартовые контексты для каждого пользователя достигшего цели
// ВАЖНО: ищем контексты с 'started_working' и сразу джойним Position ноды
MATCH (targetUser)-[:HAS_CONTEXT]->(startedContext:Context)-[:HAS_POSITION]->(startedPosition:Position)
WHERE 'started_working' IN startedContext.creation_reason

// ⏱️ ЭТАП 3: РАСЧЕТ ВРЕМЕННЫХ МЕТРИК И ВОЗРАСТОВ
// Собираем информацию о пути от start до target
WITH targetUser, startedContext, dbTargetContext, startedPosition,
     // Время от начала карьеры до target
     duration.inMonths(
       date(startedContext.created_at),
       date(dbTargetContext.created_at)
     ).months AS totalMonthsFromStart,

     // Возраст на начало карьеры и достижения цели
     CASE
       WHEN startedContext.birth_year IS NOT NULL
       THEN startedContext.created_at.year - startedContext.birth_year
       ELSE NULL
     END AS startingAge,

     CASE
       WHEN dbTargetContext.birth_year IS NOT NULL
       THEN dbTargetContext.created_at.year - dbTargetContext.birth_year
       ELSE NULL
     END AS achievementAge

// 📊 ЭТАП 4: ГРУППИРОВКА ПО НАЧАЛЬНЫМ УСЛОВИЯМ
// Группируем по начальным условиям для анализа путей
WITH
     startedPosition.name AS fromPosition,
     startedContext.industry AS startingIndustry,
     startedContext.company_size AS startingCompanySize,
     collect({
       user_id: targetUser.user_id,
       total_months: totalMonthsFromStart,
       startingAge: startingAge,
       achievementAge: achievementAge,
       targetContext: dbTargetContext
     }) AS achieversData

// 🧮 ЭТАП 5: ВЫЧИСЛЕНИЕ СТАТИСТИКИ ДЛЯ КАЖДОЙ ГРУППЫ
// Вычисляем статистику для каждого пути
WITH fromPosition, startingIndustry, startingCompanySize, achieversData,
     size(achieversData) AS avatarCount,

     // Временные метрики - извлекаем массивы для дальнейших расчетов
     [data IN achieversData | data.total_months] AS allDurations,
     [data IN achieversData WHERE data.startingAge IS NOT NULL | data.startingAge] AS startingAges,
     [data IN achieversData WHERE data.achievementAge IS NOT NULL | data.achievementAge] AS achievementAges

// 🏗️ ЭТАП 6: СОЗДАНИЕ ОБЪЕКТОВ ПУТЕЙ ДОСТИЖЕНИЯ
// Создаем объект пути достижения для каждой группы
WITH fromPosition, startingIndustry, startingCompanySize,
     avatarCount, allDurations, startingAges, achievementAges,
     {
       fromPosition: fromPosition,
       startingIndustry: startingIndustry,
       startingCompanySize: startingCompanySize,
       percentageOfAchievers: 100.0, // TODO: рассчитать от общего числа попыток
       averageTransitionMonths: CASE
         WHEN size(allDurations) > 0
         THEN toFloat(reduce(sum = 0, dur IN allDurations | sum + dur)) / size(allDurations)
         ELSE 0.0
       END,
       totalMonthsFromStart: CASE
         WHEN size(allDurations) > 0
         THEN toFloat(reduce(sum = 0, dur IN allDurations | sum + dur)) / size(allDurations)
         ELSE 0.0
       END,
       successRate: 1.0, // TODO: рассчитать реальный success rate
       avatarCount: avatarCount,
       avgPositionChanges: 0, // TODO: подсчитать среднее количество смен позиций
       avgCompanyChanges: 0, // TODO: подсчитать среднее количество смен компаний
       firstPromotionMonths: 0 // TODO: время до первого повышения
     } AS achievementPath

// 📈 ЭТАП 7: АГРЕГАЦИЯ ВСЕХ ПУТЕЙ И ОБЩАЯ СТАТИСТИКА
// Группируем все пути и вычисляем общую статистику
WITH collect(achievementPath) AS achievementPaths,
     // Собираем все длительности для общей статистики
     reduce(allDurations = [], path IN collect(achievementPath) |
       allDurations + [path.totalMonthsFromStart]) AS allPathDurations,
     // Собираем возрасты из всех групп
     reduce(allStartingAges = [], path IN collect({path: achievementPath, ages: startingAges}) |
       allStartingAges + path.ages) AS combinedStartingAges,
     reduce(allAchievementAges = [], path IN collect({path: achievementPath, ages: achievementAges}) |
       allAchievementAges + path.ages) AS combinedAchievementAges,
     // Общее количество достигших
     reduce(totalAvatars = 0, path IN collect(achievementPath) |
       totalAvatars + path.avatarCount) AS totalAvatarsFound

// ✅ ЭТАП 8: ПОШАГОВАЯ БЕЗОПАСНАЯ СОРТИРОВКА NATIVE CYPHER
// Сортируем каждый массив отдельно с проверкой на пустоту

// ШАГ 8.1: Сортируем длительности (если есть данные)
WITH achievementPaths, totalAvatarsFound, allPathDurations,
     combinedStartingAges, combinedAchievementAges

WITH achievementPaths, totalAvatarsFound, combinedStartingAges, combinedAchievementAges,
     CASE
       WHEN size(allPathDurations) = 0 THEN []
       ELSE allPathDurations
     END AS durationsToSort

// Применяем сортировку только к непустому массиву
CALL {
  WITH durationsToSort
  UNWIND durationsToSort AS duration
  WITH duration ORDER BY duration
  RETURN collect(duration) AS sortedDurations
}

// ШАГ 8.2: Сортируем стартовые возрасты (если есть данные)
WITH achievementPaths, totalAvatarsFound, combinedAchievementAges, sortedDurations,
     CASE
       WHEN size(combinedStartingAges) = 0 THEN []
       ELSE combinedStartingAges
     END AS startAgesToSort

CALL {
  WITH startAgesToSort
  UNWIND startAgesToSort AS startAge
  WITH startAge ORDER BY startAge
  RETURN collect(startAge) AS sortedStartingAges
}

// ШАГ 8.3: Сортируем возрасты достижения (если есть данные)
WITH achievementPaths, totalAvatarsFound, sortedDurations, sortedStartingAges,
     CASE
       WHEN size(combinedAchievementAges) = 0 THEN []
       ELSE combinedAchievementAges
     END AS achieveAgesToSort

CALL {
  WITH achieveAgesToSort
  UNWIND achieveAgesToSort AS achieveAge
  WITH achieveAge ORDER BY achieveAge
  RETURN collect(achieveAge) AS sortedAchievementAges
}

// 🎯 ЭТАП 9: ФОРМИРОВАНИЕ ФИНАЛЬНОГО РЕЗУЛЬТАТА
// ВОЗВРАЩАЕМ ГОТОВЫЙ TargetAnalysisResult через literal map
RETURN {
  targetPosition: $targetContext.position,
  totalAvatarsFound: totalAvatarsFound,

  achievementPaths: achievementPaths,

  timingInsights: {
    medianMonths: CASE
      WHEN size(sortedDurations) > 0
      THEN sortedDurations[size(sortedDurations) / 2]
      ELSE 0
    END,
    percentile25Months: CASE
      WHEN size(sortedDurations) > 0
      THEN sortedDurations[size(sortedDurations) / 4]
      ELSE 0
    END,
    percentile75Months: CASE
      WHEN size(sortedDurations) > 0
      THEN sortedDurations[size(sortedDurations) * 3 / 4]
      ELSE 0
    END,
    averageAgeAtAchievement: CASE
      WHEN size(sortedAchievementAges) > 0
      THEN toFloat(reduce(sum = 0, age IN sortedAchievementAges | sum + age)) / size(sortedAchievementAges)
      ELSE 0.0
    END,
    averageStartingAge: CASE
      WHEN size(sortedStartingAges) > 0
      THEN toFloat(reduce(sum = 0, age IN sortedStartingAges | sum + age)) / size(sortedStartingAges)
      ELSE 0.0
    END
  }
} AS result

LIMIT 1 // Возвращаем один агрегированный результат`,
  CAREER_PROGRESSION: `/* ============================================
 * БЛОК 4: АНАЛИЗ ПРОГРЕССИИ (CURRENT_ONLY)
 * ============================================
 *
 * 📍 ПОЗИЦИЯ В ЦЕПОЧКЕ ВЫЗОВОВ:
 *
 * REAL_CURRENT_TO_TARGET:   skip (не используется)
 * UNREAL_CURRENT_TO_TARGET: skip (не используется)
 * CURRENT_ONLY:             1 → [4] ✅ ВОЗВРАТ РЕЗУЛЬТАТА
 * TARGET_ONLY:              skip (не используется)
 *
 * ---
 *
 * 🎯 НАЗНАЧЕНИЕ:
 * Проанализировать что происходит с пользователями через заданный период времени
 * Отслеживает карьерные изменения: смена позиции, локации, компании и т.д.
 *
 * Логика: берем current-like контексты и смотрим на первый контекст через N месяцев
 *
 * ---
 *
 * 📥 ВХОДНЫЕ ДАННЫЕ (от предыдущего блока):
 * - dbCurrentUser: User - пользователи с current-like контекстами
 * - dbCurrentContext: Context - их текущие контексты
 * - compatibilityPercent: Float - совместимость с запрошенным контекстом
 *
 * Параметры:
 * - $timePeriod - временной период (6|12|18|24 месяцев)
 * - $reasonsToTrack - массив триггеров для отслеживания или "all"
 * - $searchConstraints - ограничения (например, max_users)
 *
 * 📤 ВЫХОДНЫЕ ДАННЫЕ:
 * 🎯 ВОЗВРАЩАЕТ готовый объект AvatarProgressionResult через literal map:
 * {
 *   user_id, current_like_context_id, compatibilityPercent,
 *   progression_context_id, context_triggers,
 *
 *   // Опциональные поля (заполняются если триггер присутствует):
 *   months_in_position_before_change, age_at_position_change,
 *   destination_country, destination_city,
 *   company_type_transition, industry_transition, tech_stack_transition, work_format_transition
 * } AS result
 *
 * ❌ НЕ возвращает отдельные поля - только готовый literal map
 */

/* === РЕАЛИЗАЦИЯ: АНАЛИЗ ПРОГРЕССИИ ДЛЯ CURRENT_ONLY === */

// Получаем данные от find-current-contexts блока
WITH dbCurrentUser, dbCurrentContext, compatibilityPercent
WHERE dbCurrentUser IS NOT NULL

// Ищем контекст через заданный временной период
OPTIONAL MATCH (dbCurrentUser)-[:HAS_CONTEXT]->(dbTransitionContext:Context)
WHERE
  dbTransitionContext <> dbCurrentContext AND
  duration.inMonths(
    date(dbCurrentContext.created_at),
    date(dbTransitionContext.created_at)
  ).months >= $timePeriod

// Берем первый контекст после периода (ближайший по времени)
WITH dbCurrentUser, dbCurrentContext, compatibilityPercent, dbTransitionContext
ORDER BY dbTransitionContext.created_at ASC
WITH dbCurrentUser, dbCurrentContext, compatibilityPercent,
     head(collect(dbTransitionContext)) AS dbTransitionContext

// Анализируем триггеры если контекст найден
WITH dbCurrentUser, dbCurrentContext, compatibilityPercent, dbTransitionContext,
     // Извлекаем триггеры из creation_reason (массив строк)
     CASE
       WHEN dbTransitionContext IS NOT NULL
       THEN coalesce(dbTransitionContext.creation_reason, [])
       ELSE []
     END AS contextTriggers

// Проверяем какие триггеры нас интересуют (фильтр по $reasonsToTrack)
WITH dbCurrentUser, dbCurrentContext, compatibilityPercent, dbTransitionContext, contextTriggers,
     // Оставляем только интересующие нас триггеры
     [trigger IN contextTriggers WHERE trigger IN $reasonsToTrack] AS relevantTriggers

// Вычисляем специфичные поля для каждого триггера
WITH *,
     // === ПОЗИЦИЯ ===
     CASE WHEN 'position_changed' IN relevantTriggers
       THEN {
         months_in_position: duration.inMonths(
           date(dbCurrentContext.created_at),
           date(dbTransitionContext.created_at)
         ).months,
         age_at_change: CASE
           WHEN dbCurrentContext.birth_year IS NOT NULL AND dbTransitionContext.created_at IS NOT NULL
           THEN dbTransitionContext.created_at.year - dbCurrentContext.birth_year
           ELSE NULL
         END
       }
       ELSE NULL
     END AS positionChangeData,

     // === ЛОКАЦИЯ ===
     CASE WHEN 'location_changed' IN relevantTriggers AND dbTransitionContext IS NOT NULL
       THEN {
         destination_country: dbTransitionContext.country_code,
         destination_city: dbTransitionContext.city_name
       }
       ELSE NULL
     END AS locationChangeData

// 🎯 ВОЗВРАЩАЕМ ГОТОВЫЙ AvatarProgressionResult через literal map (camelCase!)
RETURN {
  userId: dbCurrentUser.user_id,
  currentLikeContextId: dbCurrentContext.context_id,
  compatibilityPercent: compatibilityPercent,
  transitionContextId: CASE
    WHEN dbTransitionContext IS NOT NULL
    THEN dbTransitionContext.context_id
    ELSE ''
  END,
  contextTriggers: relevantTriggers,

  // Поля для позиции (если триггер присутствует) - с null safety
  monthsInPositionBeforeChange: CASE
    WHEN positionChangeData IS NOT NULL AND positionChangeData.months_in_position IS NOT NULL
    THEN positionChangeData.months_in_position
    ELSE 0
  END,
  ageAtPositionChange: CASE
    WHEN positionChangeData IS NOT NULL AND positionChangeData.age_at_change IS NOT NULL
    THEN positionChangeData.age_at_change
    ELSE 0
  END,

  // Поля для локации (если триггер присутствует) - с null safety
  destinationCountry: CASE
    WHEN locationChangeData IS NOT NULL THEN locationChangeData.destination_country
    ELSE ''
  END,
  destinationCity: CASE
    WHEN locationChangeData IS NOT NULL THEN locationChangeData.destination_city
    ELSE ''
  END,

  // TODO: Остальные триггеры - с default значениями для schema validation
  companyTypeTransition: '', // company_changed
  industryTransition: '',     // industry_changed
  techStackTransition: '',   // stack_changed
  workFormatTransition: ''   // work_format_changed
} AS result

LIMIT coalesce($searchConstraints.max_users, 100)`,
  COMPATIBILITY_SCORE: `/* ============================================
 * БЛОК 3: РАСЧЕТ МЕТРИК СОВМЕСТИМОСТИ (УПРОЩЕННАЯ ВЕРСИЯ ДЛЯ ОТЛАДКИ)
 * ============================================
 *
 * 📍 ПОЗИЦИЯ В ЦЕПОЧКЕ ВЫЗОВОВ:
 *
 * REAL_CURRENT_TO_TARGET:   1 → 2 → [3] ✅ ВОЗВРАТ РЕЗУЛЬТАТА
 * UNREAL_CURRENT_TO_TARGET: 1 → 2 → [3] ✅ ВОЗВРАТ РЕЗУЛЬТАТА
 * CURRENT_ONLY:             skip (не используется)
 * TARGET_ONLY:              skip (не используется)
 * TARGET_SEARCH:            skip (не используется)
 *
 * ---
 *
 * 🎯 НАЗНАЧЕНИЕ:
 * Вычислить детальные метрики перехода от current к target контексту
 * Анализирует: совпадение навыков, опыт, локацию, индустрию, время перехода
 *
 * ---
 *
 * 📥 ВХОДНЫЕ ДАННЫЕ (от предыдущих блоков):
 * - dbCurrentUser: User - пользователь с переходом current→target
 * - dbCurrentContext: Context - current-like контекст
 * - currentContextCompatibilityScore: Float - совместимость current контекста
 * - dbTargetContext: Context - target-like контекст
 * - targetContextCompatibilityScore: Float - совместимость target контекста
 *
 * Параметры:
 * - $currentContext - текущий контекст для сравнения полей
 * - $searchConstraints - ограничения (например, results_limit)
 *
 * ---
 *
 * 📤 ВЫХОДНЫЕ ДАННЫЕ:
 * CurrentToTargetResult {
 *   userId, currentLikeContextId, targetLikeContextId,
 *   trailPath, positionTimingDiff*,
 *   currentSkillsMatched, currentSkillsTotal, currentSkillsPercent,
 *   currentExperienceDiffMonths, transitionDurationMonths,
 *   countryMatch, cityMatch, companySizeMatch, industryMatch
 * } AS result
 *
 * ❌ НЕ возвращает отдельные поля - только готовый literal map
 */

/* === РЕАЛИЗАЦИЯ: УПРОЩЕННАЯ ВЕРСИЯ ДЛЯ ОТЛАДКИ === */

// Получаем данные от предыдущих блоков
WITH *
WHERE dbTargetContext IS NOT NULL // Только для current→target режимов

// === РАСЧЕТ РЕАЛЬНЫХ МЕТРИК СОВМЕСТИМОСТИ ===

// Навыки: сколько навыков из currentContext есть у dbCurrentContext
WITH *,
  CASE
    WHEN $currentContext.skills IS NULL OR size($currentContext.skills) = 0 THEN 0
    ELSE size([
      skill IN $currentContext.skills
      WHERE EXISTS {
        MATCH (dbCurrentContext)-[:USES_SKILL]->(s:Skill {name: skill.name})
      }
    ])
  END AS skillsMatched,

  CASE
    WHEN $currentContext.skills IS NULL THEN 0
    ELSE size($currentContext.skills)
  END AS skillsTotal,

// Географические совпадения (с обработкой NULL)
coalesce(dbCurrentContext.country_code = $currentContext.country_code, false) AS countryMatch,
coalesce(dbCurrentContext.city_name = $currentContext.city_name, false) AS cityMatch,

// Совпадения размеров (теперь учитываются в весах, а не фильтрах)
coalesce(dbCurrentContext.company_size = $currentContext.company_size, false) AS companySizeMatch,
coalesce(dbCurrentContext.team_size = $currentContext.team_size, false) AS teamSizeMatch

// Индустрия - жесткий фильтр, поэтому всегда true (не считаем отдельно)

// Строим путь обучения (Trail[]) между current и target для данного пользователя
// Избегаем shortestPath когда узлы одинаковые
OPTIONAL MATCH p = shortestPath((dbCurrentContext)-[:STEPS_ON|STEPS_TO*1..6]->(dbTargetContext))
WHERE dbCurrentContext.context_id <> dbTargetContext.context_id
WITH *,
     CASE WHEN p IS NULL THEN [] ELSE [n IN nodes(p) WHERE n:Trail] END AS pathTrails
WITH *,
     [t IN pathTrails WHERE EXISTS( (dbCurrentUser)-[:HAS_TRAIL]->(t) )] AS userTrails
WITH *,
     [t IN userTrails | {
        skill: t.skill,
        platform: t.platform,
        from_context_id: t.from_context_id,
        to_context_id: coalesce(t.to_context_id, null),
        total_duration_weeks: t.total_duration_weeks,
        schedule: {
          sessions_per_week: t.sessions_per_week,
          hours_per_session: t.hours_per_session
        },
        cost_usd: t.cost_usd,
        rating_course: t.rating_course,
        rating_platform: t.rating_platform,
        rating_schedule: t.rating_schedule,
        course_name: t.course_name,
        course_link: t.course_link,
        user_feedback: t.user_feedback
     }] AS trailPath

// 🎯 ВОЗВРАЩАЕМ РЕАЛЬНЫЙ CurrentToTargetResult
RETURN {
  userId: dbCurrentUser.user_id,
  currentLikeContextId: dbCurrentContext.context_id,
  targetLikeContextId: dbTargetContext.context_id,
  trailPath: trailPath,
  positionTimingDiffPercent: toFloat(0.0), // TODO: реализовать timing
  positionTimingDiffMonths: toInteger(0),
  currentSkillsMatched: skillsMatched,
  currentSkillsTotal: skillsTotal,
  currentSkillsPercent:
    CASE
      WHEN skillsTotal = 0 THEN toFloat(100.0)
      ELSE toFloat(skillsMatched) / skillsTotal * 100.0
    END,
  currentCompatibilityScore: currentContextCompatibilityScore,
  targetCompatibilityScore: targetContextCompatibilityScore,
  currentExperienceDiffMonths: toInteger(0), // TODO: реализовать experience diff
  transitionDurationMonths: toInteger(0), // TODO: реализовать transition duration
  countryMatch: countryMatch,
  cityMatch: cityMatch,
  companySizeMatch: companySizeMatch,
  industryMatch: dbCurrentContext.industry = dbTargetContext.industry // Dynamic industry comparison
} AS result

LIMIT 100`,
  EXPERIENCE_DATA: `/* ============================================
 * БЛОК: GET CURRENT EXPERIENCE
 * ============================================
 *
 * 🎯 НАЗНАЧЕНИЕ:
 * Получение текущего опыта работы пользователя
 *
 * 📥 ПАРАМЕТРЫ:
 * - $user_id - ID пользователя
 *
 * 📤 ВОЗВРАЩАЕТ:
 * - current_experience - текущий опыт в месяцах
 * - current_date - дата текущего контекста
 */

MATCH (user:User {user_id: $user_id})
OPTIONAL MATCH (user)-[:HAS_CONTEXT]->(current:Context {context_id: user.current_context_id})
RETURN null as current_experience,
       current.created_at as current_date`,
  SEARCH_RESULTS: `/* ============================================
 * БЛОК 2c: МАППИНГ TARGET → SEARCH RESULT
 * ============================================
 *
 * 📍 ПОЗИЦИЯ В ЦЕПОЧКЕ ВЫЗОВОВ:
 *
 * REAL_CURRENT_TO_TARGET:   не используется
 * UNREAL_CURRENT_TO_TARGET: не используется
 * CURRENT_ONLY:             не используется
 * TARGET_ONLY:              не используется
 * TARGET_SEARCH:            2b → [2c] ✅ ВОЗВРАТ РЕЗУЛЬТАТА
 *
 * ---
 *
 * 🎯 НАЗНАЧЕНИЕ:
 * Преобразовать найденные target контексты в структурированный результат
 * Возвращает TargetSearchResult (UserContext + user_id)
 *
 * ---
 *
 * 📥 ВХОДНЫЕ ДАННЫЕ (от блока 2b):
 * - dbTargetContext: Context - найденный контекст
 * - targetUser: User - пользователь с этим контекстом
 * - dbCurrentUser: NULL (не используется)
 * - dbCurrentContext: NULL (не используется)
 * - compatibilityPercent: 0.0 (не используется)
 *
 * Параметры:
 * - $searchConstraints - для LIMIT
 *
 * 📤 ВЫХОДНЫЕ ДАННЫЕ:
 * 🎯 ВОЗВРАЩАЕТ готовый объект TargetSearchResult через literal map:
 * {
 *   user_id, context_id,
 *   position, industry, company_size, country_code, city_name,
 *   work_type, team_size,
 *   created_at, creation_reason, birth_year,
 *   skills: [{name, category}], domains: [string]
 * } AS result
 *
 * ❌ НЕ возвращает отдельные поля - только готовый literal map
 */

/* === РЕАЛИЗАЦИЯ: МАППИНГ В TYPED RESULT === */

// Получаем данные от блока 2b
WITH targetUser, dbTargetContext
WHERE dbTargetContext IS NOT NULL

// Извлекаем связанные навыки и их категории через граф
OPTIONAL MATCH (dbTargetContext)-[:USES_SKILL]->(s:Skill)-[:IN_CATEGORY]->(sc:SkillCategory)
WITH targetUser, dbTargetContext, collect({
  name: s.name,
  category: sc.name
}) AS skills

// Извлекаем связанные домены через граф
OPTIONAL MATCH (dbTargetContext)-[:IN_WORK_DOMAIN]->(domain:WorkDomain)
WITH targetUser, dbTargetContext, skills, collect(domain.name) AS domains

// Извлекаем позицию (обязательная связь)
MATCH (dbTargetContext)-[:HAS_POSITION]->(position:Position)

// 🎯 ВОЗВРАЩАЕМ готовый TargetSearchResult через literal map
// Структура соответствует UserContext + user_id
RETURN {
  // Системные идентификаторы
  user_id: targetUser.user_id,
  context_id: dbTargetContext.context_id,

  // Основная информация (из UserContextSchema)
  created_at: toString(dbTargetContext.created_at),
  creation_reason: dbTargetContext.creation_reason,
  position: position.name,
  domains: domains,
  skills: skills,

  // Компания и локация
  industry: dbTargetContext.industry,
  company_size: dbTargetContext.company_size,
  country_code: dbTargetContext.country_code,
  city_name: dbTargetContext.city_name,
  work_type: dbTargetContext.work_type,
  team_size: dbTargetContext.team_size,

  // Опыт и дополнительная информация
  birth_year: targetUser.birth_year,
  citizenships: dbTargetContext.citizenships
} AS result

LIMIT toInteger(coalesce($searchConstraints.results_limit, 100))`,
} as const;

