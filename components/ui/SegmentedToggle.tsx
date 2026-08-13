import React from 'react';

export const SegmentedToggle = ({ checked, onChange, isDarkMode, ariaLabel }: any) => {
  return (
    <div 
      onClick={() => onChange(!checked)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onChange(!checked);
        }
      }}
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      tabIndex={0}
      className={`cursor-pointer flex items-center border text-[9px] font-bold uppercase transition-colors ${
        isDarkMode ? 'border-[#555]' : 'border-[#ccc]'
      }`}
    >
      <div className={`px-2 py-1 ${!checked ? (isDarkMode ? 'bg-[#E4E3E0] text-[#141414]' : 'bg-[#141414] text-white') : 'opacity-50'}`}>OFF</div>
      <div className={`px-2 py-1 ${checked ? (isDarkMode ? 'bg-[#b4ff39] text-[#141414]' : 'bg-[#141414] text-white') : 'opacity-50'}`}>ON</div>
    </div>
  );
};
