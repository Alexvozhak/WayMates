import { deleteGoalQuery, getUserGoalQuery, setGoalQuery } from "../cypher/index.js";
import { goalSchema, userIdSchema } from "../shared/schemas.js";

import type { DatabaseContext } from "./database-context.js";
import type { CreateGoalInput, Goal, UserId } from "../shared/schemas.js";

export class GoalsManager {
  constructor(private db: DatabaseContext) {}

  async setGoal(params: CreateGoalInput): Promise<UserId> {
    const createdAt = new Date().toISOString();

    return this.db.write(async (tx) => {
      const result = await tx.run(setGoalQuery(), {
        userId: params.userId,
        targetCriteria: JSON.stringify(params.targetContext),
        createdAt,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(`setGoal: no result returned for user=${params.userId}`);
      }

      return userIdSchema.parse(record.get("userId"));
    });
  }

  async getUserGoal(userId: string): Promise<Goal | null> {
    return this.db.read(async (tx) => {
      const result = await tx.run(getUserGoalQuery(), { userId: userId });
      const record = result.records[0];
      if (!record) {
        return null;
      }
      const goalData = record.get("goal");

      // Deserialize targetCriteria from JSON string
      const goalWithParsedCriteria = {
        ...goalData,
        targetCriteria: JSON.parse(goalData.targetCriteria),
      };

      return goalSchema.parse(goalWithParsedCriteria);
    });
  }

  async deleteGoal(userId: string): Promise<boolean> {
    return this.db.write(async (tx) => {
      const result = await tx.run(deleteGoalQuery(), {
        userId: userId,
      });
      const record = result.records[0];
      if (!record) {
        return false;
      }
      return Boolean(record.get("success"));
    });
  }
}
