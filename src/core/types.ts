import type { ComponentType, ReactNode } from 'react';

/** Editors the open-in-editor protocol fallback understands. `auto` = whatever runs the project. */
export type EditorType = 'auto' | 'vscode' | 'cursor' | 'webstorm' | 'zed';

/** A source location the panel can open in an editor. */
export interface SourceLocation {
  /** Absolute or repo-relative file path. */
  file: string;
  line?: number;
  column?: number;
}

/**
 * How the panel opens source files. Supplied by an adapter (Next/Vite/server) or the host.
 * Returning `false`/throwing makes the panel fall back to copying the path.
 */
export type OpenInEditor = (loc: SourceLocation, editor?: EditorType) => void | Promise<void | boolean>;

/** Visual theme overrides (any CSS color). Only the accent is commonly customized. */
export interface DevPanelTheme {
  accent?: string;
  accentContrast?: string;
}

/** Host-supplied configuration for the whole panel. */
export interface DevPanelConfig {
  /**
   * Whether the panel is allowed to render at all. The host decides the gate (env check,
   * internal-user role, feature flag…). Defaults to `process.env.NODE_ENV !== 'production'`.
   */
  enabled?: boolean;
  /** Current route/pathname, for tools that show it. Adapters wire their router here. */
  getRoute?: () => string | undefined;
  /** Opens a source file. Adapters provide this; without it, the panel copies paths instead. */
  openInEditor?: OpenInEditor;
  /** Endpoint that serves the component graph JSON (Component Graph Inspector). */
  graphEndpoint?: string;
  /** Preferred editor for protocol-style opens. Default `auto`. */
  editor?: EditorType;
  /** Theme overrides. */
  theme?: DevPanelTheme;
  /** Restrict to a subset/order of tools by id. Defaults to all registered tools. */
  tools?: string[];
}

/** Resolved config (defaults applied) handed to tools via context. */
export interface ResolvedDevPanelConfig extends Required<Omit<DevPanelConfig, 'theme' | 'tools' | 'getRoute' | 'openInEditor' | 'graphEndpoint'>> {
  getRoute: () => string | undefined;
  openInEditor?: OpenInEditor;
  graphEndpoint?: string;
  theme: DevPanelTheme;
  tools?: string[];
}

/** Props a tool's panel body receives. */
export interface ToolPanelProps {
  onClose: () => void;
}

/** A registered dev tool. */
export interface ToolDefinition {
  id: string;
  title: string;
  subtitle: string;
  /** Accent color key for the tile. */
  color?: 'primary' | 'info' | 'warning' | 'success' | 'error';
  /** Tile icon (any React node — the bundled tools ship inline SVG icons). */
  icon: ReactNode;
  /** The panel body shown when the tool is open. */
  Panel: ComponentType<ToolPanelProps>;
  /** Optional always-mounted layer (e.g. the inspector overlay). Self-gates internally. */
  Overlay?: ComponentType;
  /** Optional badge shown on the menu row (e.g. log count). Re-reads on render. */
  useBadge?: () => { label: string; tone?: 'error' | 'neutral' | 'success' } | null;
  /** Optional one-time init when the panel mounts (e.g. install console capture). */
  init?: () => void;
}
