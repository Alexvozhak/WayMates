import Cypher from '@neo4j/cypher-builder';

/**
 * User-[:HAS_GOAL]->Goal
 */
export function userHasGoal(
  userNode: Cypher.Node,
  goalNode: Cypher.Node
): Cypher.Pattern {
  return new Cypher.Pattern(userNode, { labels: ['User'] })
    .related(new Cypher.NamedRelationship('hasGoal'), { type: 'HAS_GOAL' })
    .to(goalNode, { labels: ['Goal'] });
}
