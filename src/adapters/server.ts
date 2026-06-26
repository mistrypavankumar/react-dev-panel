/**
 * Framework-agnostic dev middleware (connect/express/http style) that powers the Component
 * Graph Inspector's server features:
 *   GET  /__dev-panel/graph      → serves the generated component-graph JSON
 *   POST /__dev-panel/open-file  → opens a file in the editor running the project (launch-editor)
 *
 * Dev-only by design — mount it only in your dev server. Opens are path-traversal-guarded to
 * the repo root. Used directly for CRA/Express/custom servers, and internally by the Vite plugin.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve, relative, isAbsolute } from 'node:path';
import { existsSync, statSync, readFileSync } from 'node:fs';

import { DEFAULT_GRAPH_ENDPOINT, DEFAULT_OPEN_ENDPOINT } from '../core/server-open';

export interface DevPanelServerOptions {
  /** Repo root (absolute). Default: process.cwd(). */
  root?: string;
  /** Path to the generated graph JSON, relative to root. Default: .dev-panel/component-graph.json */
  graphFile?: string;
  graphEndpoint?: string;
  openEndpoint?: string;
}

const EDITOR_BIN: Record<string, string | undefined> = {
  auto: undefined,
  vscode: 'code',
  cursor: 'cursor',
  webstorm: 'webstorm',
  zed: 'zed',
};

type Next = (err?: unknown) => void;

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function createDevPanelMiddleware(options: DevPanelServerOptions = {}) {
  const root = resolve(options.root ?? process.cwd());
  const graphFile = resolve(root, options.graphFile ?? '.dev-panel/component-graph.json');
  const graphEndpoint = options.graphEndpoint ?? DEFAULT_GRAPH_ENDPOINT;
  const openEndpoint = options.openEndpoint ?? DEFAULT_OPEN_ENDPOINT;

  return function devPanelMiddleware(req: IncomingMessage, res: ServerResponse, next: Next): void {
    const url = (req.url ?? '').split('?')[0];

    if (req.method === 'GET' && url === graphEndpoint) {
      try {
        send(res, 200, readFileSync(graphFile, 'utf8'));
      } catch {
        send(res, 404, { error: 'graph-not-generated', hint: 'Run: npx dev-panel-graph' });
      }
      return;
    }

    if (req.method === 'POST' && url === openEndpoint) {
      void (async () => {
        try {
          const body = (await readBody(req)) as {
            file?: string;
            line?: number;
            column?: number;
            editor?: string;
          };
          if (!body.file) return send(res, 400, { error: 'file required' });
          const abs = isAbsolute(body.file) ? resolve(body.file) : resolve(root, body.file);
          const rel = relative(root, abs);
          if (rel.startsWith('..') || isAbsolute(rel)) return send(res, 403, { error: 'path escapes root' });
          if (!existsSync(abs) || !statSync(abs).isFile()) return send(res, 404, { error: 'not found' });

          const launch = (await import('launch-editor')).default;
          const target = `${abs}:${body.line ?? 1}:${body.column ?? 1}`;
          launch(target, EDITOR_BIN[body.editor ?? 'auto']);
          return send(res, 200, { ok: true });
        } catch (err) {
          return send(res, 500, { error: err instanceof Error ? err.message : 'open failed' });
        }
      })();
      return;
    }

    next();
  };
}
