'use client';

import React, { useState } from 'react';

interface Props {
  children: React.ReactNode;
  className: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}

export function FileDropzone({ children, className, accept, multiple = false, onFiles }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  return (
    <label className={`${className} relative focus-within:outline focus-within:outline-2 ${dragging ? 'outline outline-2 outline-offset-2' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (!files.length) return;
        if ((!multiple && files.length > 1) || files.some(file => !accept.split(',').some(extension => file.name.toLowerCase().endsWith(extension)))) {
          setError(`Drop ${multiple ? 'files' : 'one file'} in ${accept} format.`);
          return;
        }
        setError('');
        onFiles(files);
      }}>
      {children}
      {error && <span role="alert" className="absolute bottom-1 px-2 text-xs text-red-600">{error}</span>}
    </label>
  );
}
