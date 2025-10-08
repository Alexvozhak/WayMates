/* ============================================
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

LIMIT toInteger(coalesce($searchConstraints.results_limit, 100))
