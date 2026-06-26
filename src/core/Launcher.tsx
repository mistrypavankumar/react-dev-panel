'use client';

import type { ReactNode, MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';

import Fab from '@mui/material/Fab';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { LuWrench, LuChevronRight } from 'react-icons/lu';

import type { ToolDefinition } from './types';

type TileColor = 'primary' | 'info' | 'warning' | 'success' | 'error';

function ToolTile({ color, size = 38, children }: { color: TileColor; size?: number; children: ReactNode }) {
  return (
    <Box
      sx={(theme) => ({
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 1.5,
        display: 'grid',
        placeItems: 'center',
        color: theme.palette[color].main,
        bgcolor: alpha(theme.palette[color].main, 0.14),
      })}
    >
      {children}
    </Box>
  );
}

// ── draggable corner launcher (ported from the daxwell toolbox) ───────────────
type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
const STORAGE_KEY = 'react-dev-panel:corner';
const EDGE_GAP = 24;
const FAB_SIZE = 56;
const DRAG_THRESHOLD = 5;

function isCorner(v: string | null): v is Corner {
  return v === 'top-left' || v === 'top-right' || v === 'bottom-left' || v === 'bottom-right';
}
function readStoredCorner(): Corner {
  if (typeof window === 'undefined') return 'bottom-right';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isCorner(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'bottom-right';
}

function useDraggableCorner() {
  const [corner, setCorner] = useState<Corner>('bottom-right');
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => setCorner(readStoredCorner()), []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    offsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    movedRef.current = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const handleMove = (ev: PointerEvent) => {
      if (!movedRef.current && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
      movedRef.current = true;
      setDragPos({ x: ev.clientX - offsetRef.current.x, y: ev.clientY - offsetRef.current.y });
    };
    const handleUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (movedRef.current) {
        const cx = ev.clientX - offsetRef.current.x + FAB_SIZE / 2;
        const cy = ev.clientY - offsetRef.current.y + FAB_SIZE / 2;
        const next = `${cy < window.innerHeight / 2 ? 'top' : 'bottom'}-${cx < window.innerWidth / 2 ? 'left' : 'right'}` as Corner;
        setCorner(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
      }
      setDragPos(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, []);

  const onClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
    if (movedRef.current) {
      event.stopPropagation();
      event.preventDefault();
      movedRef.current = false;
    }
  }, []);

  const dragging = dragPos !== null;
  const isTop = corner.startsWith('top');
  const isLeft = corner.endsWith('left');
  const positionSx = dragging
    ? { top: dragPos.y, left: dragPos.x, right: 'auto', bottom: 'auto' }
    : {
        top: isTop ? EDGE_GAP : 'auto',
        bottom: isTop ? 'auto' : EDGE_GAP,
        left: isLeft ? EDGE_GAP : 'auto',
        right: isLeft ? 'auto' : EDGE_GAP,
      };

  return { positionSx, onPointerDown, onClickCapture, isTop, isLeft, dragging };
}

function ToolBadge({ tool }: { tool: ToolDefinition }) {
  const badge = tool.useBadge?.();
  if (!badge) return null;
  const color = badge.tone === 'error' ? 'error' : badge.tone === 'success' ? 'success' : 'default';
  return (
    <Chip
      size="small"
      variant="soft"
      color={color}
      label={badge.label}
      sx={{ height: 18, fontWeight: 700, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
    />
  );
}

/** Floating launcher: draggable FAB opening a menu of the registered tools (MUI). */
export function Launcher({ tools, onOpenTool }: { tools: ToolDefinition[]; onOpenTool: (id: string) => void }) {
  const { positionSx, onPointerDown, onClickCapture, isTop, isLeft, dragging } = useDraggableCorner();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Box
        data-rdp-ignore=""
        sx={(theme) => ({ position: 'fixed', zIndex: theme.zIndex.modal + 2, ...positionSx })}
      >
        <Tooltip title={dragging ? '' : 'Developer Tools — drag to a corner'} placement={isLeft ? 'right' : 'left'} arrow>
          <Fab
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            onClickCapture={onClickCapture}
            onPointerDown={onPointerDown}
            aria-label="Open Developer Tools"
            aria-haspopup="menu"
            sx={(theme) => ({
              width: FAB_SIZE,
              height: FAB_SIZE,
              touchAction: 'none',
              cursor: dragging ? 'grabbing' : 'grab',
              color: theme.palette.primary.contrastText,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.24)}, 0 8px 24px rgba(0,0,0,0.5)`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.dark})`,
              },
            })}
          >
            <LuWrench size={22} />
          </Fab>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        sx={(theme) => ({ zIndex: theme.zIndex.modal + 2 })}
        anchorOrigin={{ vertical: isTop ? 'bottom' : 'top', horizontal: isLeft ? 'left' : 'right' }}
        transformOrigin={{ vertical: isTop ? 'top' : 'bottom', horizontal: isLeft ? 'left' : 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 320,
              mt: isTop ? 1.5 : 0,
              mb: isTop ? 0 : 1.5,
              borderRadius: 2.5,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 16,
            },
          },
          list: { sx: { py: 0 } },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 2,
            py: 1.5,
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)}, ${alpha(theme.palette.primary.main, 0.04)})`,
          }}
        >
          <ToolTile color="primary" size={34}>
            <LuWrench size={17} />
          </ToolTile>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Developer Tools
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Internal utilities
            </Typography>
          </Box>
        </Box>
        <Divider />
        <Box sx={{ p: 1 }}>
          {tools.map((tool, i) => (
            <MenuItem
              key={tool.id}
              onClick={() => {
                onOpenTool(tool.id);
                setMenuAnchor(null);
              }}
              disableGutters
              sx={{ alignItems: 'flex-start', gap: 1.25, px: 1.25, py: 1.25, mt: i === 0 ? 0 : 0.5, borderRadius: 1.5, whiteSpace: 'normal' }}
            >
              <ToolTile color={(tool.color as TileColor) ?? 'primary'}>{tool.icon}</ToolTile>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                  {tool.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {tool.subtitle}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                <ToolBadge tool={tool} />
                <Box sx={{ display: 'grid', placeItems: 'center', color: 'text.disabled' }}>
                  <LuChevronRight size={16} />
                </Box>
              </Stack>
            </MenuItem>
          ))}
        </Box>
      </Menu>
    </>
  );
}
