import Cypher from '@neo4j/cypher-builder';

/**
 * User-[:HAS_CONTEXT]->Context (текущий контекст)
 */
export function userHasCurrentContext(
  userNode: Cypher.Node,
  contextNode: Cypher.Node
): Cypher.Pattern {
  return new Cypher.Pattern(userNode, { labels: ['User'] })
    .related(new Cypher.NamedRelationship('hasContext'), { type: 'HAS_CONTEXT' })
    .to(contextNode, {
      labels: ['Context'],
      properties: { contextId: userNode.property('currentContextId') }
    });
}

/**
 * User-[:HAS_CONTEXT]->Context (любой контекст)
 */
export function userHasContext(
  userNode: Cypher.Node,
  contextNode: Cypher.Node
): Cypher.Pattern {
  return new Cypher.Pattern(userNode, { labels: ['User'] })
    .related(new Cypher.NamedRelationship('hasContext'), { type: 'HAS_CONTEXT' })
    .to(contextNode, { labels: ['Context'] });
}
