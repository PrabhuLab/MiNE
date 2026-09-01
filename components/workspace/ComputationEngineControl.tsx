'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { CheckCircle2, Cloud, Info, LoaderCircle, RefreshCw, XCircle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  MINE_IGRAPH_API_URL,
  checkCloudBackend,
  cloudBackendHostname,
  resolveComputeEngine,
  type CloudBackendStatus,
} from '@/services/cloud/config';
import { CLOUD_EDGE_CUTOFF, CLOUD_NODE_CUTOFF, isLargeGraph } from '@/services/engines/policy';
import { effectiveRenderer } from '@/services/engines/policy';

interface Props {
  nodeCount?: number;
  edgeCount?: number;
  compact?: boolean;
}

export function ComputationEngineControl({ nodeCount, edgeCount, compact = false }: Props) {
  const { computeEngine, setComputeEngine, rendererEngine, setRendererEngine, rawNodes, rawEdges, isDarkMode } = useStore();
  const nodes = nodeCount ?? rawNodes.length;
  const edges = edgeCount ?? rawEdges.length;
  const large = isLargeGraph(nodes, edges);
  const resolved = resolveComputeEngine(nodes, edges, computeEngine);
  const resolvedRenderer = effectiveRenderer(rendererEngine, resolved);
  const descriptionId = useId();
  const configuredHostname = useMemo(() => cloudBackendHostname(), []);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CloudBackendStatus>(() => MINE_IGRAPH_API_URL
    ? { state: 'idle', hostname: configuredHostname, message: 'Configured; Cloud Run starts when an analysis is requested.' }
    : { state: 'not-configured', hostname: null, message: 'Set NEXT_PUBLIC_MINE_IGRAPH_API_URL and restart MiNE to enable Cloud.' });
  const [statusRevision, setStatusRevision] = useState(0);

  const retry = useCallback(() => {
    setStatus({ state: 'checking', hostname: configuredHostname });
    setStatusRevision((value) => value + 1);
  }, [configuredHostname]);

  useEffect(() => {
    if (statusRevision === 0) return;
    const controller = new AbortController();
    void checkCloudBackend(MINE_IGRAPH_API_URL, { signal: controller.signal }).then(setStatus).catch((error) => {
      if (error?.name !== 'AbortError') setStatus({ state: 'unavailable', hostname: configuredHostname, message: error instanceof Error ? error.message : String(error) });
    });
    return () => controller.abort();
  }, [configuredHostname, statusRevision]);

  const border = isDarkMode ? 'border-[#444]' : 'border-[#aaa]';
  const selected = isDarkMode ? 'bg-[#E4E3E0] text-[#141414]' : 'bg-[#141414] text-white';
  const pairing = `${resolvedRenderer.toUpperCase()} renderer + ${resolved === 'cloud' ? 'Cloud igraph/Graphology' : 'Browser Graphology'}`;

  return (
    <div
      data-testid="computation-engine-control"
      className={`relative ${compact ? '' : `border p-3 ${border}`}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Computation engine">
          {(['browser', 'cloud'] as const).map((engine) => {
            const active = resolved === engine;
            return (
              <button
                key={engine}
                type="button"
                role="radio"
                aria-checked={active}
                aria-describedby={descriptionId}
                onClick={() => setComputeEngine(engine)}
                className={`rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide border transition-colors ${border} ${active ? selected : 'opacity-60 hover:opacity-100'}`}
              >
                {engine}
              </button>
            );
          })}
        </div>
        <span className="h-4 w-px bg-current opacity-20" aria-hidden="true" />
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Graph renderer">
          {(['d3', 'sigma'] as const).map((renderer) => (
            <button
              key={renderer}
              type="button"
              role="radio"
              aria-checked={resolvedRenderer === renderer}
              aria-describedby={descriptionId}
              onClick={() => setRendererEngine(renderer)}
              className={`rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wide border transition-colors ${border} ${resolvedRenderer === renderer ? selected : 'opacity-60 hover:opacity-100'}`}
            >
              {renderer}
            </button>
          ))}
        </div>
        <button type="button" aria-label="About computation engines" aria-expanded={open} aria-describedby={descriptionId} onClick={() => setOpen(true)} className="p-1 opacity-60 hover:opacity-100">
          <Info size={14} />
        </button>
      </div>
      <span className="sr-only" id={descriptionId}>Computation and rendering are independent. Browser or Cloud selects where analysis runs; D3 or Sigma selects how the graph is drawn. Large graphs prefer Cloud, but Browser remains available.</span>

      {open && (
        <div className={`absolute right-0 top-full z-[80] mt-2 w-80 border p-3 text-left shadow-xl ${isDarkMode ? 'border-[#444] bg-[#181818] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`}>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"><Cloud size={13} /> {pairing}</div>
          <p className="mt-2 text-[9px] font-mono leading-relaxed opacity-75">Computation and rendering are independent. Browser uses Graphology analysis; Cloud uses Python igraph for heavy operations. D3 or Sigma can render either mode from the same Graphology model.</p>
          <p className="mt-2 text-[9px] font-mono leading-relaxed opacity-75">Live Physics always uses MiNE&apos;s shared D3 force simulation and streams positions to the selected renderer.</p>
          <p className="mt-2 text-[9px] font-mono leading-relaxed">Cloud is recommended at or above {CLOUD_NODE_CUTOFF.toLocaleString()} raw nodes or {CLOUD_EDGE_CUTOFF.toLocaleString()} raw edges. Browser remains available and is used when a supported Cloud calculation fails. Filtering never changes the large-graph classification.</p>
          {large && <p className="mt-2 text-[9px] font-mono font-bold text-amber-500">Automatic initial Louvain is skipped for this large graph. You can run it manually in Cloud or Browser; Browser may be slower.</p>}
          <div className={`mt-3 flex items-start gap-2 border-t pt-2 text-[9px] font-mono ${border}`}>
            {status.state === 'checking' && <LoaderCircle size={12} className="shrink-0 animate-spin" />}
            {status.state === 'idle' && <Cloud size={12} className="shrink-0 opacity-60" />}
            {status.state === 'available' && <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />}
            {(status.state === 'unavailable' || status.state === 'not-configured') && <XCircle size={12} className="shrink-0 text-red-500" />}
            <span className="min-w-0 flex-1 break-words">Cloud backend: {status.state === 'available' ? `${status.hostname || 'available'}${status.version ? ` · v${status.version}` : ''}` : status.message || status.state}</span>
            {(status.state === 'idle' || status.state === 'unavailable') && <button type="button" onClick={retry} title="Check Cloud connection"><RefreshCw size={12} /></button>}
          </div>
        </div>
      )}
    </div>
  );
}
