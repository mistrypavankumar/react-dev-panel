import { useMemo, useCallback, useSyncExternalStore } from 'react';

import type { ToolPanelProps } from '../../core/types';
import type { ComponentGraphNode } from '../../core/graph-types';
import { cx } from '../../core/styles';
import { useDevPanelConfig } from '../../core/config';
import { GraphSearch } from './Search';
import { NodeDetails } from './NodeDetails';
import { ComponentGraphTree } from './Tree';
import { ComponentGraphPageList } from './PageList';
import type { Selected, GraphMode } from './store';
import { IconX, IconGraph, IconLayers, IconPointer, IconFileCode } from '../../core/icons';
import { selectFromNode, formatForCopy } from './graph-utils';
import {
  setMode,
  loadGraph,
  setSearch,
  setSelected,
  showToast,
  toggleExpanded,
  getGraphState,
  subscribeGraph,
  toggleInspector,
  getGraphServerState,
} from './store';

const TABS: Array<{ value: GraphMode; label: string; icon: React.ReactNode }> = [
  { value: 'hover', label: 'Hover', icon: <IconPointer size={14} /> },
  { value: 'graph', label: 'Graph', icon: <IconGraph size={14} /> },
  { value: 'page', label: 'Page', icon: <IconLayers size={14} /> },
  { value: 'file', label: 'File', icon: <IconFileCode size={14} /> },
];

async function copy(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}

export function ComponentGraphPanel({ onClose }: ToolPanelProps) {
  const state = useSyncExternalStore(subscribeGraph, getGraphState, getGraphServerState);
  const config = useDevPanelConfig();
  const route = config.getRoute();
  const { enabled, mode, selected, graph, status, search, expanded } = state;

  const openLoc = useCallback(
    async (sel: Selected | null) => {
      const file = sel?.absFilePath ?? sel?.filePath;
      if (!file) {
        showToast({ message: 'No source path available', tone: 'error' });
        return;
      }
      const ok = await config.openInEditor?.({ file, line: sel?.line, column: sel?.column }, config.editor);
      showToast(ok === false ? { message: 'Editor unavailable — path copied', tone: 'info' } : { message: 'Opening in your editor…', tone: 'success' });
    },
    [config],
  );

  const copyInfo = useCallback(() => {
    if (!selected) return;
    void copy(formatForCopy(selected)).then((ok) => showToast({ message: ok ? 'Component info copied' : 'Copy failed', tone: ok ? 'success' : 'error' }));
  }, [selected]);

  const copyPath = useCallback(
    (sel: Selected | null) => {
      const path = sel?.filePath ?? sel?.absFilePath;
      if (!path) return showToast({ message: 'No path to copy', tone: 'info' });
      void copy(`${path}${sel?.line ? `:${sel.line}` : ''}`).then((ok) => showToast({ message: ok ? 'File path copied' : 'Copy failed', tone: ok ? 'success' : 'error' }));
    },
    [],
  );

  const selectName = useCallback(
    (name: string) => {
      const node = graph?.nodes.find((n) => n.name === name || n.id === name);
      if (node) setSelected(selectFromNode(graph, node));
    },
    [graph],
  );
  const selectNode = useCallback((node: ComponentGraphNode) => setSelected(selectFromNode(graph, node)), [graph]);
  const openNode = useCallback((node: ComponentGraphNode) => void openLoc(selectFromNode(graph, node)), [graph, openLoc]);
  const copyNode = useCallback((node: ComponentGraphNode) => copyPath(selectFromNode(graph, node)), [graph, copyPath]);

  const statusText = useMemo(() => {
    if (status === 'ready' && graph) return `${graph.nodes.length} components · ${graph.edges.length} relationships`;
    if (status === 'loading' || status === 'idle') return 'Loading component graph…';
    if (status === 'empty') return 'Graph not generated — run `npx dev-panel-graph` (or add an adapter)';
    return 'Graph endpoint unavailable.';
  }, [status, graph]);

  const details = (
    <NodeDetails
      selected={selected}
      onOpen={() => void openLoc(selected)}
      onCopyInfo={copyInfo}
      onCopyPath={() => copyPath(selected)}
      onSelectName={selectName}
    />
  );

  return (
    <div className="rdp-surface rdp-panel" style={{ bottom: 88, right: 20 }}>
      <div className="rdp-header">
        <IconGraph size={16} />
        <span className="rdp-title" style={{ flex: 1 }}>
          Component Graph Inspector
        </span>
        {enabled && (
          <span className="rdp-chip" style={{ background: 'var(--rdp-success)', color: '#06210f' }}>ON</span>
        )}
        <button type="button" className="rdp-iconbtn-bare" onClick={onClose} aria-label="Close">
          <IconX size={16} />
        </button>
      </div>

      <div className="rdp-body">
        {/* enable */}
        <div
          style={{
            padding: 12,
            borderRadius: 9,
            border: `1px solid ${enabled ? 'rgba(61,220,132,0.5)' : 'var(--rdp-border)'}`,
            background: enabled ? 'rgba(61,220,132,0.08)' : 'var(--rdp-bg-elev)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            <span className="rdp-title" style={{ display: 'block' }}>
              Inspect mode
            </span>
            <span className="rdp-sub">{enabled ? 'Hover the UI, click to lock · Esc to exit' : 'Enable, then hover the UI'}</span>
          </span>
          <button
            type="button"
            className={cx('rdp-btn', enabled && 'rdp-btn-primary')}
            style={{ width: 'auto' }}
            onClick={() => toggleInspector(config.graphEndpoint)}
          >
            {enabled ? 'On' : 'Enable'}
          </button>
        </div>

        {/* tabs */}
        <div className="rdp-tabs" style={{ marginTop: 12 }}>
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              className="rdp-tab"
              aria-selected={mode === t.value}
              onClick={() => {
                setMode(t.value);
                if (t.value === 'graph' || t.value === 'page') void loadGraph(config.graphEndpoint);
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          {mode === 'hover' && (
            <div>
              <span className="rdp-section-label">Last locked component</span>
              {details}
            </div>
          )}

          {mode === 'graph' && (
            <div>
              <div className="rdp-sub" style={{ marginBottom: 6, color: status === 'ready' ? 'var(--rdp-success)' : 'var(--rdp-text-faint)' }}>
                {statusText}
              </div>
              {(status === 'empty' || status === 'error') && (
                <button type="button" className="rdp-btn rdp-btn-sm" style={{ marginBottom: 8 }} onClick={() => loadGraph(config.graphEndpoint, true)}>
                  Retry graph load
                </button>
              )}
              <GraphSearch value={search} onChange={setSearch} />
              <div style={{ marginTop: 8 }}>
                <ComponentGraphTree
                  graph={graph}
                  selected={selected}
                  search={search}
                  expanded={expanded}
                  onSelect={selectNode}
                  onToggle={toggleExpanded}
                  onOpen={openNode}
                  onCopy={copyNode}
                />
              </div>
              {selected && !search.trim() && <div style={{ marginTop: 12 }}>{details}</div>}
            </div>
          )}

          {mode === 'page' && (
            <div>
              <ComponentGraphPageList
                graph={graph}
                route={route}
                selectedName={selected?.componentName}
                onSelect={selectNode}
                onOpen={openNode}
                onCopy={copyNode}
              />
              {selected && <div style={{ marginTop: 12 }}>{details}</div>}
            </div>
          )}

          {mode === 'file' && details}
        </div>
      </div>
    </div>
  );
}
