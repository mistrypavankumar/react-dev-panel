import { useSyncExternalStore } from 'react';
import { onLCP, onCLS, onINP, onFCP, onTTFB, type Metric } from 'web-vitals';

import type { ToolDefinition, ToolPanelProps } from '../../core/types';
import { registerTool } from '../../core/registry';
import { IconGauge, IconX } from '../../core/icons';

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
    [m.name]: {
      name: m.name,
      value: m.value,
      rating: m.rating as Rating,
      unit: m.name === 'CLS' ? '' : 'ms',
    },
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
function snapshot(): Record<string, MetricSnapshot> {
  return metrics;
}
const EMPTY: Record<string, MetricSnapshot> = {};
function serverSnapshot() {
  return EMPTY;
}

const RATING_COLOR: Record<Rating, string> = {
  good: 'var(--rdp-success)',
  'needs-improvement': 'var(--rdp-warning)',
  poor: 'var(--rdp-error)',
};

function PagePerformancePanel({ onClose }: ToolPanelProps) {
  const data = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const order = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

  return (
    <div className="rdp-surface rdp-panel" style={{ bottom: 88, right: 20 }}>
      <div className="rdp-header">
        <IconGauge size={16} />
        <span className="rdp-title" style={{ flex: 1 }}>
          Page Performance
        </span>
        <button type="button" className="rdp-iconbtn-bare" onClick={onClose} aria-label="Close">
          <IconX size={16} />
        </button>
      </div>
      <div className="rdp-body">
        {order.every((k) => !data[k]) && (
          <div style={{ color: 'var(--rdp-text-faint)' }}>
            Collecting Web Vitals… interact with the page (INP needs an interaction).
          </div>
        )}
        {order.map((key) => {
          const m = data[key];
          if (!m) return null;
          return (
            <div key={key} style={{ padding: '8px 0', borderBottom: '1px solid var(--rdp-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="rdp-chip" style={{ background: RATING_COLOR[m.rating], color: '#06210f' }}>
                  {m.name}
                </span>
                <span className="rdp-mono" style={{ fontWeight: 700 }}>
                  {m.unit === 'ms' ? Math.round(m.value) : m.value.toFixed(3)}
                  {m.unit}
                </span>
                <span style={{ color: RATING_COLOR[m.rating], fontSize: 11, marginLeft: 'auto' }}>
                  {m.rating}
                </span>
              </div>
              <div className="rdp-sub" style={{ marginTop: 2 }}>
                {HINTS[key]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const pagePerformanceTool: ToolDefinition = {
  id: 'perf',
  title: 'Page Performance',
  subtitle: 'Web Vitals & fix suggestions',
  color: 'warning',
  icon: <IconGauge size={19} />,
  Panel: PagePerformancePanel,
  init: installPerf,
};

export function registerPagePerformance() {
  registerTool(pagePerformanceTool);
}
