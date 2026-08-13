import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';

export const SyncInput = ({ value, onChange, step, className }: any) => {
  const liveUpdate = useStore(state => state.filters.liveUpdate);
  const [localVal, setLocalVal] = useState(value);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLocalVal(value), [value]);

  return (
    <input 
      type="number"
      className={`text-inherit ${className}`}
      value={localVal}
      onChange={e => {
        setLocalVal(e.target.value);
        if (liveUpdate) onChange(Number(e.target.value));
      }}
      onBlur={() => onChange(Number(localVal))}
      onKeyDown={e => e.key === 'Enter' && onChange(Number(localVal))}
      step={step}
    />
  );
};

export const SyncTextInput = ({ value, onChange, className, placeholder, list, options }: any) => {
  const liveUpdate = useStore(state => state.filters.liveUpdate);
  const [localVal, setLocalVal] = useState(value);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLocalVal(value), [value]);

  // Support comma-separated autocomplete
  const tokens = typeof localVal === 'string' ? localVal.split(',') : [];
  const lastToken = tokens.length > 0 ? tokens[tokens.length - 1].trim() : '';
  const prefix = tokens.length > 1 ? tokens.slice(0, -1).join(', ') + ', ' : '';

  return (
    <>
      <input 
        type="text"
        className={`text-inherit ${className}`}
        value={localVal}
        onChange={e => {
          setLocalVal(e.target.value);
          if (liveUpdate) onChange(e.target.value);
        }}
        onBlur={() => onChange(localVal)}
        onKeyDown={e => e.key === 'Enter' && onChange(localVal)}
        placeholder={placeholder}
        list={list}
      />
      {list && options && lastToken.length >= 1 && (
        <datalist id={list}>
          {options
            .filter((opt: any) => String(opt.value).toLowerCase().includes(lastToken.toLowerCase()) || String(opt.label).toLowerCase().includes(lastToken.toLowerCase()))
            .slice(0, 15)
            .map((opt: any, idx: number) => (
              <option key={idx} value={prefix + opt.value}>{opt.label}</option>
            ))}
        </datalist>
      )}
    </>
  );
};
