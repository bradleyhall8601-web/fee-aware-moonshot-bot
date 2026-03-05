import pino from "pino";

const prettyEnabled = process.env.LOG_PRETTY !== "false";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: prettyEnabled
    ? {
        target: "pino-pretty",
        options: {
          colorize: false,
          translateTime: "SYS:standard"
        }
      }
    : undefined
});
