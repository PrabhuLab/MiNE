import React from 'react';
import { BaseStepProps, WizardFilesState } from '../types';

interface StepFileFormatProps extends BaseStepProps {
  format: string;
  setFormat: (format: string) => void;
  availableFormats: string[];
  filesState: WizardFilesState;
  setFilesState: React.Dispatch<React.SetStateAction<WizardFilesState>>;
  isProcessing: boolean;
  isValid: boolean;
  onParseAndReview: () => void;
}

export const StepFileFormat: React.FC<StepFileFormatProps> = ({
  isDarkMode,
  format,
  setFormat,
  availableFormats,
  filesState,
  setFilesState,
  isProcessing,
  isValid,
  onParseAndReview,
  onBack,
}) => {
  const isFormatMatrix = ['Adjacency Matrix', 'Incidence Matrix', 'Single Weighted Adjacency Matrix', 'Single Adjacency Matrix'].includes(format);
  const isFormatEdgeList = ['Edge List', 'Weighted Edge List', 'Directed Edge List', 'Directed Weighted Edge List', 'Bipartite Edge List', 'Directed Bipartite Edge List'].includes(format);
  const isFormatDualMatrix = format === 'Dual Adjacency Matrix';
  const isFormatAdjList = format === 'Adjacency List';

  const dropzoneClass = `flex flex-col items-center justify-center w-full h-32 border border-dashed cursor-pointer transition-colors ${
    isDarkMode
      ? 'border-[#E4E3E0]/50 bg-[#222]/30 hover:bg-[#222]'
      : 'border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#E4E3E0]'
  }`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="font-mono text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5">STEP 04</div>
        <h3 className="text-sm font-bold uppercase tracking-widest">Select Input Format & Upload</h3>
      </div>
      <div className="ml-14">
        <div className="relative mb-6">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={`w-full border px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none appearance-none cursor-pointer transition-all ${
              isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0] hover:bg-[#222]' : 'border-[#141414] bg-white text-[#141414] hover:bg-black/5'
            }`}
          >
            {availableFormats.map((opt) => (
              <option key={opt} value={opt} className={isDarkMode ? 'bg-[#1a1a1a] text-[#E4E3E0]' : 'bg-white text-[#141414]'}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Upload zones */}
        <div className="space-y-6">
          {format === 'Standard JSON' && (
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                Standard JSON Upload
              </label>
              <label className={dropzoneClass}>
                <div className="flex flex-col items-center justify-center">
                  <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                  <p className="text-[10px] font-mono opacity-60 mt-1">{filesState.jsonFile?.name || '---'}</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".json"
                  onChange={(e) => setFilesState((prev) => ({ ...prev, jsonFile: e.target.files?.[0] || null }))}
                />
              </label>
            </div>
          )}

          {isFormatMatrix && (
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                Matrix Dataset (CSV)
              </label>
              <label className={dropzoneClass}>
                <div className="flex flex-col items-center justify-center">
                  <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                  <p className="text-[10px] font-mono opacity-60 mt-1">{filesState.singleMatrixFile?.name || '---'}</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={(e) => setFilesState((prev) => ({ ...prev, singleMatrixFile: e.target.files?.[0] || null }))}
                />
              </label>
            </div>
          )}

          {isFormatDualMatrix && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                  Raw Matrix (CSV)
                </label>
                <label className={dropzoneClass}>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                    <p className="text-[10px] font-mono opacity-60 mt-1">{filesState.countsFile?.name || '---'}</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={(e) => setFilesState((prev) => ({ ...prev, countsFile: e.target.files?.[0] || null }))}
                  />
                </label>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                  Secondary Matrix (CSV)
                </label>
                <label className={dropzoneClass}>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                    <p className="text-[10px] font-mono opacity-60 mt-1">{filesState.percentagesFile?.name || '---'}</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={(e) => setFilesState((prev) => ({ ...prev, percentagesFile: e.target.files?.[0] || null }))}
                  />
                </label>
              </div>
            </div>
          )}

          {isFormatEdgeList && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                  Edges (CSV) *
                </label>
                <label className={dropzoneClass}>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                    <p className="text-[10px] font-mono opacity-60 mt-1">{filesState.edgesFile?.name || '---'}</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={(e) => setFilesState((prev) => ({ ...prev, edgesFile: e.target.files?.[0] || null }))}
                  />
                </label>
              </div>
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                  Nodes (CSV) {format !== 'Bipartite Edge List' && format !== 'Directed Bipartite Edge List' && '[Optional]'}
                </label>
                <label className={dropzoneClass}>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                    <p className="text-[10px] font-mono opacity-60 mt-1">{filesState.nodesFile?.name || '---'}</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={(e) => setFilesState((prev) => ({ ...prev, nodesFile: e.target.files?.[0] || null }))}
                  />
                </label>
              </div>
            </div>
          )}

          {isFormatAdjList && (
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                Adjacency List (CSV)
              </label>
              <label className={dropzoneClass}>
                <div className="flex flex-col items-center justify-center">
                  <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                  <p className="text-[10px] font-mono opacity-60 mt-1">{filesState.adjListFile?.name || '---'}</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={(e) => setFilesState((prev) => ({ ...prev, adjListFile: e.target.files?.[0] || null }))}
                />
              </label>
            </div>
          )}
        </div>

        {format !== 'Standard JSON' && (
          <div className="mt-6 border-t border-dashed pt-6" style={{ borderColor: isDarkMode ? '#333' : '#d0d0d0' }}>
            <label className="flex items-center space-x-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={filesState.hasAdditionalAttributes}
                onChange={(e) => setFilesState((prev) => ({ ...prev, hasAdditionalAttributes: e.target.checked }))}
                className="accent-[#141414] dark:accent-[#E4E3E0]"
              />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                Upload Additional Node/Edge Attributes
              </span>
            </label>
            {filesState.hasAdditionalAttributes && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!isFormatEdgeList && (
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                      Additional Edges (CSV) [Optional]
                    </label>
                    <label className={dropzoneClass}>
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                        <p className="text-[10px] font-mono opacity-60 mt-1">{filesState.edgesFile?.name || '---'}</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".csv"
                        onChange={(e) => setFilesState((prev) => ({ ...prev, edgesFile: e.target.files?.[0] || null }))}
                      />
                    </label>
                  </div>
                )}
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
                    Additional Nodes (CSV) [Optional]
                  </label>
                  <label className={dropzoneClass}>
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                      <p className="text-[10px] font-mono opacity-60 mt-1">{filesState.nodesFile?.name || '---'}</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv"
                      onChange={(e) => setFilesState((prev) => ({ ...prev, nodesFile: e.target.files?.[0] || null }))}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

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
            disabled={!isValid || isProcessing}
            onClick={onParseAndReview}
            className={`text-[10px] px-6 py-3 font-bold uppercase tracking-widest hover:invert transition-all border disabled:opacity-50 ${
              isDarkMode ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0] border-[#141414]'
            }`}
          >
            {isProcessing ? 'Reading...' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};
