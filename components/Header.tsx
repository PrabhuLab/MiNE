'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useStore } from '@/store/useStore';

export default function Header() {
  const pathname = usePathname();
  const [projectName, setProjectName] = useState('ADJ_MATRIX_772_B');
  const isDarkMode = useStore(state => state.isDarkMode);
  const setIsDarkMode = useStore(state => state.setIsDarkMode);

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
            className={`${pathname.startsWith('/workspace') ? 'underline underline-offset-4' : 'opacity-40 hover:opacity-100'}`}
          >
            02 WORKSPACE
          </Link>
        </nav>
      </div>
      <div className="flex items-center space-x-6">
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
        
        <div 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`w-8 h-8 border flex items-center justify-center font-mono text-[10px] cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]' : 'border-black hover:bg-[#141414] hover:text-[#E4E3E0]'}`}
          title="Toggle Dark Mode"
        >
          {isDarkMode ? 'LGT' : 'DRK'}
        </div>

        <div className={`w-8 h-8 border flex items-center justify-center font-mono text-[10px] cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0] hover:bg-[#E4E3E0] hover:text-[#141414]' : 'border-black hover:bg-[#141414] hover:text-[#E4E3E0]'}`}>
          USR
        </div>
      </div>
    </header>
  );
}
