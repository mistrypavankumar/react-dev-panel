/**
 * In-browser developer log store. A bounded ring buffer capturing runtime activity so the
 * Developer Logs tool can surface it without a backend sink:
 *   - client  — uncaught errors, unhandled rejections, console.error/warn/log from app code.
 *   - server  — backend errors surfaced to the browser (e.g. Apollo error link console output).
 *   - network — every fetch (method, status, duration, GraphQL op name/type, headers, bodies).
 *
 * Entries persist to sessionStorage (per-tab): they survive reloads/soft-nav, clear on tab close.
 * Consumed via useSyncExternalStore. Framework-agnostic (no React/MUI here).
 */

export type DevLogSource = 'client' | 'server' | 'network';
export type DevLogLevel = 'error' | 'warn' | 'info';

export type DevLogEntry = {
  id: string;
  timestamp: number;
  source: DevLogSource;
  level: DevLogLevel;
  message: string;
  detail?: string;
  stack?: string;
  requestHeaders?: string;
  requestBody?: string;
  requestBodyRaw?: string;
  responseHeaders?: string;
  responseBody?: string;
  /** Route the entry occurred on, so the tool can show logs page-wise. */
  path?: string;
};

const MAX_ENTRIES = 500;
const STORAGE_KEY = 'react-dev-panel:dev-logs';

let entries: DevLogEntry[] = [];
let seq = 0;
let installed = false;
let hydrated = false;
let emitScheduled = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const EMPTY: DevLogEntry[] = [];

function emit() {
  if (emitScheduled) return;
  emitScheduled = true;
  const flush = () => {
    emitScheduled = false;
    listeners.forEach((listener) => listener());
  };
  if (typeof queueMicrotask === 'function') queueMicrotask(flush);
  else void Promise.resolve().then(flush);
}

function persist(): void {
  if (typeof window === 'undefined') return;
  let list = entries;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return;
    } catch {
      if (!list.length) return;
      list = list.slice(0, Math.floor(list.length / 2));
    }
  }
}
function schedulePersist(): void {
  if (typeof window === 'undefined' || persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persist();
  }, 500);
}
function hydrate(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as DevLogEntry[];
    if (!Array.isArray(parsed)) return;
    entries = parsed.slice(0, MAX_ENTRIES);
    seq = entries.reduce((max, entry) => {
      const n = Number(String(entry.id).replace('log-', ''));
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    emit();
  } catch {
    /* ignore corrupt storage */
  }
}

export function getDevLogs(): DevLogEntry[] {
  return entries;
}
export function getDevLogsServerSnapshot(): DevLogEntry[] {
  return EMPTY;
}
export function subscribeDevLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function clearDevLogs(): void {
  entries = [];
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  emit();
}
export function errorCount(): number {
  return entries.reduce((n, e) => (e.level === 'error' ? n + 1 : n), 0);
}

export function addDevLog(entry: Omit<DevLogEntry, 'id' | 'timestamp' | 'path'>): void {
  seq += 1;
  const next: DevLogEntry = {
    ...entry,
    id: `log-${seq}`,
    timestamp: Date.now(),
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
  };
  entries = [next, ...entries].slice(0, MAX_ENTRIES);
  emit();
  schedulePersist();
}

function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function classifyApolloPayload(payload: unknown): DevLogSource {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (p.gqlErrors) return 'server';
    if (p.networkError || p.networkStatus) return 'network';
  }
  return 'server';
}

function captureConsole(level: DevLogLevel, args: unknown[]): void {
  const firstStr = typeof args[0] === 'string' ? (args[0] as string) : safeString(args[0]);
  if (firstStr.startsWith('[Apollo error]')) {
    const payload = args[1];
    addDevLog({
      source: classifyApolloPayload(payload),
      level,
      message: firstStr.replace('[Apollo error] ', '').trim() || 'Apollo error',
      detail: payload !== undefined ? safeString(payload) : undefined,
    });
    return;
  }
  const errorArg = args.find((a) => a instanceof Error) as Error | undefined;
  addDevLog({
    source: 'client',
    level,
    message: args.map(safeString).join(' ').trim() || `console.${level}`,
    stack: errorArg?.stack,
  });
}

const NETWORK_IGNORE = ['/_next/', '/__nextjs', 'hot-update', 'webpack', '.map', '/monitoring'];
function shouldIgnoreNetwork(url: string): boolean {
  return NETWORK_IGNORE.some((needle) => url.includes(needle));
}
function resolveRequest(input: RequestInfo | URL): { url: string; method: string } {
  if (typeof input === 'string') return { url: input, method: 'GET' };
  if (input instanceof URL) return { url: input.href, method: 'GET' };
  return { url: input.url, method: input.method || 'GET' };
}
function graphqlOperationName(body: BodyInit | null | undefined): string | undefined {
  if (typeof body !== 'string') return undefined;
  try {
    const parsed = JSON.parse(body) as { operationName?: string } | Array<{ operationName?: string }>;
    if (Array.isArray(parsed)) {
      const names = parsed.map((p) => p?.operationName).filter(Boolean);
      return names.length ? names.join(', ') : undefined;
    }
    return parsed?.operationName || undefined;
  } catch {
    return undefined;
  }
}
type GraphqlOpType = 'query' | 'mutation' | 'subscription';
function detectOpType(query: string | undefined, opName?: string): GraphqlOpType | undefined {
  if (typeof query !== 'string') return undefined;
  if (opName) {
    const named = new RegExp(`\\b(query|mutation|subscription)\\s+${opName}\\b`).exec(query);
    if (named) return named[1] as GraphqlOpType;
  }
  const keyword = /\b(query|mutation|subscription)\b/.exec(query);
  if (keyword) return keyword[1] as GraphqlOpType;
  return /^\s*\{/.test(query) ? 'query' : undefined;
}
function graphqlOperationType(body: BodyInit | null | undefined): GraphqlOpType | undefined {
  if (typeof body !== 'string') return undefined;
  try {
    const parsed = JSON.parse(body) as
      | { query?: string; operationName?: string }
      | Array<{ query?: string; operationName?: string }>;
    const ops = Array.isArray(parsed) ? parsed : [parsed];
    const types = ops.map((p) => detectOpType(p?.query, p?.operationName)).filter(Boolean);
    const unique = Array.from(new Set(types));
    return unique.length === 1 ? (unique[0] as GraphqlOpType) : undefined;
  } catch {
    return undefined;
  }
}
function collapseSignedQuery(u: URL): string {
  return u.searchParams.has('X-Amz-Signature') ? '?[signed]' : u.search;
}
function shortUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    return u.pathname + collapseSignedQuery(u);
  } catch {
    return url;
  }
}
function redactedUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    return `${u.origin}${u.pathname}${collapseSignedQuery(u)}`;
  } catch {
    return url;
  }
}
function networkLevel(status: number): DevLogLevel {
  if (status === 0 || status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
}
const MAX_REASON_CHARS = 160;
function errorReason(body: string | undefined): string | undefined {
  if (!body) return undefined;
  const text = body.trim();
  if (!text) return undefined;
  const xmlCode = /<Code>([^<]+)<\/Code>/i.exec(text)?.[1];
  const xmlMessage = /<Message>([^<]+)<\/Message>/i.exec(text)?.[1];
  if (xmlCode || xmlMessage) return [xmlCode, xmlMessage].filter(Boolean).join(': ').slice(0, MAX_REASON_CHARS);
  if (text[0] === '{' || text[0] === '[') {
    try {
      const parsed = JSON.parse(text) as {
        errors?: Array<{ message?: string }>;
        message?: unknown;
        error?: unknown;
      };
      const gql = parsed?.errors?.map((e) => e?.message).filter(Boolean).join('; ');
      const reason =
        gql ||
        (typeof parsed.message === 'string' ? parsed.message : undefined) ||
        (typeof parsed.error === 'string' ? parsed.error : undefined);
      if (reason) return reason.slice(0, MAX_REASON_CHARS);
    } catch {
      /* not JSON */
    }
  }
  const firstLine = text.split('\n').find((line) => line.trim());
  return firstLine ? firstLine.slice(0, MAX_REASON_CHARS) : undefined;
}
function graphqlResponseErrors(body: string | undefined): { reason: string; partial: boolean } | undefined {
  if (!body) return undefined;
  const trimmed = body.trim();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return undefined;
  try {
    const parsed = JSON.parse(trimmed) as
      | { errors?: Array<{ message?: string; extensions?: { code?: string } }>; data?: unknown }
      | Array<{ errors?: Array<{ message?: string; extensions?: { code?: string } }> }>;
    const result = Array.isArray(parsed) ? parsed[0] : parsed;
    const errors = result?.errors;
    if (!Array.isArray(errors) || errors.length === 0) return undefined;
    const reason =
      errors
        .map((e) => {
          const code = e?.extensions?.code;
          return code ? `${code}: ${e?.message ?? ''}`.trim() : e?.message;
        })
        .filter(Boolean)
        .join('; ')
        .slice(0, MAX_REASON_CHARS) || 'GraphQL error';
    const data = (result as { data?: unknown })?.data;
    const partial =
      data != null && typeof data === 'object' && Object.values(data as Record<string, unknown>).some((v) => v != null);
    return { reason, partial };
  } catch {
    return undefined;
  }
}
const MAX_BODY_CHARS = 50_000;
function truncateBody(text: string): string {
  if (text.length <= MAX_BODY_CHARS) return text;
  return `${text.slice(0, MAX_BODY_CHARS)}\n… [truncated ${text.length - MAX_BODY_CHARS} chars]`;
}
function prettyMaybeJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return text;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}
type GraphqlOp = { operationName?: string; query?: string; variables?: unknown };
function formatGraphqlBody(parsed: unknown): string | null {
  const ops: GraphqlOp[] = Array.isArray(parsed) ? parsed : [parsed as GraphqlOp];
  if (!ops.length || !ops.every((op) => op && typeof op === 'object' && typeof op.query === 'string')) return null;
  return ops
    .map((op) => {
      const parts: string[] = [];
      if (op.operationName) parts.push(`# Operation: ${op.operationName}`);
      if (op.variables && Object.keys(op.variables as object).length > 0)
        parts.push(`# Variables\n${JSON.stringify(op.variables, null, 2)}`);
      parts.push(`# Query\n${(op.query as string).trim()}`);
      return parts.join('\n\n');
    })
    .join('\n\n———\n\n');
}
function formatBodyString(text: string): string {
  const trimmed = text.trim();
  if (trimmed[0] === '{' || trimmed[0] === '[') {
    try {
      const parsed = JSON.parse(trimmed);
      return formatGraphqlBody(parsed) ?? JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  }
  return text;
}
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'proxy-authorization'];
function formatHeaders(source: Headers): string | undefined {
  const lines: string[] = [];
  source.forEach((value, key) => {
    const redacted = SENSITIVE_HEADERS.includes(key.toLowerCase()) ? '[redacted]' : value;
    lines.push(`${key}: ${redacted}`);
  });
  return lines.length ? lines.join('\n') : undefined;
}
function requestHeaders(input: RequestInfo | URL, init?: RequestInit): string | undefined {
  const merged = new Headers();
  if (input instanceof Request) input.headers.forEach((value, key) => merged.set(key, value));
  if (init?.headers) new Headers(init.headers).forEach((value, key) => merged.set(key, value));
  return formatHeaders(merged);
}
function rawRequestBody(body: BodyInit | null | undefined): string | undefined {
  if (typeof body !== 'string') return undefined;
  return truncateBody(body);
}
function readableRequestBody(body: BodyInit | null | undefined): string | undefined {
  if (body == null) return undefined;
  if (typeof body === 'string') return truncateBody(formatBodyString(body));
  if (body instanceof URLSearchParams) return body.toString();
  const name = (body as { constructor?: { name?: string } }).constructor?.name;
  return `[${name || 'binary'} body — not shown]`;
}
async function readResponseBody(res: Response): Promise<string | undefined> {
  try {
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !/json|text|xml|graphql|javascript|csv|html/i.test(ct)) return `[${ct} response — not shown]`;
    const text = await res.text();
    if (!text) return undefined;
    return truncateBody(prettyMaybeJson(text));
  } catch {
    return undefined;
  }
}

function captureFetch(): void {
  if (typeof window.fetch !== 'function') return;
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { url, method: inferredMethod } = resolveRequest(input);
    const method = (init?.method || inferredMethod || 'GET').toUpperCase();
    if (shouldIgnoreNetwork(url)) return origFetch(input, init);

    const opName = graphqlOperationName(init?.body ?? null);
    const opType = graphqlOperationType(init?.body ?? null);
    const reqHeaders = requestHeaders(input, init);
    const requestBody = readableRequestBody(init?.body ?? null);
    const requestBodyRaw = rawRequestBody(init?.body ?? null);
    const start = Date.now();

    const log = (status: number, statusText: string, errored: boolean, responseBody?: string, responseHeaders?: string) => {
      const ms = Date.now() - start;
      const opLabel = opName ? `${opType ? `${opType} ` : ''}${opName}` : undefined;
      const label = opLabel ? `${shortUrl(url)} · ${opLabel}` : shortUrl(url);
      const gqlErrors = !errored && status < 400 ? graphqlResponseErrors(responseBody) : undefined;
      const statusLabel = errored ? 'FAILED' : String(status);
      const reason = errored ? statusText : status >= 400 ? errorReason(responseBody) : gqlErrors?.reason;
      const level: DevLogLevel = errored
        ? 'error'
        : gqlErrors
          ? gqlErrors.partial
            ? 'warn'
            : 'error'
          : networkLevel(status);
      addDevLog({
        source: 'network',
        level,
        message: `${method} ${statusLabel} ${label} (${ms}ms)${reason ? ` — ${reason}` : ''}`,
        detail: `${method} ${redactedUrl(url)}\n${errored ? statusText : `${status} ${statusText}`} · ${ms}ms${
          gqlErrors ? ` · GraphQL ${gqlErrors.partial ? 'partial error' : 'error'}` : ''
        }`,
        requestHeaders: reqHeaders,
        requestBody,
        requestBodyRaw,
        responseHeaders,
        responseBody,
      });
    };

    try {
      const res = await origFetch(input, init);
      let clone: Response | null = null;
      try {
        clone = res.clone();
      } catch {
        clone = null;
      }
      const resHeaders = formatHeaders(res.headers);
      if (clone) void readResponseBody(clone).then((body) => log(res.status, res.statusText, false, body, resHeaders));
      else log(res.status, res.statusText, false, undefined, resHeaders);
      return res;
    } catch (err) {
      log(0, err instanceof Error ? err.message : 'Network error', true);
      throw err;
    }
  };
}

/** Idempotently wraps console, global error handlers, and fetch. No-op on the server. */
export function installDevLogCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  hydrate();
  captureFetch();
  window.addEventListener('pagehide', persist);

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  const origLog = console.log.bind(console);
  console.error = (...args: unknown[]) => {
    origError(...args);
    try {
      captureConsole('error', args);
    } catch {
      /* never break logging */
    }
  };
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    try {
      captureConsole('warn', args);
    } catch {
      /* ignore */
    }
  };
  console.log = (...args: unknown[]) => {
    origLog(...args);
    try {
      captureConsole('info', args);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('error', (event: ErrorEvent) => {
    addDevLog({
      source: 'client',
      level: 'error',
      message: event.message || 'Uncaught error',
      stack: event.error?.stack,
      detail: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    });
  });
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason as { message?: string; stack?: string } | undefined;
    addDevLog({
      source: 'client',
      level: 'error',
      message: reason?.message ? `Unhandled rejection: ${reason.message}` : 'Unhandled promise rejection',
      stack: reason?.stack,
      detail: safeString(event.reason),
    });
  });
}
