import { useState, useSyncExternalStore } from 'react';

import type { ToolDefinition, ToolPanelProps } from '../../core/types';
import { cx } from '../../core/styles';
import { registerTool } from '../../core/registry';
import { IconBug, IconX } from '../../core/icons';
import type { LogLevel } from './store';
import {
  getLogs,
  clearLogs,
  errorCount,
  getServerLogs,
  subscribeLogs,
  installCapture,
} from './store';

const LEVELS: Array<LogLevel | 'all'> = ['all', 'log', 'warn', 'error', 'network'];

const LEVEL_COLOR: Record<LogLevel, string> = {
  log: 'var(--rdp-text-dim)',
  info: 'var(--rdp-info)',
  warn: 'var(--rdp-warning)',
  error: 'var(--rdp-error)',
  network: 'var(--rdp-info)',
};

function DevLogsPanel({ onClose }: ToolPanelProps) {
  const logs = useSyncExternalStore(subscribeLogs, getLogs, getServerLogs);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const shown = filter === 'all' ? logs : logs.filter((l) => l.level === filter);

  return (
    <div className="rdp-surface rdp-panel" style={{ bottom: 88, right: 20 }}>
      <div className="rdp-header">
        <IconBug size={16} />
        <span className="rdp-title" style={{ flex: 1 }}>
          Developer Logs
        </span>
        <button type="button" className="rdp-iconbtn-bare" onClick={clearLogs} title="Clear" style={{ width: 'auto', padding: '0 8px' }}>
          Clear
        </button>
        <button type="button" className="rdp-iconbtn-bare" onClick={onClose} aria-label="Close">
          <IconX size={16} />
        </button>
      </div>

      <div style={{ padding: '8px 12px 0', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {LEVELS.map((lvl) => (
          <button
            key={lvl}
            type="button"
            className={cx('rdp-btn', 'rdp-btn-sm')}
            style={filter === lvl ? { borderColor: 'var(--rdp-accent)', color: 'var(--rdp-accent)' } : undefined}
            onClick={() => setFilter(lvl)}
          >
            {lvl}
          </button>
        ))}
      </div>

      <div className="rdp-body rdp-mono" style={{ fontSize: 12 }}>
        {shown.length === 0 ? (
          <div style={{ color: 'var(--rdp-text-faint)' }}>No log entries captured yet.</div>
        ) : (
          shown
            .slice()
            .reverse()
            .map((entry) => (
              <div key={entry.id} style={{ padding: '3px 0', borderBottom: '1px solid var(--rdp-border)' }}>
                <span style={{ color: LEVEL_COLOR[entry.level], fontWeight: 700, marginRight: 6 }}>
                  {entry.level === 'network' ? 'net' : entry.level}
                </span>
                <span style={{ wordBreak: 'break-word' }}>{entry.message}</span>
                {entry.meta && (
                  <span style={{ color: 'var(--rdp-text-faint)', marginLeft: 6 }}>{entry.meta}</span>
                )}
              </div>
            ))
        )}
      </div>
    </div>
  );
}

function useBadge() {
  const logs = useSyncExternalStore(subscribeLogs, getLogs, getServerLogs);
  const errors = logs.filter((l) => l.level === 'error').length;
  if (logs.length === 0) return null;
  return errors > 0
    ? { label: String(errors), tone: 'error' as const }
    : { label: String(logs.length), tone: 'neutral' as const };
}

export const devLogsTool: ToolDefinition = {
  id: 'logs',
  title: 'Developer Logs',
  subtitle: 'Client & network activity',
  color: 'info',
  icon: <IconBug size={19} />,
  Panel: DevLogsPanel,
  useBadge,
  init: installCapture,
};

export function registerDevLogs() {
  registerTool(devLogsTool);
}

export { errorCount };
