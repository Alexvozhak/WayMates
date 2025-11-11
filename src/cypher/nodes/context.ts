import Cypher from '@neo4j/cypher-builder';

export function contextById(paramName: string) {
  const node = new Cypher.NamedNode('context');
  const pattern = new Cypher.Pattern(node, {
    labels: ['Context'],
    properties: { contextId: new Cypher.NamedParam(paramName, paramName) }
  });

  return { node, pattern };
}

export function contextCreate() {
  const node = new Cypher.NamedNode('context');
  const pattern = new Cypher.Pattern(node, { labels: ['Context'] });

  return { node, pattern };
}
