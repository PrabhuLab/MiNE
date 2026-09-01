'use client';

import React from 'react';
import { RawNode, RawEdge } from '@/store/useStore';

export interface NodeCentralityMetrics {
  degreeCentrality?: string;
  inDegreeCentrality?: string;
  outDegreeCentrality?: string;
  betweenness?: string;
  closeness?: string;
  clustering?: string;
  pagerank?: string;
  eigenvector?: string;
  [key: string]: any;
}

interface NodeDetailsSidebarProps {
  clickedNode: RawNode | null;
  clickedEdge: RawEdge | null;
  clickedDegree: number;
  netMap: Map<string, NodeCentralityMetrics | any>;
  communityMap: Record<string, string>;
  customColorMap: Record<string, string>;
  isDarkMode?: boolean;
  onClose?: () => void;
}

export default function NodeDetailsSidebar({
  clickedNode,
  clickedEdge,
  clickedDegree,
  netMap,
  communityMap,
  customColorMap,
  isDarkMode,
  onClose,
}: NodeDetailsSidebarProps) {
  if (!clickedNode && !clickedEdge) return null;

  if (clickedNode) {
    const net = netMap.get(clickedNode.id);
    return (
      <div className="absolute bottom-6 right-6 flex space-x-2 z-10">
        <div
          className={`p-3 w-56 shadow-none border transition-colors ${
            isDarkMode ? 'bg-[#141414] border-[#333] text-[#E4E3E0]' : 'bg-white border-[#141414] text-[#141414]'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <div
              className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${
                isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'
              }`}
            >
              Node Details
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-xs opacity-50 hover:opacity-100 font-mono px-1"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="opacity-50 uppercase font-bold">NODE</span>
              <span
                className="font-mono font-bold truncate max-w-[120px] text-right"
                title={clickedNode.label || clickedNode.name || clickedNode.id}
              >
                {clickedNode.label || clickedNode.name || clickedNode.id}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="opacity-50 uppercase font-bold">DEGREE (Abs)</span>
              <span className="font-mono font-bold">{clickedDegree}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="opacity-50 uppercase font-bold">COMMUNITY</span>
              <span className="font-mono font-bold">
                <div
                  className="w-3 h-3 inline-block align-middle ml-1"
                  style={{
                    backgroundColor:
                      customColorMap[communityMap[clickedNode.id]] ||
                      (isDarkMode ? '#bbbbbb' : '#141414'),
                  }}
                ></div>
              </span>
            </div>

            {Object.keys(clickedNode)
              .filter(
                (k) =>
                  ![
                    'id',
                    'name',
                    'label',
                    'community',
                    'x',
                    'y',
                    'vx',
                    'vy',
                    'index',
                    'fx',
                    'fy',
                    'currentRadius',
                    '_defaultStrokeWidth',
                    'type',
                  ].includes(k)
              )
              .map((key) => (
                <div key={key} className="flex justify-between text-[10px]">
                  <span className="opacity-50 uppercase font-bold truncate max-w-[80px]" title={key}>
                    {key}
                  </span>
                  <span
                    className="font-mono font-bold truncate max-w-[100px] text-right"
                    title={String((clickedNode as any)[key])}
                  >
                    {String((clickedNode as any)[key])}
                  </span>
                </div>
              ))}
            {net?.degreeCentrality !== undefined && (
              <div className="flex justify-between text-[10px]">
                <span className="opacity-50 uppercase font-bold" title="Degree Centrality">
                  DEGREE CENT
                </span>
                <span className="font-mono font-bold">
                  {parseFloat(net.degreeCentrality).toFixed(4)}
                </span>
              </div>
            )}
            {net?.inDegreeCentrality !== undefined && (
              <div className="flex justify-between text-[10px]">
                <span className="opacity-50 uppercase font-bold" title="In-Degree Centrality">
                  IN-DEG CENT
                </span>
                <span className="font-mono font-bold">
                  {parseFloat(net.inDegreeCentrality).toFixed(4)}
                </span>
              </div>
            )}
            {net?.outDegreeCentrality !== undefined && (
              <div className="flex justify-between text-[10px]">
                <span className="opacity-50 uppercase font-bold" title="Out-Degree Centrality">
                  OUT-DEG CENT
                </span>
                <span className="font-mono font-bold">
                  {parseFloat(net.outDegreeCentrality).toFixed(4)}
                </span>
              </div>
            )}
            {net?.betweenness !== undefined && (
              <div className="flex justify-between text-[10px]">
                <span className="opacity-50 uppercase font-bold" title="Betweenness Centrality">
                  BETWEENNESS
                </span>
                <span className="font-mono font-bold">
                  {parseFloat(net.betweenness).toFixed(4)}
                </span>
              </div>
            )}
            {net?.closeness !== undefined && (
              <div className="flex justify-between text-[10px]">
                <span className="opacity-50 uppercase font-bold" title="Closeness Centrality">
                  CLOSENESS
                </span>
                <span className="font-mono font-bold">
                  {parseFloat(net.closeness).toFixed(4)}
                </span>
              </div>
            )}
            {net?.clustering !== undefined && (
              <div className="flex justify-between text-[10px]">
                <span className="opacity-50 uppercase font-bold" title="Clustering Coefficient">
                  CLUSTERING
                </span>
                <span className="font-mono font-bold">
                  {parseFloat(net.clustering).toFixed(4)}
                </span>
              </div>
            )}
            {net?.pagerank !== undefined && net?.pagerank !== '0' && (
              <div className="flex justify-between text-[10px]">
                <span className="opacity-50 uppercase font-bold" title="PageRank">
                  PAGERANK
                </span>
                <span className="font-mono font-bold">
                  {parseFloat(net.pagerank).toFixed(4)}
                </span>
              </div>
            )}
            {net?.eigenvector !== undefined && net?.eigenvector !== '0' && (
              <div className="flex justify-between text-[10px]">
                <span className="opacity-50 uppercase font-bold" title="Eigenvector Centrality">
                  EIGENVECTOR
                </span>
                <span className="font-mono font-bold">
                  {parseFloat(net.eigenvector).toFixed(4)}
                </span>
              </div>
            )}
            {Object.entries(net || {})
              .filter(([key]) => !['id', 'degree', 'degreeCentrality', 'inDegreeCentrality', 'outDegreeCentrality', 'betweenness', 'closeness', 'clustering', 'pagerank', 'eigenvector'].includes(key))
              .map(([key, value]) => (
                <div key={`metric-${key}`} className="flex justify-between text-[10px]">
                  <span className="max-w-[90px] truncate font-bold uppercase opacity-50" title={key}>{key}</span>
                  <span className="max-w-[100px] truncate text-right font-mono font-bold" title={String(value)}>{String(value)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  if (clickedEdge) {
    const sourceId =
      typeof clickedEdge.source === 'object'
        ? (clickedEdge.source as any).id
        : clickedEdge.source;
    const targetId =
      typeof clickedEdge.target === 'object'
        ? (clickedEdge.target as any).id
        : clickedEdge.target;

    return (
      <div className="absolute bottom-6 right-6 flex space-x-2 z-10">
        <div
          className={`p-3 w-56 shadow-none border transition-colors ${
            isDarkMode ? 'bg-[#141414] border-[#333] text-[#E4E3E0]' : 'bg-white border-[#141414] text-[#141414]'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <div
              className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${
                isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'
              }`}
            >
              Edge Details
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-xs opacity-50 hover:opacity-100 font-mono px-1"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] items-center">
              <span className="opacity-50 uppercase font-bold">SOURCE</span>
              <span
                className="font-mono font-bold truncate max-w-[120px] text-right"
                title={sourceId}
              >
                {sourceId}
              </span>
            </div>
            <div className="flex justify-between text-[10px] items-center">
              <span className="opacity-50 uppercase font-bold">TARGET</span>
              <span
                className="font-mono font-bold truncate max-w-[120px] text-right"
                title={targetId}
              >
                {targetId}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="opacity-50 uppercase font-bold">RAW WT</span>
              <span className="font-mono font-bold">{clickedEdge.weight_raw ?? '-'}</span>
            </div>
            {clickedEdge.weight_secondary !== undefined && <div className="flex justify-between text-[10px]">
              <span className="opacity-50 uppercase font-bold">SEC WT</span>
              <span className="font-mono font-bold">{clickedEdge.weight_secondary}</span>
            </div>}
            {Object.keys(clickedEdge)
              .filter(
                (k) =>
                  ![
                    'source',
                    'target',
                    'weight',
                    'weight_raw',
                    'weight_secondary',
                    'index',
                    '_defaultStrokeWidth',
                  ].includes(k)
              )
              .map((key) => (
                <div key={key} className="flex justify-between text-[10px]">
                  <span className="opacity-50 uppercase font-bold truncate max-w-[80px]" title={key}>
                    {key}
                  </span>
                  <span
                    className="font-mono font-bold truncate max-w-[100px] text-right"
                    title={String((clickedEdge as any)[key])}
                  >
                    {String((clickedEdge as any)[key])}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
