'use client';

import { useState, useEffect, useMemo } from 'react';

import type { DevPanelConfig } from './types';
import { Launcher } from './Launcher';
import { resolveTools } from './registry';
import { DevPanelConfigProvider } from './config';

/**
 * The single component a host mounts (once, near the app root, inside its MUI ThemeProvider).
 * Renders the floating launcher, the active tool's panel, and every tool's always-on overlay —
 * all gated by `enabled`.
 *
 *   <DevPanel enabled={isInternalUser} getRoute={() => pathname} openInEditor={...} />
 */
export function DevPanel(config: DevPanelConfig) {
  const enabled =
    config.enabled ??
    (typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true);

  if (!enabled) return null;
  return (
    <DevPanelConfigProvider config={config}>
      <DevPanelInner ids={config.tools} />
    </DevPanelConfigProvider>
  );
}

function DevPanelInner({ ids }: { ids?: string[] }) {
  const tools = useMemo(() => resolveTools(ids), [ids]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    tools.forEach((t) => t.init?.());
  }, [tools]);

  const ActivePanel = tools.find((t) => t.id === openId)?.Panel ?? null;

  return (
    <>
      <Launcher tools={tools} onOpenTool={setOpenId} />
      {ActivePanel && <ActivePanel onClose={() => setOpenId(null)} />}
      {tools.map((t) => (t.Overlay ? <t.Overlay key={t.id} /> : null))}
    </>
  );
}
