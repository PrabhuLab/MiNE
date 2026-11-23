import type { ChangeEvent, RefObject } from 'react';
import type Graph from 'graphology';
import type Sigma from 'sigma';
import { resetCommunityColorCache, savedCommunityColors } from '@/lib/communityUtils';
import { downloadBlobAsFile, downloadStringAsFile, exportElementAsImage, exportImage, exportSvg, viewportRasterDimensions } from '@/lib/exportUtils';
import { captureExportCamera, rasterizeFixedFrame, type CreateSigmaExportRenderer } from '@/lib/fixedFrameExport';
import { restoreExportFrame, type ExportFrame } from '@/services/graphIO/exportFrame';
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
  createSigmaExportRendererRef: RefObject<CreateSigmaExportRenderer | null>;
  showIsolates: boolean;
  appliedFilters: WorkspaceFilters;
  getLivePosition?: (id: string) => { x: number; y: number } | undefined;
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
  const graphSvg = () => document.getElementById('network-graph-svg') as SVGSVGElement | null;
  const captureFrame = (frame: ExportFrame) => captureExportCamera(frame, graphSvg(), options.sigmaRendererRef.current);
  const buildFrameImage = (frame: ExportFrame, format: 'png' | 'jpeg' = 'png') => rasterizeFixedFrame(
    { ...frame, camera: frame.camera ?? captureFrame(frame) }, format, options.isDarkMode,
    graphSvg(), options.createSigmaExportRendererRef.current,
  );

  const createWorkspaceSettings = (): WorkspaceSettingsDocument => {
    const state = useStore.getState();
    const filters = state.exportFrame.camera && !state.filters.liveUpdate ? options.appliedFilters : state.filters;
    const livePhysics = !state.exportFrame.camera && filters.livePhysics;
    return {
      format: 'workspace-settings',
      version: 1,
      projectName: options.projectName,
      computeEngine: state.computeEngine,
      rendererEngine: state.rendererEngine,
      enginePolicyVersion: ENGINE_POLICY_VERSION,
      effectiveEngine: effectiveComputationEngine(options.rawNodes.length, options.rawEdges.length, state.computeEngine),
      effectiveRenderer: effectiveRenderer(state.rendererEngine, effectiveComputationEngine(options.rawNodes.length, options.rawEdges.length, state.computeEngine), options.rawNodes.length, options.rawEdges.length),
      graphMode: {
        directed: options.directed,
        bipartite: options.bipartite,
        weighted: options.rawEdges.some((edge) => Number(edge.weight_raw) !== 1 || (edge.weight_secondary !== undefined && Number(edge.weight_secondary) !== 1)),
      },
      filters: { ...filters, livePhysics },
      appearance: {
        isDarkMode: options.isDarkMode,
        showNodeLabels: state.showNodeLabels,
        showArrowheads: state.showArrowheads,
        communityMap: options.communityMap,
        communityColors: savedCommunityColors(),
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
      layout: { livePhysics, forceStrength: filters.forceStrength, showIsolates: options.showIsolates },
      exportFrame: state.exportFrame,
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
        resetCommunityColorCache(settings.appearance?.communityColors);
        const exportFrame = restoreExportFrame(settings.exportFrame);
        useStore.setState({
          projectName: settings.projectName || options.projectName,
          directed: settings.graphMode?.directed ?? options.directed,
          bipartite: settings.graphMode?.bipartite ?? options.bipartite,
          isDarkMode: settings.appearance?.isDarkMode ?? useStore.getState().isDarkMode,
          computeEngine: migrateComputationPreference(settings, options.rawNodes.length, options.rawEdges.length),
          rendererEngine: exportFrame.camera?.renderer ?? migrateRendererPreference(settings),
          filters: nextFilters,
          communityMap: settings.appearance?.communityMap || {},
          customAttributes: mergeCustomAttributeMetadata(
            [...inferCustomNodeAttributes(options.rawNodes), ...inferCustomEdgeAttributes(options.rawEdges)],
            settings.appearance?.customAttributes || useStore.getState().customAttributes,
          ),
          legendColorOverrides: settings.appearance?.legendColorOverrides || {},
          exportFrame,
          showIsolates: settings.layout?.showIsolates ?? useStore.getState().showIsolates,
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
    if (format === 'blockmodels') {
      downloadStringAsFile(JSON.stringify({
        format: 'mine-block-model-runs', version: 1, projectName: options.projectName,
        runs: useStore.getState().communityRuns,
      }, null, 2), `${options.projectName}_block_models.json`, 'application/json');
      return;
    }
    if (format === 'svg') {
      exportSvg(document.getElementById('network-graph-svg') as SVGSVGElement | null, `${options.projectName}.svg`);
      return;
    }
    if (format === 'legend') {
      try {
        await exportElementAsImage(document.getElementById('graph-legend'), `${options.projectName}_legend.png`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Legend image export failed:', error);
        window.alert(`Legend image export failed: ${message}`);
      }
      return;
    }
    if (format === 'png' || format === 'jpeg') {
      try {
        const frame = useStore.getState().exportFrame;
        if (frame.camera) {
          const extension = format === 'jpeg' ? 'jpg' : format;
          downloadBlobAsFile(await buildFrameImage(frame, format), `${options.projectName}.${extension}`);
        } else if (options.useSigma && options.sigmaRendererRef.current) {
          const renderer = options.sigmaRendererRef.current;
          const dimensions = renderer.getDimensions();
          const cameraState = renderer.getCamera().getState();
          const pixelRatio = window.devicePixelRatio || 1;
          const rasterDimensions = viewportRasterDimensions(dimensions.width, dimensions.height, pixelRatio);
          const { toBlob } = await import('@sigma/export-image');
          let blob: Blob | null = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              blob = await toBlob(renderer, {
                format,
                fileName: options.projectName,
                backgroundColor: format === 'png' ? 'transparent' : options.isDarkMode ? '#141414' : '#ffffff',
                // Sigma applies device pixel ratio internally; halve each
                // dimension on retries to reduce canvas memory by 75%.
                width: Math.max(1, Math.floor(rasterDimensions.exportWidth / 2 ** attempt)) / pixelRatio,
                height: Math.max(1, Math.floor(rasterDimensions.exportHeight / 2 ** attempt)) / pixelRatio,
                cameraState,
              });
              break;
            } catch (error) {
              if (attempt === 3 || (error instanceof DOMException && error.name === 'SecurityError')) throw error;
            }
          }
          if (!blob) throw new Error('The graph image could not be encoded.');
          downloadBlobAsFile(blob, `${options.projectName}.${format === 'jpeg' ? 'jpg' : 'png'}`);
        } else {
          await exportImage(
            document.getElementById('network-graph-svg') as SVGSVGElement | null,
            format,
            `${options.projectName}.${format === 'jpeg' ? 'jpg' : 'png'}`,
            options.isDarkMode,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Graph image export failed:', error);
        window.alert(`Graph image export failed: ${message}`);
      }
      return;
    }

    const metrics = createMetricsBundle(
      options.networkMetrics,
      options.nodeMetrics,
      options.edgeMetrics,
      options.graphMetrics,
      { selectedMetrics: options.metricsToRun, validity: options.metricValidity, attributeDescriptors: useStore.getState().customAttributes,
        communityRuns: useStore.getState().communityRuns },
    );
    const exportGraph = canonicalExportGraph(
      options.graph,
      options.rawNodes,
      options.rawEdges,
      metrics,
      options.directed,
      options.bipartite,
      format === 'allinone' ? options.getLivePosition : undefined,
    );
    if (format === 'json') downloadStringAsFile(JSON.stringify(exportGraph.export(), null, 2), `${options.projectName}.json`, 'application/json');
    else if (format === 'graphml') downloadStringAsFile(writeGraphML(exportGraph), `${options.projectName}.graphml`, 'application/graphml+xml');
    else if (format === 'gexf') downloadStringAsFile(writeGexf(exportGraph), `${options.projectName}.gexf`, 'application/gexf+xml');
    else if (format === 'csvzip') downloadBlobAsFile(await buildCsvZip(exportGraph, metrics), `${options.projectName}_network.zip`);
    else if (format === 'settings') downloadStringAsFile(JSON.stringify(createWorkspaceSettings(), null, 2), `${options.projectName}_workspace_settings.json`, 'application/json');
    else if (format === 'allinone') downloadStringAsFile(JSON.stringify(buildAllInOne(exportGraph, metrics, createWorkspaceSettings()), null, 2), `${options.projectName}_all_in_one.json`, 'application/json');
  };

  return { handleImportWorkspace, handleExport, captureFrame, buildFrameImage };
}
