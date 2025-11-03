import type { DatabaseContext } from '../database-context.js';
import type { CreateGoalInput, Goal, GoalId } from '../shared/schemas.js';
import type { GoalWithContext } from './schemas.js';
import { GoalIdSchema, GoalSchema } from '../shared/schemas.js';
import { GoalWithContextSchema } from './schemas.js';
import { v7 as uuidv7 } from 'uuid';
import {
  CREATE_GOAL_QUERY,
  GET_USER_GOAL_IDS_QUERY,
  GET_USER_GOAL_CONTEXTS_QUERY,
  DELETE_GOAL_QUERY,
} from './goals-query-builder.js';

export class GoalsManager {
  constructor(private db: DatabaseContext) {}

  async createGoal(params: CreateGoalInput): Promise<GoalId> {
    const goal_id = this.generateGoalId();
    const created_at = new Date().toISOString();

    return this.db.write(async (tx) => {
      const result = await tx.run(CREATE_GOAL_QUERY, {
        goal_id,
        user_id: params.userId,
        target_context_id: params.targetContextId,
        created_at,
      });

      const record = result.records[0];
      if (!record) {
        throw new Error(
          `createGoal: no result returned for user=${params.userId}`
        );
      }

      return GoalIdSchema.parse(record.get('goal_id'));
    });
  }

  async getUserGoalIds(userId: string): Promise<Goal[]> {
    return this.db.read(async (tx) => {
      const result = await tx.run(GET_USER_GOAL_IDS_QUERY, { user_id: userId });
      return result.records.map((rec) => {
        const goalData = rec.get('goal');
        return GoalSchema.parse(goalData);
      });
    });
  }

  async getUserGoalContexts(userId: string): Promise<GoalWithContext[]> {
    return this.db.read(async (tx) => {
      const result = await tx.run(GET_USER_GOAL_CONTEXTS_QUERY, {
        user_id: userId,
      });
      return result.records.map((rec) => {
        const goalWithContextData = rec.get('goalWithContext');
        return GoalWithContextSchema.parse(goalWithContextData);
      });
    });
  }

  async deleteGoal(goalId: string, userId: string): Promise<void> {
    const success = await this.db.write(async (tx) => {
      const result = await tx.run(DELETE_GOAL_QUERY, {
        goal_id: goalId,
        user_id: userId,
      });
      const record = result.records[0];
      if (!record) {
        throw new Error(
          `deleteGoal: no result returned for goal=${goalId}, user=${userId}`
        );
      }
      return Boolean(record.get('success'));
    });

    if (!success) {
      throw new Error(`Failed to delete goal ${goalId} for user ${userId}`);
    }
  }

  private generateGoalId(): string {
    return `goal_${uuidv7()}`;
  }
}
