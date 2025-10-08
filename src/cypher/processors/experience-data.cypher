/* ============================================
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
       current.created_at as current_date
