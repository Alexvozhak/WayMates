import pino from "pino";

import type { LogLevel, NodeEnv } from "./env/index.js";
import type { SessionId, UserId } from "./schemas.js";
import type { Logger } from "pino";

export type ServiceName = "telegram" | "facade" | "core";

export type LoggerConfig = {
  level: LogLevel;
  nodeEnv: NodeEnv;
};

export type RequestFields = {
  requestId: string;
  userId: UserId;
  sessionId: SessionId;
};

const REDACT_PATHS = ["password", "token", "apiKey", "*.password", "*.token", "*.apiKey"];

export function createLogger(service: ServiceName, config: LoggerConfig): Logger {
  const isDevelopment = config.nodeEnv === "development";

  const options: pino.LoggerOptions = {
    name: service,
    level: config.level,
    redact: REDACT_PATHS,
  };

  if (isDevelopment) {
    options.transport = { target: "pino-pretty" };
  }

  return pino(options);
}

export function createRequestLogger(baseLogger: Logger, fields: RequestFields): Logger {
  return baseLogger.child({
    requestId: fields.requestId,
    userId: fields.userId,
    sessionId: fields.sessionId,
  });
}
