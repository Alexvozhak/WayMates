import Cypher from '@neo4j/cypher-builder';

export function goalCreate() {
  const node = new Cypher.NamedNode('goal');
  const pattern = new Cypher.Pattern(node, { labels: ['Goal'] });

  return { node, pattern };
}
