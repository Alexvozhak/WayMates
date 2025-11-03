import type { DatabaseContext } from "../database-context.js";
import type { UserContext } from "./schemas.js";
import { UserContextSchema } from "./schemas.js";

export class PathCollectorService {
  constructor(private db: DatabaseContext) {}

  async collectBackwardPath(
    _userId: string,
    matchedContextId: string
  ): Promise<UserContext[]> {
    return this.db.read(async (tx) => {
      const result = await tx.run(
        `
        MATCH (end:Context {context_id: $matchedContextId})
        MATCH path = (start:Context)-[:NEXT_CONTEXT*0..]->(end)
        WHERE start.previous_context_id IS NULL
        WITH nodes(path) AS contextNodes
        RETURN [node IN contextNodes | {
          context_id: node.context_id,
          previous_context_id: node.previous_context_id,
          next_context_id: node.next_context_id,
          created_at: node.created_at,
          creation_reason: node.creation_reason,
          position: node.position,
          domains: node.domains,
          skills: node.skills,
          industry: node.industry,
          company_size: node.company_size,
          country_code: node.country_code,
          city_name: node.city_name,
          citizenships: node.citizenships,
          birth_year: node.birth_year
        }] AS contexts
        `,
        { matchedContextId }
      );

      const record = result.records[0];
      if (!record) {
        return [];
      }

      const contexts = record.get("contexts");
      return contexts.map((ctx: unknown) => UserContextSchema.parse(ctx));
    });
  }

  async collectUserTrajectory(userId: string): Promise<UserContext[]> {
    return this.db.read(async (tx) => {
      const result = await tx.run(
        `
        MATCH (u:User {user_id: $userId})
        MATCH (current:Context {context_id: u.current_context_id})
        MATCH path = (start:Context)-[:NEXT_CONTEXT*0..]->(current)
        WHERE start.previous_context_id IS NULL
        WITH nodes(path) AS contextNodes
        RETURN [node IN contextNodes | {
          context_id: node.context_id,
          previous_context_id: node.previous_context_id,
          next_context_id: node.next_context_id,
          created_at: node.created_at,
          creation_reason: node.creation_reason,
          position: node.position,
          domains: node.domains,
          skills: node.skills,
          industry: node.industry,
          company_size: node.company_size,
          country_code: node.country_code,
          city_name: node.city_name,
          citizenships: node.citizenships,
          birth_year: node.birth_year
        }] AS contexts
        `,
        { userId }
      );

      const record = result.records[0];
      if (!record) {
        return [];
      }

      const contexts = record.get("contexts");
      return contexts.map((ctx: unknown) => UserContextSchema.parse(ctx));
    });
  }
}
