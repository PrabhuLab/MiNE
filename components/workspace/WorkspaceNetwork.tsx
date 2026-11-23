'use client';

import { useEffect, useState } from 'react';
import Workspace from '@/components/Workspace';
import { CLOUD_ANALYSIS_TIMEOUT_MS, MINE_IGRAPH_API_URL } from '@/services/cloud/config';
import { useStore, type RawEdge, type RawNode } from '@/store/useStore';

export function WorkspaceNetwork() {
  const [view, setView] = useState<'loading' | 'workspace' | 'comparison' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.hash.slice(1));
    if (!query.has('randomNodes')) {
      const start = window.setTimeout(() => setView('workspace'), 0);
      return () => window.clearTimeout(start);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CLOUD_ANALYSIS_TIMEOUT_MS);
    const previousTitle = document.title;
    let disposed = false;
    async function loadComparison() {
      if (!MINE_IGRAPH_API_URL) {
        throw new Error('Set NEXT_PUBLIC_MINE_IGRAPH_API_URL to enable igraph random comparisons.');
      }
      const nodeCount = Number(query.get('randomNodes'));
      const edgeCount = Number(query.get('randomEdges'));
      const secondaryCount = query.has('secondary') ? Number(query.get('secondary')) : null;
      const directed = query.get('directed') === '1';
      const response = await fetch(`${MINE_IGRAPH_API_URL}/v1/random-network`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeCount, edgeCount, secondaryCount, directed }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail?.message || `The igraph API returned HTTP ${response.status}.`);
      }
      if (disposed) return;
      const { types, edges } = payload as { types: boolean[] | null; edges: [number, number][] };
      const nodes: RawNode[] = Array.from({ length: nodeCount }, (_, index) => ({
        id: String(index),
        name: String(index + 1),
        ...(types ? { partition: Number(types[index]) } : {}),
      }));
      const rawEdges: RawEdge[] = edges.map(([source, target]) => ({
        source: String(source),
        target: String(target),
        weight_raw: 1,
      }));
      const sourceName = query.get('source');
      const projectName = sourceName ? `Random comparison of ${sourceName}` : 'Random comparison';
      const workspace = useStore.getState();
      workspace.setRawData(nodes, rawEdges, directed, secondaryCount !== null);
      workspace.setProjectName(projectName);
      document.title = `${projectName} | MiNE`;
      setView('comparison');
    }

    // Let Strict Mode discard its first effect before sending the request.
    const start = window.setTimeout(() => {
      void loadComparison().catch((cause: unknown) => {
        if (disposed) return;
        setError(controller.signal.aborted ? 'Network generation timed out.' : cause instanceof Error ? cause.message : 'Network generation failed.');
        setView('error');
      }).finally(() => window.clearTimeout(timeout));
    }, 0);
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(start);
      window.clearTimeout(timeout);
      document.title = previousTitle;
    };
  }, []);

  if (view === 'workspace' || view === 'comparison') return <Workspace showIsolates={view === 'comparison'} />;
  return (
    <div className="grid h-full place-content-center gap-2 p-6 text-center text-[#141414]">
      {view === 'loading' ? <p role="status">Loading workspace…</p> : (
        <div role="alert">
          <h1 className="font-semibold">Unable to generate random comparison</h1>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
