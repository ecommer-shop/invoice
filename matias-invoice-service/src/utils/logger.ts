import winston from 'winston';
import { getConfig } from '@/config/environment';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  }),
);

let loggerInstance: winston.Logger | null = null;

function createLogger(): winston.Logger {
  const cfg = getConfig();
  const instance = winston.createLogger({
    level: cfg.logging.level,
    format: logFormat,
    defaultMeta: { service: 'matias-invoice-service' },
    transports: [
      new winston.transports.Console({
        format: cfg.nodeEnv === 'production' ? logFormat : consoleFormat,
      }),
    ],
  });

  if (cfg.nodeEnv !== 'production') {
    instance.add(
      new winston.transports.Console({
        format: consoleFormat,
      }),
    );
  }

  return instance;
}

function getLogger(): winston.Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
}

const logger = new Proxy({} as winston.Logger, {
  get(_target, prop: keyof winston.Logger) {
    const instance = getLogger();
    const value = instance[prop];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
});

export { logger };
export default logger;
