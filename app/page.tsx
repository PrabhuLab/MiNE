'use client';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import Header from '@/components/Header';
import { MiNEWordmark } from '@/components/MiNEWordmark';

export default function Home() {
  const isDarkMode = useStore(state => state.isDarkMode);

  return (
    <div className={`h-full w-full flex flex-col transition-colors ${isDarkMode ? 'bg-[#000] text-[#E4E3E0]' : 'bg-[#E4E3E0] text-[#141414]'}`}>
      <Header />
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="max-w-2xl text-center mt-[-40px]">
          <div className="flex justify-center mb-6">
            <div className={`border p-4 shadow-none ${isDarkMode ? 'border-[#333] bg-[#141414]' : 'border-[#141414] bg-white'}`}>
               <MiNEWordmark className="text-2xl" />
            </div>
          </div>
          
          <h1 className={`text-4xl md:text-5xl font-black tracking-tighter mb-4 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
            Mineral Network Explorer
          </h1>
          
          <p className={`text-sm font-mono opacity-80 mb-10 max-w-xl mx-auto leading-relaxed ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>
            The next-generation interactive platform for complex mineralogical networks. Bring your matrices and edge-lists into a unified, accelerated visual workspace.
          </p>

          <Link 
            href="/upload" 
            className={`inline-flex items-center justify-center px-8 py-4 text-xs font-bold uppercase tracking-widest border transition-colors ${isDarkMode ? 'bg-[#E4E3E0] border-[#E4E3E0] text-[#141414] hover:bg-transparent hover:text-[#E4E3E0]' : 'bg-[#141414] border-[#141414] text-[#E4E3E0] hover:bg-transparent hover:text-[#141414]'}`}
          >
            Create New Project
          </Link>
        </div>
        
        <div className={`mt-20 grid grid-cols-1 md:grid-cols-3 gap-0 border max-w-4xl w-full ${isDarkMode ? 'border-[#333] bg-[#141414] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`}>
          <FeatureCard isDarkMode={isDarkMode} title="Universal Matrix Parsing" desc="Import adjacency, incidence, dual-adjacency, list, JSON, GraphML, and GEXF data into one normalized graph model while preserving supported metadata." borderRight={true} />
          <FeatureCard isDarkMode={isDarkMode} title="Interactive Filtering" desc="Filter one edge-derived range at a time and inspect the active and filtered portions without changing the raw network." borderRight={true} />
          <FeatureCard isDarkMode={isDarkMode} title="Louvain Community Detection" desc="Run Louvain in the browser or curated igraph community algorithms in Cloud mode, then color nodes and edges by the result." />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, desc, borderRight, isDarkMode }: { title: string, desc: string, borderRight?: boolean, isDarkMode: boolean }) {
  return (
    <div className={`p-6 text-left ${borderRight ? (isDarkMode ? 'border-r border-[#333]' : 'border-r border-[#141414]') : ''} mb-0`}>
      <h3 className="text-xs font-bold uppercase mb-2">{title}</h3>
      <p className="font-mono text-xs opacity-80 leading-relaxed">{desc}</p>
    </div>
  );
}
