'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { useSyncExternalStore } from 'react';
import { LuX, LuGauge } from 'react-icons/lu';
import { onLCP, onCLS, onINP, onFCP, onTTFB, type Metric } from 'web-vitals';

import type { ToolDefinition, ToolPanelProps } from '../../core/types';
import { registerTool } from '../../core/registry';

type Rating = 'good' | 'needs-improvement' | 'poor';
interface MetricSnapshot {
  name: string;
  value: number;
  rating: Rating;
  unit: 'ms' | '';
}

const HINTS: Record<string, string> = {
  LCP: 'Largest Contentful Paint — optimize hero image/font, reduce server time.',
  CLS: 'Cumulative Layout Shift — set sizes on images/embeds, reserve space.',
  INP: 'Interaction to Next Paint — break up long tasks, defer work.',
  FCP: 'First Contentful Paint — reduce render-blocking CSS/JS.',
  TTFB: 'Time to First Byte — server/edge latency, caching.',
};

let metrics: Record<string, MetricSnapshot> = {};
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function record(m: Metric) {
  metrics = {
    ...metrics,
    [m.name]: { name: m.name, value: m.value, rating: m.rating as Rating, unit: m.name === 'CLS' ? '' : 'ms' },
  };
  emit();
}
let installed = false;
function installPerf(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  onLCP(record);
  onCLS(record);
  onINP(record);
  onFCP(record);
  onTTFB(record);
}
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function snapshot() {
  return metrics;
}
const EMPTY: Record<string, MetricSnapshot> = {};
function serverSnapshot() {
  return EMPTY;
}

const RATING_COLOR: Record<Rating, 'success' | 'warning' | 'error'> = {
  good: 'success',
  'needs-improvement': 'warning',
  poor: 'error',
};

function PagePerformancePanel({ onClose }: ToolPanelProps) {
  const data = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const order = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  return (
    <Box
      data-rdp-ignore=""
      sx={{
        position: 'fixed',
        bottom: 96,
        right: 24,
        zIndex: (t) => t.zIndex.modal + 1,
        width: 'min(440px, calc(100vw - 32px))',
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
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LuGauge size={16} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Page Performance
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose}>
          <LuX size={16} />
        </IconButton>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        {order.every((k) => !data[k]) && (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Collecting Web Vitals… interact with the page (INP needs an interaction).
          </Typography>
        )}
        {order.map((key) => {
          const m = data[key];
          if (!m) return null;
          return (
            <Box key={key} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip
                  label={m.name}
                  size="small"
                  color={RATING_COLOR[m.rating]}
                  variant="soft"
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                />
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  {m.unit === 'ms' ? Math.round(m.value) : m.value.toFixed(3)}
                  {m.unit}
                </Typography>
                <Typography variant="caption" sx={{ color: `${RATING_COLOR[m.rating]}.main`, ml: 'auto' }}>
                  {m.rating}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                {HINTS[key]}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export const pagePerformanceTool: ToolDefinition = {
  id: 'perf',
  title: 'Page Performance',
  subtitle: 'Web Vitals & fix suggestions',
  color: 'warning',
  icon: <LuGauge size={19} />,
  Panel: PagePerformancePanel,
  init: installPerf,
};

export function registerPagePerformance() {
  registerTool(pagePerformanceTool);
}
