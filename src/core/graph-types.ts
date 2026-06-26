/** Pure data types for the component graph — shared by the CLI generator and the React tool. */

export type GraphNodeType = 'component' | 'route';

export interface ComponentGraphNode {
  id: string;
  name: string;
  filePath: string;
  line?: number;
  column?: number;
  type: GraphNodeType;
  exported?: boolean;
  route?: string;
}

export type GraphEdgeType = 'renders' | 'imports' | 'route';

export interface ComponentGraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
}

export interface ComponentGraph {
  /** Absolute repo root — used client-side to build absolute paths for editor protocol URLs. */
  root: string;
  generatedAt: string;
  nodes: ComponentGraphNode[];
  edges: ComponentGraphEdge[];
}
