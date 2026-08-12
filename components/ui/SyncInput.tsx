/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';

export const SyncInput = ({ value, onChange, step, className }: any) => {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const commit = () => {
    const num = Number(localVal);
    if (!isNaN(num) && num !== value) {
      onChange(num);
    }
  };

  return (
    <input 
      type="number"
      className={`text-inherit ${className}`}
      value={localVal ?? ''}
      onChange={e => setLocalVal(e.target.value)}
      onBlur={commit}
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

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const commit = () => {
    if (localVal !== value) {
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
        onBlur={commit}
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
