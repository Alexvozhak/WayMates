import Cypher from '@neo4j/cypher-builder';
import { userById } from '../nodes/user.js';
import { contextCreate } from '../nodes/context.js';
import { userHasCurrentContext } from '../patterns/user-context.js';
import { enrichContext } from '../enrichment/context.js';
import { applyOptionalMatches } from '../helpers/query.js';

/**
 * Получить текущий контекст пользователя с enrichment
 */
export function userCurrentContextQuery(): Cypher.Return {
  const { node: user } = userById('userId');
  const { node: context } = contextCreate();

  const mainPattern = userHasCurrentContext(user, context);
  const enriched = enrichContext(context);

  return applyOptionalMatches(
      new Cypher.Match(mainPattern),
      enriched.patterns
    )
    .with(...enriched.withClause)
    .return([enriched.projection, 'context']);
}

/**
 * Получить currentContextId пользователя
 */
export function userCurrentContextIdQuery(): Cypher.Return {
  const { node: user, pattern: userPattern } = userById('userId');

  return new Cypher.Match(userPattern)
    .where(Cypher.isNotNull(user.property('currentContextId')))
    .return([user.property('currentContextId'), 'currentContextId']);
}
