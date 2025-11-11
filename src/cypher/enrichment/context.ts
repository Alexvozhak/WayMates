import Cypher from '@neo4j/cypher-builder';
import { collectDistinct } from '../helpers/aggregations.js';

export type RelConfig = {
  key: string;
  relationship: string;
  nodeLabel: string;
};

export const DEFAULT_CONTEXT_RELS: RelConfig[] = [
  { key: 'position', relationship: 'HAS_POSITION', nodeLabel: 'Position' },
  { key: 'workDomain', relationship: 'IN_WORK_DOMAIN', nodeLabel: 'WorkDomain' },
  { key: 'skill', relationship: 'USES_SKILL', nodeLabel: 'Skill' },
  { key: 'industry', relationship: 'IN_INDUSTRY', nodeLabel: 'Industry' },
  { key: 'city', relationship: 'IN_CITY', nodeLabel: 'City' },
  { key: 'country', relationship: 'IN_COUNTRY', nodeLabel: 'Country' },
];

/**
 * Enrichment compositor - возвращает конфиг для OPTIONAL MATCH + WITH + RETURN
 * Паттерн из Kysely: helper function возвращает всё необходимое для композиции
 */
export function enrichContext(
  contextNode: Cypher.Node,
  configs: RelConfig[] = DEFAULT_CONTEXT_RELS
) {
  const nodes = new Map<string, Cypher.Node>();
  const patterns: Cypher.Pattern[] = [];

  for (const { key, relationship, nodeLabel } of configs) {
    const targetNode = new Cypher.NamedNode(key);
    nodes.set(key, targetNode);

    patterns.push(
      new Cypher.Pattern(contextNode, { labels: ['Context'] })
        .related(new Cypher.NamedRelationship(`${key}Rel`), { type: relationship })
        .to(targetNode, { labels: [nodeLabel] })
    );
  }

  const domains = new Cypher.NamedVariable('domains');
  const skills = new Cypher.NamedVariable('skills');

  const get = (key: string) => {
    const node = nodes.get(key);
    if (!node) {
      throw new Error(`Node not found for key: ${key}`);
    }
    return node;
  };

  return {
    patterns,

    withClause: [
      contextNode,
      get('position'),
      get('industry'),
      get('city'),
      get('country'),
      [collectDistinct(get('workDomain').property('name')), domains],
      [collectDistinct(get('skill').property('name')), skills]
    ] as Array<Cypher.Node | [Cypher.Expr, Cypher.Variable]>,

    projection: new Cypher.MapProjection(
      contextNode,
      [
        'contextId',
        'previousContextId',
        'nextContextId',
        'createdAt',
        'creationReason',
        'birthYear',
        'citizenships',
        'companySize'
      ],
      {
        position: get('position').property('name'),
        domains,
        skills,
        industry: get('industry').property('name'),
        countryCode: get('country').property('name'),
        cityName: get('city').property('name')
      }
    )
  };
}
