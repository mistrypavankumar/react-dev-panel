import { useState, useEffect, useCallback } from 'react';

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
import { useSyncExternalStore } from 'react';

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

/** Always-mounted overlay. Renders nothing until inspect mode is on. pointer-events:none. */
export function ComponentGraphOverlay() {
  const state = useSyncExternalStore(subscribeGraph, getGraphState, getGraphServerState);
  const config = useDevPanelConfig();
  const [hover, setHover] = useState<Hover | null>(null);
  const route = config.getRoute();
  const { enabled } = state;

  const openSelected = useCallback(
    async (file?: string, line?: number, column?: number, name?: string) => {
      if (!file) {
        showToast({ message: 'No source path — generate the graph or use inspect build', tone: 'error' });
        return;
      }
      const ok = await config.openInEditor?.({ file, line, column }, config.editor);
      showToast(
        ok === false
          ? { message: `Editor unavailable — path copied (${name ?? ''})`, tone: 'info' }
          : { message: 'Opening in your editor…', tone: 'success' },
      );
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
      if (e.metaKey || e.ctrlKey) {
        void openSelected(sel.absFilePath ?? sel.filePath, sel.line, sel.column, sel.componentName);
      } else {
        showToast({ message: `Locked ${sel.componentName}`, tone: 'success' });
      }
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
  }, [enabled, route, openSelected]);

  if (!enabled) return null;

  const flipX = typeof window !== 'undefined' && hover && hover.x + 374 > window.innerWidth;
  const flipY = typeof window !== 'undefined' && hover && hover.y + 140 > window.innerHeight;

  return (
    <div className="rdp-overlay">
      {hover && (
        <div
          className="rdp-hl"
          style={{ top: hover.rect.top, left: hover.rect.left, width: hover.rect.width, height: hover.rect.height }}
        />
      )}
      {hover && (
        <div
          className="rdp-tooltip"
          style={{
            top: flipY ? undefined : hover.y + 14,
            bottom: flipY ? window.innerHeight - hover.y + 14 : undefined,
            left: flipX ? undefined : hover.x + 14,
            right: flipX ? window.innerWidth - hover.x + 14 : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hover.filePath ? 4 : 0 }}>
            <span className="rdp-chip" style={{ background: 'rgba(105,80,232,0.5)', color: '#fff' }}>
              {hover.name}
            </span>
            <span className="rdp-mono" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
              {`<${hover.domTag}>`}
            </span>
          </div>
          <div className="rdp-mono" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', wordBreak: 'break-all' }}>
            {hover.filePath ? `${hover.filePath}${hover.line ? `:${hover.line}` : ''}` : 'source resolved from graph on lock'}
          </div>
          {hover.route && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{hover.route}</div>
          )}
          <div style={{ fontSize: 10.5, marginTop: 4, color: 'rgba(255,255,255,0.5)' }}>
            click to lock · ⌘/Ctrl + click to open · Esc to exit
          </div>
        </div>
      )}
      {state.toast && (
        <div
          className="rdp-toast"
          style={{
            color:
              state.toast.tone === 'success'
                ? 'var(--rdp-success)'
                : state.toast.tone === 'error'
                  ? 'var(--rdp-error)'
                  : '#fff',
          }}
        >
          {state.toast.message}
        </div>
      )}
    </div>
  );
}
