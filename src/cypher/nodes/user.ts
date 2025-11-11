import Cypher from '@neo4j/cypher-builder';

export function userById(paramName: string) {
  const node = new Cypher.NamedNode('user');
  const pattern = new Cypher.Pattern(node, {
    labels: ['User'],
    properties: { userId: new Cypher.NamedParam(paramName, paramName) }
  });

  return { node, pattern };
}

export function userCreate() {
  const node = new Cypher.NamedNode('user');
  const pattern = new Cypher.Pattern(node, { labels: ['User'] });

  return { node, pattern };
}
