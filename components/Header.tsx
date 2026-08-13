'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Sun, Moon } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const projectName = useStore(state => state.projectName);
  const setProjectName = useStore(state => state.setProjectName);
  const isDarkMode = useStore(state => state.isDarkMode);
  const setIsDarkMode = useStore(state => state.setIsDarkMode);

  const rendererEngine = useStore(state => state.rendererEngine);
  const setRendererEngine = useStore(state => state.setRendererEngine);
  const rawNodes = useStore(state => state.rawNodes);
  const rawEdges = useStore(state => state.rawEdges);

  const isLargeGraph = rawNodes.length > 500 || rawEdges.length > 1000;
  const activeEngineLabel = rendererEngine === 'auto' 
    ? (isLargeGraph ? 'AUTO (SIGMA)' : 'AUTO (D3)')
    : rendererEngine.toUpperCase();

  return (
    <header className={`h-14 border-b flex items-center px-6 justify-between shrink-0 transition-colors ${isDarkMode ? 'bg-[#141414] border-[#333] text-[#E4E3E0]' : 'bg-[#E4E3E0] border-[#141414] text-[#141414]'}`}>
      <div className="flex items-center space-x-4">
        <Link href="/" className="font-black text-xl tracking-tighter">MiNE</Link>
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

        {/* Renderer Engine Toggle (D3 / Sigma / Auto) */}
        <div className={`flex items-center rounded text-[10px] font-bold uppercase tracking-wider p-0.5 border ${isDarkMode ? 'bg-[#222] border-[#444]' : 'bg-[#d8d7d4] border-[#b0b0b0]'}`}>
          <button
            type="button"
            onClick={() => setRendererEngine('auto')}
            className={`px-2 py-1 rounded transition-colors ${rendererEngine === 'auto' ? (isDarkMode ? 'bg-[#444] text-white shadow-sm' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}
            title={isLargeGraph ? "Auto mode: Large graph detected (>500 nodes / >1000 edges), using Sigma.js" : "Auto mode: Using D3.js for standard size graph"}
          >
            Auto
          </button>
          <button
            type="button"
            onClick={() => setRendererEngine('d3')}
            className={`px-2 py-1 rounded transition-colors ${rendererEngine === 'd3' ? (isDarkMode ? 'bg-[#444] text-white shadow-sm' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}
            title="Force D3.js SVG Renderer"
          >
            D3
          </button>
          <button
            type="button"
            onClick={() => setRendererEngine('sigma')}
            className={`px-2 py-1 rounded transition-colors ${rendererEngine === 'sigma' ? (isDarkMode ? 'bg-[#444] text-white shadow-sm' : 'bg-white text-black shadow-sm') : 'opacity-60 hover:opacity-100'}`}
            title="Force Sigma.js WebGL Renderer (High Performance)"
          >
            Sigma
          </button>
        </div>

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
