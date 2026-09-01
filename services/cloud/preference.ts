import type { ComputeEnginePreference } from './config';
import type { RendererPreference } from '../engines/policy.ts';

export interface ComputeEnginePreferenceState {
  computeEngine: ComputeEnginePreference;
  rendererEngine: RendererPreference;
}

export function normalizeComputeEnginePreference(value: unknown): ComputeEnginePreference {
  return value === 'cloud' ? 'cloud' : 'browser';
}

export function normalizeRendererPreference(value: unknown): RendererPreference {
  return value === 'd3' || value === 'sigma' ? value : 'auto';
}

export function persistedComputeEnginePreference(state: ComputeEnginePreferenceState): ComputeEnginePreferenceState {
  return {
    computeEngine: normalizeComputeEnginePreference(state.computeEngine),
    rendererEngine: normalizeRendererPreference(state.rendererEngine),
  };
}

export function mergeComputeEnginePreference<T extends ComputeEnginePreferenceState>(persisted: unknown, current: T): T {
  const candidate = persisted as Partial<ComputeEnginePreferenceState> | null;
  return {
    ...current,
    computeEngine: normalizeComputeEnginePreference(candidate?.computeEngine),
    rendererEngine: normalizeRendererPreference(candidate?.rendererEngine),
  };
}
