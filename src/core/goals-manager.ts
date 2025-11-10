import { GoalSchema, UserIdSchema } from '../shared/schemas.js';

import {
  DELETE_GOAL_QUERY,
  GET_USER_GOAL_QUERY,
  SET_GOAL_QUERY,
} from './goals-query-builder.js';

import type { DatabaseContext } from '../database-context.js';
import type { CreateGoalInput, Goal, UserId } from '../shared/schemas.js';

export class GoalsManager {
  constructor(private db: DatabaseContext) {}

  async setGoal(params: CreateGoalInput): Promise<UserId> {
    const createdAt = new Date().toISOString();

    return this.db.write(async (tx) => {
      const result = await tx.run(SET_GOAL_QUERY, {
        userId: params.userId,
        targetCriteria: params.targetContext,
        createdAt,
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
      const result = await tx.run(GET_USER_GOAL_QUERY, { userId: userId });
      const record = result.records[0];
      if (!record) {
        return null;
      }
      const goalData = record.get('goal');
      return GoalSchema.parse(goalData);
    });
  }

  async deleteGoal(userId: string): Promise<boolean> {
    return this.db.write(async (tx) => {
      const result = await tx.run(DELETE_GOAL_QUERY, {
        userId: userId,
      });
      const record = result.records[0];
      if (!record) {
        return false;
      }
      return Boolean(record.get('success'));
    });
  }
}
