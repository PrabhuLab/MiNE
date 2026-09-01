import type { CustomAttributeMetadata, CustomAttributeType } from '@/store/useStore';

export type AttributeScope = 'node' | 'edge' | 'graph';
export type AttributeOrigin = 'topology' | 'uploaded' | 'metric' | 'community';

export interface AttributeDescriptor {
  name: string;
  label: string;
  scope: AttributeScope;
  origin: AttributeOrigin;
  semanticType: CustomAttributeType;
  numeric: boolean;
  categorical: boolean;
  presentCount: number;
  resultOf?: string;
}

export const isNumericSemanticType = (type: CustomAttributeType): boolean =>
  type === 'discrete' || type === 'continuous';

export const isCategoricalSemanticType = (type: CustomAttributeType): boolean =>
  type === 'binary' || type === 'nominal' || type === 'ordinal';

export function descriptorFromMetadata(
  metadata: CustomAttributeMetadata,
  records: Array<Record<string, unknown>>,
): AttributeDescriptor {
  const semanticType = metadata.selectedType;
  return {
    name: metadata.name,
    label: metadata.label || metadata.name,
    scope: metadata.scope,
    origin: metadata.origin || 'uploaded',
    semanticType,
    numeric: isNumericSemanticType(semanticType),
    categorical: isCategoricalSemanticType(semanticType),
    presentCount: metadata.presentCount ?? records.reduce((count, record) => {
      const value = record[metadata.name];
      return count + (value === undefined || value === null || value === '' ? 0 : 1);
    }, 0),
    resultOf: metadata.resultOf,
  };
}

export function buildAttributeRegistry(options: {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  metadata: CustomAttributeMetadata[];
}): AttributeDescriptor[] {
  return options.metadata
    .map((entry) => descriptorFromMetadata(entry, entry.scope === 'node' ? options.nodes : options.edges))
    .filter((descriptor) => descriptor.presentCount > 0);
}

export const nodeColorDescriptors = (registry: AttributeDescriptor[]) =>
  registry.filter((descriptor) => descriptor.scope === 'node');

export const nodeSizeDescriptors = (registry: AttributeDescriptor[]) =>
  registry.filter((descriptor) => descriptor.scope === 'node');

export const edgeColorDescriptors = (registry: AttributeDescriptor[]) =>
  registry.filter((descriptor) => descriptor.scope === 'edge');

export const edgeWeightDescriptors = (registry: AttributeDescriptor[]) =>
  registry.filter((descriptor) => descriptor.scope === 'edge');

export const graphMetricDescriptors = (registry: AttributeDescriptor[]) =>
  registry.filter((descriptor) => descriptor.scope === 'graph');

export function resultMetadata(options: {
  name: string;
  label: string;
  scope: 'node' | 'edge';
  semanticType: CustomAttributeType;
  origin?: 'metric' | 'community';
  resultOf?: string;
  presentCount: number;
}): CustomAttributeMetadata {
  return {
    name: options.name,
    label: options.label,
    scope: options.scope,
    detectedType: options.semanticType,
    selectedType: options.semanticType,
    origin: options.origin || 'metric',
    resultOf: options.resultOf,
    presentCount: options.presentCount,
    active: true,
    shown: false,
    edgeNodeTarget: 'source',
  };
}
