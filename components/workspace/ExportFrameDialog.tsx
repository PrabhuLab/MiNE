'use client';

import { useEffect, useRef, useState } from 'react';
import { downloadBlobAsFile } from '@/lib/exportUtils';
import { EXPORT_RESOLUTION_SCALES, MAX_EXPORT_SIDE, exportImageDimensions, validExportDimensions, validExportResolution, type ExportCamera, type ExportFrame } from '@/services/graphIO/exportFrame';
import { useStore } from '@/store/useStore';

interface Props {
  onClose: () => void;
  captureFrame: (frame: ExportFrame) => ExportCamera;
  buildFrameImage: (frame: ExportFrame) => Promise<Blob>;
}

export function ExportFrameDialog({ onClose, captureFrame, buildFrameImage }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const saved = useStore(state => state.exportFrame);
  const setFrame = useStore(state => state.setExportFrame);
  const isDarkMode = useStore(state => state.isDarkMode);
  const projectName = useStore(state => state.projectName);
  const [width, setWidth] = useState(String(saved.width));
  const [height, setHeight] = useState(String(saved.height));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const previewArtifact = useRef<{ url: string; camera: ExportCamera; image: Blob } | null>(null);
  const frame = { width: Number(width), height: Number(height), camera: saved.camera, resolutionScale: saved.resolutionScale };
  const valid = validExportResolution(frame);
  const output = exportImageDimensions(frame);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => {
      if (previewArtifact.current) URL.revokeObjectURL(previewArtifact.current.url);
      previewArtifact.current = null;
    };
  }, []);

  function discardPreview() {
    if (previewArtifact.current) URL.revokeObjectURL(previewArtifact.current.url);
    previewArtifact.current = null;
    setPreview(null);
  }

  function changeSize(nextWidth: string, nextHeight: string) {
    setWidth(nextWidth);
    setHeight(nextHeight);
    const size = { width: Number(nextWidth), height: Number(nextHeight), resolutionScale: saved.resolutionScale };
    if (validExportDimensions(size)) setFrame(validExportResolution(size) ? size : { ...size, resolutionScale: 1 });
    discardPreview();
  }

  function toggleLock() {
    setError('');
    try {
      if (saved.camera) {
        discardPreview();
        setFrame({ ...frame, camera: undefined });
      } else {
        setFrame({ ...frame, camera: previewArtifact.current?.camera ?? captureFrame(frame) });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function render(download: boolean) {
    if (download && previewArtifact.current) {
      downloadBlobAsFile(previewArtifact.current.image, `${projectName}.png`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const camera = frame.camera ?? captureFrame(frame);
      const image = await buildFrameImage({ ...frame, camera });
      if (download) {
        downloadBlobAsFile(image, `${projectName}.png`);
      } else if (dialog.current?.open) {
        discardPreview();
        const url = URL.createObjectURL(image);
        previewArtifact.current = { url, camera, image };
        setPreview(url);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const control = 'rounded border border-current/30 px-3 py-2 text-sm hover:bg-current/10 disabled:opacity-50';
  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="export-frame-title"
      className={`m-auto w-[min(44rem,92vw)] max-h-[90vh] overflow-auto rounded-lg border p-5 backdrop:bg-black/60 ${isDarkMode ? 'bg-[#181818] text-white' : 'bg-white text-[#141414]'}`}>
      <div className="flex items-center justify-between gap-4">
        <h2 id="export-frame-title" className="text-lg font-semibold">Fixed-size export</h2>
        <button type="button" className={control} onClick={() => dialog.current?.close()}>Close</button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">Width (px)
          <input type="number" min={1} max={MAX_EXPORT_SIDE} value={width} disabled={Boolean(saved.camera) || busy}
            onChange={event => changeSize(event.target.value, height)} className="mt-1 block w-28 rounded border bg-transparent p-2" />
        </label>
        <label className="text-sm">Height (px)
          <input type="number" min={1} max={MAX_EXPORT_SIDE} value={height} disabled={Boolean(saved.camera) || busy}
            onChange={event => changeSize(width, event.target.value)} className="mt-1 block w-28 rounded border bg-transparent p-2" />
        </label>
        <label className="text-sm">Resolution
          <select aria-label="Export resolution" value={frame.resolutionScale ?? 1} disabled={!validExportDimensions(frame) || busy}
            onChange={event => {
              setFrame({ ...frame, resolutionScale: Number(event.target.value) });
              discardPreview();
            }} className="mt-1 block rounded border bg-transparent p-2">
            {EXPORT_RESOLUTION_SCALES.map(scale => (
              <option key={scale} value={scale} disabled={!validExportResolution({ ...frame, resolutionScale: scale })}>
                {scale === 1 ? '1× (original)' : `${scale}× (high resolution)`}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!valid || busy} onClick={toggleLock} className={control}>
          {saved.camera ? 'Unlock framing' : 'Lock framing'}
        </button>
      </div>
      <p role="status" className="mt-3 text-sm opacity-75">
        {saved.camera
          ? `Framing locked for ${saved.camera.renderer === 'sigma' ? 'Sigma' : 'D3'}. All-in-One JSON saves this frame.`
          : 'Lock framing to reuse this camera across exports. Close this panel to pan or zoom the graph.'}
      </p>
      {valid && <p className="mt-2 text-sm opacity-75">Output {output.width} × {output.height} px. Enable Node Labels in the graph legend before exporting.</p>}
      {preview && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={preview} alt="Export frame preview" className="mx-auto mt-4 max-h-[48vh] max-w-full rounded border border-current/20 bg-neutral-500/20 object-contain" />
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!valid || busy} onClick={() => void render(false)} className={control}>
          {busy ? 'Rendering…' : 'Preview frame'}
        </button>
        <button type="button" disabled={!valid || busy} onClick={() => void render(true)} className={control}>Download PNG</button>
      </div>
    </dialog>
  );
}
