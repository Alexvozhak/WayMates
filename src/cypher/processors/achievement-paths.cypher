/* ============================================
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

LIMIT 1 // Возвращаем один агрегированный результат
