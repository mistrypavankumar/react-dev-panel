import { useState, useEffect, useCallback } from 'react';

import type { ComponentGraph, ComponentGraphNode } from '../../core/graph-types';
import { GraphSearch } from './Search';
import { IconCopy, IconRefresh, IconFileCode } from '../../core/icons';
import { collectMounted, type MountedComponent } from './graph-utils';

export function ComponentGraphPageList({
  graph,
  route,
  selectedName,
  onSelect,
  onOpen,
  onCopy,
}: {
  graph: ComponentGraph | null;
  route?: string;
  selectedName?: string;
  onSelect: (node: ComponentGraphNode) => void;
  onOpen: (node: ComponentGraphNode) => void;
  onCopy: (node: ComponentGraphNode) => void;
}) {
  const [items, setItems] = useState<MountedComponent[]>([]);
  const [query, setQuery] = useState('');

  const scan = useCallback(() => setItems(collectMounted(graph)), [graph]);

  // Scan on open / graph load / route change; two frames + a late pass for streamed content.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(scan);
    });
    const late = setTimeout(scan, 600);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(late);
    };
  }, [scan, route]);

  if (!graph) {
    return (
      <div style={{ color: 'var(--rdp-text-faint)', padding: '6px 2px' }}>
        Load the component graph (Graph tab) to map mounted components to source files.
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.name.toLowerCase().includes(q) || i.node.filePath.toLowerCase().includes(q))
    : items;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="rdp-sub">
          <span className="rdp-mono" style={{ color: 'var(--rdp-info)' }}>{route ?? '/'}</span> ·{' '}
          {q ? `${filtered.length} / ${items.length}` : items.length} component{items.length === 1 ? '' : 's'}
        </span>
        <button type="button" className="rdp-btn rdp-btn-sm" onClick={scan}>
          <IconRefresh size={13} /> Rescan
        </button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <GraphSearch value={query} onChange={setQuery} placeholder="Filter components on this page…" />
      </div>

      {items.length === 0 ? (
        <div style={{ color: 'var(--rdp-text-faint)', paddingLeft: 4 }}>
          No graph components detected in the live tree. Try Rescan, or regenerate the graph.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--rdp-text-faint)', paddingLeft: 4 }}>No components match “{query}”.</div>
      ) : (
        filtered.map(({ name, node, count }) => (
          <div
            key={node.id}
            className="rdp-row"
            style={{ padding: '4px 6px', alignItems: 'center', background: selectedName === name ? 'rgba(105,80,232,0.16)' : undefined }}
            onClick={() => onSelect(node)}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="rdp-mono" style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                </span>
                {count > 1 && (
                  <span className="rdp-chip" style={{ background: 'var(--rdp-bg-soft)', color: 'var(--rdp-text-dim)', height: 15 }}>
                    ×{count}
                  </span>
                )}
              </span>
              <span style={{ display: 'block', color: 'var(--rdp-text-faint)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {node.filePath}
              </span>
            </span>
            <span style={{ display: 'inline-flex', gap: 2 }}>
              <button type="button" className="rdp-iconbtn-bare" title="Open in editor" onClick={(e) => { e.stopPropagation(); onOpen(node); }}>
                <IconFileCode size={13} />
              </button>
              <button type="button" className="rdp-iconbtn-bare" title="Copy file path" onClick={(e) => { e.stopPropagation(); onCopy(node); }}>
                <IconCopy size={13} />
              </button>
            </span>
          </div>
        ))
      )}
    </div>
  );
}
