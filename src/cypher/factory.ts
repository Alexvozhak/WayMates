import Cypher from "@neo4j/cypher-builder";

export type RelationshipConfig = {
  key: string;
  relationship: string;
  nodeLabel: string;
};

export const NODE_LABELS = {
  user: "User",
  context: "Context",
  position: "Position",
  skill: "Skill",
  workDomain: "WorkDomain",
  industry: "Industry",
  city: "City",
  country: "Country",
  goal: "Goal",
} as const;

// prettier-ignore
export const DEFAULT_CONTEXT_RELATIONSHIPS: RelationshipConfig[] = [
  { key: 'position', relationship: 'HAS_POSITION', nodeLabel: NODE_LABELS.position },
  { key: 'workDomain', relationship: 'IN_WORK_DOMAIN', nodeLabel: NODE_LABELS.workDomain },
  { key: 'skill', relationship: 'USES_SKILL', nodeLabel: NODE_LABELS.skill },
  { key: 'industry', relationship: 'IN_INDUSTRY', nodeLabel: NODE_LABELS.industry },
  { key: 'city', relationship: 'IN_CITY', nodeLabel: NODE_LABELS.city },
  { key: 'country', relationship: 'IN_COUNTRY', nodeLabel: NODE_LABELS.country },
];

function toParamProperties(
  properties: Record<string, string | number>
): Record<string, Cypher.Param> {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      new Cypher.Param(value),
    ])
  );
}

export function createNode(labels: string[]): {
  node: Cypher.Node;
  pattern: Cypher.Pattern;
  withProperties: (props: Record<string, string | number>) => {
    node: Cypher.Node;
    pattern: Cypher.Pattern;
  };
} {
  const node = new Cypher.Node();

  return {
    node,
    pattern: new Cypher.Pattern(node, { labels }),

    withProperties(props: Record<string, string | number>) {
      return {
        node,
        pattern: new Cypher.Pattern(node, {
          labels,
          properties: toParamProperties(props),
        }),
      };
    },
  };
}

export type ContextRelationshipNodes = {
  position: Cypher.Node;
  workDomain: Cypher.Node;
  skill: Cypher.Node;
  industry: Cypher.Node;
  city: Cypher.Node;
  country: Cypher.Node;
}

export function enrichContextWithRelationships(
  contextNode: Cypher.Node,
  relationships: RelationshipConfig[] = DEFAULT_CONTEXT_RELATIONSHIPS
): {
  nodes: ContextRelationshipNodes;
  patterns: Cypher.Pattern[];
} {
  const builtRelationships = relationships.map(
    ({ key, relationship, nodeLabel }) => {
      const targetNode = new Cypher.Node();
      const matchPattern = new Cypher.Pattern(contextNode)
        .related(new Cypher.Relationship(), { type: relationship })
        .to(targetNode, { labels: [nodeLabel] });
      return { key, targetNode, matchPattern };
    }
  );

  const nodesByKey = new Map(
    builtRelationships.map((rel) => [rel.key, rel.targetNode])
  );

  const getRequiredNode = (key: string): Cypher.Node => {
    const node = nodesByKey.get(key);
    if (!node) {
      throw new Error(`Required node not found for key: ${key}`);
    }
    return node;
  };

  return {
    nodes: {
      position: getRequiredNode("position"),
      workDomain: getRequiredNode("workDomain"),
      skill: getRequiredNode("skill"),
      industry: getRequiredNode("industry"),
      city: getRequiredNode("city"),
      country: getRequiredNode("country"),
    },
    patterns: builtRelationships.map((rel) => rel.matchPattern),
  };
}

export function whereUserIdNot(
  userNode: Cypher.Node,
  userId: string
): Cypher.Predicate {
  return Cypher.neq(userNode.property("userId"), new Cypher.Param(userId));
}

export function whereRecency(
  contextNode: Cypher.Node,
  thresholdMonths: number
): Cypher.Predicate {
  const createdAt = Cypher.datetime(contextNode.property("createdAt"));
  const now = Cypher.datetime();

  const durationMonths = new Cypher.Raw(
    (ctx: Cypher.RawCypherContext) =>
      `duration.between(${ctx.compile(createdAt)}, ${ctx.compile(now)}).months`
  );

  return Cypher.lte(durationMonths, new Cypher.Param(thresholdMonths));
}

export function projectContext(
  contextNode: Cypher.Node,
  relationships: {
    position: Cypher.Node;
    domains: Cypher.Variable;
    skills: Cypher.Variable;
    industry: Cypher.Node;
    city: Cypher.Node;
    country: Cypher.Node;
  }
): Cypher.Map {
  return new Cypher.Map({
    contextId: contextNode.property("contextId"),
    previousContextId: contextNode.property("previousContextId"),
    nextContextId: contextNode.property("nextContextId"),
    createdAt: contextNode.property("createdAt"),
    creationReason: contextNode.property("creationReason"),
    birthYear: contextNode.property("birthYear"),
    citizenships: contextNode.property("citizenships"),
    position: relationships.position.property("name"),
    domains: relationships.domains,
    skills: relationships.skills,
    industry: relationships.industry.property("name"),
    companySize: contextNode.property("companySize"),
    countryCode: relationships.country.property("name"),
    cityName: relationships.city.property("name"),
  });
}

export function collectTrajectory(contextNode: Cypher.Node): {
  pathVariable: Cypher.Variable;
  startNode: Cypher.Node;
  pattern: Cypher.QuantifiedPattern;
  whereClause: Cypher.Predicate;
} {
  const pathVariable = new Cypher.Variable();
  const startNode = new Cypher.Node();

  const pattern = new Cypher.Pattern(contextNode)
    .related(new Cypher.Relationship(), {
      type: "PREVIOUS_CONTEXT",
      direction: "left",
    })
    .to(startNode, { labels: [NODE_LABELS.context] })
    .quantifier({ min: 0 });

  const whereClause = Cypher.isNull(startNode.property("previousContextId"));

  return { pathVariable, startNode, pattern, whereClause };
}

export function collectDistinct(expression: Cypher.Expr): Cypher.Raw {
  return new Cypher.Raw(
    (ctx: Cypher.RawCypherContext) =>
      `collect(DISTINCT ${ctx.compile(expression)})`
  );
}

export function aggregateNames(
  node: Cypher.Node,
  alias: Cypher.Variable
): [Cypher.Raw, Cypher.Variable] {
  return [collectDistinct(node.property("name")), alias];
}

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
