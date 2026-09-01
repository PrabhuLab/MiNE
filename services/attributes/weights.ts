import type { RawEdge } from '@/store/useStore';

export interface WeightChannelMetadata {
  primary: boolean;
  secondary: boolean;
}

export function weightChannelMetadata(edges: RawEdge[]): WeightChannelMetadata {
  return {
    primary: edges.length > 0 && edges.every((edge) => Number.isFinite(Number(edge.weight_raw))),
    secondary: edges.some((edge) => edge.weight_secondary !== undefined && Number.isFinite(Number(edge.weight_secondary))),
  };
}

export function hasSecondaryWeightChannel(edges: RawEdge[]): boolean {
  return weightChannelMetadata(edges).secondary;
}
