import type { ElementLegendItem } from './types';

export function createElementLegendItems(
  bipartite: boolean,
  directed: boolean,
  isDarkMode?: boolean,
): ElementLegendItem[] {
  return [
    {
      id: 'element:standard',
      label: 'Standard Nodes',
      Icon: () => (
        <div
          className={`w-3 h-3 rounded-full border ${
            isDarkMode ? 'border-[#E4E3E0] bg-transparent' : 'border-[#141414] bg-transparent'
          }`}
        />
      ),
    },
    ...(bipartite
      ? [{
          id: 'element:bipartite',
          label: 'Bipartite Nodes',
          Icon: () => (
            <div
              className={`w-3 h-3 border ${
                isDarkMode
                  ? 'border-[#E4E3E0] bg-transparent'
                  : 'border-[#141414] bg-transparent'
              }`}
            />
          ),
        }]
      : []),
    {
      id: 'element:edges',
      label: directed ? 'Directed Edges' : 'Undirected Edges',
      Icon: () => (
        <div className="w-3 relative flex items-center justify-center">
          <div className={`w-full h-[1px] ${isDarkMode ? 'bg-[#bbb]' : 'bg-[#141414]'}`} />
          {directed && (
            <div
              className={`absolute right-0 translate-x-[2px] w-0 h-0 border-y-[3px] border-y-transparent border-l-[4px] ${
                isDarkMode ? 'border-l-[#bbb]' : 'border-l-[#141414]'
              } opacity-80`}
            />
          )}
        </div>
      ),
    },
  ];
}
