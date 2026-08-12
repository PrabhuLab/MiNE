import type Graph from 'graphology';
import type Sigma from 'sigma';

export const SIGMA_CAMERA_MS = 200;

export function fitSigmaNodeSet(
  sigma: Sigma | null,
  graph: Graph,
  container: HTMLDivElement | null,
  nodeIds: string[],
  duration = SIGMA_CAMERA_MS,
) {
  if (!sigma || !graph || !container) return;
  sigma.resize();
  const { width, height } = sigma.getDimensions();
  if (width <= 0 || height <= 0) return;

  const camera = sigma.getCamera();
  if (!nodeIds?.length) {
    camera.animate({ x: 0.5, y: 0.5, ratio: 1, angle: 0 }, { duration });
    return;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let validCount = 0;

  for (const id of nodeIds) {
    if (!graph.hasNode(id)) continue;
    const rawX = Number(graph.getNodeAttribute(id, 'x'));
    const rawY = Number(graph.getNodeAttribute(id, 'y'));
    if (!isFinite(rawX) || !isFinite(rawY)) continue;
    const viewportPoint = sigma.graphToViewport({ x: rawX, y: rawY });
    if (!isFinite(viewportPoint.x) || !isFinite(viewportPoint.y)) continue;
    minX = Math.min(minX, viewportPoint.x);
    maxX = Math.max(maxX, viewportPoint.x);
    minY = Math.min(minY, viewportPoint.y);
    maxY = Math.max(maxY, viewportPoint.y);
    validCount++;
  }

  if (validCount === 0 || minX === Infinity || !isFinite(minX) || !isFinite(minY)) {
    camera.animate({ x: 0.5, y: 0.5, ratio: 1, angle: 0 }, { duration });
    return;
  }

  const framedCenter = sigma.viewportToFramedGraph({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
  if (validCount === 1) {
    camera.animate({ x: framedCenter.x, y: framedCenter.y, ratio: 0.25, angle: 0 }, { duration });
    return;
  }

  const currentRatio = camera.ratio;
  if (!isFinite(currentRatio) || currentRatio <= 0) {
    camera.animate({ x: framedCenter.x, y: framedCenter.y, ratio: 0.5, angle: 0 }, { duration });
    return;
  }

  const stagePadding = Number(sigma.getSetting('stagePadding')) || 0;
  const availableWidth = Math.max(1, (width - stagePadding * 2) * 0.75);
  const availableHeight = Math.max(1, (height - stagePadding * 2) * 0.75);
  let targetRatio = Math.max(
    (Math.abs(maxX - minX) / availableWidth) * currentRatio,
    (Math.abs(maxY - minY) / availableHeight) * currentRatio,
  );
  if (!isFinite(targetRatio) || targetRatio <= 0) targetRatio = 0.5;
  camera.animate(
    { x: framedCenter.x, y: framedCenter.y, ratio: camera.getBoundedRatio(targetRatio), angle: 0 },
    { duration },
  );
}
