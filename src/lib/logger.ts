// Lightweight structured logger (modeled on qaAgent's pino conventions: level-gated,
// context-object-first, secrets redacted) without pulling in a Node-oriented logging
// library that doesn't belong in an RN bundle.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: LogLevel = __DEV__ ? 'debug' : 'warn';

const REDACT_KEY_PATTERN = /password|token|apikey|api_key|authorization|secret/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACT_KEY_PATTERN.test(key) ? '[REDACTED]' : redact(val, depth + 1);
  }
  return out;
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    const extra = redact({ ...(error as unknown as Record<string, unknown>) });
    return { message: error.message, stack: error.stack, ...(extra as Record<string, unknown>) };
  }
  return redact(error);
}

function write(level: LogLevel, scope: string, message: string, context?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  // Every call site in this app already catches its error and surfaces a friendly, user-facing
  // message (toast, inline banner, etc.) -- that's the whole point of logger.error. Routing it
  // through console.error would trigger RN's LogBox full-screen redbox for conditions that are
  // already gracefully handled (e.g. a transient 503 from a provider), which reads to the user
  // as a crash even though the app recovers correctly. console.warn keeps full visibility in the
  // dev console without the intrusive blocking overlay.
  const method = level === 'error' ? 'warn' : level === 'debug' ? 'log' : level;
  if (context && Object.keys(context).length > 0) {
    // eslint-disable-next-line no-console
    console[method](`[${scope}] ${message}`, redact(context));
  } else {
    // eslint-disable-next-line no-console
    console[method](`[${scope}] ${message}`);
  }
}

export const logger = {
  debug: (scope: string, message: string, context?: Record<string, unknown>) =>
    write('debug', scope, message, context),
  info: (scope: string, message: string, context?: Record<string, unknown>) =>
    write('info', scope, message, context),
  warn: (scope: string, message: string, context?: Record<string, unknown>) =>
    write('warn', scope, message, context),
  error: (scope: string, message: string, error?: unknown, context?: Record<string, unknown>) =>
    write('error', scope, message, { ...(context ?? {}), err: serializeError(error) }),
};
