'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

import { useDevPanelConfig } from '../../core/config';
import { isIgnored, resolveDisplay, resolveSelected } from './graph-utils';
import {
  setMode,
  showToast,
  setSelected,
  getGraphState,
  subscribeGraph,
  disableInspector,
  getGraphServerState,
} from './store';

interface Hover {
  name: string;
  filePath?: string;
  line?: number;
  domTag: string;
  route?: string;
  rect: { top: number; left: number; width: number; height: number };
  x: number;
  y: number;
}

const TOOLTIP_W = 360;

/** Always-mounted overlay; renders nothing until inspect mode is on. pointer-events:none. */
export function ComponentGraphOverlay() {
  const state = useSyncExternalStore(subscribeGraph, getGraphState, getGraphServerState);
  const theme = useTheme();
  const config = useDevPanelConfig();
  const route = config.getRoute();
  const { enabled } = state;
  const [hover, setHover] = useState<Hover | null>(null);

  const open = useCallback(
    async (file?: string, line?: number, column?: number) => {
      if (!file) {
        showToast({ message: 'No source path — generate the graph', tone: 'error' });
        return;
      }
      const ok = await config.openInEditor?.({ file, line, column }, config.editor);
      showToast(ok === false ? { message: 'Editor unavailable — path copied', tone: 'info' } : { message: 'Opening in your editor…', tone: 'success' });
    },
    [config],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    let raf = 0;
    let last: PointerEvent | null = null;
    const onMove = (e: PointerEvent) => {
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const ev = last;
        const target = ev?.target as Element | null;
        if (!ev || !target || !(target instanceof Element) || isIgnored(target)) {
          setHover(null);
          return;
        }
        const meta = resolveDisplay(target, getGraphState().graph, route);
        const r = target.getBoundingClientRect();
        setHover({
          name: meta.componentName,
          filePath: meta.filePath,
          line: meta.line,
          domTag: meta.domTag,
          route: meta.route,
          rect: { top: r.top, left: r.left, width: r.width, height: r.height },
          x: ev.clientX,
          y: ev.clientY,
        });
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') disableInspector();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || !(target instanceof Element) || isIgnored(target)) return;
      const sel = resolveSelected(target, getGraphState().graph, route);
      e.preventDefault();
      e.stopPropagation();
      setSelected(sel);
      setMode('graph');
      if (e.metaKey || e.ctrlKey) void open(sel.absFilePath ?? sel.filePath, sel.line, sel.column);
      else showToast({ message: `Locked ${sel.componentName}`, tone: 'success' });
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', onClick, true);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', onClick, true);
      setHover(null);
    };
  }, [enabled, route, open]);

  if (!enabled) return null;

  const flipX = typeof window !== 'undefined' && hover && hover.x + TOOLTIP_W + 14 > window.innerWidth;
  const flipY = typeof window !== 'undefined' && hover && hover.y + 140 > window.innerHeight;

  return (
    <Box data-rdp-ignore="" sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: (t) => t.zIndex.tooltip + 1 }}>
      {hover && (
        <Box
          sx={{
            position: 'fixed',
            top: hover.rect.top,
            left: hover.rect.left,
            width: hover.rect.width,
            height: hover.rect.height,
            border: '1px solid',
            borderColor: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            borderRadius: 0.5,
            boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.4)}`,
            transition: 'all 60ms linear',
          }}
        />
      )}
      {hover && (
        <Box
          sx={{
            position: 'fixed',
            top: flipY ? undefined : hover.y + 14,
            bottom: flipY ? window.innerHeight - hover.y + 14 : undefined,
            left: flipX ? undefined : hover.x + 14,
            right: flipX ? window.innerWidth - hover.x + 14 : undefined,
            maxWidth: TOOLTIP_W,
            px: 1.25,
            py: 1,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: alpha(theme.palette.common.white, 0.12),
            bgcolor: alpha(theme.palette.grey[900], 0.85),
            backdropFilter: 'blur(8px)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
            color: theme.palette.common.white,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: hover.filePath ? 0.5 : 0 }}>
            <Chip
              label={hover.name}
              size="small"
              sx={{ height: 18, fontWeight: 700, fontSize: '0.65rem', color: '#fff', bgcolor: alpha(theme.palette.primary.main, 0.5) }}
            />
            <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.6), fontFamily: 'monospace' }}>
              {`<${hover.domTag}>`}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace', fontSize: '0.68rem', wordBreak: 'break-all', color: hover.filePath ? alpha(theme.palette.common.white, 0.85) : alpha(theme.palette.warning.light, 0.9) }}>
            {hover.filePath ? `${hover.filePath}${hover.line ? `:${hover.line}` : ''}` : 'source resolved from graph on lock'}
          </Typography>
          {hover.route && (
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.62rem', color: alpha(theme.palette.common.white, 0.45) }}>
              {hover.route}
            </Typography>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontSize: '0.6rem', color: alpha(theme.palette.common.white, 0.5) }}>
            click to lock · ⌘/Ctrl + click to open · Esc to exit
          </Typography>
        </Box>
      )}
      {state.toast && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 1.5,
            py: 0.75,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: alpha(theme.palette.common.white, 0.12),
            bgcolor: alpha(theme.palette.grey[900], 0.9),
            backdropFilter: 'blur(8px)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: state.toast.tone === 'success' ? 'success.light' : state.toast.tone === 'error' ? 'error.light' : 'common.white' }}
          >
            {state.toast.message}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
