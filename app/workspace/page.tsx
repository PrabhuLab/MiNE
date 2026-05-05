import React from 'react';
import Workspace from '@/components/Workspace';
import Header from '@/components/Header';

export default function WorkspacePage() {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-[#E4E3E0]">
      <Header />
      <main className="flex-1 min-h-0 relative overflow-hidden">
        <Workspace />
      </main>
    </div>
  );
}
