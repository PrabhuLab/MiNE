import type Graph from 'graphology';
import random from 'graphology-layout/random';
import circular from 'graphology-layout/circular';
import circlepack from 'graphology-layout/circlepack';
import forceAtlas2, { type ForceAtlas2Settings } from 'graphology-layout-forceatlas2';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import NoverlapLayout from 'graphology-layout-noverlap/worker';
import type { LayoutAlgorithm, LayoutRequest, LayoutResult } from './types';

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

function positions(graph: Graph): LayoutResult {
  return { positions: Object.fromEntries(graph.mapNodes((node, attributes) => [node, { x: Number(attributes.x), y: Number(attributes.y) }])) };
}

function ensurePositions(graph: Graph): void {
  const valid = graph.everyNode((_node, attributes) => Number.isFinite(Number(attributes.x)) && Number.isFinite(Number(attributes.y)));
  const allZero = valid && graph.everyNode((_node, attributes) => Number(attributes.x) === 0 && Number(attributes.y) === 0);
  if (!valid || allZero) random.assign(graph, { scale: Math.max(10, Math.sqrt(graph.order) * 10) });
}

class SupervisorController implements LayoutController {
  private timer: ReturnType<typeof setInterval> | null = null;
  private stoppedNotified = false;

  constructor(private supervisor: { start(): void; stop(): void; kill(): void; isRunning(): boolean }, private onTick?: () => void, private onStop?: () => void) {}

  start(): void {
    this.stoppedNotified = false;
    this.supervisor.start();
    this.timer = setInterval(() => {
      this.onTick?.();
      if (!this.supervisor.isRunning()) this.finish();
    }, 100);
  }

  stop(): void {
    this.supervisor.stop();
    this.onTick?.();
    this.finish();
  }

  kill(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.supervisor.kill();
    this.notifyStopped();
  }

  isRunning(): boolean {
    return this.supervisor.isRunning();
  }

  private finish(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.notifyStopped();
  }

  private notifyStopped(): void {
    if (this.stoppedNotified) return;
    this.stoppedNotified = true;
    this.onStop?.();
  }
}

class GraphologyLayoutEngine implements LayoutEngine<any, any> {
  async compute(request: LayoutRequest<any, any>): Promise<LayoutResult> {
    const graph = request.graph;
    if (!graph) throw new Error('Graphology layout engine requires the active graph instance.');
    ensurePositions(graph);
    const algorithm = request.algorithm;
    if (algorithm === 'random') random.assign(graph, request.settings.random);
    else if (algorithm === 'circular') circular.assign(graph, request.settings.circular);
    else if (algorithm === 'circlepack') circlepack.assign(graph, request.settings.circlepack);
    else throw new Error(`${algorithm} is continuous and must be started with a controller.`);
    request.onTick?.();
    request.onStop?.();
    return positions(graph);
  }

  createController(request: LayoutRequest<any, any>): LayoutController {
    const graph = request.graph;
    if (!graph) throw new Error('Graphology layout engine requires the active graph instance.');
    ensurePositions(graph);
    let supervisor: FA2Layout | NoverlapLayout;
    if (request.algorithm === 'forceatlas2') {
      supervisor = new FA2Layout(graph, { settings: request.settings.forceatlas2, getEdgeWeight: 'weight' });
    } else if (request.algorithm === 'noverlap') {
      const { maxIterations: _maxIterations, ...settings } = request.settings.noverlap || {};
      supervisor = new NoverlapLayout(graph, { settings });
    } else {
      throw new Error(`${request.algorithm} is a static layout.`);
    }
    return new SupervisorController(supervisor, request.onTick, request.onStop);
  }

  inferForceAtlas2(graph: Graph): ForceAtlas2Settings {
    return forceAtlas2.inferSettings(graph);
  }
}

export const graphologyLayoutEngine = new GraphologyLayoutEngine();

export function isContinuousLayout(algorithm: LayoutAlgorithm): boolean {
  return algorithm === 'forceatlas2' || algorithm === 'noverlap';
}
