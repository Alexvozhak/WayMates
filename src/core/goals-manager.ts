import { deleteGoalQuery, getUserGoalQuery, setGoalQuery } from "../cypher/index.js";
import { goalSchema } from "../shared/schemas.js";

import type { DatabaseContext } from "./database-context.js";
import type { CreateGoalInput, Goal } from "../shared/schemas.js";

export class GoalsManager {
  constructor(private db: DatabaseContext) {}

  async setGoal(params: CreateGoalInput): Promise<Goal> {
    const createdAt = new Date().toISOString();

    return this.db.write(async (tx) => {
      const result = await tx.run(setGoalQuery(), {
        userId: params.userId,
        targetContext: JSON.stringify(params.targetContext),
        createdAt,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(`setGoal: no result returned for user=${params.userId}`);
      }

      const goalData = record.get("goal");
      const goalWithParsedContext = {
        ...goalData,
        targetContext: JSON.parse(goalData.targetContext),
      };

      return goalSchema.parse(goalWithParsedContext);
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

      // Deserialize targetContext from JSON string
      const goalWithParsedCriteria = {
        ...goalData,
        targetContext: JSON.parse(goalData.targetContext),
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
