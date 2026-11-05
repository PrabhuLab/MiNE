import type { RawNode, RawEdge } from '@/store/useStore';

export function computeForceDirectedLayoutAsync(
  nodes: RawNode[], edges: RawEdge[], directed: boolean, forceStrength: number, signal: AbortSignal,
): Promise<Map<string, { x: number; y: number }>> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Layout cancelled', 'AbortError')); return; }
    const worker = new Worker(new URL('./d3.worker.ts', import.meta.url));
    const finish = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(new DOMException('Layout cancelled', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data.positions);
    };
    worker.onerror = (event) => { finish(); reject(new Error(event.message || 'Layout worker failed')); };
    try {
      worker.postMessage({ type: 'static', nodes: nodes.map(({ id, x, y }) => ({ id, x, y })), edges: edges.map(({ source, target, weight_raw }) => ({ source, target, weight_raw })), directed, forceStrength });
    } catch (cause) { finish(); reject(cause); }
  });
}
