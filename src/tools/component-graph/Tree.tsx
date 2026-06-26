'use client';

import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import { LuCopy, LuArrowUp, LuFileCode, LuChevronDown, LuChevronRight } from 'react-icons/lu';

import type { Selected } from './store';
import type { ComponentGraph, ComponentGraphNode } from '../../core/graph-types';
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
  return (
    <Typography variant="caption" sx={{ display: 'block', mt: 1, mb: 0.25, color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: '0.6rem' }}>
      {children}
    </Typography>
  );
}

function RowActions({ node, onOpen, onCopy }: { node: ComponentGraphNode; onOpen: (n: ComponentGraphNode) => void; onCopy: (n: ComponentGraphNode) => void }) {
  return (
    <>
      <Tooltip title="Open in editor" placement="top">
        <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => { e.stopPropagation(); onOpen(node); }}>
          <LuFileCode size={13} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Copy file path" placement="top">
        <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => { e.stopPropagation(); onCopy(node); }}>
          <LuCopy size={13} />
        </IconButton>
      </Tooltip>
    </>
  );
}

function RowShell({
  depth = 0,
  active = false,
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
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.5}
      sx={(t) => ({
        pl: 0.5 + depth * 1.5,
        pr: 0.5,
        py: 0.25,
        borderRadius: 1,
        bgcolor: active ? alpha(t.palette.primary.main, 0.16) : 'transparent',
        '&:hover': { bgcolor: active ? alpha(t.palette.primary.main, 0.2) : 'action.hover' },
        '&:hover .rdp-row-actions': { opacity: 1 },
      })}
    >
      <Box sx={{ width: 16, display: 'grid', placeItems: 'center', color: 'text.disabled' }}>{caret}</Box>
      <Typography
        onClick={onLabel}
        variant="caption"
        sx={{
          flex: 1,
          minWidth: 0,
          cursor: 'pointer',
          fontWeight: active ? 700 : 500,
          fontFamily: 'monospace',
          fontSize: '0.72rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: isRoute ? 'info.main' : active ? 'primary.main' : 'text.primary',
        }}
      >
        {label}
      </Typography>
      {actions && (
        <Stack direction="row" spacing={0.25} className="rdp-row-actions" sx={{ opacity: 0, transition: 'opacity 120ms' }}>
          {actions}
        </Stack>
      )}
    </Stack>
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
    <Box>
      <RowShell
        depth={depth}
        active={active}
        isRoute={node?.type === 'route'}
        caret={
          hasKids ? (
            <Box sx={{ cursor: 'pointer', display: 'grid', placeItems: 'center' }} onClick={() => p.onToggle(id)}>
              {open ? <LuChevronDown size={13} /> : <LuChevronRight size={13} />}
            </Box>
          ) : null
        }
        label={name}
        onLabel={() => node && p.onSelect(node)}
        actions={node ? <RowActions node={node} onOpen={p.onOpen} onCopy={p.onCopy} /> : null}
      />
      {hasKids && open && kids.map((k) => <Branch key={`${id}>${k}`} name={k} depth={depth + 1} trail={new Set([...trail, id])} p={p} />)}
    </Box>
  );
}

export function ComponentGraphTree(p: TreeProps) {
  const { graph, selected, search } = p;

  if (graph && search.trim()) {
    const results = searchNodes(graph, search);
    return (
      <Box>
        <Label>
          {results.length} match{results.length === 1 ? '' : 'es'}
        </Label>
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
          <Typography variant="caption" sx={{ color: 'text.disabled', pl: 1 }}>
            No components match “{search}”.
          </Typography>
        )}
      </Box>
    );
  }

  if (!selected) {
    return (
      <Typography variant="body2" sx={{ color: 'text.disabled', px: 0.5, py: 1 }}>
        Lock a component (hover + click) or search above to explore the tree.
      </Typography>
    );
  }

  return (
    <Box>
      {selected.parents.length > 0 && (
        <>
          <Label>Parent chain</Label>
          {selected.parents.map((parent) => {
            const node = findNode(graph, parent);
            return (
              <RowShell
                key={`p:${parent}`}
                isRoute={node?.type === 'route'}
                caret={<LuArrowUp size={12} />}
                label={parent}
                onLabel={() => node && p.onSelect(node)}
                actions={node ? <RowActions node={node} onOpen={p.onOpen} onCopy={p.onCopy} /> : null}
              />
            );
          })}
        </>
      )}

      <Label>Selected</Label>
      <RowShell active label={selected.componentName} onLabel={() => undefined} actions={<Chip size="small" variant="soft" color="primary" label={selected.source} sx={{ height: 16, fontSize: '0.55rem', fontWeight: 700 }} />} />

      <Label>Renders ({selected.children.length})</Label>
      {selected.children.length === 0 ? (
        <Typography variant="caption" sx={{ color: 'text.disabled', pl: 1.5 }}>
          No child components detected.
        </Typography>
      ) : (
        selected.children.map((c) => <Branch key={`c:${c}`} name={c} depth={0} trail={new Set(selected.nodeId ? [selected.nodeId] : [])} p={p} />)
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
    </Box>
  );
}
