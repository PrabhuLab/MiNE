export interface LayoutRequest<Node = unknown, Edge = unknown> {
  nodes: Node[];
  edges: Edge[];
  width: number;
  height: number;
  forceStrength: number;
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
}
