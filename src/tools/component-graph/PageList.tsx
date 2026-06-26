'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import { useState, useEffect, useCallback } from 'react';
import { LuCopy, LuFileCode, LuRefreshCw } from 'react-icons/lu';

import { GraphSearch } from './Search';
import { collectMounted, type MountedComponent } from './graph-utils';
import type { ComponentGraph, ComponentGraphNode } from '../../core/graph-types';

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
      <Typography variant="body2" sx={{ color: 'text.disabled', px: 0.5, py: 1 }}>
        Load the component graph (Graph tab) to map mounted components to source files.
      </Typography>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q) || i.node.filePath.toLowerCase().includes(q)) : items;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          <Box component="span" sx={{ fontFamily: 'monospace', color: 'info.main' }}>
            {route ?? '/'}
          </Box>{' '}
          · {q ? `${filtered.length} / ${items.length}` : items.length} component{items.length === 1 ? '' : 's'}
        </Typography>
        <Button size="small" startIcon={<LuRefreshCw size={13} />} onClick={scan} sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25 }}>
          Rescan
        </Button>
      </Stack>

      <Box sx={{ mb: 1 }}>
        <GraphSearch value={query} onChange={setQuery} placeholder="Filter components on this page…" />
      </Box>

      {items.length === 0 ? (
        <Typography variant="caption" sx={{ color: 'text.disabled', pl: 0.5 }}>
          No graph components detected in the live tree. Try Rescan, or regenerate the graph.
        </Typography>
      ) : filtered.length === 0 ? (
        <Typography variant="caption" sx={{ color: 'text.disabled', pl: 0.5 }}>
          No components match “{query}”.
        </Typography>
      ) : (
        filtered.map(({ name, node, count }) => (
          <Stack
            key={node.id}
            direction="row"
            alignItems="center"
            spacing={0.5}
            onClick={() => onSelect(node)}
            sx={(t) => ({
              px: 0.5,
              py: 0.4,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: selectedName === name ? alpha(t.palette.primary.main, 0.16) : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
              '&:hover .rdp-row-actions': { opacity: 1 },
            })}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                </Typography>
                {count > 1 && <Chip label={`×${count}`} size="small" variant="soft" sx={{ height: 15, fontSize: '0.55rem', '& .MuiChip-label': { px: 0.5 } }} />}
              </Stack>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontSize: '0.62rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {node.filePath}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.25} className="rdp-row-actions" sx={{ opacity: 0, transition: 'opacity 120ms' }}>
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
            </Stack>
          </Stack>
        ))
      )}
    </Box>
  );
}
