import pino from "pino";
import { config } from "./config.js";

export const logger = pino(
  {
    level: config.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  config.LOG_LEVEL === "debug"
    ? pino.transport({ target: "pino-pretty", options: { colorize: true } })
    : undefined
);
