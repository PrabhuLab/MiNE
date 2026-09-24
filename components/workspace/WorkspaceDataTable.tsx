import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';

interface WorkspaceDataTableProps {
  active: boolean;
  dataTab: 'nodes' | 'edges';
  tableData: any[];
  tableDataEdges: any[];
  edgeMetrics: any[];
  handleSort: (key: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  handleElementDoubleClick: (id: string, type: 'node' | 'edge', endpoints?: { source: string; target: string }) => void;
}

const HIDDEN_COLUMNS = new Set(['net', 'mod', 'comm', 'x', 'y', 'partitionIndex']);
const preferredNodeColumns = ['id', 'label', 'name', 'degree', 'type', 'partition', 'community'];
const preferredEdgeColumns = ['source', 'target', 'weight_raw', 'weight_secondary'];
const labelOf = (key: string) => key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (letter) => letter.toUpperCase());
const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? (Math.abs(value) >= 1000 ? value.toLocaleString() : Number(value.toPrecision(7)).toString()) : String(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

function orderedColumns(rows: any[], preferred: string[]): string[] {
  const keys = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => { if (!HIDDEN_COLUMNS.has(key)) keys.add(key); });
    Object.keys(row.net || {}).forEach((key) => { if (key !== 'id') keys.add(key); });
    Object.keys(row.mod || {}).forEach((key) => { if (key !== 'id') keys.add(key); });
  });
  return [...preferred.filter((key) => keys.delete(key)), ...Array.from(keys).sort()];
}

const PAGE_SIZE = 100;

export const WorkspaceDataTable = ({ active, dataTab, tableData, tableDataEdges, edgeMetrics, handleSort, sortConfig, handleElementDoubleClick }: WorkspaceDataTableProps) => {
  const { isDarkMode, directed, selectedElement, setSelectedElement } = useStore();
  const [page, setPage] = useState(0);
  const edgeMetricMap = useMemo(() => new Map(edgeMetrics.map((metric) => [String(metric.key), metric])), [edgeMetrics]);
  const edgeRows = useMemo(() => dataTab === 'edges' ? tableDataEdges.map((edge) => {
    const direct = `${edge.source}${directed ? '->' : '--'}${edge.target}`;
    const reverse = `${edge.target}--${edge.source}`;
    return { ...edge, ...(edgeMetricMap.get(String(edge.key)) || edgeMetricMap.get(direct) || edgeMetricMap.get(reverse) || {}) };
  }) : [], [dataTab, directed, edgeMetricMap, tableDataEdges]);
  const rows = dataTab === 'nodes' ? tableData : edgeRows;
  const columns = useMemo(() => orderedColumns(rows, dataTab === 'nodes' ? preferredNodeColumns : preferredEdgeColumns), [dataTab, rows]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  useEffect(() => {
    if (!active || !selectedElement) return;
    const selectedIndex = rows.findIndex((row) => dataTab === 'nodes'
      ? String(row.id) === selectedElement
      : `${row.source}-${row.target}` === selectedElement || `${row.target}-${row.source}` === selectedElement);
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / PAGE_SIZE));
  }, [active, dataTab, rows, selectedElement]);

  useEffect(() => {
    if (!active || !selectedElement) return;
    document.getElementById(`row-${selectedElement}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [active, currentPage, selectedElement]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="mine-scroll-container flex-1 overflow-auto">
      <table className={`min-w-max w-full text-left text-xs border-collapse ${isDarkMode ? 'text-[#ddd]' : 'text-[#333]'}`}>
        <thead className={`sticky top-0 shadow-sm z-20 ${isDarkMode ? 'bg-[#222] border-b border-[#444]' : 'bg-[#f0f0f0] border-b border-[#ccc]'}`}>
          <tr>
            {columns.map((column, index) => (
              <th key={column} onClick={() => handleSort(column)} className={`min-w-32 max-w-72 p-3 font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap ${index === 0 ? `sticky left-0 z-30 ${isDarkMode ? 'bg-[#222]' : 'bg-[#f0f0f0]'}` : ''}`}>
                {labelOf(column)} {sortConfig?.key === column && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => {
            const id = dataTab === 'nodes' ? String(row.id) : `${row.source}-${row.target}`;
            const selected = selectedElement === id || (dataTab === 'edges' && selectedElement === `${row.target}-${row.source}`);
            return (
              <tr id={`row-${id}`} key={`${id}-${index}`} className={`border-t cursor-pointer ${isDarkMode ? 'border-[#333]' : 'border-[#ccc]'} ${selected ? 'bg-[#b4ff39]/30 font-semibold' : isDarkMode ? 'hover:bg-[#333]' : 'hover:bg-[#f9f9f9]'}`} onClick={() => setSelectedElement(id)} onDoubleClick={() => handleElementDoubleClick(id, dataTab === 'nodes' ? 'node' : 'edge', dataTab === 'edges' ? { source: row.source, target: row.target } : undefined)}>
                {columns.map((column, columnIndex) => {
                  const value = row[column] ?? row.net?.[column] ?? row.mod?.[column];
                  return <td key={column} className={`min-w-32 max-w-72 p-2 font-mono whitespace-nowrap overflow-hidden text-ellipsis ${columnIndex === 0 ? `sticky left-0 z-10 ${isDarkMode ? 'bg-[#191919]' : 'bg-white'}` : ''}`} title={displayValue(value)}>{displayValue(value)}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      {pageCount > 1 && <div className="flex items-center justify-between border-t px-3 py-1 text-[10px] font-mono">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="disabled:opacity-40">Previous</button>
        <span>{currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, rows.length)} of {rows.length}</span>
        <button type="button" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} className="disabled:opacity-40">Next</button>
      </div>}
    </div>
  );
};
