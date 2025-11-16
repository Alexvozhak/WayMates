import { buildPathQuery } from "../cypher/queries/paths.js";
import { type UserContext, userContextSchema } from "../shared/schemas.js";

import type { DatabaseContext } from "../database-context.js";

export class PathCollectorService {
  constructor(private db: DatabaseContext) {}

  async collectTrajectories(userIds: string[]): Promise<Map<string, UserContext[]>> {
    if (userIds.length === 0) {
      return new Map();
    }

    return this.db.read(async (tx) => {
      const query = buildPathQuery();

      const result = await tx.run(query, { userIds });

      const pathsMap = new Map<string, UserContext[]>();

      for (const rec of result.records) {
        const rawPath = rec.get("path");
        const userId = rec.get("userId") as string;

        try {
          const path = rawPath.map((ctx: unknown) => userContextSchema.parse(ctx));
          pathsMap.set(userId, path);
        } catch (error) {
          throw new Error(
            `Failed to parse trajectory for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return pathsMap;
    });
  }
}
