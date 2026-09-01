import React, { useState, useEffect, useRef } from 'react';
import { liveNumericValue } from '@/services/graphStyles/liveUpdate';

export const SyncInput = ({ value, onChange, step, className, live = false }: any) => {
  const [localVal, setLocalVal] = useState(value);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setLocalVal(value);
  }, [value]);

  const commit = () => {
    const num = Number(localVal);
    if (!isNaN(num) && (live || num !== value)) {
      onChange(num);
    }
  };

  return (
    <input 
      type="number"
      className={`text-inherit ${className}`}
      value={localVal ?? ''}
      onChange={e => {
        const next = e.target.value;
        setLocalVal(next);
        const numeric = liveNumericValue(next, live);
        if (numeric !== undefined) onChange(numeric);
      }}
      onFocus={() => { editingRef.current = true; }}
      onBlur={() => { commit(); editingRef.current = false; }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      step={step}
    />
  );
};

export const SyncTextInput = ({ value, onChange, className, placeholder, list, options, live = false }: any) => {
  const [localVal, setLocalVal] = useState(value);
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setLocalVal(value);
  }, [value]);

  const commit = () => {
    if (live || localVal !== value) {
      onChange(localVal);
    }
  };

  // Support comma-separated autocomplete
  const tokens = typeof localVal === 'string' ? localVal.split(',') : [];
  const lastToken = tokens.length > 0 ? tokens[tokens.length - 1].trim() : '';
  const prefix = tokens.length > 1 ? tokens.slice(0, -1).join(', ') + ', ' : '';

  return (
    <>
      <input 
        type="text"
        className={`text-inherit ${className}`}
        value={localVal ?? ''}
        onChange={e => {
          setLocalVal(e.target.value);
          if (live) onChange(e.target.value);
        }}
        onFocus={() => { editingRef.current = true; }}
        onBlur={() => { commit(); editingRef.current = false; }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
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
