import type { RawNode, RawEdge, CustomAttributeMetadata } from '../../store/useStore';
import { getCommunityColor, type CommunityDisplayResult } from '../../lib/communityUtils.ts';
import { isCategoricalSemanticType } from '../attributes/registry.ts';
import { legendItemId } from '../graphPresentation/legendVisibility.ts';
import type { LegendCategories } from './types';

interface LegendCategoryOptions {
  nodes: RawNode[];
  edges: RawEdge[];
  communityDisplay: CommunityDisplayResult;
  netMap: Map<string, Record<string, any>>;
  nodeColorBase: string;
  edgeColorBase: string;
  edgeColorNodeMetric: string;
  edgeColorNodeTarget: 'source' | 'target';
  customAttributes: CustomAttributeMetadata[];
  legendColorOverrides: Record<string, string>;
  customNodeAttribute?: string;
  typeColorScale: (value: string) => string;
}

/** Build categorical legend entries from the selected visual channels. */
export function buildLegendCategories({
  nodes,
  edges,
  communityDisplay,
  netMap,
  nodeColorBase,
  edgeColorBase,
  edgeColorNodeMetric,
  edgeColorNodeTarget,
  customAttributes,
  legendColorOverrides,
  customNodeAttribute,
  typeColorScale,
}: LegendCategoryOptions): LegendCategories[] {
  const { displayMap } = communityDisplay;
  const typeLabels = Array.from(new Set(nodes.map((node) => node.type).filter(Boolean))) as string[];
  const communitiesShown = nodeColorBase === 'louvain' || nodeColorBase === 'community'
    || (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric === 'louvain');
  const communityColor = (rawId: string) => legendColorOverrides[`community:${rawId}`] ?? getCommunityColor(rawId);
  const sections: LegendCategories[] = [];
  if (
    communitiesShown &&
    Object.keys(communityDisplay.rawToDisplayMap).length > 0
  ) {
    const sortedDispIndices = Object.values(communityDisplay.rawToDisplayMap).sort((a, b) => a - b);
    sections.push({
      title: edgeColorBase === 'nodeMetric' && edgeColorNodeMetric === 'louvain'
        ? `Communities · Edge color from ${edgeColorNodeTarget} node`
        : 'Communities',
      items: sortedDispIndices.map((dispIdx) => {
        const rawId = communityDisplay.displayToRawMap[dispIdx];
        const color = communityColor(rawId);
        const memberNodes = nodes
          .filter((n) => displayMap[n.id] === dispIdx)
          .map((n) => n.label || n.name || n.id);

        return {
          label: `Community ${dispIdx}`,
          id: `community:${dispIdx}`,
          color,
          colorKey: `community:${rawId}`,
          nodes: memberNodes,
          nodeIds: nodes.filter((n) => displayMap[n.id] === dispIdx).map((n) => String(n.id)),
          edgeIds: [] as string[],
          allIds: sortedDispIndices.map((i) => `community:${i}`),
        };
      }),
    });
  } else if ((nodeColorBase === 'type' || (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric === 'type')) && typeLabels.length > 0) {
    sections.push({
      title: edgeColorBase === 'nodeMetric' && edgeColorNodeMetric === 'type'
        ? `Types · Edge color from ${edgeColorNodeTarget} node`
        : 'Types',
      items: typeLabels.map((label) => ({
        label,
        id: `type:${label}`,
        color: legendColorOverrides[`type:${label}`] ?? typeColorScale(label),
        colorKey: `type:${label}`,
        nodes: nodes.filter((n) => n.type === label).map((n) => n.label || n.name || n.id),
        nodeIds: nodes.filter((n) => n.type === label).map((n) => String(n.id)),
        edgeIds: [] as string[],
        allIds: typeLabels.map((t) => `type:${t}`),
      })),
    });
  }
  if (edgeColorBase === 'nodeMetric' && edgeColorNodeMetric.startsWith('custom:')) {
    const attribute = edgeColorNodeMetric.slice('custom:'.length);
    const metadata = customAttributes.find((item) => item.scope === 'node' && item.name === attribute);
    const valueForNode = (node: RawNode) => netMap.get(String(node.id))?.[attribute] ?? node[attribute];
    const values = Array.from(new Set(nodes.map(valueForNode).filter((value) => value !== undefined && value !== null && String(value).trim() !== '').map(String)));
    if (values.length && metadata && isCategoricalSemanticType(metadata.selectedType)) {
      sections.push({
        title: `Edge Color · ${attribute} (${edgeColorNodeTarget} node)`,
        items: values.map((value) => {
          const colorKey = `attribute:${attribute}=${value}`;
          return {
            label: value,
            id: legendItemId('node', attribute, value),
            color: legendColorOverrides[colorKey] ?? getCommunityColor(colorKey),
            colorKey,
            nodeIds: nodes.filter((node) => String(valueForNode(node)) === value).map((node) => String(node.id)),
            edgeIds: [] as string[],
            allIds: values.map((item) => legendItemId('node', attribute, item)),
          };
        }),
      });
    }
  }
  const addSelectedAttributeCategory = (scope: 'node' | 'edge', attribute: string, title: string) => {
    const entities = scope === 'node'
      ? nodes.map((node) => ({ ...node, ...(netMap.get(String(node.id)) || {}) }))
      : edges;
    const metadata = customAttributes.find((item) => item.scope === scope && item.name === attribute);
    const values = Array.from(new Set(entities.map((entity) => entity[attribute]).filter((value) => value !== undefined && value !== null && String(value).trim() !== '').map(String)));
    if (!values.length || !metadata || !isCategoricalSemanticType(metadata.selectedType)) return;
    sections.push({
      title,
      items: values.map((value) => {
        const colorKey = `attribute:${attribute}=${value}`;
        return {
          label: value,
          id: legendItemId(scope, attribute, value),
          color: legendColorOverrides[colorKey] ?? getCommunityColor(colorKey),
          colorKey,
          nodeIds: scope === 'node' ? entities.filter((node) => String(node[attribute]) === value).map((node) => String(node.id)) : [],
          edgeIds: scope === 'edge' ? edges.filter((edge) => String(edge[attribute]) === value).map((edge) => String(edge.key ?? `${edge.source}->${edge.target}`)) : [],
          allIds: values.map((item) => legendItemId(scope, attribute, item)),
        };
      }),
    });
  };
  if (nodeColorBase === 'custom' && customNodeAttribute) {
    addSelectedAttributeCategory('node', customNodeAttribute, `Node Color · ${customNodeAttribute}`);
  }
  if (edgeColorBase.startsWith('edge:')) {
    const attribute = edgeColorBase.slice('edge:'.length);
    addSelectedAttributeCategory('edge', attribute, `Edge Color · ${attribute}`);
  }
  return sections;
}
