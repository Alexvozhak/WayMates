import { ZodError } from "zod";

import { createRequestLogger } from "../../../shared/logger.js";
import { captureException } from "../../../shared/sentry.js";
import { FacadeError } from "../../errors.js";
import { err, ok } from "../result.js";

import type { SessionId, UserId } from "../../../../private/schemas.js";
import type { CoreClient } from "../../core-client.js";
import type { GraphDeps } from "../../langGraph/shared/types.js";
import type { CheckpointService } from "../../services/checkpoint.service.js";
import type { DictionariesService } from "../../services/dictionaries.service.js";
import type { DocumentaryService } from "../../services/documentary.service.js";
import type { Normalizer } from "../../services/normalizer.js";
import type { SessionService } from "../../services/session.service.js";
import type { UserService } from "../../services/user.service.js";
import type { ErrorResponse, Result } from "../result.js";
import type { Logger } from "pino";
import type { ZodType } from "zod";

export type BaseToolParams = { sessionId: SessionId; requestId: string };

export type BaseToolDependencies = {
  sessionService: SessionService;
  normalizerService: Normalizer;
  coreClient: CoreClient;
  dictionariesService: DictionariesService;
  checkpointService: CheckpointService;
  userService: UserService;
  documentaryService: DocumentaryService;
  logger: Logger;
};

export abstract class BaseTool<TParams extends BaseToolParams, TResult> {
  protected sessionService: SessionService;
  protected normalizerService: Normalizer;
  protected coreClient: CoreClient;
  protected dictionariesService: DictionariesService;
  protected checkpointService: CheckpointService;
  protected userService: UserService;
  protected documentaryService: DocumentaryService;
  protected baseLogger: Logger;
  private paramsSchema: ZodType;

  constructor(deps: BaseToolDependencies, paramsSchema: ZodType) {
    this.sessionService = deps.sessionService;
    this.normalizerService = deps.normalizerService;
    this.coreClient = deps.coreClient;
    this.dictionariesService = deps.dictionariesService;
    this.checkpointService = deps.checkpointService;
    this.userService = deps.userService;
    this.documentaryService = deps.documentaryService;
    this.baseLogger = deps.logger;
    this.paramsSchema = paramsSchema;
  }

  protected get graphDeps(): GraphDeps {
    return {
      coreClient: this.coreClient,
      normalizerService: this.normalizerService,
      dictionariesService: this.dictionariesService,
      checkpointService: this.checkpointService,
      logger: this.baseLogger,
    };
  }

  async execute(params: TParams): Promise<Result<TResult, ErrorResponse>> {
    const { requestId } = params;
    const start = Date.now();
    let userId: UserId | undefined;
    let requestLogger: Logger = this.baseLogger;

    try {
      this.paramsSchema.parse(params);
      userId = await this.sessionService.validate(params.sessionId);
      requestLogger = createRequestLogger(this.baseLogger, { requestId, userId, sessionId: params.sessionId });
      requestLogger.info({ tool: this.constructor.name }, "Tool execution started");

      const result = await this.executeImpl(params, userId);

      const durationMs = Date.now() - start;
      requestLogger.info({ tool: this.constructor.name, durationMs }, "Tool execution completed");
      return ok(result);
    } catch (error) {
      const durationMs = Date.now() - start;
      const tags = userId
        ? { tool: this.constructor.name, userId, sessionId: params.sessionId }
        : { tool: this.constructor.name };
      captureException(error, tags);
      requestLogger.error({ err: error, tool: this.constructor.name, durationMs }, "Tool execution failed");
      return err(this.handleError(error));
    }
  }

  protected abstract executeImpl(params: TParams, userId: UserId): Promise<TResult>;

  private handleError(error: unknown): ErrorResponse {
    if (error instanceof FacadeError) {
      return error.toResponse();
    }

    if (error instanceof ZodError) {
      return {
        code: "validation_error",
        message: "Validation failed",
        details: { errors: error.errors },
      };
    }

    if (error instanceof Error) {
      return {
        code: "internal_error",
        message: "An unexpected error occurred.",
        details: { originalError: error.message },
      };
    }

    return {
      code: "internal_error",
      message: "An unexpected error occurred.",
      details: null,
    };
  }
}
