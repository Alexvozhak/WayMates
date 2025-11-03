import express from 'express';
import type { Request, Response } from 'express';
import type { SearchManager } from './search-manager.js';
import type { StoryManager } from './story-manager.js';
import type { GoalsManager } from './goals-manager.js';
import {
  StoryInputSchema,
  CreateGoalInputSchema,
  UserIdSchema,
  GoalIdSchema,
} from '../shared/schemas.js';
import {
  AdHocSearchParamsSchema,
  SavedCurrentSearchParamsSchema,
  TrajectorySearchParamsSchema,
  TargetOnlySearchParamsSchema,
} from './schemas.js';

interface CoreContext {
  searchManager?: SearchManager;
  storyManager: StoryManager;
  goalsManager: GoalsManager;
}

function registerSearchRoutes(app: express.Express, context: CoreContext) {
  if (!context.searchManager) {
    return;
  }

  app.post('/api/search/ad-hoc', async (req: Request, res: Response) => {
    const params = AdHocSearchParamsSchema.parse(req.body);
    const result = await context.searchManager!.searchAdHoc(params);
    res.json(result);
  });

  app.post('/api/search/saved-current', async (req: Request, res: Response) => {
    const params = SavedCurrentSearchParamsSchema.parse(req.body);
    const result = await context.searchManager!.searchSavedCurrent(params);
    res.json(result);
  });

  app.post('/api/search/trajectory', async (req: Request, res: Response) => {
    const params = TrajectorySearchParamsSchema.parse(req.body);
    const result = await context.searchManager!.searchTrajectory(params);
    res.json(result);
  });

  app.post('/api/search/target-only', async (req: Request, res: Response) => {
    const params = TargetOnlySearchParamsSchema.parse(req.body);
    const result = await context.searchManager!.searchTargetOnly(params);
    res.json(result);
  });
}

function registerStoryRoutes(app: express.Express, context: CoreContext) {
  app.post('/api/story/upsert', async (req: Request, res: Response) => {
    const params = StoryInputSchema.parse(req.body);
    const result = await context.storyManager.upsertStory(params);
    res.json(result);
  });

  app.get('/api/story/:userId', async (req: Request, res: Response) => {
    const userId = UserIdSchema.parse(req.params.userId);
    const result = await context.storyManager.getUserStory(userId);
    res.json(result);
  });
}

function registerGoalRoutes(app: express.Express, context: CoreContext) {
  app.post('/api/goal/create', async (req: Request, res: Response) => {
    const params = CreateGoalInputSchema.parse(req.body);
    const result = await context.goalsManager.createGoal(params);
    res.json(result);
  });

  app.get('/api/goal/:userId', async (req: Request, res: Response) => {
    const userId = UserIdSchema.parse(req.params.userId);
    const result = await context.goalsManager.getUserGoalContexts(userId);
    res.json(result);
  });

  app.delete('/api/goal/:goalId', async (req: Request, res: Response) => {
    const goalId = GoalIdSchema.parse(req.params.goalId);
    const userId = UserIdSchema.parse(req.query.userId);
    await context.goalsManager.deleteGoal(goalId, userId);
    res.json({ success: true });
  });
}

export function createRestServer(context: CoreContext) {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  registerSearchRoutes(app, context);
  registerStoryRoutes(app, context);
  registerGoalRoutes(app, context);

  app.use((err: unknown, _req: Request, res: Response, _next: unknown) => {
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export async function startRestServer(
  context: CoreContext,
  port: number = 9000,
  host: string = '0.0.0.0'
) {
  const app = createRestServer(context);

  return new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      console.log(`🚀 WayMates Core REST API listening on ${host}:${port}`);
      resolve();
    });
  });
}
