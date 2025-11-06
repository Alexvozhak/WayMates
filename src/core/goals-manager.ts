import type { DatabaseContext } from '../database-context.js';
import type { CreateGoalInput, Goal, UserId } from '../shared/schemas.js';
import { GoalSchema, UserIdSchema } from '../shared/schemas.js';
import {
  SET_GOAL_QUERY,
  GET_USER_GOAL_QUERY,
  DELETE_GOAL_QUERY,
} from './goals-query-builder.js';

export class GoalsManager {
  constructor(private db: DatabaseContext) {}

  async setGoal(params: CreateGoalInput): Promise<UserId> {
    const created_at = new Date().toISOString();

    return this.db.write(async (tx) => {
      const result = await tx.run(SET_GOAL_QUERY, {
        user_id: params.userId,
        target_criteria: params.targetCriteria,
        created_at,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(`setGoal: no result returned for user=${params.userId}`);
      }

      return UserIdSchema.parse(record.get('user_id'));
    });
  }

  async getUserGoal(userId: string): Promise<Goal | null> {
    return this.db.read(async (tx) => {
      const result = await tx.run(GET_USER_GOAL_QUERY, { user_id: userId });
      const record = result.records[0];
      if (!record) {
        return null;
      }
      const goalData = record.get('goal');
      return GoalSchema.parse(goalData);
    });
  }

  async deleteGoal(userId: string): Promise<void> {
    const success = await this.db.write(async (tx) => {
      const result = await tx.run(DELETE_GOAL_QUERY, {
        user_id: userId,
      });
      const record = result.records[0];
      if (!record) {
        throw new Error(
          `deleteGoal: no result returned for user=${userId}`
        );
      }
      return Boolean(record.get('success'));
    });

    if (!success) {
      throw new Error(`Failed to delete goal for user ${userId}`);
    }
  }
}
