import pino from "pino";

const isDevelopment = process.env.NODE_ENV === "development";

const options: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
};

if (isDevelopment) {
  options.transport = { target: "pino-pretty" };
}

export const logger = pino(options);

export function createChildLogger(name: string): pino.Logger {
  return logger.child({ component: name });
}
