type Meta = Record<string, unknown> | string | undefined;

function emit(level: string, message: string, meta?: Meta): void {
  const suffix = meta === undefined ? '' : ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}`;
  const line = `[${new Date().toISOString()}] [${level}] ${message}${suffix}`;
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

const telemetryLogger = {
  debug: (message: string, meta?: Meta) => emit('DEBUG', message, meta),
  info: (message: string, meta?: Meta) => emit('INFO', message, meta),
  warn: (message: string, meta?: Meta) => emit('WARN', message, meta),
  error: (message: string, meta?: Meta) => emit('ERROR', message, meta),
};

export default telemetryLogger;
