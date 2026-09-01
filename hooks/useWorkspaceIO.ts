import type { ChangeEvent, RefObject } from 'react';
import type Graph from 'graphology';
import type Sigma from 'sigma';
import { resetCommunityColorCache } from '@/lib/communityUtils';
import { downloadBlobAsFile, downloadStringAsFile, exportElementAsImage, exportImage, exportSvg } from '@/lib/exportUtils';
import {
  buildAllInOne,
  buildCsvZip,
  canonicalExportGraph,
  createMetricsBundle,
  writeGexf,
  writeGraphML,
  inferCustomEdgeAttributes,
  inferCustomNodeAttributes,
  mergeCustomAttributeMetadata,
  type WorkspaceSettingsDocument,
} from '@/lib/graphIO';
import { useStore, type RawEdge, type RawNode, type WorkspaceFilters } from '@/store/useStore';
import { ENGINE_POLICY_VERSION, effectiveComputationEngine, effectiveRenderer } from '@/services/engines/policy';
import { migrateComputationPreference, migrateRendererPreference, migrateWorkspaceFilters } from '@/services/graphIO/migrations';
import { weightChannelMetadata } from '@/services/attributes/weights';

interface WorkspaceIOOptions {
  graph: Graph;
  rawNodes: RawNode[];
  rawEdges: RawEdge[];
  directed: boolean;
  bipartite: boolean;
  isDarkMode: boolean;
  projectName: string;
  useSigma: boolean;
  sigmaRendererRef: RefObject<Sigma | null>;
  communityMap: Record<string, string>;
  networkMetrics: any[];
  nodeMetrics: any[];
  edgeMetrics: any[];
  graphMetrics: Record<string, any>;
  metricValidity: Record<string, any>;
  metricsToRun: Record<string, boolean>;
  setMetricsToRun: (updater: (current: any) => any) => void;
  setAppliedFilters: (filters: WorkspaceFilters) => void;
  setRefreshKey: (updater: (key: number) => number) => void;
  closeExportMenu: () => void;
}

export function useWorkspaceIO(options: WorkspaceIOOptions) {
  const createWorkspaceSettings = (): WorkspaceSettingsDocument => {
    const state = useStore.getState();
    return {
      format: 'workspace-settings',
      version: 1,
      projectName: options.projectName,
      computeEngine: state.computeEngine,
      rendererEngine: state.rendererEngine,
      enginePolicyVersion: ENGINE_POLICY_VERSION,
      effectiveEngine: effectiveComputationEngine(options.rawNodes.length, options.rawEdges.length, state.computeEngine),
      effectiveRenderer: effectiveRenderer(state.rendererEngine, effectiveComputationEngine(options.rawNodes.length, options.rawEdges.length, state.computeEngine)),
      graphMode: {
        directed: options.directed,
        bipartite: options.bipartite,
        weighted: options.rawEdges.some((edge) => Number(edge.weight_raw) !== 1 || (edge.weight_secondary !== undefined && Number(edge.weight_secondary) !== 1)),
      },
      filters: state.filters,
      appearance: {
        isDarkMode: options.isDarkMode,
        showNodeLabels: state.showNodeLabels,
        showArrowheads: state.showArrowheads,
        communityMap: options.communityMap,
        customAttributes: state.customAttributes,
        legendColorOverrides: state.legendColorOverrides,
        isLegendMinimized: state.isLegendMinimized,
      },
      visibility: {
        hiddenLegendItems: state.hiddenLegendItems,
        isolatedLegendItem: state.isolatedLegendItem,
        isolatedCommunityId: state.isolatedCommunityId,
      },
      calculations: { selected: options.metricsToRun },
      layout: { livePhysics: state.filters.livePhysics, forceStrength: state.filters.forceStrength },
    };
  };

  const handleImportWorkspace = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const json = JSON.parse(loadEvent.target?.result as string);
        const currentSettings = json.format === 'workspace-settings' && json.version === 1;
        const legacySettings = json.type === 'workspace_state';
        if (!currentSettings && !legacySettings) throw new Error('Invalid Workspace Settings JSON.');
        resetCommunityColorCache();
        const settings: any = currentSettings ? json : {
          projectName: json.projectName,
          rendererEngine: json.rendererEngine || json.renderer,
          graphMode: { directed: json.directed, bipartite: json.bipartite },
          filters: json.filters,
          appearance: {
            isDarkMode: json.isDarkMode,
            showNodeLabels: json.showNodeLabels,
            showArrowheads: json.showArrowheads,
            communityMap: json.communityMap,
            customAttributes: json.customAttributes,
          },
          visibility: {},
          calculations: { selected: {} },
        };
        const nextFilters = {
          ...useStore.getState().filters,
          ...(settings.filters || {}),
          edgeFilter: migrateWorkspaceFilters(settings.filters, options.rawEdges),
          weightFilters: undefined,
        };
        useStore.setState({
          projectName: settings.projectName || options.projectName,
          directed: settings.graphMode?.directed ?? options.directed,
          bipartite: settings.graphMode?.bipartite ?? options.bipartite,
          isDarkMode: settings.appearance?.isDarkMode ?? useStore.getState().isDarkMode,
          computeEngine: migrateComputationPreference(settings, options.rawNodes.length, options.rawEdges.length),
          rendererEngine: migrateRendererPreference(settings),
          filters: nextFilters,
          communityMap: settings.appearance?.communityMap || {},
          customAttributes: mergeCustomAttributeMetadata(
            [...inferCustomNodeAttributes(options.rawNodes), ...inferCustomEdgeAttributes(options.rawEdges)],
            settings.appearance?.customAttributes || useStore.getState().customAttributes,
          ),
          legendColorOverrides: settings.appearance?.legendColorOverrides || {},
          showNodeLabels: settings.appearance?.showNodeLabels ?? useStore.getState().showNodeLabels,
          showArrowheads: settings.appearance?.showArrowheads ?? useStore.getState().showArrowheads,
          hiddenLegendItems: settings.visibility?.hiddenLegendItems || [],
          isolatedLegendItem: settings.visibility?.isolatedLegendItem || null,
          isolatedCommunityId: settings.visibility?.isolatedCommunityId || null,
          isLegendMinimized: settings.appearance?.isLegendMinimized ?? false,
        });
        options.setAppliedFilters(nextFilters);
        options.setMetricsToRun((current) => ({ ...current, ...(settings.calculations?.selected || {}) }));
        options.setRefreshKey((key) => key + 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        window.alert(`Failed to import workspace: ${message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleExport = async (format: string) => {
    options.closeExportMenu();
    if (format === 'svg') {
      exportSvg(document.getElementById('network-graph-svg') as SVGSVGElement | null, `${options.projectName}.svg`);
      return;
    }
    if (format === 'legend') {
      try {
        await exportElementAsImage(document.getElementById('graph-legend'), `${options.projectName}_legend.png`, options.isDarkMode);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Legend image export failed:', error);
        window.alert(`Legend image export failed: ${message}`);
      }
      return;
    }
    if (format === 'png' || format === 'jpeg') {
      if (options.useSigma && options.sigmaRendererRef.current) {
        try {
          const { toBlob } = await import('@sigma/export-image');
          const blob = await toBlob(options.sigmaRendererRef.current, {
            format,
            fileName: options.projectName,
            backgroundColor: options.isDarkMode ? '#141414' : '#ffffff',
          });
          downloadBlobAsFile(blob, `${options.projectName}.${format === 'jpeg' ? 'jpg' : 'png'}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('Sigma image export failed:', error);
          window.alert(`Sigma image export failed: ${message}`);
        }
      } else {
        exportImage(
          document.getElementById('network-graph-svg') as SVGSVGElement | null,
          format,
          `${options.projectName}.${format === 'jpeg' ? 'jpg' : 'png'}`,
          options.isDarkMode,
        );
      }
      return;
    }

    const metrics = createMetricsBundle(
      options.networkMetrics,
      options.nodeMetrics,
      options.edgeMetrics,
      options.graphMetrics,
      { selectedMetrics: options.metricsToRun, validity: options.metricValidity, attributeDescriptors: useStore.getState().customAttributes },
    );
    const exportGraph = canonicalExportGraph(
      options.graph,
      options.rawNodes,
      options.rawEdges,
      metrics,
      options.directed,
      options.bipartite,
    );
    if (format === 'json') downloadStringAsFile(JSON.stringify(exportGraph.export(), null, 2), `${options.projectName}.json`, 'application/json');
    else if (format === 'graphml') downloadStringAsFile(writeGraphML(exportGraph), `${options.projectName}.graphml`, 'application/graphml+xml');
    else if (format === 'gexf') downloadStringAsFile(writeGexf(exportGraph), `${options.projectName}.gexf`, 'application/gexf+xml');
    else if (format === 'csvzip') downloadBlobAsFile(await buildCsvZip(exportGraph, metrics), `${options.projectName}_network.zip`);
    else if (format === 'settings') downloadStringAsFile(JSON.stringify(createWorkspaceSettings(), null, 2), `${options.projectName}_workspace_settings.json`, 'application/json');
    else if (format === 'allinone') downloadStringAsFile(JSON.stringify(buildAllInOne(exportGraph, metrics, createWorkspaceSettings()), null, 2), `${options.projectName}_all_in_one.json`, 'application/json');
  };

  return { handleImportWorkspace, handleExport };
}
