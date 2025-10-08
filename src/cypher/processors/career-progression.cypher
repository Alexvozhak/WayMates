/* ============================================
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

LIMIT coalesce($searchConstraints.max_users, 100)
