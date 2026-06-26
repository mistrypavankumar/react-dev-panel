/**
 * Runtime helpers for the Component Graph Inspector: a memoized graph index, fiber-tree walking,
 * graph-aware component resolution (climb to the nearest ancestor that's in the graph), a safe
 * props preview, and a live "what's mounted on this page" scan. All defensive — React internals
 * can vary between versions, so every read is guarded.
 */
import type { ComponentGraph, ComponentGraphNode } from '../../core/graph-types';
import type { Selected, PropEntry } from './store';

// ── index ───────────────────────────────────────────────────────────────────
interface GraphIndex {
  byName: Map<string, ComponentGraphNode>;
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  importsOf: Map<string, string[]>;
}
const indexCache = new WeakMap<ComponentGraph, GraphIndex>();
function pushUnique(map: Map<string, string[]>, k: string, v: string) {
  const a = map.get(k);
  if (a) {
    if (!a.includes(v)) a.push(v);
  } else map.set(k, [v]);
}
function getIndex(graph: ComponentGraph | null): GraphIndex | null {
  if (!graph) return null;
  let idx = indexCache.get(graph);
  if (idx) return idx;
  idx = { byName: new Map(), childrenOf: new Map(), parentsOf: new Map(), importsOf: new Map() };
  for (const n of graph.nodes) {
    idx.byName.set(n.id, n);
    idx.byName.set(n.name, n);
  }
  for (const e of graph.edges) {
    if (e.type === 'renders') {
      pushUnique(idx.childrenOf, e.from, e.to);
      pushUnique(idx.parentsOf, e.to, e.from);
    } else if (e.type === 'route') {
      pushUnique(idx.parentsOf, e.to, e.from);
    } else if (e.type === 'imports') {
      pushUnique(idx.importsOf, e.from, e.to);
    }
  }
  indexCache.set(graph, idx);
  return idx;
}

export function findNode(graph: ComponentGraph | null, name: string): ComponentGraphNode | null {
  return getIndex(graph)?.byName.get(name) ?? null;
}
export function getParents(graph: ComponentGraph | null, id: string): string[] {
  return getIndex(graph)?.parentsOf.get(id) ?? [];
}
export function getChildren(graph: ComponentGraph | null, id: string): string[] {
  return getIndex(graph)?.childrenOf.get(id) ?? [];
}
export function getImports(graph: ComponentGraph | null, id: string): string[] {
  return getIndex(graph)?.importsOf.get(id) ?? [];
}
export function searchNodes(graph: ComponentGraph | null, query: string, limit = 40): ComponentGraphNode[] {
  if (!graph) return [];
  const q = query.trim().toLowerCase();
  const matches = q
    ? graph.nodes.filter((n) => n.name.toLowerCase().includes(q) || n.filePath.toLowerCase().includes(q))
    : graph.nodes.filter((n) => n.type === 'component');
  matches.sort((a, b) => (a.type !== b.type ? (a.type === 'component' ? -1 : 1) : a.name.localeCompare(b.name)));
  return matches.slice(0, limit);
}

// ── path helpers ─────────────────────────────────────────────────────────────
function isAbs(p: string): boolean {
  return p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
}
export function toDisplayPath(graph: ComponentGraph | null, file: string): string {
  const root = graph?.root;
  if (root && file.startsWith(root)) return file.slice(root.length).replace(/^[/\\]/, '');
  return file;
}
export function toAbsPath(graph: ComponentGraph | null, file: string): string | undefined {
  if (isAbs(file)) return file;
  return graph?.root ? `${graph.root}/${file}` : undefined;
}

// ── fiber ────────────────────────────────────────────────────────────────────
interface FiberLike {
  type: unknown;
  return: FiberLike | null;
  child?: FiberLike | null;
  sibling?: FiberLike | null;
  memoizedProps?: Record<string, unknown> | null;
}
function getFiber(node: Element): FiberLike | null {
  const key = Object.keys(node).find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
  );
  return key ? ((node as unknown as Record<string, FiberLike>)[key] ?? null) : null;
}
function getDisplayName(type: unknown): string | null {
  if (!type || typeof type === 'string') return null;
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || null;
  }
  const o = type as { displayName?: string; render?: unknown; type?: unknown };
  if (o.displayName) return o.displayName;
  if (o.render) return getDisplayName(o.render);
  if (o.type) return getDisplayName(o.type);
  return null;
}
function chain(el: Element): string[] {
  const out: string[] = [];
  try {
    let f = getFiber(el);
    let hops = 0;
    while (f && hops < 200) {
      const n = getDisplayName(f.type);
      if (n && out[out.length - 1] !== n) out.push(n);
      f = f.return;
      hops += 1;
    }
  } catch {
    /* ignore */
  }
  return out;
}

export const IGNORE_ATTR = 'data-rdp-ignore';
export function isIgnored(el: Element | null): boolean {
  return !!el?.closest(`[${IGNORE_ATTR}]`);
}

function summarize(v: unknown): string | null {
  if (v == null) return String(v);
  switch (typeof v) {
    case 'string':
      return v.length > 40 ? `"${v.slice(0, 40)}…"` : `"${v}"`;
    case 'number':
    case 'boolean':
      return String(v);
    case 'function':
      return 'ƒ';
    case 'object':
      if (Array.isArray(v)) return `Array(${v.length})`;
      if ((v as { $$typeof?: symbol }).$$typeof) return null;
      return '{…}';
    default:
      return null;
  }
}
export function extractProps(el: Element): PropEntry[] | undefined {
  try {
    let f = getFiber(el);
    while (f && typeof f.type === 'string') f = f.return;
    const props = f?.memoizedProps;
    if (!props || typeof props !== 'object') return undefined;
    const out: PropEntry[] = [];
    for (const name of Object.keys(props)) {
      if (name === 'children') continue;
      const s = summarize(props[name]);
      if (s == null) continue;
      out.push({ name, value: s });
      if (out.length >= 12) break;
    }
    return out.length ? out : undefined;
  } catch {
    return undefined;
  }
}

interface RawMeta {
  componentName: string;
  filePath?: string;
  line?: number;
  column?: number;
  domTag: string;
}
// Reads data-dev-* attrs if a build transform injected them, else the fiber component name.
function extractRaw(el: Element): RawMeta {
  const host = el.closest('[data-dev-file], [data-dev-component]');
  const attrFile = host?.getAttribute('data-dev-file') ?? undefined;
  const attrLine = host?.getAttribute('data-dev-line');
  const attrCol = host?.getAttribute('data-dev-column');
  let fiberName: string | null = null;
  try {
    fiberName = chain(el)[0] ?? null;
  } catch {
    /* ignore */
  }
  const domTag = el.tagName.toLowerCase();
  return {
    componentName: fiberName || host?.getAttribute('data-dev-component') || domTag,
    filePath: attrFile,
    line: attrLine ? Number(attrLine) : undefined,
    column: attrCol ? Number(attrCol) : undefined,
    domTag,
  };
}

function graphMatch(el: Element, graph: ComponentGraph | null, fallbackName: string) {
  const idx = getIndex(graph);
  if (idx) {
    const name = chain(el).find((n) => idx.byName.has(n));
    if (name) return { componentName: name, node: idx.byName.get(name) ?? null };
  }
  return { componentName: fallbackName, node: findNode(graph, fallbackName) };
}

/** Lightweight resolution for the hover tooltip. */
export function resolveDisplay(el: Element, graph: ComponentGraph | null, route?: string) {
  const raw = extractRaw(el);
  const { componentName, node } = graphMatch(el, graph, raw.componentName);
  return {
    componentName,
    filePath: raw.filePath ?? node?.filePath,
    line: raw.line ?? node?.line,
    domTag: raw.domTag,
    route,
  };
}

/** Full selection for a locked element, merged with the matching graph node. */
export function resolveSelected(
  el: Element,
  graph: ComponentGraph | null,
  route?: string,
): Selected {
  const raw = extractRaw(el);
  const { componentName, node } = graphMatch(el, graph, raw.componentName);
  const rel = node?.filePath;
  const absFromAttr = raw.filePath && isAbs(raw.filePath) ? raw.filePath : undefined;
  const absFilePath = absFromAttr ?? (rel ? toAbsPath(graph, rel) : undefined);
  const display = rel ?? (raw.filePath ? toDisplayPath(graph, raw.filePath) : undefined);
  const parents = node ? getParents(graph, node.id) : [];
  return {
    componentName,
    filePath: display,
    absFilePath,
    line: raw.line ?? node?.line,
    column: raw.column ?? node?.column,
    route: route ?? node?.route,
    domTag: raw.domTag,
    parent: parents[0],
    parents,
    children: node ? getChildren(graph, node.id) : [],
    imports: node ? getImports(graph, node.id) : [],
    props: extractProps(el),
    source: 'hover',
    nodeId: node?.id,
  };
}

export function selectFromNode(graph: ComponentGraph | null, node: ComponentGraphNode): Selected {
  return {
    componentName: node.name,
    filePath: node.filePath,
    absFilePath: toAbsPath(graph, node.filePath),
    line: node.line,
    column: node.column,
    route: node.route,
    parent: getParents(graph, node.id)[0],
    parents: getParents(graph, node.id),
    children: getChildren(graph, node.id),
    imports: getImports(graph, node.id),
    source: 'graph',
    nodeId: node.id,
  };
}

export interface MountedComponent {
  name: string;
  node: ComponentGraphNode;
  count: number;
}
/** Walk the live fiber tree; list app components mounted on the current page (in the graph). */
export function collectMounted(graph: ComponentGraph | null): MountedComponent[] {
  const idx = getIndex(graph);
  if (!idx || typeof document === 'undefined') return [];
  try {
    let root: FiberLike | null = null;
    const all = document.body.getElementsByTagName('*');
    for (let i = 0; i < all.length; i += 1) {
      let f = getFiber(all[i]);
      if (f) {
        let g = 0;
        while (f.return && g < 100000) {
          f = f.return;
          g += 1;
        }
        root = f;
        break;
      }
    }
    if (!root) return [];
    const counts = new Map<string, number>();
    const stack: Array<FiberLike | null | undefined> = [root];
    let visited = 0;
    while (stack.length && visited < 200000) {
      const cur = stack.pop();
      if (!cur) continue;
      visited += 1;
      const name = getDisplayName(cur.type);
      if (name) {
        const node = idx.byName.get(name);
        if (node && node.type === 'component') counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      if (cur.child) stack.push(cur.child);
      if (cur.sibling) stack.push(cur.sibling);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, node: idx.byName.get(name) as ComponentGraphNode, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function formatForCopy(s: Selected): string {
  const lines = [`Component: ${s.componentName}`];
  if (s.filePath) lines.push(`File: ${s.filePath}${s.line ? `:${s.line}` : ''}`);
  if (s.route) lines.push(`Route: ${s.route}`);
  if (s.parent) lines.push(`Parent: ${s.parent}`);
  if (s.children.length) lines.push(`Children: ${s.children.join(', ')}`);
  if (s.imports.length) lines.push(`Imports: ${s.imports.join(', ')}`);
  return lines.join('\n');
}
