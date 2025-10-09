export function buildCurrentToTargetQuery(
  whereClause: string,
  scoreClause: string
): string {
  const whereBlock = [
    `requestedCurrentContext IS NOT NULL`,
    whereClause ? whereClause.replace(/^\s*WHERE\s+/i, "").trim() : undefined,
  ]
    .filter(Boolean)
    .join(" AND\n  ");

  return `/* ============================================
 * ОРКЕСТРИРОВАННЫЙ ПОИСК CURRENT КОНТЕКСТОВ
 * ============================================ */

// ШАГ 1: Получаем контекст для поиска 
WITH $currentContext AS requestedCurrentContext 

// ШАГ 2: Поиск похожих контекстов с динамической фильтрацией
MATCH
  (dbCurrentUser:User)-[:HAS_CONTEXT]->(dbCurrentContext:Context)
WITH *, dbCurrentUser, dbCurrentContext, requestedCurrentContext
WHERE
  ${whereBlock}

${scoreClause}

// ШАГ 3: Передаём результаты дальше (закрепляем переменные для следующего блока)
WITH *, dbCurrentUser, dbCurrentContext AS dbCurrentContext, compatibilityScore AS currentContextCompatibilityScore
WHERE dbCurrentUser IS NOT NULL
WITH *, dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore`;
}

export function buildTargetTransitionQuery(
  whereClause: string,
  scoreClause: string
): string {
  // Добавляем фильтр исключения того же контекста (карьерный переход, а не статус-кво)
  const whereBlock = [
    `requestedTargetContext IS NOT NULL`,
    `dbTargetContext.context_id <> dbCurrentContext.context_id`, // исключаем дубли
    whereClause ? whereClause.replace(/^\s*WHERE\s+/i, "").trim() : undefined,
  ]
    .filter(Boolean)
    .join(" AND\n  ");

  return `/* ============================================
 * ОРКЕСТРИРОВАННЫЙ ПОИСК TARGET КОНТЕКСТОВ  
 * ============================================ */

// Сохраняем все существующие переменные и добавляем $targetContext
WITH *, $targetContext AS requestedTargetContext

// Поиск target контекстов у найденных пользователей  
MATCH
  (dbCurrentUser)-[:HAS_CONTEXT]->(dbTargetContext:Context)

// Сохраняем ВСЕ переменные из предыдущего WITH + новые из MATCH
WITH *, dbCurrentUser, dbTargetContext, requestedTargetContext
WHERE
  ${whereBlock}

${scoreClause}

// Передаём результаты следующему блоку (совместимость с существующей цепочкой)
// Используем WITH * чтобы сохранить ВСЕ переменные включая currentContextCompatibilityScore
// Добавляем targetContextCompatibilityScore для второй стадии
WITH *, dbCurrentUser, dbTargetContext, compatibilityScore AS targetContextCompatibilityScore
WHERE dbTargetContext IS NOT NULL`;
}
