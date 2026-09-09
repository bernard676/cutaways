// Lightweight structured logger (modeled on qaAgent's pino conventions: level-gated,
// context-object-first, secrets redacted) without pulling in a Node-oriented logging
// library that doesn't belong in an RN bundle.

import { LogBox } from 'react-native';

// Every call site in this app logs a failure it has ALREADY handled with its own UI (toast,
// inline error banner, retry button, etc.) -- see the write() comment below. RN's LogBox
// intercepts console.warn/console.error and shows its own overlay on top of that, which is
// redundant at best and reads as a crash at worst. Every one of our log lines is prefixed
// "[scope] message" (see write() below), so that prefix alone is a reliable, narrow filter --
// genuine warnings from React Native or third-party libraries don't match it and still show.
LogBox.ignoreLogs([/^\[[^\]]+\] /]);

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

/**
 * Flatten a context object into indented `key: value` lines. The Metro terminal renders a
 * nested object argument as `[Object]` / truncates it, so anything that matters for debugging
 * a failure (HTTP status, response body, stack) has to be pre-formatted into the message
 * string itself to actually reach the developer's terminal.
 */
function renderValue(value: unknown): string {
  if (typeof value === 'string') return value;
  // A serialized error: show message + stack as raw text, not JSON-escaped one-liners.
  if (value && typeof value === 'object' && 'stack' in value && typeof (value as { stack: unknown }).stack === 'string') {
    const { message, stack, ...rest } = value as { message?: unknown; stack: string; [k: string]: unknown };
    const restKeys = Object.keys(rest);
    return [
      message ? String(message) : undefined,
      stack,
      restKeys.length ? JSON.stringify(rest, null, 2) : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatContext(context: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    lines.push(`  ${key}: ${renderValue(value).replace(/\n/g, '\n  ')}`);
  }
  return lines.join('\n');
}

function write(level: LogLevel, scope: string, message: string, context?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const method = level === 'debug' ? 'log' : level;
  const head = `[${scope}] ${message}`;
  const body = context && Object.keys(context).length > 0 ? formatContext(redact(context) as Record<string, unknown>) : '';
  console[method](body ? `${head}\n${body}` : head);
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
