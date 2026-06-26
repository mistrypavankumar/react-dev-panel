/**
 * react-dev-panel — a framework-agnostic, self-contained floating dev panel for React.
 *
 *   import { DevPanel } from 'react-dev-panel';
 *   <DevPanel enabled={isInternalUser} getRoute={() => pathname} />
 *
 * Bundled tools register themselves on import (below). Hosts can add their own via
 * `registerTool` before mounting <DevPanel/>, or restrict/order via the `tools` prop.
 */

import { registerDevLogs } from './tools/dev-logs/index';
import { registerPagePerformance } from './tools/page-performance/index';

// Register the bundled tools once, at import time.
registerDevLogs();
registerPagePerformance();

export { DevPanel } from './core/DevPanel';
export { registerTool, getRegisteredTools } from './core/registry';
export { defaultOpenInEditor, useDevPanelConfig } from './core/config';
export { injectBaseStyles } from './core/styles';

export type {
  DevPanelConfig,
  DevPanelTheme,
  ToolDefinition,
  ToolPanelProps,
  EditorType,
  SourceLocation,
  OpenInEditor,
} from './core/types';
