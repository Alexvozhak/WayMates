import express from "express";

import {
  CreateGoalInputSchema,
  StoryInputSchema,
  UserIdSchema,
} from "../shared/schemas.js";

import {
  AdhocSearchParamsSchema,
  TargetSearchParamsSchema,
  UserSearchParamsSchema,
} from "./schemas.js";

import type { GoalsManager } from "./goals-manager.js";
import type { SearchManager } from "./search-manager.js";
import type { StoryManager } from "./story-manager.js";
import type { Request, Response } from "express";

interface CoreContext {
  searchManager?: SearchManager;
  storyManager: StoryManager;
  goalsManager: GoalsManager;
}

const HTTP_STATUS = {
  badRequest: 400,
  internalServerError: 500,
} as const;

export function createRestServer(context: CoreContext): express.Express {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  registerSearchRoutes(app, context);
  registerStoryRoutes(app, context);
  registerGoalRoutes(app, context);

  app.use((err: unknown, _req: Request, res: Response, _next: unknown) => {
    if (err instanceof Error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ error: err.message });
      return;
    }
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: "Internal server error" });
  });

  return app;
}

export async function startRestServer(
  context: CoreContext,
  port: number,
  host: string
): Promise<void> {
  const app = createRestServer(context);

  return new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      console.log(`🚀 WayMates Core REST API listening on ${host}:${port}`);
      resolve();
    });
  });
}

function registerSearchRoutes(app: express.Express, context: CoreContext): void {
  if (!context.searchManager) {
    return;
  }

  // Режим 1: Ad-Hoc Search
  app.post(
    "/api/search/adhoc",
    async (req: Request, res: Response) => {
      const params = AdhocSearchParamsSchema.parse(req.body);
      const result = await context.searchManager!.searchAdhoc(params);
      res.json(result);
    }
  );

  // Режимы 2+3: User Search (автоматический DTW)
  app.post("/api/search/user", async (req: Request, res: Response) => {
    const params = UserSearchParamsSchema.parse(req.body);
    const result = await context.searchManager!.searchByUser(params);
    res.json(result);
  });

  // Режим 4: Target-Only Search
  app.post("/api/search/target", async (req: Request, res: Response) => {
    const params = TargetSearchParamsSchema.parse(req.body);
    const result = await context.searchManager!.searchByTarget(params);
    res.json(result);
  });
}

function registerStoryRoutes(app: express.Express, context: CoreContext): void {
  app.post("/api/story/upsert", async (req: Request, res: Response) => {
    const params = StoryInputSchema.parse(req.body);
    const result = await context.storyManager.upsertStory(params);
    res.json(result);
  });

  app.get("/api/story/:userId", async (req: Request, res: Response) => {
    const userId = UserIdSchema.parse(req.params.userId);
    const result = await context.storyManager.getUserStory(userId);
    res.json(result);
  });
}

function registerGoalRoutes(app: express.Express, context: CoreContext): void {
  app.post("/api/goal/set", async (req: Request, res: Response) => {
    const params = CreateGoalInputSchema.parse(req.body);
    const result = await context.goalsManager.setGoal(params);
    res.json({ userId: result });
  });

  app.get("/api/goal/:userId", async (req: Request, res: Response) => {
    const userId = UserIdSchema.parse(req.params.userId);
    const result = await context.goalsManager.getUserGoal(userId);
    res.json(result);
  });

  app.delete("/api/goal/:userId", async (req: Request, res: Response) => {
    const userId = UserIdSchema.parse(req.params.userId);
    const success = await context.goalsManager.deleteGoal(userId);
    res.json({ success });
  });
}
