
import { buildTrajectoryQuery } from "@cypher/index.js";
import { type Trail, type UserContext, trailSchema, userContextSchema } from "@shared/schemas.js";
import { z } from "zod";

import type { DatabaseContext } from "./database-context.js";

export type TrajectoryData = {
  path: UserContext[];
  trails: Trail[];
};

export class PathCollectorService {
  constructor(private db: DatabaseContext) {}

  async collectTrajectories(userIds: string[]): Promise<Map<string, TrajectoryData>> {
    if (userIds.length === 0) {
      return new Map();
    }

    return this.db.read(async (tx) => {
      const query = buildTrajectoryQuery();

      const result = await tx.run(query, { userIds });

      const trajectoriesMap = new Map<string, TrajectoryData>();

      for (const rec of result.records) {
        const rawPath = rec.get("path");
        const rawTrails = rec.get("trails");
        const userId = z.string().parse(rec.get("userId"));

        try {
          const path = rawPath.map((ctx: unknown) => userContextSchema.parse(ctx));
          const trails = rawTrails.map((t: unknown) => trailSchema.parse(t));
          trajectoriesMap.set(userId, { path, trails });
        } catch (error) {
          throw new Error(
            `Failed to parse trajectory for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return trajectoriesMap;
    });
  }
}
