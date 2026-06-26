/**
 * State store for the Component Graph Inspector (useSyncExternalStore). Holds the enabled flag,
 * active mode, locked selection, the lazily-fetched static graph, search/expansion UI state, and
 * a transient toast. Self-contained — no persistence beyond an in-memory snapshot.
 */
import type { ComponentGraph } from '../../core/graph-types';

export type GraphMode = 'hover' | 'graph' | 'page' | 'file';
export type GraphStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface PropEntry {
  name: string;
  value: string;
}

export interface Selected {
  componentName: string;
  filePath?: string;
  absFilePath?: string;
  line?: number;
  column?: number;
  route?: string;
  domTag?: string;
  parent?: string;
  parents: string[];
  children: string[];
  imports: string[];
  props?: PropEntry[];
  source: 'hover' | 'graph';
  nodeId?: string;
}

export interface Toast {
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface State {
  enabled: boolean;
  mode: GraphMode;
  selected: Selected | null;
  graph: ComponentGraph | null;
  status: GraphStatus;
  search: string;
  expanded: ReadonlySet<string>;
  toast: Toast | null;
}

let state: State = {
  enabled: false,
  mode: 'hover',
  selected: null,
  graph: null,
  status: 'idle',
  search: '',
  expanded: new Set<string>(),
  toast: null,
};

const listeners = new Set<() => void>();
let scheduled = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  if (scheduled) return;
  scheduled = true;
  const flush = () => {
    scheduled = false;
    listeners.forEach((l) => l());
  };
  if (typeof queueMicrotask === 'function') queueMicrotask(flush);
  else void Promise.resolve().then(flush);
}
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

export function subscribeGraph(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getGraphState(): State {
  return state;
}
const SERVER: State = { ...state };
export function getGraphServerState(): State {
  return SERVER;
}

export function enableInspector(endpoint?: string) {
  if (!state.enabled) set({ enabled: true });
  void loadGraph(endpoint);
}
export function disableInspector() {
  if (state.enabled) set({ enabled: false });
}
export function toggleInspector(endpoint?: string) {
  set({ enabled: !state.enabled });
  if (state.enabled) void loadGraph(endpoint);
}
export function setMode(mode: GraphMode) {
  if (state.mode !== mode) set({ mode });
}
export function setSelected(selected: Selected | null) {
  set({ selected });
}
export function setSearch(search: string) {
  set({ search });
}
export function toggleExpanded(id: string) {
  const expanded = new Set(state.expanded);
  if (expanded.has(id)) expanded.delete(id);
  else expanded.add(id);
  set({ expanded });
}
export function showToast(toast: Toast) {
  set({ toast });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastTimer = null;
    set({ toast: null });
  }, 2600);
}

let graphPromise: Promise<void> | null = null;
export function loadGraph(endpoint?: string, force = false): Promise<void> {
  if (!endpoint) {
    set({ status: 'empty' });
    return Promise.resolve();
  }
  if (!force && (state.status === 'ready' || state.status === 'loading')) {
    return graphPromise ?? Promise.resolve();
  }
  set({ status: 'loading' });
  graphPromise = (async () => {
    try {
      const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (res.status === 404) return set({ graph: null, status: 'empty' });
      if (!res.ok) return set({ status: 'error' });
      const graph = (await res.json()) as ComponentGraph;
      set({ graph, status: graph.nodes?.length ? 'ready' : 'empty' });
    } catch {
      set({ status: 'error' });
    }
  })();
  return graphPromise;
}
