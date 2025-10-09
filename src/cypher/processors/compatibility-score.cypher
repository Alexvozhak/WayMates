/* ============================================
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
OPTIONAL MATCH p = shortestPath((dbCurrentContext)-[:STEPS_ON|STEPS_TO*1..6]->(dbTargetContext))
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

LIMIT 100
