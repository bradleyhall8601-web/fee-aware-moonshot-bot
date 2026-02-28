import pino from 'pino';
import { env } from './env';

export const logger = pino(
  {
    level: env.LOG_LEVEL,
  },
  env.LOG_PRETTY
    ? pino.transport({ target: 'pino-pretty', options: { colorize: true } })
    : undefined,
);
