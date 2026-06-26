/**
 * Next.js App Router adapter for react-dev-panel. Provides route-handler factories that serve
 * the component graph and open files in the running editor.
 *
 *   // app/dev-panel/graph/route.ts
 *   import { createGraphRoute } from 'react-dev-panel/next';
 *   export const { GET } = createGraphRoute();
 *
 *   // app/dev-panel/open-file/route.ts
 *   import { createOpenFileRoute } from 'react-dev-panel/next';
 *   export const { POST } = createOpenFileRoute();
 *
 * Then on the client:
 *   import { DevPanel, serverOpenInEditor, DEFAULT_GRAPH_ENDPOINT } from 'react-dev-panel';
 *   <DevPanel enabled={isDev} graphEndpoint={DEFAULT_GRAPH_ENDPOINT} openInEditor={serverOpenInEditor} />
 *
 * IMPORTANT: gate these routes yourself (NODE_ENV / auth) — pass `enabled` or wrap the handler.
 * They are intended for development and internal use only.
 */
import { resolve, relative, isAbsolute } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export interface NextGraphRouteOptions {
  root?: string;
  graphFile?: string;
  /** Extra gate — return false to 404 (e.g. NODE_ENV check + developer auth). */
  enabled?: () => boolean | Promise<boolean>;
}

const EDITOR_BIN: Record<string, string | undefined> = {
  auto: undefined,
  vscode: 'code',
  cursor: 'cursor',
  webstorm: 'webstorm',
  zed: 'zed',
};

const json = (body: unknown, status = 200): Response =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

async function gate(enabled?: () => boolean | Promise<boolean>): Promise<boolean> {
  if (process.env.NODE_ENV === 'production' && !enabled) return false;
  if (enabled) return (await enabled()) === true;
  return true;
}

export function createGraphRoute(options: NextGraphRouteOptions = {}) {
  const root = resolve(options.root ?? process.cwd());
  const graphFile = resolve(root, options.graphFile ?? '.dev-panel/component-graph.json');
  return {
    async GET() {
      if (!(await gate(options.enabled))) return json({ error: 'Not found' }, 404);
      try {
        return json(await readFile(graphFile, 'utf8'));
      } catch {
        return json({ error: 'graph-not-generated', hint: 'Run: npx dev-panel-graph' }, 404);
      }
    },
  };
}

export function createOpenFileRoute(options: NextGraphRouteOptions = {}) {
  const root = resolve(options.root ?? process.cwd());
  return {
    async POST(req: Request) {
      if (!(await gate(options.enabled))) return json({ error: 'Not found' }, 404);
      let body: { file?: string; line?: number; column?: number; editor?: string };
      try {
        body = await req.json();
      } catch {
        return json({ error: 'invalid body' }, 400);
      }
      if (!body.file) return json({ error: 'file required' }, 400);
      const abs = isAbsolute(body.file) ? resolve(body.file) : resolve(root, body.file);
      const rel = relative(root, abs);
      if (rel.startsWith('..') || isAbsolute(rel)) return json({ error: 'path escapes root' }, 403);
      if (!existsSync(abs) || !statSync(abs).isFile()) return json({ error: 'not found' }, 404);
      try {
        const launch = (await import('launch-editor')).default;
        launch(`${abs}:${body.line ?? 1}:${body.column ?? 1}`, EDITOR_BIN[body.editor ?? 'auto']);
        return json({ ok: true });
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'open failed' }, 500);
      }
    },
  };
}

export { DEFAULT_GRAPH_ENDPOINT, DEFAULT_OPEN_ENDPOINT, serverOpenInEditor } from '../core/server-open';
