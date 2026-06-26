'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import { alpha, useTheme } from '@mui/material/styles';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useMemo, useCallback, useSyncExternalStore } from 'react';
import { LuX, LuFile, LuLayers, LuWorkflow, LuMousePointerClick } from 'react-icons/lu';

import type { ToolPanelProps } from '../../core/types';
import type { ComponentGraphNode } from '../../core/graph-types';
import { useDevPanelConfig } from '../../core/config';
import { GraphSearch } from './Search';
import { NodeDetails } from './NodeDetails';
import { ComponentGraphTree } from './Tree';
import { ComponentGraphPageList } from './PageList';
import type { Selected, GraphMode } from './store';
import { selectFromNode, formatForCopy } from './graph-utils';
import {
  setMode,
  loadGraph,
  setSearch,
  showToast,
  setSelected,
  toggleExpanded,
  getGraphState,
  subscribeGraph,
  toggleInspector,
  getGraphServerState,
} from './store';

const TABS: Array<{ value: GraphMode; label: string; icon: React.ReactNode }> = [
  { value: 'hover', label: 'Hover', icon: <LuMousePointerClick size={14} /> },
  { value: 'graph', label: 'Graph', icon: <LuWorkflow size={14} /> },
  { value: 'page', label: 'Page', icon: <LuLayers size={14} /> },
  { value: 'file', label: 'File', icon: <LuFile size={14} /> },
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
  const theme = useTheme();
  const config = useDevPanelConfig();
  const route = config.getRoute();
  const { enabled, mode, selected, graph, status, search, expanded } = state;

  const openLoc = useCallback(
    async (sel: Selected | null) => {
      const file = sel?.absFilePath ?? sel?.filePath;
      if (!file) return showToast({ message: 'No source path available', tone: 'error' });
      const ok = await config.openInEditor?.({ file, line: sel?.line, column: sel?.column }, config.editor);
      showToast(ok === false ? { message: 'Editor unavailable — path copied', tone: 'info' } : { message: 'Opening in your editor…', tone: 'success' });
    },
    [config],
  );

  const copyInfo = useCallback(() => {
    if (!selected) return;
    void copy(formatForCopy(selected)).then((ok) => showToast({ message: ok ? 'Component info copied' : 'Copy failed', tone: ok ? 'success' : 'error' }));
  }, [selected]);

  const copyPath = useCallback((sel: Selected | null) => {
    const path = sel?.filePath ?? sel?.absFilePath;
    if (!path) return showToast({ message: 'No path to copy', tone: 'info' });
    void copy(`${path}${sel?.line ? `:${sel.line}` : ''}`).then((ok) => showToast({ message: ok ? 'File path copied' : 'Copy failed', tone: ok ? 'success' : 'error' }));
  }, []);

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
    <NodeDetails selected={selected} onOpen={() => void openLoc(selected)} onCopyInfo={copyInfo} onCopyPath={() => copyPath(selected)} onSelectName={selectName} />
  );

  return (
    <Box
      data-rdp-ignore=""
      sx={{
        position: 'fixed',
        bottom: 96,
        right: 24,
        zIndex: (t) => t.zIndex.modal + 1,
        width: 'min(460px, calc(100vw - 32px))',
        maxHeight: 'min(78vh, 720px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 12,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LuWorkflow size={16} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Component Graph Inspector
          </Typography>
          {enabled && <Chip label="ON" size="small" color="success" variant="soft" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />}
        </Stack>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <LuX size={16} />
        </IconButton>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        <Box
          sx={{
            p: 1.25,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: enabled ? alpha(theme.palette.success.main, 0.5) : 'divider',
            bgcolor: enabled ? alpha(theme.palette.success.main, 0.08) : 'background.default',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Inspect mode
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {enabled ? 'Hover the UI, click to lock · Esc to exit' : 'Enable, then hover the UI'}
              </Typography>
            </Box>
            <Switch checked={enabled} onChange={() => toggleInspector(config.graphEndpoint)} />
          </Stack>
        </Box>

        <ToggleButtonGroup
          fullWidth
          exclusive
          size="small"
          value={mode}
          onChange={(_, next: GraphMode | null) => {
            if (!next) return;
            setMode(next);
            if (next === 'graph' || next === 'page') void loadGraph(config.graphEndpoint);
          }}
          sx={{ mt: 1.5 }}
        >
          {TABS.map((t) => (
            <ToggleButton key={t.value} value={t.value} sx={{ textTransform: 'none', gap: 0.5, py: 0.5 }}>
              {t.icon}
              {t.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Divider sx={{ my: 1.5 }} />

        {mode === 'hover' && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Last locked component
            </Typography>
            <Box sx={{ mt: 0.5 }}>{details}</Box>
          </Box>
        )}

        {mode === 'graph' && (
          <Box>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: status === 'ready' ? 'success.main' : 'text.disabled' }}>
              {statusText}
            </Typography>
            {(status === 'empty' || status === 'error') && (
              <Chip size="small" variant="outlined" label="Retry graph load" onClick={() => loadGraph(config.graphEndpoint, true)} sx={{ mb: 1, height: 22, fontSize: '0.65rem' }} />
            )}
            <GraphSearch value={search} onChange={setSearch} />
            <Box sx={{ mt: 1 }}>
              <ComponentGraphTree graph={graph} selected={selected} search={search} expanded={expanded} onSelect={selectNode} onToggle={toggleExpanded} onOpen={openNode} onCopy={copyNode} />
            </Box>
            {selected && !search.trim() && <Box sx={{ mt: 1.5 }}>{details}</Box>}
          </Box>
        )}

        {mode === 'page' && (
          <Box>
            <ComponentGraphPageList graph={graph} route={route} selectedName={selected?.componentName} onSelect={selectNode} onOpen={openNode} onCopy={copyNode} />
            {selected && <Box sx={{ mt: 1.5 }}>{details}</Box>}
          </Box>
        )}

        {mode === 'file' && details}
      </Box>
    </Box>
  );
}
