export function buildCurrentToTargetQuery(
  whereClause: string,
  scoreClause: string,
  searchCtx: string = "requestedCurrentContext",
  candidateCtx: string = "dbCurrentContext"
): string {
  const normalizedWhere = (whereClause || "")
    .replace(/^\s*WHERE\s+/i, "")
    .trim();
  const whereBlock = [
    `${searchCtx} IS NOT NULL`,
    normalizedWhere ? normalizedWhere : undefined,
  ]
    .filter(Boolean)
    .join(" AND\n  ");

  return `/* ============================================
 * ОРКЕСТРИРОВАННЫЙ ПОИСК CURRENT КОНТЕКСТОВ
 * ============================================ */

// ШАГ 1: Получаем контекст для поиска 
WITH $currentContext AS ${searchCtx} 

// ШАГ 2: Поиск похожих контекстов с динамической фильтрацией
MATCH
  (dbCurrentUser:User)-[:HAS_CONTEXT]->(${candidateCtx}:Context)
WITH dbCurrentUser, ${candidateCtx}, ${searchCtx}
WHERE
  ${whereBlock}

${scoreClause}

// ШАГ 3: Передаём результаты дальше (закрепляем переменные для следующего блока)
WITH dbCurrentUser, ${candidateCtx} AS dbCurrentContext, compatibilityScore AS currentContextCompatibilityScore
WHERE dbCurrentUser IS NOT NULL
WITH dbCurrentUser, dbCurrentContext, currentContextCompatibilityScore`;
}

export function buildTargetTransitionQuery(
  whereClause: string,
  scoreClause: string,
  searchCtx: string = "requestedTargetContext",
  targetCtx: string = "dbTargetContext"
): string {
  const normalizedWhere = (whereClause || "")
    .replace(/^\s*WHERE\s+/i, "")
    .trim();

  // Добавляем фильтр исключения того же контекста (карьерный переход, а не статус-кво)
  const whereBlock = [
    `${searchCtx} IS NOT NULL`,
    `${targetCtx}.context_id <> dbCurrentContext.context_id`, // исключаем дубли
    normalizedWhere ? normalizedWhere : undefined,
  ]
    .filter(Boolean)
    .join(" AND\n  ");

  return `/* ============================================
 * ОРКЕСТРИРОВАННЫЙ ПОИСК TARGET КОНТЕКСТОВ  
 * ============================================ */

// Сохраняем все существующие переменные и добавляем $targetContext
WITH *, $targetContext AS ${searchCtx}

// Поиск target контекстов у найденных пользователей  
MATCH
  (dbCurrentUser)-[:HAS_CONTEXT]->(${targetCtx}:Context)

// Сохраняем ВСЕ переменные из предыдущего WITH + новые из MATCH
WITH *, ${targetCtx}, ${searchCtx}
WHERE
  ${whereBlock}

${scoreClause}

// Передаём результаты следующему блоку (совместимость с существующей цепочкой)
// Используем WITH * чтобы сохранить ВСЕ переменные включая currentContextCompatibilityScore
// Добавляем targetContextCompatibilityScore для второй стадии
WITH *, compatibilityScore AS targetContextCompatibilityScore
WHERE ${targetCtx} IS NOT NULL`;
}
