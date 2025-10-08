/* ============================================
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
SET user.current_context_id = $context_id

