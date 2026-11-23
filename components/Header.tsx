'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Moon, Shuffle, Sun } from 'lucide-react';
import { ComputationEngineControl } from '@/components/workspace/ComputationEngineControl';
import { MiNEWordmark } from '@/components/MiNEWordmark';
import { isSecondaryNode, orderPartitionValues } from '@/services/graphPresentation/visibility';

export default function Header() {
  useEffect(() => {
    void useStore.persist.rehydrate();
  }, []);
  const pathname = usePathname();
  const projectName = useStore(state => state.projectName);
  const setProjectName = useStore(state => state.setProjectName);
  const isDarkMode = useStore(state => state.isDarkMode);
  const setIsDarkMode = useStore(state => state.setIsDarkMode);

  const rawNodes = useStore(state => state.rawNodes);
  const rawEdges = useStore(state => state.rawEdges);
  const directed = useStore(state => state.directed);
  const bipartite = useStore(state => state.bipartite);
  const secondaryCount = useMemo(() => {
    if (!bipartite) return null;
    const partitions = orderPartitionValues(rawNodes.flatMap(node => {
      const value = node.partition ?? node.bipartite ?? node.set;
      return value == null || value === '' ? [] : [value];
    }));
    const secondaryLabel = partitions.length === 2 ? partitions[1] : undefined;
    return rawNodes.filter(node => {
      const value = node.partition ?? node.bipartite ?? node.set;
      const partitionIndex = node.partitionIndex ?? (secondaryLabel !== undefined && String(value) === secondaryLabel ? 1 : undefined);
      return isSecondaryNode({ ...node, partitionIndex }, true);
    }).length;
  }, [bipartite, rawNodes]);
  const comparison = new URLSearchParams({
    randomNodes: String(rawNodes.length),
    randomEdges: String(rawEdges.length),
    ...(secondaryCount !== null ? { secondary: String(secondaryCount) } : {}),
    ...(directed ? { directed: '1' } : {}),
    source: projectName,
  });

  return (
    <header className={`h-14 border-b flex items-center px-6 justify-between shrink-0 transition-colors ${isDarkMode ? 'bg-[#141414] border-[#333] text-[#E4E3E0]' : 'bg-[#E4E3E0] border-[#141414] text-[#141414]'}`}>
      <div className="flex items-center space-x-4">
        <Link href="/" aria-label="MiNE home"><MiNEWordmark className="text-xl" /></Link>
        <span className={`text-[10px] px-2 py-0.5 ${isDarkMode ? 'bg-[#E4E3E0] text-[#141414]' : 'bg-black text-white'}`}>V1.0.0.-PROTOTYPE</span>
        <div className={`h-4 w-px opacity-20 ${isDarkMode ? 'bg-white' : 'bg-black'}`}></div>
        <nav className="text-xs flex space-x-4 font-medium hidden sm:flex">
          <Link 
            href="/upload" 
            className={`${pathname === '/upload' ? 'underline underline-offset-4' : 'opacity-40 hover:opacity-100'}`}
          >
            01 UPLOAD
          </Link>
          <span className="opacity-40">/</span>
          <Link 
            href="/workspace" 
            className={`${pathname?.startsWith('/workspace') ? 'underline underline-offset-4' : 'opacity-40 hover:opacity-100'}`}
          >
            02 WORKSPACE
          </Link>
        </nav>
      </div>
      <div className="flex items-center space-x-4 sm:space-x-6">
        <div className="text-right hidden sm:block">
          <div className="text-[10px] opacity-60 font-bold uppercase">Project Instance</div>
          <input 
            type="text" 
            value={projectName} 
            onChange={(e) => setProjectName(e.target.value)}
            className={`text-xs font-mono bg-transparent border-b border-transparent focus:outline-none text-right placeholder-gray-500 w-32 ${isDarkMode ? 'focus:border-white text-white' : 'focus:border-[#141414] text-[#141414]'}`}
            title="Edit Project Name"
          />
        </div>

        {pathname?.replace(/\/$/, '') === '/workspace' && rawNodes.length > 0 && (
          <Link
            href={{ pathname: '/workspace', hash: comparison.toString() }}
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
            className="flex items-center gap-2 rounded border border-current/30 px-2 py-1.5 text-xs font-medium hover:bg-current/10"
            title="Generate an igraph network with matching counts in a new tab"
          >
            <Shuffle size={14} aria-hidden="true" />
            <span>Random comparison</span>
          </Link>
        )}

        <ComputationEngineControl nodeCount={rawNodes.length} edgeCount={rawEdges.length} compact />

        <div 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </div>
      </div>
    </header>
  );
}
