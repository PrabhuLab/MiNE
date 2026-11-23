import type { Renderer } from '../engines/policy';

export interface ExportCamera {
  renderer: Renderer;
  x: number;
  y: number;
  pixelsPerUnit: number;
  angle: number;
}

export interface ExportFrame {
  width: number;
  height: number;
  resolutionScale?: number;
  camera?: ExportCamera;
}

export const DEFAULT_EXPORT_FRAME: ExportFrame = { width: 1920, height: 1080 };
export const MAX_EXPORT_SIDE = 4096;
export const MAX_RASTER_SIDE = 16384;
export const MAX_RASTER_PIXELS = 24_000_000;
export const EXPORT_RESOLUTION_SCALES = Array.from({ length: 10 }, (_, index) => index + 1);

export function validExportDimensions({ width, height }: Pick<ExportFrame, 'width' | 'height'>): boolean {
  return [width, height].every(value => Number.isInteger(value) && value >= 1 && value <= MAX_EXPORT_SIDE);
}

export function exportImageDimensions({ width, height, resolutionScale = 1 }: ExportFrame) {
  return { width: width * resolutionScale, height: height * resolutionScale };
}

export function validExportResolution(frame: ExportFrame): boolean {
  const scale = frame.resolutionScale ?? 1;
  const { width, height } = exportImageDimensions(frame);
  return validExportDimensions(frame) && EXPORT_RESOLUTION_SCALES.some(value => value === scale)
    && Math.max(width, height) <= MAX_RASTER_SIDE && width * height <= MAX_RASTER_PIXELS;
}

export function restoreExportFrame(frame?: ExportFrame): ExportFrame {
  if (!frame || !validExportDimensions(frame)) return DEFAULT_EXPORT_FRAME;
  const { width, height, camera } = frame;
  const size = { width, height, ...(frame.resolutionScale && validExportResolution(frame) ? { resolutionScale: frame.resolutionScale } : {}) };
  if (!camera || !['d3', 'sigma'].includes(camera.renderer)
    || ![camera.x, camera.y, camera.angle, camera.pixelsPerUnit].every(Number.isFinite)
    || camera.pixelsPerUnit <= 0) return size;
  return { ...size, camera };
}

export function frameScale(frame: ExportFrame, viewport: { width: number; height: number }): number {
  return Math.min(frame.width / viewport.width, frame.height / viewport.height);
}

export function svgFrameTransform(frame: ExportFrame & { camera: ExportCamera }): string {
  const { x, y, pixelsPerUnit: scale } = frame.camera;
  return `translate(${frame.width / 2 - x * scale},${frame.height / 2 - y * scale}) scale(${scale})`;
}
