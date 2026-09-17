'use client';

import React, { useState } from 'react';
import { useStore, type CustomAttributeType } from '@/store/useStore';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';

export function AdvancedSettings() {
  const { customAttributes, setCustomAttributes, isDarkMode } = useStore();
  const [shown, setShown] = useState(false);
  const selectClass = `w-full border bg-transparent p-2 text-xs font-mono ${isDarkMode ? 'border-[#444] [&>option]:bg-[#181818]' : 'border-[#141414] [&>option]:bg-white'}`;

  return <section className={`border-t pt-4 ${isDarkMode ? 'border-[#333]' : 'border-[#ccc]'}`}>
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-widest">Advanced Settings</h3>
      <SegmentedToggle checked={shown} onChange={setShown} isDarkMode={isDarkMode} ariaLabel="Show advanced settings" />
    </div>
    {shown && <>
        <p className="my-3 text-xs opacity-65">Choose how attributes are interpreted. For years such as 2024 and 2025, select Categories to give each year a separate color. Changes apply immediately.</p>
      {(['node', 'edge'] as const).map((scope) => <div key={scope} className="mt-4">
        <h4 className="text-[10px] font-bold uppercase tracking-widest">{scope} Attribute Types</h4>

        <div className="space-y-3">
          {customAttributes.filter((attribute) => attribute.scope === scope).map((attribute) => <label key={`${attribute.scope}:${attribute.name}`} className="block text-xs">
            {attribute.label || attribute.name}
            <select className={`mt-1 ${selectClass}`} value={attribute.selectedType} onChange={(event) => {
              const selectedType = event.target.value as CustomAttributeType;
              setCustomAttributes(useStore.getState().customAttributes.map((entry) => entry.scope === attribute.scope && entry.name === attribute.name ? { ...entry, selectedType } : entry));
            }}>
              <option value="nominal">Categories</option>
              <option value="ordinal">Ordered categories</option>
              <option value="binary">Binary categories</option>
              <option value="discrete">Numbers (whole)</option>
              <option value="continuous">Numbers (continuous)</option>
            </select>
            <button type="button" className="mt-1 text-[10px] underline opacity-65" onClick={() => setCustomAttributes(useStore.getState().customAttributes.map((entry) => entry.scope === attribute.scope && entry.name === attribute.name ? { ...entry, selectedType: entry.detectedType } : entry))}>Reset to detected type</button>
          </label>)}
        </div>
      </div>)}
    </>}
  </section>;
}
