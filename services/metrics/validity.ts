import type { MetricValidity } from './types';

export function staleCalculationIds(validityById: Record<string, MetricValidity>, graphRevision: string, filterRevision: string): string[] {
  return Object.entries(validityById)
    .filter(([, validity]) => Boolean(validity) && validity.graphRevision === graphRevision && validity.filterRevision !== filterRevision)
    .map(([id]) => id);
}
