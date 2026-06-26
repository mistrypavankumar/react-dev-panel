import type { ReactNode } from 'react';

import type { ComponentGraph, ComponentGraphNode } from '../../core/graph-types';
import type { Selected } from './store';
import { IconCopy, IconArrowUp, IconFileCode, IconChevronDown, IconChevronRight } from '../../core/icons';
import { findNode, getChildren, searchNodes } from './graph-utils';

const MAX_DEPTH = 6;

export interface TreeProps {
  graph: ComponentGraph | null;
  selected: Selected | null;
  search: string;
  expanded: ReadonlySet<string>;
  onSelect: (node: ComponentGraphNode) => void;
  onToggle: (id: string) => void;
  onOpen: (node: ComponentGraphNode) => void;
  onCopy: (node: ComponentGraphNode) => void;
}

function Label({ children }: { children: ReactNode }) {
  return <span className="rdp-section-label">{children}</span>;
}

function RowActions({
  node,
  onOpen,
  onCopy,
}: {
  node: ComponentGraphNode;
  onOpen: (n: ComponentGraphNode) => void;
  onCopy: (n: ComponentGraphNode) => void;
}) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      <button type="button" className="rdp-iconbtn-bare" title="Open in editor" onClick={(e) => { e.stopPropagation(); onOpen(node); }}>
        <IconFileCode size={13} />
      </button>
      <button type="button" className="rdp-iconbtn-bare" title="Copy file path" onClick={(e) => { e.stopPropagation(); onCopy(node); }}>
        <IconCopy size={13} />
      </button>
    </span>
  );
}

function RowShell({
  depth = 0,
  active,
  caret,
  label,
  isRoute,
  onLabel,
  actions,
}: {
  depth?: number;
  active?: boolean;
  caret?: ReactNode;
  label: string;
  isRoute?: boolean;
  onLabel: () => void;
  actions?: ReactNode;
}) {
  return (
    <div
      className="rdp-row"
      style={{
        padding: '3px 6px',
        paddingLeft: 6 + depth * 14,
        gap: 4,
        alignItems: 'center',
        background: active ? 'rgba(105,80,232,0.16)' : undefined,
      }}
    >
      <span style={{ width: 16, display: 'grid', placeItems: 'center', color: 'var(--rdp-text-faint)' }}>{caret}</span>
      <button
        type="button"
        onClick={onLabel}
        className="rdp-mono"
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: active ? 700 : 500,
          color: isRoute ? 'var(--rdp-info)' : active ? 'var(--rdp-accent)' : 'var(--rdp-text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </button>
      {actions}
    </div>
  );
}

function Branch({ name, depth, trail, p }: { name: string; depth: number; trail: ReadonlySet<string>; p: TreeProps }) {
  const node = findNode(p.graph, name);
  const id = node?.id ?? name;
  const kids = node ? getChildren(p.graph, id) : [];
  const hasKids = kids.length > 0 && depth < MAX_DEPTH && !trail.has(id);
  const open = p.expanded.has(id);
  const active = p.selected?.nodeId === id || p.selected?.componentName === name;
  return (
    <div>
      <RowShell
        depth={depth}
        active={active}
        isRoute={node?.type === 'route'}
        caret={
          hasKids ? (
            <span style={{ cursor: 'pointer' }} onClick={() => p.onToggle(id)}>
              {open ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
            </span>
          ) : null
        }
        label={name}
        onLabel={() => node && p.onSelect(node)}
        actions={node ? <RowActions node={node} onOpen={p.onOpen} onCopy={p.onCopy} /> : null}
      />
      {hasKids && open && kids.map((k) => <Branch key={`${id}>${k}`} name={k} depth={depth + 1} trail={new Set([...trail, id])} p={p} />)}
    </div>
  );
}

export function ComponentGraphTree(p: TreeProps) {
  const { graph, selected, search } = p;

  if (graph && search.trim()) {
    const results = searchNodes(graph, search);
    return (
      <div>
        <Label>{results.length} match{results.length === 1 ? '' : 'es'}</Label>
        {results.map((node) => (
          <RowShell
            key={node.id}
            active={selected?.nodeId === node.id}
            isRoute={node.type === 'route'}
            label={node.name}
            onLabel={() => p.onSelect(node)}
            actions={<RowActions node={node} onOpen={p.onOpen} onCopy={p.onCopy} />}
          />
        ))}
        {results.length === 0 && (
          <div style={{ color: 'var(--rdp-text-faint)', paddingLeft: 8 }}>No components match “{search}”.</div>
        )}
      </div>
    );
  }

  if (!selected) {
    return (
      <div style={{ color: 'var(--rdp-text-faint)', padding: '8px 2px' }}>
        Lock a component (hover + click) or search above to explore the tree.
      </div>
    );
  }

  return (
    <div>
      {selected.parents.length > 0 && (
        <>
          <Label>Parent chain</Label>
          {selected.parents.map((parent) => {
            const node = findNode(graph, parent);
            return (
              <RowShell
                key={`p:${parent}`}
                isRoute={node?.type === 'route'}
                caret={<IconArrowUp size={12} />}
                label={parent}
                onLabel={() => node && p.onSelect(node)}
                actions={node ? <RowActions node={node} onOpen={p.onOpen} onCopy={p.onCopy} /> : null}
              />
            );
          })}
        </>
      )}

      <Label>Selected</Label>
      <RowShell active label={selected.componentName} onLabel={() => undefined} />

      <Label>Renders ({selected.children.length})</Label>
      {selected.children.length === 0 ? (
        <div style={{ color: 'var(--rdp-text-faint)', paddingLeft: 20 }}>No child components detected.</div>
      ) : (
        selected.children.map((c) => (
          <Branch key={`c:${c}`} name={c} depth={0} trail={new Set(selected.nodeId ? [selected.nodeId] : [])} p={p} />
        ))
      )}

      {selected.imports.length > 0 && (
        <>
          <Label>Imports ({selected.imports.length})</Label>
          {selected.imports.map((imp) => {
            const node = findNode(graph, imp);
            return (
              <RowShell
                key={`i:${imp}`}
                isRoute={node?.type === 'route'}
                label={imp}
                onLabel={() => node && p.onSelect(node)}
                actions={node ? <RowActions node={node} onOpen={p.onOpen} onCopy={p.onCopy} /> : null}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
