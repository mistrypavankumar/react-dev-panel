import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRef, useState, useEffect, useCallback } from 'react';

import type { ToolDefinition } from './types';
import { colorVar } from './styles';
import { IconWrench, IconChevronRight } from './icons';

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
const STORAGE_KEY = 'react-dev-panel:corner';
const GAP = 20;
const FAB = 52;
const DRAG_THRESHOLD = 5;

function isCorner(v: string | null): v is Corner {
  return v === 'top-left' || v === 'top-right' || v === 'bottom-left' || v === 'bottom-right';
}
function readCorner(): Corner {
  if (typeof window === 'undefined') return 'bottom-right';
  try {
    const s = window.localStorage.getItem(STORAGE_KEY);
    if (isCorner(s)) return s;
  } catch {
    /* ignore */
  }
  return 'bottom-right';
}

function useDraggableCorner() {
  const [corner, setCorner] = useState<Corner>('bottom-right');
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => setCorner(readCorner()), []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    moved.current = false;
    const sx = e.clientX;
    const sy = e.clientY;
    const move = (ev: PointerEvent) => {
      if (!moved.current && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
      moved.current = true;
      setDrag({ x: ev.clientX - offset.current.x, y: ev.clientY - offset.current.y });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved.current) {
        const cxp = ev.clientX - offset.current.x + FAB / 2;
        const cyp = ev.clientY - offset.current.y + FAB / 2;
        const next = `${cyp < window.innerHeight / 2 ? 'top' : 'bottom'}-${
          cxp < window.innerWidth / 2 ? 'left' : 'right'
        }` as Corner;
        setCorner(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const onClickCapture = useCallback((e: ReactMouseEvent) => {
    if (moved.current) {
      e.stopPropagation();
      e.preventDefault();
      moved.current = false;
    }
  }, []);

  const isTop = corner.startsWith('top');
  const isLeft = corner.endsWith('left');
  const pos = drag
    ? { top: drag.y, left: drag.x }
    : {
        top: isTop ? GAP : undefined,
        bottom: isTop ? undefined : GAP,
        left: isLeft ? GAP : undefined,
        right: isLeft ? undefined : GAP,
      };
  return { pos, isTop, isLeft, onPointerDown, onClickCapture };
}

function ToolBadge({ tool }: { tool: ToolDefinition }) {
  const badge = tool.useBadge?.();
  if (!badge) return null;
  const bg =
    badge.tone === 'error'
      ? 'var(--rdp-error)'
      : badge.tone === 'success'
        ? 'var(--rdp-success)'
        : 'var(--rdp-bg-soft)';
  const color = badge.tone === 'success' ? '#06210f' : '#fff';
  return (
    <span className="rdp-chip" style={{ background: bg, color }}>
      {badge.label}
    </span>
  );
}

/** Floating launcher: draggable FAB that opens a menu listing the registered tools. */
export function Launcher({
  tools,
  onOpenTool,
}: {
  tools: ToolDefinition[];
  onOpenTool: (id: string) => void;
}) {
  const { pos, isTop, isLeft, onPointerDown, onClickCapture } = useDraggableCorner();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuPos = {
    top: isTop ? pos.top !== undefined ? (pos.top as number) + FAB + 8 : GAP + FAB + 8 : undefined,
    bottom: isTop ? undefined : GAP + FAB + 8,
    left: isLeft ? GAP : undefined,
    right: isLeft ? undefined : GAP,
  };

  return (
    <>
      <button
        type="button"
        className="rdp-fab"
        style={pos}
        onPointerDown={onPointerDown}
        onClickCapture={onClickCapture}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Open Developer Tools"
        aria-haspopup="menu"
      >
        <IconWrench size={22} />
      </button>

      {menuOpen && (
        <>
          {/* click-away */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 1 }}
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div className="rdp-surface rdp-menu" style={menuPos} role="menu">
            <div className="rdp-header rdp-menu-head">
              <span className="rdp-tile" style={{ color: 'var(--rdp-accent)', background: 'rgba(105,80,232,0.16)' }}>
                <IconWrench size={17} />
              </span>
              <div>
                <div className="rdp-title">Developer Tools</div>
                <div className="rdp-sub">Internal utilities</div>
              </div>
            </div>
            <div style={{ padding: 8 }}>
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className="rdp-row"
                  role="menuitem"
                  onClick={() => {
                    onOpenTool(tool.id);
                    setMenuOpen(false);
                  }}
                >
                  <span
                    className="rdp-tile"
                    style={{ color: colorVar(tool.color), background: 'rgba(148,163,184,0.1)' }}
                  >
                    {tool.icon}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="rdp-title" style={{ display: 'block' }}>
                      {tool.title}
                    </span>
                    <span className="rdp-sub" style={{ display: 'block' }}>
                      {tool.subtitle}
                    </span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--rdp-text-faint)' }}>
                    <ToolBadge tool={tool} />
                    <IconChevronRight size={16} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
