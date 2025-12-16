import pino from "pino";

export function createLogger(nodeEnv: string, logLevel?: string): pino.Logger {
  const isDevelopment = nodeEnv === "development";

  const options: pino.LoggerOptions = {
    level: logLevel ?? "info",
  };

  if (isDevelopment) {
    options.transport = { target: "pino-pretty" };
  }

  return pino(options);
}

export function createChildLogger(logger: pino.Logger, name: string): pino.Logger {
  return logger.child({ component: name });
}
