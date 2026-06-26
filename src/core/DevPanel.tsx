import type { CSSProperties } from 'react';
import { useState, useEffect, useMemo } from 'react';

import type { DevPanelConfig } from './types';
import { Launcher } from './Launcher';
import { resolveTools } from './registry';
import { injectBaseStyles } from './styles';
import { DevPanelConfigProvider } from './config';

/**
 * The single component a host mounts (once, near the app root). Renders the floating launcher,
 * the active tool's panel, and every tool's always-on overlay — all gated by `enabled`.
 *
 *   <DevPanel enabled={isInternalUser} getRoute={() => pathname} openInEditor={...} />
 */
export function DevPanel(config: DevPanelConfig) {
  const enabled =
    config.enabled ??
    (typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true);

  useEffect(() => {
    if (enabled) injectBaseStyles();
  }, [enabled]);

  if (!enabled) return null;
  return (
    <DevPanelConfigProvider config={config}>
      <DevPanelInner ids={config.tools} theme={config.theme} />
    </DevPanelConfigProvider>
  );
}

function DevPanelInner({
  ids,
  theme,
}: {
  ids?: string[];
  theme?: { accent?: string; accentContrast?: string };
}) {
  const tools = useMemo(() => resolveTools(ids), [ids]);
  const [openId, setOpenId] = useState<string | null>(null);

  // One-time tool init (console capture, perf observers, …).
  useEffect(() => {
    tools.forEach((t) => t.init?.());
  }, [tools]);

  const rootStyle: CSSProperties = {};
  if (theme?.accent) (rootStyle as Record<string, string>)['--rdp-accent'] = theme.accent;
  if (theme?.accentContrast)
    (rootStyle as Record<string, string>)['--rdp-accent-contrast'] = theme.accentContrast;

  const ActivePanel = tools.find((t) => t.id === openId)?.Panel ?? null;

  return (
    <div className="rdp-root" style={rootStyle} data-rdp-ignore="">
      <Launcher tools={tools} onOpenTool={setOpenId} />
      {ActivePanel && <ActivePanel onClose={() => setOpenId(null)} />}
      {tools.map((t) => (t.Overlay ? <t.Overlay key={t.id} /> : null))}
    </div>
  );
}
