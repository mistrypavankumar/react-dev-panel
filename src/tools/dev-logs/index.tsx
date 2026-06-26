'use client';

import type { DevLogEntry, DevLogLevel, DevLogSource } from './store';
import type { ToolDefinition, ToolPanelProps } from '../../core/types';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import { alpha, useTheme } from '@mui/material/styles';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useMemo, useState, useCallback, useSyncExternalStore } from 'react';
import { LuX, LuBug, LuCopy, LuCheck, LuSearch, LuTrash2, LuChevronDown } from 'react-icons/lu';

import { registerTool } from '../../core/registry';
import { useDevPanelConfig } from '../../core/config';
import {
  getDevLogs,
  errorCount,
  clearDevLogs,
  subscribeDevLogs,
  installDevLogCapture,
  getDevLogsServerSnapshot,
} from './store';

type SourceFilter = 'all' | DevLogSource;
type LevelFilter = 'all' | DevLogLevel;

const SOURCE_COLOR: Record<DevLogSource, 'warning' | 'info' | 'success'> = {
  server: 'warning',
  client: 'info',
  network: 'success',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type SectionVariant = { key: string; label: string; value: string };
type SectionTab = { key: string; label: string; value: string; variants?: SectionVariant[] };
type LogSection = { label: string; tabs: SectionTab[] };

function buildSections(entry: DevLogEntry): LogSection[] {
  const sections: LogSection[] = [];
  const requestTabs: SectionTab[] = [];
  if (entry.requestBody) {
    const hasRaw = Boolean(entry.requestBodyRaw && entry.requestBodyRaw !== entry.requestBody);
    requestTabs.push({
      key: 'payload',
      label: 'Payload',
      value: entry.requestBody,
      variants: hasRaw
        ? [
            { key: 'pretty', label: 'Pretty', value: entry.requestBody },
            { key: 'raw', label: 'Raw', value: entry.requestBodyRaw as string },
          ]
        : undefined,
    });
  }
  if (entry.requestHeaders) requestTabs.push({ key: 'headers', label: 'Headers', value: entry.requestHeaders });
  if (requestTabs.length) sections.push({ label: 'Request', tabs: requestTabs });

  const responseTabs: SectionTab[] = [];
  if (entry.responseBody) responseTabs.push({ key: 'body', label: 'Body', value: entry.responseBody });
  if (entry.responseHeaders) responseTabs.push({ key: 'headers', label: 'Headers', value: entry.responseHeaders });
  if (responseTabs.length) sections.push({ label: 'Response', tabs: responseTabs });

  if (entry.stack) sections.push({ label: 'Stack trace', tabs: [{ key: 'stack', label: 'Stack trace', value: entry.stack }] });
  if (!sections.length && entry.detail) sections.push({ label: 'Detail', tabs: [{ key: 'detail', label: 'Detail', value: entry.detail }] });
  return sections;
}

const TOGGLE_SX = {
  '& .MuiToggleButton-root': {
    py: 0,
    px: 0.75,
    height: 20,
    fontSize: '0.6rem',
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    border: '1px solid',
    borderColor: 'divider',
  },
} as const;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(value).then(
        () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        },
        () => undefined,
      );
    },
    [value],
  );
  return (
    <Tooltip title={copied ? 'Copied' : 'Copy'} placement="top">
      <IconButton size="small" onClick={handleCopy} sx={{ color: copied ? 'success.main' : undefined }}>
        {copied ? <LuCheck size={13} /> : <LuCopy size={13} />}
      </IconButton>
    </Tooltip>
  );
}

function SectionBlock({ section }: { section: LogSection }) {
  const theme = useTheme();
  const [activeTabKey, setActiveTabKey] = useState(section.tabs[0]?.key);
  const [variantByTab, setVariantByTab] = useState<Record<string, string>>({});
  const activeTab = section.tabs.find((t) => t.key === activeTabKey) ?? section.tabs[0];
  const activeVariantKey = variantByTab[activeTab.key] ?? activeTab.variants?.[0]?.key;
  const activeVariant = activeTab.variants?.find((v) => v.key === activeVariantKey);
  const displayValue = activeVariant?.value ?? activeTab.value;
  const showTabs = section.tabs.length > 1;
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, py: 0.25, gap: 0.5, flexWrap: 'wrap' }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {section.label}
          </Typography>
          {showTabs && (
            <ToggleButtonGroup size="small" exclusive value={activeTab.key} onChange={(_, next) => next && setActiveTabKey(next)} sx={TOGGLE_SX}>
              {section.tabs.map((t) => (
                <ToggleButton key={t.key} value={t.key}>
                  {t.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {activeTab.variants && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={activeVariantKey}
              onChange={(_, next) => next && setVariantByTab((prev) => ({ ...prev, [activeTab.key]: next }))}
              sx={TOGGLE_SX}
            >
              {activeTab.variants.map((v) => (
                <ToggleButton key={v.key} value={v.key}>
                  {v.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
          <CopyButton value={displayValue} />
        </Stack>
      </Stack>
      <Box
        component="pre"
        sx={{
          m: 0,
          px: 1,
          pb: 1,
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          color: 'text.secondary',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowX: 'auto',
          maxHeight: 280,
          bgcolor: alpha(theme.palette.grey[500], 0.06),
        }}
      >
        {displayValue}
      </Box>
    </Box>
  );
}

function LogRow({ entry, showPath }: { entry: DevLogEntry; showPath: boolean }) {
  const [open, setOpen] = useState(false);
  const sections = useMemo(() => buildSections(entry), [entry]);
  const expandable = sections.length > 0;
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Box
        onClick={expandable ? () => setOpen((v) => !v) : undefined}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          px: 1,
          py: 0.75,
          cursor: expandable ? 'pointer' : 'default',
          '&:hover': expandable ? { bgcolor: 'action.hover' } : undefined,
        }}
      >
        <Chip
          label={entry.source}
          size="small"
          color={SOURCE_COLOR[entry.source]}
          variant="soft"
          sx={{ height: 18, fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 700, mt: 0.25, flexShrink: 0 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: entry.level === 'error' ? 'error.main' : 'text.primary',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {entry.message}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>
              {formatTime(entry.timestamp)}
            </Typography>
            {showPath && entry.path && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {entry.path}
              </Typography>
            )}
          </Stack>
        </Box>
        {expandable && (
          <Box sx={{ flexShrink: 0, color: 'text.disabled', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', mt: 0.25 }}>
            <LuChevronDown size={14} />
          </Box>
        )}
      </Box>
      {expandable && (
        <Collapse in={open} unmountOnExit>
          <Stack spacing={0.5} sx={{ borderTop: '1px solid', borderColor: 'divider', py: 0.5 }}>
            {sections.map((section) => (
              <SectionBlock key={section.label} section={section} />
            ))}
          </Stack>
        </Collapse>
      )}
    </Box>
  );
}

function DevLogsPanel({ onClose }: ToolPanelProps) {
  const logs = useSyncExternalStore(subscribeDevLogs, getDevLogs, getDevLogsServerSnapshot);
  const pathname = useDevPanelConfig().getRoute();

  const [source, setSource] = useState<SourceFilter>('all');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [thisPageOnly, setThisPageOnly] = useState(true);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((entry) => {
      if (source !== 'all' && entry.source !== source) return false;
      if (level !== 'all' && entry.level !== level) return false;
      if (thisPageOnly && entry.path && entry.path !== pathname) return false;
      if (term) {
        const haystack = `${entry.message} ${entry.detail ?? ''} ${entry.stack ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [logs, source, level, thisPageOnly, search, pathname]);

  return (
    <Box
      data-rdp-ignore=""
      sx={{
        position: 'fixed',
        bottom: 96,
        right: 24,
        zIndex: (t) => t.zIndex.modal + 1,
        width: 'min(460px, calc(100vw - 32px))',
        maxHeight: 'min(70vh, 640px)',
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
          <LuBug size={16} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Developer Logs
          </Typography>
          <Chip label={`${filtered.length}/${logs.length}`} size="small" variant="soft" sx={{ height: 18, fontSize: '0.65rem' }} />
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={clearDevLogs} disabled={logs.length === 0}>
            <LuTrash2 size={15} />
          </IconButton>
          <IconButton size="small" onClick={onClose}>
            <LuX size={16} />
          </IconButton>
        </Stack>
      </Stack>

      <Stack spacing={1} sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup size="small" exclusive value={source} onChange={(_, v) => v && setSource(v)}>
            {(['all', 'client', 'server', 'network'] as const).map((v) => (
              <ToggleButton key={v} value={v} sx={{ px: 1, py: 0.25, fontSize: '0.7rem', textTransform: 'capitalize' }}>
                {v}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <ToggleButton size="small" value="thisPage" selected={thisPageOnly} onChange={() => setThisPageOnly((v) => !v)} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>
            This page
          </ToggleButton>
        </Stack>
        <ToggleButtonGroup size="small" exclusive value={level} onChange={(_, v) => v && setLevel(v)}>
          {(['all', 'error', 'warn', 'info'] as const).map((v) => (
            <ToggleButton key={v} value={v} sx={{ px: 1, py: 0.25, fontSize: '0.7rem', textTransform: 'capitalize' }}>
              {v}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          size="small"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LuSearch size={15} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {filtered.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 4 }}>
            {logs.length === 0 ? 'No activity captured this session.' : 'No logs match the current filters.'}
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {filtered.map((entry) => (
              <LogRow key={entry.id} entry={entry} showPath={!thisPageOnly} />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function useBadge() {
  const logs = useSyncExternalStore(subscribeDevLogs, getDevLogs, getDevLogsServerSnapshot);
  if (logs.length === 0) return null;
  const errors = errorCount();
  return errors > 0 ? { label: String(errors), tone: 'error' as const } : { label: String(logs.length), tone: 'neutral' as const };
}

export const devLogsTool: ToolDefinition = {
  id: 'logs',
  title: 'Developer Logs',
  subtitle: 'Client, server & network activity',
  color: 'info',
  icon: <LuBug size={19} />,
  Panel: DevLogsPanel,
  useBadge,
  init: installDevLogCapture,
};

export function registerDevLogs() {
  registerTool(devLogsTool);
}
