import { isSecondaryNode } from '../../../services/graphPresentation/visibility.ts';

interface EdgePathNode {
  x: number;
  y: number;
  currentRadius?: number;
  partition?: string | number;
  bipartite?: string | number;
  set?: unknown;
  partitionIndex?: number;
  type?: string;
}

/** Trim directed curves to circular or square node boundaries. */
export function edgePath(
  d: { source: EdgePathNode; target: EdgePathNode },
  directed: boolean,
  bipartite: boolean,
): string {
  const sx = d.source.x;
  const sy = d.source.y;
  const tx = d.target.x;
  const ty = d.target.y;

  if (directed) {
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      // A quadratic curve gives a stable tangent at each endpoint. Trim
      // both ends along those tangents so the arrow tip terminates at
      // the target node boundary instead of its center.
      const normalX = -dy / dist;
      const normalY = dx / dist;
      const bend = Math.min(80, Math.max(12, dist * 0.2));
      const controlX = (sx + tx) / 2 + normalX * bend;
      const controlY = (sy + ty) / 2 + normalY * bend;

      const sourceTangentX = controlX - sx;
      const sourceTangentY = controlY - sy;
      const sourceTangentLength = Math.hypot(sourceTangentX, sourceTangentY) || 1;
      const targetTangentX = tx - controlX;
      const targetTangentY = ty - controlY;
      const targetTangentLength = Math.hypot(targetTangentX, targetTangentY) || 1;
      const boundaryDistance = (node: EdgePathNode, tangentX: number, tangentY: number, tangentLength: number) => {
        const radius = Math.max(0, Number(node.currentRadius) || 0) + 1;
        const isSquare = isSecondaryNode(node, bipartite);
        if (!isSquare) return radius;
        const unitX = Math.abs(tangentX / tangentLength);
        const unitY = Math.abs(tangentY / tangentLength);
        return radius / Math.max(unitX, unitY, 0.0001);
      };
      const sourceRadius = boundaryDistance(d.source, sourceTangentX, sourceTangentY, sourceTangentLength);
      const targetRadius = boundaryDistance(d.target, targetTangentX, targetTangentY, targetTangentLength);
      const startX = sx + (sourceTangentX / sourceTangentLength) * sourceRadius;
      const startY = sy + (sourceTangentY / sourceTangentLength) * sourceRadius;
      const endX = tx - (targetTangentX / targetTangentLength) * targetRadius;
      const endY = ty - (targetTangentY / targetTangentLength) * targetRadius;

      return `M${startX},${startY}Q${controlX},${controlY} ${endX},${endY}`;
    }
  }
  return `M${sx},${sy}L${tx},${ty}`;
}
