/* ============================================
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
WITH NULL AS dbCurrentUser, NULL AS dbCurrentContext, 0.0 AS compatibilityPercent, dbTargetContext, targetUser
