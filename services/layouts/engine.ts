import type { LayoutRequest, LayoutResult } from './types';

export interface LayoutController {
  start(): void;
  stop(): void;
  kill(): void;
  isRunning(): boolean;
}

export interface LayoutEngine<Node = unknown, Edge = unknown> {
  compute(request: LayoutRequest<Node, Edge>): Promise<LayoutResult>;
  createController?(request: LayoutRequest<Node, Edge>): LayoutController;
}
