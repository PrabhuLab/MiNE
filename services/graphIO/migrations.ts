import type { RawEdge, WorkspaceFilters } from '@/store/useStore';
import { legacyRendererToPreference, type ComputationPreference, type RendererPreference } from '../engines/policy.ts';

export function migrateWorkspaceFilters(input: Partial<WorkspaceFilters> | undefined, edges: RawEdge[]): WorkspaceFilters['edgeFilter'] {
  if (input?.edgeFilter) return input.edgeFilter;
  const first = input?.weightFilters?.[0];
  if (!first || String(first.type).startsWith('node:')) return null;
  const attribute = String(first.type).replace(/^edge:/, '');
  const values = edges.map((edge) => Number(edge[attribute])).filter(Number.isFinite);
  if (!values.length) return null;
  return { attribute, min: Number(first.cutoff), max: Math.max(...values) };
}

export function migrateComputationPreference(
  input: { computeEngine?: unknown; rendererEngine?: 'auto' | 'd3' | 'sigma'; renderer?: 'auto' | 'd3' | 'sigma' } | null | undefined,
  nodeCount: number,
  edgeCount: number,
): ComputationPreference {
  if (input?.computeEngine === 'browser' || input?.computeEngine === 'cloud') return input.computeEngine;
  return legacyRendererToPreference(input?.rendererEngine || input?.renderer, nodeCount, edgeCount);
}

export function migrateRendererPreference(
  input: { rendererEngine?: unknown; renderer?: unknown } | null | undefined,
): RendererPreference {
  const candidate = input?.rendererEngine ?? input?.renderer;
  return candidate === 'd3' || candidate === 'sigma' ? candidate : 'auto';
}
