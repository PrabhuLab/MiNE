import type Sigma from 'sigma';
import { zoomTransform } from 'd3';
import { exportImageDimensions, frameScale, MAX_RASTER_PIXELS, MAX_RASTER_SIDE, validExportDimensions, validExportResolution, type ExportCamera, type ExportFrame } from '@/services/graphIO/exportFrame';
import { rasterizeGraphSvg } from './exportUtils';

export type CreateSigmaExportRenderer = (container: HTMLElement) => Sigma;

export function captureExportCamera(frame: ExportFrame, svg: SVGSVGElement | null, sigma: Sigma | null): ExportCamera {
  if (!validExportDimensions(frame)) throw new Error('Enter a valid export width and height.');
  if (sigma) {
    const viewport = sigma.getDimensions();
    if (viewport.width <= 0 || viewport.height <= 0) throw new Error('The graph viewport is not available.');
    const center = sigma.viewportToGraph({ x: viewport.width / 2, y: viewport.height / 2 });
    return {
      renderer: 'sigma', ...center, angle: sigma.getCamera().getState().angle,
      pixelsPerUnit: sigma.getGraphToViewportRatio() * frameScale(frame, viewport),
    };
  }
  if (!svg?.querySelector('.zoom-group')) throw new Error('Open the Graph tab and wait for the graph to render.');
  const viewport = svg.getBoundingClientRect();
  if (viewport.width <= 0 || viewport.height <= 0) throw new Error('The graph viewport is not available.');
  const zoom = zoomTransform(svg);
  const [x, y] = zoom.invert([viewport.width / 2, viewport.height / 2]);
  return { renderer: 'd3', x, y, angle: 0, pixelsPerUnit: zoom.k * frameScale(frame, viewport) };
}

export async function rasterizeFixedFrame(
  frame: ExportFrame & { camera: ExportCamera }, format: 'png' | 'jpeg', isDarkMode: boolean,
  svg: SVGSVGElement | null, createSigmaRenderer: CreateSigmaExportRenderer | null,
): Promise<Blob> {
  if (!validExportResolution(frame)) throw new Error('Choose a smaller resolution for this frame size.');
  if (!Number.isFinite(frame.camera.pixelsPerUnit) || frame.camera.pixelsPerUnit <= 0) throw new Error('The graph camera is unavailable.');
  const { camera } = frame;
  if (camera.renderer === 'd3') {
    if (!svg) throw new Error('Open the Graph tab with D3 to use this locked frame.');
    return rasterizeGraphSvg(svg, format, isDarkMode, frame);
  }
  if (!createSigmaRenderer) throw new Error('Open the Graph tab with Sigma to use this locked frame.');

  await document.fonts.ready;
  const { width, height } = exportImageDimensions(frame);
  // Render a larger Sigma stage so automatic labels have more room. The
  // stage already uses device pixels, so account for that before allocating.
  const pixelRatio = window.devicePixelRatio || 1;
  const requestedScale = frame.resolutionScale ?? 1;
  const stageScale = requestedScale === 1 ? 1 : Math.min(
    requestedScale,
    MAX_RASTER_SIDE / (Math.max(frame.width, frame.height) * pixelRatio),
    Math.sqrt(MAX_RASTER_PIXELS / (frame.width * frame.height)) / pixelRatio,
  );
  const container = document.createElement('div');
  container.style.cssText = `position:fixed;right:101%;top:0;width:${frame.width * stageScale}px;height:${frame.height * stageScale}px;pointer-events:none`;
  document.body.append(container);
  let renderer: Sigma | undefined;
  try {
    renderer = createSigmaRenderer(container);
    const target = renderer;
    target.getCamera().setState({ angle: camera.angle, ratio: 1 });
    target.refresh();
    const center = target.graphToFramedGraph({ x: camera.x, y: camera.y });
    const ratio = target.getGraphToViewportRatio() / (camera.pixelsPerUnit * stageScale);
    target.getCamera().setState({ ...center, ratio });
    target.refresh();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the export canvas.');
    if (format === 'jpeg') {
      context.fillStyle = isDarkMode ? '#141414' : '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(target.getStageCanvas(), 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/${format}`, 0.95));
    if (!blob) throw new Error('Could not encode the fixed-size frame. Try smaller dimensions.');
    return blob;
  } finally {
    renderer?.kill();
    container.remove();
  }
}
