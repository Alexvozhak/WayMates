import Cypher from '@neo4j/cypher-builder';

/**
 * collect(DISTINCT expression)
 */
export function collectDistinct(expr: Cypher.Expr): Cypher.Raw {
  return new Cypher.Raw(
    (ctx: Cypher.RawCypherContext) =>
      `collect(DISTINCT ${ctx.compile(expr)})`
  );
}

/**
 * duration.between(datetime(start), datetime(end)).months
 */
export function durationInMonths(
  startExpr: Cypher.Expr,
  endExpr: Cypher.Expr
): Cypher.Raw {
  const start = Cypher.datetime(startExpr);
  const end = Cypher.datetime(endExpr);

  return new Cypher.Raw(
    (ctx: Cypher.RawCypherContext) =>
      `duration.between(${ctx.compile(start)}, ${ctx.compile(end)}).months`
  );
}
