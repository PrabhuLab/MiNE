import type { ElementLegendItem } from './types';

export function createElementLegendItems(
  bipartite: boolean,
  directed: boolean,
  isDarkMode?: boolean,
): ElementLegendItem[] {
  return [
    {
      id: 'element:standard',
      label: 'Node Type 1',
      color: isDarkMode ? '#E4E3E0' : '#141414',
      colorKey: 'element:standard',
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
          label: 'Node Type 2',
          color: isDarkMode ? '#ff9f43' : '#c44f00',
          colorKey: 'element:bipartite',
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
      color: isDarkMode ? '#888888' : '#333333',
      colorKey: 'element:edges',
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
