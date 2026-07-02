const fs = require('fs');
let content = fs.readFileSync('components/Workspace.tsx', 'utf8');

const target3 = `          {activeTab === "data" && (
            <div className="flex items-center space-x-6">
              {typeof modularity === "number" && !isNaN(modularity) && (
                <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest">
                  <span className="opacity-60">Modularity (Q):</span>
                  <span className={\`font-mono px-2 py-1 rounded \${isDarkMode ? "bg-white/10" : "bg-black/5"}\`}>
                    {modularity.toFixed(4)}
                  </span>
                </div>
              )}
              <input
                type="text"
                placeholder="SEARCH NODES..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={\`text-[10px] uppercase font-bold tracking-widest px-3 py-2 border outline-none w-64 transition-colors \${isDarkMode ? "bg-[#141414] border-[#333] text-[#E4E3E0] focus:border-[#E4E3E0] placeholder-[#666]" : "bg-white border-[#ccc] text-[#141414] focus:border-[#141414] placeholder-[#999]"}\`}
              />
            </div>
          )}`;

const replacement3 = `          <div className="flex items-center space-x-6">
            {activeTab === "data" && (
              <>
                {typeof modularity === "number" && !isNaN(modularity) && (
                  <div className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest">
                    <span className="opacity-60">Modularity (Q):</span>
                    <span className={\`font-mono px-2 py-1 rounded \${isDarkMode ? "bg-white/10" : "bg-black/5"}\`}>
                      {modularity.toFixed(4)}
                    </span>
                  </div>
                )}
                <input
                  type="text"
                  placeholder="SEARCH NODES..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={\`text-[10px] uppercase font-bold tracking-widest px-3 py-2 border outline-none w-64 transition-colors \${isDarkMode ? "bg-[#141414] border-[#333] text-[#E4E3E0] focus:border-[#E4E3E0] placeholder-[#666]" : "bg-white border-[#ccc] text-[#141414] focus:border-[#141414] placeholder-[#999]"}\`}
                />
              </>
            )}
            
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={\`flex items-center space-x-2 px-4 py-2 border text-[10px] uppercase font-bold tracking-widest transition-colors shadow-sm \${isDarkMode ? "bg-[#141414] border-[#333] text-[#E4E3E0] hover:bg-[#333]" : "bg-white border-[#141414] text-[#141414] hover:bg-black/5"}\`}
              >
                <Download size={14} />
                <span>Export</span>
              </button>
              
              {showExportMenu && (
                <div 
                  className={\`absolute right-0 mt-2 w-48 border shadow-lg z-50 flex flex-col text-[10px] uppercase font-bold tracking-widest \${isDarkMode ? 'bg-[#141414] border-[#333]' : 'bg-white border-[#ccc]'}\`}
                  onMouseLeave={() => setShowExportMenu(false)}
                >
                  {activeTab === 'graph' ? (
                    <>
                      <button onClick={() => handleExport('svg')} className={\`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 \${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}\`}>Export as SVG</button>
                      <button onClick={() => handleExport('png')} className={\`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 \${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}\`}>Export as PNG</button>
                      <button onClick={() => handleExport('jpeg')} className={\`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 \${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}\`}>Export as JPG</button>
                      <div className={\`h-px w-full \${isDarkMode ? 'bg-[#333]' : 'bg-[#eee]'}\`}></div>
                      <button onClick={() => handleExport('json')} className={\`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 \${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}\`}>Export JSON</button>
                      <button onClick={() => handleExport('nodelist')} className={\`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 \${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}\`}>Export Node CSV</button>
                      <button onClick={() => handleExport('edgelist')} className={\`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 \${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}\`}>Export Edge CSV</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleExport('csv')} className={\`text-left px-4 py-3 hover:opacity-100 transition-opacity opacity-70 \${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}\`}>Export Table CSV</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>`;

content = content.replace(target3, replacement3);
fs.writeFileSync('components/Workspace.tsx', content);
