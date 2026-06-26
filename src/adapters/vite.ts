/**
 * Vite plugin for react-dev-panel. Mounts the dev middleware (graph + open-file endpoints) and
 * regenerates the component graph on dev-server start (and optionally on change).
 *
 *   // vite.config.ts
 *   import { devPanel } from 'react-dev-panel/vite';
 *   export default defineConfig({ plugins: [react(), devPanel()] });
 *
 * Then on the client:
 *   import { DevPanel, serverOpenInEditor, DEFAULT_GRAPH_ENDPOINT } from 'react-dev-panel';
 *   <DevPanel graphEndpoint={DEFAULT_GRAPH_ENDPOINT} openInEditor={serverOpenInEditor} />
 */
import { createDevPanelMiddleware, type DevPanelServerOptions } from './server';

export interface DevPanelViteOptions extends DevPanelServerOptions {
  /** Dirs to scan for the graph (relative to root). Default ['src']. */
  scan?: string[];
  /** Generate the graph when the dev server starts. Default true. */
  generateOnStart?: boolean;
}

// Loosely typed to avoid a hard `vite` dependency.
interface ViteDevServerLike {
  middlewares: { use: (fn: (req: unknown, res: unknown, next: unknown) => void) => void };
}
interface VitePluginLike {
  name: string;
  apply?: 'serve' | 'build';
  configureServer?: (server: ViteDevServerLike) => void | Promise<void>;
}

export function devPanel(options: DevPanelViteOptions = {}): VitePluginLike {
  const root = options.root ?? process.cwd();
  return {
    name: 'react-dev-panel',
    apply: 'serve',
    async configureServer(server) {
      if (options.generateOnStart !== false) {
        try {
          const { generateComponentGraph } = await import('../cli/generate');
          const res = await generateComponentGraph({ root, scan: options.scan, out: options.graphFile });
          // eslint-disable-next-line no-console
          console.log(`[react-dev-panel] graph: ${res.graph.nodes.length} nodes → ${res.outFile}`);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[react-dev-panel] graph generation skipped:', err instanceof Error ? err.message : err);
        }
      }
      const mw = createDevPanelMiddleware(options);
      server.middlewares.use((req, res, next) =>
        mw(req as never, res as never, next as never),
      );
    },
  };
}

export default devPanel;
