'use client';
import React from 'react';
import SmartUploadWizard from '@/components/SmartUploadWizard';
import Header from '@/components/Header';
import { useStore } from '@/store/useStore';

export default function UploadPage() {
  const isDarkMode = useStore(state => state.isDarkMode);
  return (
    <div className={`h-full flex flex-col overflow-y-auto w-full transition-colors ${isDarkMode ? 'bg-[#000] text-[#E4E3E0]' : 'bg-[#E4E3E0] text-[#141414]'}`}>
      <Header />
      <div className="flex-1 px-4 py-8 max-w-4xl mx-auto w-full">
        <SmartUploadWizard />
      </div>
    </div>
  );
}
