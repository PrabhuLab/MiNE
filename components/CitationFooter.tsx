'use client';

import { useStore } from '@/store/useStore';

const REPOSITORY_URL = 'https://github.com/PrabhuLab/MiNE';

export function CitationFooter() {
  const isDarkMode = useStore((state) => state.isDarkMode);
  return (
    <footer className={`flex h-8 shrink-0 items-center justify-center gap-3 border-t px-4 text-[9px] font-mono uppercase tracking-wider ${isDarkMode ? 'border-[#333] bg-[#141414] text-[#E4E3E0]' : 'border-[#141414] bg-[#E4E3E0] text-[#141414]'}`}>
      <span className="opacity-60">How to cite MiNE</span>
      <a className="underline underline-offset-2" href={`${REPOSITORY_URL}/blob/main/CITATION.cff`} target="_blank" rel="noreferrer">CITATION.cff</a>
      <a className="underline underline-offset-2" href={REPOSITORY_URL} target="_blank" rel="noreferrer">Repository</a>
    </footer>
  );
}
