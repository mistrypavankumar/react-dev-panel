/**
 * Console + network capture store for the Developer Logs tool. Patches console methods and
 * fetch/XHR once, keeps a bounded ring buffer, and exposes a `useSyncExternalStore` snapshot.
 * Framework-agnostic — no dependencies beyond the browser.
 */

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'network';

export interface LogEntry {
  id: number;
  level: LogLevel;
  time: number;
  message: string;
  /** For network entries: HTTP status + method + url. */
  meta?: string;
}

const MAX = 500;
let buffer: LogEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function push(level: LogLevel, message: string, meta?: string) {
  buffer = [...buffer.slice(-(MAX - 1)), { id: nextId++, level, time: Date.now(), message, meta }];
  emit();
}

function stringify(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')
    .slice(0, 2000);
}

let installed = false;

/** Patch console + fetch + XHR once. Safe to call repeatedly; no-op after the first. */
export function installCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  (['log', 'info', 'warn', 'error'] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      push(level, stringify(args));
      original(...args);
    };
  });

  if (typeof window.fetch === 'function') {
    const orig = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const start = Date.now();
      try {
        const res = await orig(input, init);
        push(res.ok ? 'network' : 'error', `${method} ${url}`, `${res.status} · ${Date.now() - start}ms`);
        return res;
      } catch (err) {
        push('error', `${method} ${url}`, `failed · ${String(err)}`);
        throw err;
      }
    };
  }
}

export function subscribeLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getLogs(): LogEntry[] {
  return buffer;
}
const EMPTY: LogEntry[] = [];
export function getServerLogs(): LogEntry[] {
  return EMPTY;
}
export function clearLogs(): void {
  buffer = [];
  emit();
}
export function errorCount(): number {
  return buffer.reduce((n, e) => (e.level === 'error' ? n + 1 : n), 0);
}
