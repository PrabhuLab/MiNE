import React from 'react';
import { BaseStepProps, ColumnMappingState, ParsedDataState, TopologyType } from '../types';

interface StepDataMappingProps extends BaseStepProps {
  format: string;
  parsedData: ParsedDataState;
  mapping: ColumnMappingState;
  setMapping: React.Dispatch<React.SetStateAction<ColumnMappingState>>;
  previewGraph: { nodes: any[]; edges: any[] };
  isDirected: boolean;
  topology: TopologyType;
  isWeighted: boolean;
  onFinalize: () => void;
}

export const StepDataMapping: React.FC<StepDataMappingProps> = ({
  isDarkMode,
  format,
  parsedData,
  mapping,
  setMapping,
  previewGraph,
  isDirected,
  topology,
  isWeighted,
  onFinalize,
  onBack,
}) => {
  const isFormatMatrix = ['Adjacency Matrix', 'Incidence Matrix', 'Single Weighted Adjacency Matrix', 'Single Adjacency Matrix'].includes(format);
  const isFormatEdgeList = ['Edge List', 'Weighted Edge List', 'Directed Edge List', 'Directed Weighted Edge List', 'Bipartite Edge List', 'Directed Bipartite Edge List'].includes(format);
  const isFormatDualMatrix = format === 'Dual Adjacency Matrix';
  const isFormatAdjList = format === 'Adjacency List';

  const updateMappingField = (key: keyof ColumnMappingState, value: any) => {
    setMapping((prev) => ({ ...prev, [key]: value }));
  };

  const renderDropdown = (label: string, value: string, key: keyof ColumnMappingState, options: any[]) => (
    <div>
      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>{label}</label>
      <select
        value={value}
        onChange={(e) => updateMappingField(key, e.target.value)}
        className={`w-full border px-3 py-2 text-[10px] font-mono outline-none ${
          isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'
        }`}
      >
        <option value="" className={isDarkMode ? 'bg-[#1a1a1a] text-[#E4E3E0]' : 'bg-white text-[#141414]'}>
          -- Ignore / Not Present --
        </option>
        {options.map((o, i) => (
          <option key={i} value={o} className={isDarkMode ? 'bg-[#1a1a1a] text-[#E4E3E0]' : 'bg-white text-[#141414]'}>
            {String(o)}
          </option>
        ))}
      </select>
    </div>
  );

  const renderTablePreview = (data: any[][] | undefined, title: string, applyHighlighting: boolean = false) => {
    if (!data || data.length === 0) return null;
    const dataStartRow = mapping.dataStartRow;
    const dataStartCol = mapping.dataStartCol;

    return (
      <div className="mb-4">
        <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
          {title} Preview (First 5 Rows)
        </div>
        <div className={`overflow-x-auto border ${isDarkMode ? 'border-[#333]' : 'border-[#141414]'}`}>
          <table className="w-full text-left text-xs font-mono whitespace-nowrap">
            <thead>
              <tr className={isDarkMode ? 'bg-[#333] text-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0]'}>
                {data[0].map((h: any, j: number) => {
                  const isDataStartRow = applyHighlighting && typeof dataStartRow === 'number' && 0 === dataStartRow;
                  const isDataStartCol = applyHighlighting && typeof dataStartCol === 'number' && j === dataStartCol;
                  const isDataRegion = applyHighlighting && typeof dataStartRow === 'number' && typeof dataStartCol === 'number' && 0 >= dataStartRow && j >= dataStartCol;

                  let thClass = `px-2 py-1 border-r border-t ${isDarkMode ? 'border-[#E4E3E0]/10' : 'border-[#E4E3E0]/20'}`;

                  if (isDataStartRow && isDataStartCol) {
                    thClass += isDarkMode ? ' bg-[#b4ff39]/40 border-l-2 border-t-2 border-[#b4ff39] text-[#b4ff39]' : ' bg-[#b4ff39]/50 border-l-2 border-t-2 border-[#b4ff39] text-[#141414] font-bold';
                  } else if (isDataStartRow && isDataRegion) {
                    thClass += isDarkMode ? ' bg-[#b4ff39]/20 border-t-2 border-[#b4ff39] text-[#b4ff39]' : ' bg-[#b4ff39]/30 border-t-2 border-[#b4ff39] text-[#141414] font-bold';
                  } else if (isDataStartCol && isDataRegion) {
                    thClass += isDarkMode ? ' bg-[#b4ff39]/20 border-l-2 border-[#b4ff39] text-[#b4ff39]' : ' bg-[#b4ff39]/30 border-l-2 border-[#b4ff39] text-[#141414] font-bold';
                  } else if (isDataRegion) {
                    thClass += isDarkMode ? ' bg-[#b4ff39]/10 text-[#b4ff39]' : ' bg-[#b4ff39]/20 text-[#141414]';
                  }

                  return (
                    <th key={j} className={thClass}>
                      {h || `Col ${j}`}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.slice(1, 6).map((row: any[], i: number) => {
                const actualRowIndex = i + 1;
                return (
                  <tr
                    key={i}
                    className={`border-b hover:bg-opacity-50 ${
                      isDarkMode ? 'border-[#333]/50 bg-[#141414] hover:bg-[#333]' : 'border-[#141414]/20 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {data[0].map((_: any, j: number) => {
                      const isDataStartRow = applyHighlighting && typeof dataStartRow === 'number' && actualRowIndex === dataStartRow;
                      const isDataStartCol = applyHighlighting && typeof dataStartCol === 'number' && j === dataStartCol;
                      const isDataRegion = applyHighlighting && typeof dataStartRow === 'number' && typeof dataStartCol === 'number' && actualRowIndex >= dataStartRow && j >= dataStartCol;

                      let tdClass = `px-2 py-1 border-r ${isDarkMode ? 'border-[#333]/50' : 'border-[#141414]/20'}`;

                      if (isDataStartRow && isDataStartCol) {
                        tdClass += isDarkMode ? ' bg-[#b4ff39]/40 border-l-2 border-t-2 border-[#b4ff39] text-[#b4ff39] font-bold' : ' bg-[#b4ff39]/50 border-l-2 border-t-2 border-[#b4ff39] text-[#141414] font-bold';
                      } else if (isDataStartRow && isDataRegion) {
                        tdClass += isDarkMode ? ' bg-[#b4ff39]/20 border-t-2 border-[#b4ff39] text-[#b4ff39] font-bold' : ' bg-[#b4ff39]/30 border-t-2 border-[#b4ff39] text-[#141414] font-bold';
                      } else if (isDataStartCol && isDataRegion) {
                        tdClass += isDarkMode ? ' bg-[#b4ff39]/20 border-l-2 border-[#b4ff39] text-[#b4ff39] font-bold' : ' bg-[#b4ff39]/30 border-l-2 border-[#b4ff39] text-[#141414] font-bold';
                      } else if (isDataRegion) {
                        tdClass += isDarkMode ? ' bg-[#b4ff39]/10 text-[#b4ff39]' : ' bg-[#b4ff39]/20 text-[#141414]';
                      }

                      return (
                        <td key={j} className={tdClass}>
                          {row[j] !== undefined ? String(row[j]).slice(0, 35) : ''}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const isFinalizeDisabled =
    isFormatMatrix || isFormatDualMatrix
      ? mapping.rowHeadersCol === '' || mapping.colHeadersRow === '' || mapping.dataStartRow === '' || mapping.dataStartCol === ''
      : isFormatAdjList
      ? mapping.dataStartRow === '' || mapping.dataStartCol === ''
      : false;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="font-mono text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5">STEP 05</div>
        <h3 className="text-sm font-bold uppercase tracking-widest">Data Review & Column Mapping</h3>
      </div>
      <div className="ml-14">
        {isFormatEdgeList && parsedData.edges && (
          <div className="space-y-6">
            {renderTablePreview(parsedData.edges, 'Edges Dataset')}
            <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
              {renderDropdown('Source Col', mapping.sourceCol, 'sourceCol', parsedData.edges[0] || [])}
              {renderDropdown('Target Col', mapping.targetCol, 'targetCol', parsedData.edges[0] || [])}
              {renderDropdown('Weight Col', mapping.weightRawCol, 'weightRawCol', parsedData.edges[0] || [])}
              {renderDropdown('Weight (Sec)', mapping.weightSecCol, 'weightSecCol', parsedData.edges[0] || [])}
            </div>
          </div>
        )}

        {parsedData.additionalEdges && (
          <div className="space-y-6">
            {renderTablePreview(parsedData.additionalEdges, 'Additional Edges Attributes')}
            <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
              {renderDropdown('Source Col', mapping.sourceCol, 'sourceCol', parsedData.additionalEdges[0] || [])}
              {renderDropdown('Target Col', mapping.targetCol, 'targetCol', parsedData.additionalEdges[0] || [])}
              {renderDropdown('Weight Col', mapping.weightRawCol, 'weightRawCol', parsedData.additionalEdges[0] || [])}
              {renderDropdown('Weight (Sec)', mapping.weightSecCol, 'weightSecCol', parsedData.additionalEdges[0] || [])}
            </div>
          </div>
        )}

        {parsedData.nodes && (
          <div className="space-y-6">
            {renderTablePreview(parsedData.nodes, 'Nodes Dataset')}
            <div className={`grid grid-cols-2 lg:grid-cols-6 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
              {renderDropdown('Node ID Col', mapping.nodeIdCol, 'nodeIdCol', parsedData.nodes[0] || [])}
              {renderDropdown('Label Col', mapping.nodeLabelCol, 'nodeLabelCol', parsedData.nodes[0] || [])}
              {renderDropdown('Type Col (Domain Data)', mapping.nodeTypeCol, 'nodeTypeCol', parsedData.nodes[0] || [])}
              {renderDropdown('Partition Col', mapping.nodePartitionCol, 'nodePartitionCol', parsedData.nodes[0] || [])}
              {renderDropdown('Community Col', mapping.nodeCommunityCol, 'nodeCommunityCol', parsedData.nodes[0] || [])}
              {renderDropdown('Size/Abundance Col', mapping.nodeAbundCol, 'nodeAbundCol', parsedData.nodes[0] || [])}
            </div>
            <p className="text-[10px] font-mono opacity-60">All unused node columns will be preserved automatically as custom attributes.</p>
          </div>
        )}

        {isFormatDualMatrix && (
          <>
            {renderTablePreview(parsedData.counts, 'Counts Matrix', true)}
            {renderTablePreview(parsedData.percentages, 'Secondary Matrix', true)}
          </>
        )}

        {isFormatMatrix && renderTablePreview(parsedData.matrix, 'Adjacency/Incidence Matrix', true)}

        {isFormatAdjList && parsedData.adjList && (
          <div className="space-y-6">
            {renderTablePreview(parsedData.adjList, 'Adjacency List', true)}
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
              {renderDropdown('Source Col', mapping.adjSourceCol, 'adjSourceCol', parsedData.adjList[0] || [])}
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Data Start Row Index</label>
                <input
                  type="number"
                  value={mapping.dataStartRow}
                  onChange={(e) => updateMappingField('dataStartRow', e.target.value === '' ? '' : parseInt(e.target.value))}
                  min={1}
                  className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`}
                />
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Data Start Col Index</label>
                <input
                  type="number"
                  value={mapping.dataStartCol}
                  onChange={(e) => updateMappingField('dataStartCol', e.target.value === '' ? '' : parseInt(e.target.value))}
                  min={1}
                  className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`}
                />
              </div>
            </div>
          </div>
        )}

        {format === 'Standard JSON' && parsedData.jsonEdges && (
          <div className="space-y-6">
            {renderTablePreview(parsedData.jsonEdges, 'JSON Edges Dataset')}
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
              {renderDropdown('Source Property', mapping.sourceCol, 'sourceCol', parsedData.jsonEdges[0] || [])}
              {renderDropdown('Target Property', mapping.targetCol, 'targetCol', parsedData.jsonEdges[0] || [])}
              {renderDropdown('Weight Property', mapping.weightRawCol, 'weightRawCol', parsedData.jsonEdges[0] || [])}
              {renderDropdown('Weight (Sec) Property', mapping.weightSecCol, 'weightSecCol', parsedData.jsonEdges[0] || [])}
            </div>
          </div>
        )}

        {format === 'Standard JSON' && parsedData.jsonNodes && (
          <div className="space-y-6 mt-6">
            {renderTablePreview(parsedData.jsonNodes, 'JSON Nodes Dataset')}
            <div className={`grid grid-cols-2 lg:grid-cols-6 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
              {renderDropdown('Node ID Property', mapping.nodeIdCol, 'nodeIdCol', parsedData.jsonNodes[0] || [])}
              {renderDropdown('Label Property', mapping.nodeLabelCol, 'nodeLabelCol', parsedData.jsonNodes[0] || [])}
              {renderDropdown('Type Property (Domain Data)', mapping.nodeTypeCol, 'nodeTypeCol', parsedData.jsonNodes[0] || [])}
              {renderDropdown('Partition Property', mapping.nodePartitionCol, 'nodePartitionCol', parsedData.jsonNodes[0] || [])}
              {renderDropdown('Community Property', mapping.nodeCommunityCol, 'nodeCommunityCol', parsedData.jsonNodes[0] || [])}
              {renderDropdown('Size/Abundance Property', mapping.nodeAbundCol, 'nodeAbundCol', parsedData.jsonNodes[0] || [])}
            </div>
            <p className="text-[10px] font-mono opacity-60">All undeclared JSON properties are preserved automatically as custom attributes.</p>
          </div>
        )}

        {(isFormatMatrix || isFormatDualMatrix) && (
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 border mb-6 mt-4 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Row Headers Col Index</label>
              <input
                type="number"
                value={mapping.rowHeadersCol}
                onChange={(e) => updateMappingField('rowHeadersCol', e.target.value === '' ? '' : parseInt(e.target.value))}
                min={0}
                className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Col Headers Row Index</label>
              <input
                type="number"
                value={mapping.colHeadersRow}
                onChange={(e) => updateMappingField('colHeadersRow', e.target.value === '' ? '' : parseInt(e.target.value))}
                min={0}
                className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Data Start Row Index</label>
              <input
                type="number"
                value={mapping.dataStartRow}
                onChange={(e) => updateMappingField('dataStartRow', e.target.value === '' ? '' : parseInt(e.target.value))}
                min={1}
                className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`}
              />
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Data Start Col Index</label>
              <input
                type="number"
                value={mapping.dataStartCol}
                onChange={(e) => updateMappingField('dataStartCol', e.target.value === '' ? '' : parseInt(e.target.value))}
                min={1}
                className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`}
              />
            </div>
          </div>
        )}

        <div className={`p-6 text-xs font-mono mb-6 mt-8 ${isDarkMode ? 'bg-[#1a1a1a] border border-[#333] text-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0]'}`}>
          <div className="font-bold uppercase tracking-widest mb-4">Network Summary Preview</div>
          <div>
            <span className="text-[#E4E3E0]/60">Nodes Extracted:</span> <span className="font-bold text-[#b4ff39]">{previewGraph.nodes.length}</span>
          </div>
          <div>
            <span className="text-[#E4E3E0]/60">Edges Extracted:</span> <span className="font-bold text-[#b4ff39]">{previewGraph.edges.length}</span>
          </div>
          <div className="mt-2">
            <span className="text-[#E4E3E0]/60">Directed:</span> {isDirected ? 'Yes' : 'No'}
          </div>
          <div>
            <span className="text-[#E4E3E0]/60">Bipartite:</span> {topology === 'Bipartite' ? 'Yes' : 'No'}
          </div>
          <div>
            <span className="text-[#E4E3E0]/60">Weighted:</span> {isWeighted ? 'Yes' : 'No'}
          </div>
        </div>

        <div className={`mt-8 flex justify-between border-t pt-6 ${isDarkMode ? 'border-[#333]' : 'border-[#141414]'}`}>
          <button
            onClick={onBack}
            className={`border border-transparent text-[10px] font-bold px-6 py-3 uppercase tracking-widest transition-all ${
              isDarkMode ? 'text-[#E4E3E0] hover:border-[#E4E3E0]' : 'text-[#141414] hover:border-[#141414]'
            }`}
          >
            Back
          </button>
          <button
            disabled={isFinalizeDisabled}
            onClick={onFinalize}
            className={`text-[10px] px-8 py-3 font-bold uppercase tracking-widest hover:invert transition-all border disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:invert-0 ${
              isDarkMode ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'bg-[#141414] text-[#b4ff39] border-[#141414]'
            }`}
          >
            Confirm & Plot Network
          </button>
        </div>
      </div>
    </div>
  );
};
