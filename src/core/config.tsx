import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

import type {
  EditorType,
  OpenInEditor,
  DevPanelConfig,
  SourceLocation,
  ResolvedDevPanelConfig,
} from './types';

function buildProtocolUrl(editor: EditorType, loc: SourceLocation): string | null {
  const line = loc.line ?? 1;
  const col = loc.column ?? 1;
  switch (editor) {
    case 'cursor':
      return `cursor://file/${loc.file}:${line}:${col}`;
    case 'webstorm':
      return `webstorm://open?file=${encodeURIComponent(loc.file)}&line=${line}&column=${col}`;
    case 'zed':
      return `zed://file/${loc.file}:${line}:${col}`;
    case 'vscode':
    case 'auto':
    default:
      return `vscode://file/${loc.file}:${line}:${col}`;
  }
}

/**
 * Fallback opener used when the host/adapter provides none: tries the editor's protocol URL,
 * then copies the path. Adapters (Next/Vite/server) replace this with a server-backed open that
 * launches the editor running the project regardless of OS protocol registration.
 */
export const defaultOpenInEditor: OpenInEditor = async (loc, editor = 'auto') => {
  const url = buildProtocolUrl(editor, loc);
  if (url && typeof window !== 'undefined') {
    try {
      window.location.assign(url);
      return true;
    } catch {
      /* fall through to copy */
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard
      .writeText(`${loc.file}${loc.line ? `:${loc.line}` : ''}`)
      .catch(() => undefined);
  }
  return false;
};

const DevPanelContext = createContext<ResolvedDevPanelConfig | null>(null);

function resolve(config: DevPanelConfig): ResolvedDevPanelConfig {
  const enabled =
    config.enabled ??
    (typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true);
  return {
    enabled,
    editor: config.editor ?? 'auto',
    getRoute: config.getRoute ?? (() => (typeof location !== 'undefined' ? location.pathname : undefined)),
    openInEditor: config.openInEditor ?? defaultOpenInEditor,
    graphEndpoint: config.graphEndpoint,
    theme: config.theme ?? {},
    tools: config.tools,
  };
}

export function DevPanelConfigProvider({
  config,
  children,
}: {
  config: DevPanelConfig;
  children: ReactNode;
}) {
  const value = useMemo(() => resolve(config), [config]);
  return <DevPanelContext.Provider value={value}>{children}</DevPanelContext.Provider>;
}

export function useDevPanelConfig(): ResolvedDevPanelConfig {
  const ctx = useContext(DevPanelContext);
  if (!ctx) throw new Error('useDevPanelConfig must be used within <DevPanel> / DevPanelConfigProvider');
  return ctx;
}
