import type { ToolDefinition } from './types';

// Module-level registry. Bundled tools self-register on import; hosts can add their own via
// `registerTool`. `DevPanel` reads this list (optionally filtered/ordered by config.tools).
const tools = new Map<string, ToolDefinition>();

export function registerTool(def: ToolDefinition): void {
  tools.set(def.id, def);
}

export function getRegisteredTools(): ToolDefinition[] {
  return [...tools.values()];
}

/** Resolve the active tool list, honoring an optional id allow-list/order from config. */
export function resolveTools(ids?: string[]): ToolDefinition[] {
  if (!ids || ids.length === 0) return getRegisteredTools();
  return ids.map((id) => tools.get(id)).filter((t): t is ToolDefinition => Boolean(t));
}
