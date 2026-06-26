import type { OpenInEditor } from './types';

/**
 * Default endpoint paths the adapters mount and the client talks to. No leading underscore —
 * Next.js App Router treats `_`-prefixed segments as private (non-routable), so this path works
 * uniformly across the Next, Vite, and generic-server adapters.
 */
export const DEFAULT_GRAPH_ENDPOINT = '/dev-panel/graph';
export const DEFAULT_OPEN_ENDPOINT = '/dev-panel/open-file';

/**
 * A client `openInEditor` that POSTs to a server endpoint (mounted by an adapter), which opens
 * the file in the editor running the project via `launch-editor`. Falls back to copying the
 * path when the endpoint is unreachable. Pass to `<DevPanel openInEditor={serverOpenInEditor} />`.
 */
export function createServerOpenInEditor(endpoint = DEFAULT_OPEN_ENDPOINT): OpenInEditor {
  return async (loc, editor = 'auto') => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: loc.file, line: loc.line, column: loc.column, editor }),
      });
      if (res.ok) return true;
    } catch {
      /* fall through to copy */
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard
        .writeText(`${loc.file}${loc.line ? `:${loc.line}` : ''}`)
        .catch(() => undefined);
    }
    return false;
  };
}

/** Ready-to-use server opener pointed at the default endpoint. */
export const serverOpenInEditor: OpenInEditor = createServerOpenInEditor();
