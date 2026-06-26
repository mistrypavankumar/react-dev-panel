import type { ToolDefinition } from '../../core/types';
import { IconGraph } from '../../core/icons';
import { registerTool } from '../../core/registry';
import { ComponentGraphPanel } from './Panel';
import { ComponentGraphOverlay } from './Overlay';

export const componentGraphTool: ToolDefinition = {
  id: 'graph',
  title: 'Component Graph Inspector',
  subtitle: 'Inspect component tree & open source files',
  color: 'primary',
  icon: <IconGraph size={19} />,
  Panel: ComponentGraphPanel,
  Overlay: ComponentGraphOverlay,
};

export function registerComponentGraph() {
  registerTool(componentGraphTool);
}
