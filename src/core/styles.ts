/**
 * Self-contained styling for react-dev-panel — zero CSS-in-JS dependency, zero design-system
 * coupling. A single `<style>` tag (prefixed `.rdp-*`, scoped under `.rdp-root`) is injected
 * once; components use class names + inline styles. CSS variables hold the dark "premium" theme
 * and can be overridden per-instance via the root element's inline style.
 */

export const RDP_STYLE_ID = 'react-dev-panel-styles';

/** Above virtually everything (MUI modal is 1300; this clears app stacking contexts). */
export const RDP_Z = 2147483000;

const CSS = `
.rdp-root, .rdp-root * { box-sizing: border-box; }
.rdp-root {
  --rdp-bg: #11161d;
  --rdp-bg-elev: #1a212b;
  --rdp-bg-soft: rgba(148,163,184,0.06);
  --rdp-border: rgba(255,255,255,0.09);
  --rdp-text: #e6e9ee;
  --rdp-text-dim: #9aa4b2;
  --rdp-text-faint: #6b7585;
  --rdp-accent: #6950E8;
  --rdp-accent-contrast: #ffffff;
  --rdp-success: #3ddc84;
  --rdp-warning: #e0a82e;
  --rdp-error: #e5575c;
  --rdp-info: #56a6e8;
  --rdp-radius: 10px;
  --rdp-shadow: 0 8px 28px rgba(0,0,0,0.5);
  --rdp-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --rdp-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--rdp-text);
  font-family: var(--rdp-sans);
  font-size: 13px;
  line-height: 1.4;
}

/* Launcher FAB */
.rdp-fab {
  position: fixed; width: 52px; height: 52px; border-radius: 50%;
  display: grid; place-items: center; cursor: grab; border: none;
  color: var(--rdp-accent-contrast);
  background: linear-gradient(135deg, var(--rdp-accent), #4a36b8);
  box-shadow: 0 4px 12px rgba(105,80,232,0.35), 0 8px 24px rgba(0,0,0,0.5);
  z-index: ${RDP_Z};
}
.rdp-fab:active { cursor: grabbing; }
.rdp-fab-badge {
  position: absolute; bottom: -3px; right: -3px; min-width: 18px; height: 18px;
  padding: 0 5px; border-radius: 999px; background: var(--rdp-error); color: #fff;
  font-size: 10px; font-weight: 700; display: grid; place-items: center;
  border: 2px solid var(--rdp-bg);
}

/* Floating surfaces */
.rdp-surface {
  position: fixed; background: var(--rdp-bg); border: 1px solid var(--rdp-border);
  border-radius: var(--rdp-radius); box-shadow: var(--rdp-shadow); overflow: hidden;
  display: flex; flex-direction: column; z-index: ${RDP_Z};
}
.rdp-menu { width: 320px; }
.rdp-panel { width: min(460px, calc(100vw - 32px)); max-height: min(78vh, 720px); }

.rdp-header {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  border-bottom: 1px solid var(--rdp-border); flex-shrink: 0;
}
.rdp-menu-head {
  background: linear-gradient(135deg, rgba(105,80,232,0.18), rgba(105,80,232,0.04));
}
.rdp-title { font-weight: 700; font-size: 13px; }
.rdp-sub { color: var(--rdp-text-dim); font-size: 12px; }
.rdp-body { flex: 1; overflow-y: auto; padding: 12px; }

/* Menu rows */
.rdp-row {
  display: flex; align-items: flex-start; gap: 12px; padding: 10px 12px;
  border-radius: 8px; cursor: pointer; width: 100%; text-align: left; border: none;
  background: transparent; color: inherit; font: inherit;
}
.rdp-row:hover { background: rgba(255,255,255,0.05); }
.rdp-tile {
  width: 38px; height: 38px; flex-shrink: 0; border-radius: 9px;
  display: grid; place-items: center;
}

/* Primitives */
.rdp-chip {
  display: inline-flex; align-items: center; height: 18px; padding: 0 7px;
  border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 1;
}
.rdp-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
  border-radius: 8px; border: 1px solid var(--rdp-border); background: transparent;
  color: var(--rdp-text); font: inherit; font-size: 12px; cursor: pointer;
}
.rdp-btn:hover { background: rgba(255,255,255,0.05); }
.rdp-btn-primary {
  background: var(--rdp-accent); color: var(--rdp-accent-contrast); border-color: transparent;
  font-weight: 600; justify-content: center; width: 100%;
}
.rdp-btn-primary:hover { filter: brightness(1.08); }
.rdp-btn-sm { padding: 2px 7px; font-size: 11px; border-radius: 6px; }
.rdp-iconbtn {
  display: grid; place-items: center; width: 28px; height: 28px; border-radius: 7px;
  border: 1px solid var(--rdp-border); background: transparent; color: var(--rdp-text);
  cursor: pointer;
}
.rdp-iconbtn:hover { background: rgba(255,255,255,0.06); }
.rdp-iconbtn-bare { border: none; width: 22px; height: 22px; color: var(--rdp-text-dim); }
.rdp-iconbtn-bare:hover { color: var(--rdp-text); background: rgba(255,255,255,0.06); }

.rdp-tabs { display: flex; gap: 4px; background: var(--rdp-bg-soft); padding: 3px; border-radius: 9px; }
.rdp-tab {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  padding: 6px 4px; border-radius: 7px; border: none; background: transparent;
  color: var(--rdp-text-dim); font: inherit; font-size: 12px; cursor: pointer;
}
.rdp-tab[aria-selected="true"] { background: var(--rdp-bg-elev); color: var(--rdp-text); box-shadow: 0 1px 2px rgba(0,0,0,0.3); }

.rdp-input {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 9px;
  border: 1px solid var(--rdp-border); background: var(--rdp-bg-soft);
}
.rdp-input input {
  flex: 1; background: transparent; border: none; outline: none; color: var(--rdp-text);
  font: inherit; font-size: 13px;
}
.rdp-mono { font-family: var(--rdp-mono); }
.rdp-section-label {
  display: block; margin: 8px 0 2px; color: var(--rdp-text-faint); font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px;
}

/* Inspector overlay bits */
.rdp-overlay { position: fixed; inset: 0; pointer-events: none; z-index: ${RDP_Z - 1}; }
.rdp-hl {
  position: fixed; border: 1px solid var(--rdp-accent); border-radius: 3px;
  background: rgba(105,80,232,0.14); box-shadow: 0 0 0 1px rgba(105,80,232,0.4);
  transition: all 60ms linear; pointer-events: none;
}
.rdp-tooltip {
  position: fixed; max-width: 360px; padding: 8px 10px; border-radius: 9px;
  background: rgba(15,18,24,0.86); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.12); box-shadow: var(--rdp-shadow); color: #fff;
  pointer-events: none;
}
.rdp-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 7px 14px; border-radius: 9px; background: rgba(15,18,24,0.92);
  border: 1px solid rgba(255,255,255,0.12); box-shadow: var(--rdp-shadow);
  font-size: 12px; font-weight: 600; z-index: ${RDP_Z};
}

.rdp-body::-webkit-scrollbar, .rdp-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.rdp-body::-webkit-scrollbar-thumb, .rdp-scroll::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.14); border-radius: 8px;
}
.rdp-kbd {
  padding: 1px 5px; border-radius: 5px; border: 1px solid var(--rdp-border);
  background: rgba(255,255,255,0.04); font-family: var(--rdp-mono); font-size: 11px;
  color: var(--rdp-text-dim);
}
`;

let injected = false;

/** Inject the stylesheet once (idempotent, SSR-safe). */
export function injectBaseStyles(): void {
  if (injected || typeof document === 'undefined') return;
  if (document.getElementById(RDP_STYLE_ID)) {
    injected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = RDP_STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  injected = true;
}

/** Map a tool color key to a CSS variable. */
export function colorVar(key?: string): string {
  switch (key) {
    case 'info':
      return 'var(--rdp-info)';
    case 'warning':
      return 'var(--rdp-warning)';
    case 'success':
      return 'var(--rdp-success)';
    case 'error':
      return 'var(--rdp-error)';
    default:
      return 'var(--rdp-accent)';
  }
}

/** Tiny classnames helper. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
