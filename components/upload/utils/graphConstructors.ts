import { TopologyType, ColumnMappingState, ParsedDataState } from '../types';

export interface GraphNode {
  id: string;
  name: string;
  abundance: number;
  type?: string;
  community?: string;
  [key: string]: any;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight_raw: number;
  weight_secondary: number;
  [key: string]: any;
}

export function constructGraph(
  parsedData: ParsedDataState,
  format: string,
  mapping: ColumnMappingState,
  isDirected: boolean,
  topology: TopologyType,
  isWeighted: boolean
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const isFormatMatrix = ['Adjacency Matrix', 'Incidence Matrix', 'Single Weighted Adjacency Matrix', 'Single Adjacency Matrix'].includes(format);
  const isFormatEdgeList = ['Edge List', 'Weighted Edge List', 'Directed Edge List', 'Directed Weighted Edge List', 'Bipartite Edge List', 'Directed Bipartite Edge List'].includes(format);
  const isFormatDualMatrix = format === 'Dual Adjacency Matrix';
  const isFormatAdjList = format === 'Adjacency List';

  const {
    sourceCol,
    adjSourceCol,
    targetCol,
    weightRawCol,
    weightSecCol,
    nodeIdCol,
    nodeLabelCol,
    nodeTypeCol,
    nodePartitionCol,
    nodeCommunityCol,
    nodeAbundCol,
    rowHeadersCol,
    colHeadersRow,
    dataStartRow,
    dataStartCol,
  } = mapping;

  if (format === 'Standard JSON' && parsedData.rawNodes && parsedData.rawEdges) {
    const nodesMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const edgeSet = new Set<string>();

    parsedData.rawNodes.forEach((n: any, index: number) => {
      const id = String(n[nodeIdCol || 'id'] ?? n.id ?? `node_${index}`);
      const mappedType = nodeTypeCol ? n[nodeTypeCol] : n.type;
      const mappedPartition = nodePartitionCol ? n[nodePartitionCol] : n.partition;
      nodesMap.set(id, {
        ...n,
        id,
        name: n[nodeLabelCol || 'name'] || n['name'] || id,
        label: n[nodeLabelCol || 'label'] || n.label || n.name || id,
        abundance: parseFloat(n[nodeAbundCol || 'abundance'] || n['abundance']) || 10,
        ...(mappedType !== undefined && mappedType !== '' ? { type: mappedType } : {}),
        ...(mappedPartition !== undefined && mappedPartition !== '' ? { partition: mappedPartition } : {}),
        community: n[nodeCommunityCol || 'community'] || n['community'] || '',
      });
    });

    parsedData.rawEdges.forEach((e: any) => {
      const sourceId = e[sourceCol || 'source'] || e['source'];
      const targetId = e[targetCol || 'target'] || e['target'];
      if (!sourceId || !targetId) return;

      const edgeId = isDirected
        ? `${sourceId}->${targetId}`
        : sourceId < targetId
        ? `${sourceId}_${targetId}`
        : `${targetId}_${sourceId}`;
      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId);
        edges.push({
          ...e,
          source: sourceId,
          target: targetId,
          weight_raw: parseFloat(e[weightRawCol || 'weight'] || e['weight']) || 1,
          weight_secondary: parseFloat(e[weightSecCol || 'weight'] || e['weight']) || 1,
        });
      }
    });

    return { nodes: Array.from(nodesMap.values()), edges };
  }

  const nodesMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  try {
    const safeRowHeadersCol = typeof rowHeadersCol === 'number' ? rowHeadersCol : 0;
    const safeColHeadersRow = typeof colHeadersRow === 'number' ? colHeadersRow : 0;
    const safeDataStartRow = typeof dataStartRow === 'number' ? dataStartRow : 1;
    const safeDataStartCol = typeof dataStartCol === 'number' ? dataStartCol : 1;

    if (format === 'Incidence Matrix' && parsedData.matrix) {
      const matrix = parsedData.matrix;

      for (let col = safeDataStartCol; col < (matrix[safeColHeadersRow]?.length || 0); col++) {
        const colNodeId = String(matrix[safeColHeadersRow]?.[col] ?? '').trim();
        if (colNodeId) {
          nodesMap.set(colNodeId, { id: colNodeId, name: colNodeId, label: colNodeId, partition: 'B', abundance: 0 });
        }
      }

      for (let row = safeDataStartRow; row < matrix.length; row++) {
        if (!matrix[row] || matrix[row].length === 0) continue;
        const rowNodeId = String(matrix[row][safeRowHeadersCol] ?? '').trim();
        if (!rowNodeId) continue;

        if (!nodesMap.has(rowNodeId)) {
          nodesMap.set(rowNodeId, { id: rowNodeId, name: rowNodeId, label: rowNodeId, partition: 'A', abundance: 0 });
        }

        for (let col = safeDataStartCol; col < matrix[row].length; col++) {
          const rawVal = String(matrix[row][col] ?? '').trim();
          let isConnected = false;
          let parsedWeight = parseFloat(rawVal);

          if (rawVal === '+' || rawVal === 'x' || rawVal === 'X') {
            isConnected = true;
            parsedWeight = 1;
          } else if (!isNaN(parsedWeight) && parsedWeight > 0) {
            isConnected = true;
          }

          if (isConnected) {
            const colNodeId = String(matrix[safeColHeadersRow]?.[col] ?? '').trim();
            if (colNodeId) {
              edges.push({
                source: rowNodeId,
                target: colNodeId,
                weight_raw: parsedWeight,
                weight_secondary: parsedWeight,
              });

              const aNode = nodesMap.get(rowNodeId);
              const bNode = nodesMap.get(colNodeId);
              if (aNode) aNode.abundance += parsedWeight;
              if (bNode) bNode.abundance += parsedWeight;
            }
          }
        }
      }
    } else if (isFormatDualMatrix && parsedData.counts && parsedData.percentages) {
      const countsData = parsedData.counts;
      const percData = parsedData.percentages;
      const countHeaders = countsData[safeColHeadersRow] || [];
      const percHeaders = percData[safeColHeadersRow] || [];

      const percColMap = new Map<string, number>();
      for (let j = safeDataStartCol; j < percHeaders.length; j++) {
        percColMap.set(percHeaders[j], j);
      }
      const percRowMap = new Map<string, any[]>();
      for (let i = safeDataStartRow; i < percData.length; i++) {
        const rowP = percData[i] || [];
        if (rowP[safeRowHeadersCol]) {
          percRowMap.set(rowP[safeRowHeadersCol], rowP);
        }
      }

      for (let i = safeDataStartRow; i < countsData.length; i++) {
        const row = countsData[i];
        const sourceId = row[safeRowHeadersCol];
        if (!sourceId) continue;

        let abundance = 0;
        const colIndex = countHeaders.indexOf(sourceId);
        if (colIndex !== -1) abundance = parseFloat(row[colIndex]) || 0;
        if (abundance === 0) abundance = 10;
        nodesMap.set(sourceId, { id: sourceId, name: sourceId, abundance });
      }

      for (let i = safeDataStartRow; i < countsData.length; i++) {
        const rowC = countsData[i];
        const sourceId = rowC[safeRowHeadersCol];
        if (!sourceId) continue;

        const rowP = percRowMap.get(sourceId) || [];

        for (let j = safeDataStartCol; j < Math.min(rowC.length, countHeaders.length); j++) {
          const targetId = countHeaders[j];
          if (!targetId || sourceId === targetId) continue;

          const rawW = parseFloat(rowC[j]) || 0;
          const percJ = percColMap.get(targetId);
          const secW = percJ !== undefined ? parseFloat(rowP[percJ]) || 0 : 0;

          if (rawW !== 0) {
            const edgeId = isDirected
              ? `${sourceId}->${targetId}`
              : sourceId < targetId
              ? `${sourceId}_${targetId}`
              : `${targetId}_${sourceId}`;
            if (!edgeSet.has(edgeId)) {
              edgeSet.add(edgeId);
              edges.push({ source: sourceId, target: targetId, weight_raw: rawW, weight_secondary: secW });
              if (!nodesMap.has(targetId)) nodesMap.set(targetId, { id: targetId, name: targetId, abundance: 10 });
            }
          }
        }
      }
    } else if (isFormatMatrix && parsedData.matrix) {
      const data = parsedData.matrix;
      const headers = data[safeColHeadersRow] || [];

      // Keep every column-header node. This is important for triangular matrices,
      // whose final nodes may only appear as targets (or have no off-diagonal ties).
      const headerIndexById = new Map<string, number>();
      for (let j = safeDataStartCol; j < headers.length; j++) {
        const headerId = String(headers[j] ?? '').trim();
        if (!headerId) continue;
        headerIndexById.set(headerId, j);
        nodesMap.set(headerId, { id: headerId, name: headerId, abundance: 10 });
      }

      /**
       * A triangular CSV can be represented in either of two ways:
       *
       * - padded: empty lower-left cells keep every row aligned with its header;
       * - compact: those cells are omitted, so each row starts at its diagonal
       *   (or immediately after it).
       *
       * Rows that remain header-width are always treated as padded. For shorter
       * rows, their expected remaining cell count tells us whether the diagonal
       * is included. This keeps compact matrices from being shifted onto the
       * wrong target labels while leaving ordinary square matrices unchanged.
       */
      const resolveHeaderIndex = (row: any[], sourceHeaderIndex: number, cellIndex: number) => {
        if (sourceHeaderIndex < safeDataStartCol || row.length >= headers.length) return cellIndex;

        const valueOffset = cellIndex - safeDataStartCol;
        const valueCount = Math.max(0, row.length - safeDataStartCol);
        const remainingWithDiagonal = Math.max(0, headers.length - sourceHeaderIndex);
        const remainingWithoutDiagonal = Math.max(0, remainingWithDiagonal - 1);

        if (valueCount === remainingWithoutDiagonal) return sourceHeaderIndex + 1 + valueOffset;
        if (valueCount === remainingWithDiagonal) return sourceHeaderIndex + valueOffset;
        return cellIndex;
      };

      for (let i = safeDataStartRow; i < data.length; i++) {
        const row = data[i] || [];
        const sourceId = String(row[safeRowHeadersCol] ?? '').trim();
        if (!sourceId) continue;

        let abundance = 0;
        const colIndex = headerIndexById.get(sourceId);
        if (colIndex !== undefined) {
          if (row.length >= headers.length) {
            abundance = parseFloat(row[colIndex]) || 0;
          } else {
            const valueCount = Math.max(0, row.length - safeDataStartCol);
            const remainingWithDiagonal = Math.max(0, headers.length - colIndex);
            if (valueCount === remainingWithDiagonal) {
              abundance = parseFloat(row[safeDataStartCol]) || 0;
            }
          }
        }
        if (abundance === 0) abundance = 10;
        nodesMap.set(sourceId, { id: sourceId, name: sourceId, abundance });
      }
      for (let i = safeDataStartRow; i < data.length; i++) {
        const row = data[i] || [];
        const sourceId = String(row[safeRowHeadersCol] ?? '').trim();
        if (!sourceId) continue;
        const sourceHeaderIndex = headerIndexById.get(sourceId) ?? -1;
        for (let j = safeDataStartCol; j < row.length; j++) {
          const headerIndex = resolveHeaderIndex(row, sourceHeaderIndex, j);
          const targetId = String(headers[headerIndex] ?? '').trim();
          if (!targetId || sourceId === targetId) continue;
          const value = parseFloat(row[j]) || 0;
          if (value !== 0) {
            const edgeId = isDirected
              ? `${sourceId}->${targetId}`
              : sourceId < targetId
              ? `${sourceId}_${targetId}`
              : `${targetId}_${sourceId}`;
            if (!edgeSet.has(edgeId)) {
              edgeSet.add(edgeId);
              edges.push({ source: sourceId, target: targetId, weight_raw: value, weight_secondary: value });
              if (!nodesMap.has(targetId)) nodesMap.set(targetId, { id: targetId, name: targetId, abundance: 10 });
            }
          }
        }
      }
    } else if (isFormatEdgeList && parsedData.edges) {
      const edgeData = parsedData.edges;
      const eHeaders = edgeData[0] || [];
      const sIdx = eHeaders.indexOf(sourceCol);
      const tIdx = eHeaders.indexOf(targetCol);
      const wrIdx = eHeaders.indexOf(weightRawCol);
      const wsIdx = eHeaders.indexOf(weightSecCol);

      if (sIdx !== -1 && tIdx !== -1) {
        for (let i = 1; i < edgeData.length; i++) {
          const row = edgeData[i];
          const sId = row[sIdx];
          const tId = row[tIdx];
          if (!sId || !tId || sId === tId) continue;

          const wRaw = wrIdx !== -1 ? parseFloat(row[wrIdx]) : 1;
          const wSec = wsIdx !== -1 ? parseFloat(row[wsIdx]) : wRaw;
          const finalWR = !isNaN(wRaw) ? wRaw : 1;
          const finalWS = !isNaN(wSec) ? wSec : finalWR;

          const edgeId = isDirected ? `${sId}->${tId}` : sId < tId ? `${sId}_${tId}` : `${tId}_${sId}`;
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId);
            const extraEdgeProps: any = {};
            for (let j = 0; j < eHeaders.length; j++) {
              if (j !== sIdx && j !== tIdx && j !== wrIdx && j !== wsIdx) {
                if (row[j] !== undefined && row[j] !== '') extraEdgeProps[eHeaders[j]] = row[j];
              }
            }
            edges.push({ source: sId, target: tId, weight_raw: finalWR, weight_secondary: finalWS, ...extraEdgeProps });
            if (!nodesMap.has(sId)) nodesMap.set(sId, { id: sId, name: sId, abundance: 10, partition: topology === 'Bipartite' ? 'A' : undefined });
            if (!nodesMap.has(tId)) nodesMap.set(tId, { id: tId, name: tId, abundance: 10, partition: topology === 'Bipartite' ? 'B' : undefined });
          }
        }
      }
    } else if (isFormatAdjList && parsedData.adjList) {
      let actualSourceColIdx = 0;
      if (parsedData.adjList.length > 0 && adjSourceCol) {
        const idx = parsedData.adjList[0].indexOf(adjSourceCol);
        if (idx !== -1) actualSourceColIdx = idx;
      }
      for (let i = Math.max(0, safeDataStartRow); i < parsedData.adjList.length; i++) {
        const row = parsedData.adjList[i];
        const sourceId = row[actualSourceColIdx];
        if (!sourceId) continue;
        if (!nodesMap.has(sourceId)) nodesMap.set(sourceId, { id: sourceId, name: sourceId, abundance: 10 });

        for (let j = safeDataStartCol; j < row.length; j++) {
          const targetId = row[j];
          if (!targetId || sourceId === targetId) continue;

          const edgeId = isDirected ? `${sourceId}->${targetId}` : sourceId < targetId ? `${sourceId}_${targetId}` : `${targetId}_${sourceId}`;
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId);
            edges.push({ source: sourceId, target: targetId, weight_raw: 1, weight_secondary: 1 });
            if (!nodesMap.has(targetId)) nodesMap.set(targetId, { id: targetId, name: targetId, abundance: 10 });
          }
        }
      }
    }

    if (parsedData.additionalEdges) {
      const edgeData = parsedData.additionalEdges;
      const eHeaders = edgeData[0] || [];
      const sIdx = eHeaders.indexOf(sourceCol);
      const tIdx = eHeaders.indexOf(targetCol);
      const wrIdx = eHeaders.indexOf(weightRawCol);
      const wsIdx = eHeaders.indexOf(weightSecCol);

      if (sIdx !== -1 && tIdx !== -1) {
        for (let i = 1; i < edgeData.length; i++) {
          const row = edgeData[i];
          const sId = row[sIdx];
          const tId = row[tIdx];
          if (!sId || !tId || sId === tId) continue;

          const edgeId = isDirected ? `${sId}->${tId}` : sId < tId ? `${sId}_${tId}` : `${tId}_${sId}`;
          if (edgeSet.has(edgeId)) {
            const existingEdge = edges.find(e => {
              const eId = isDirected ? `${e.source}->${e.target}` : e.source < e.target ? `${e.source}_${e.target}` : `${e.target}_${e.source}`;
              return eId === edgeId;
            });
            if (existingEdge) {
              if (wrIdx !== -1 && !isNaN(parseFloat(row[wrIdx]))) existingEdge.weight_raw = parseFloat(row[wrIdx]);
              if (wsIdx !== -1 && !isNaN(parseFloat(row[wsIdx]))) existingEdge.weight_secondary = parseFloat(row[wsIdx]);
              for (let j = 0; j < eHeaders.length; j++) {
                if (j !== sIdx && j !== tIdx && j !== wrIdx && j !== wsIdx && row[j] !== undefined && row[j] !== '') {
                  existingEdge[eHeaders[j]] = row[j];
                }
              }
            }
          } else {
            const wRaw = wrIdx !== -1 ? parseFloat(row[wrIdx]) : 1;
            const wSec = wsIdx !== -1 ? parseFloat(row[wsIdx]) : wRaw;
            const finalWR = !isNaN(wRaw) ? wRaw : 1;
            const finalWS = !isNaN(wSec) ? wSec : finalWR;
            edgeSet.add(edgeId);
            const extraEdgeProps: Record<string, any> = {};
            for (let j = 0; j < eHeaders.length; j++) {
              if (j !== sIdx && j !== tIdx && j !== wrIdx && j !== wsIdx && row[j] !== undefined && row[j] !== '') {
                extraEdgeProps[eHeaders[j]] = row[j];
              }
            }
            edges.push({ source: sId, target: tId, weight_raw: finalWR, weight_secondary: finalWS, ...extraEdgeProps });
            if (!nodesMap.has(sId)) nodesMap.set(sId, { id: sId, name: sId, abundance: 10 });
            if (!nodesMap.has(tId)) nodesMap.set(tId, { id: tId, name: tId, abundance: 10 });
          }
        }
      }
    }

    if (parsedData.nodes) {
      const nodeData = parsedData.nodes;
      const nHeaders = nodeData[0] || [];
      const idIdx = nHeaders.indexOf(nodeIdCol);
      const lblIdx = nHeaders.indexOf(nodeLabelCol);
      const typIdx = nHeaders.indexOf(nodeTypeCol);
      const partitionIdx = nHeaders.indexOf(nodePartitionCol);
      const commIdx = nHeaders.indexOf(nodeCommunityCol);
      const abnIdx = nHeaders.indexOf(nodeAbundCol);

      if (idIdx !== -1) {
        for (let i = 1; i < nodeData.length; i++) {
          const row = nodeData[i];
          const id = row[idIdx];
          if (!id) continue;
          const name = lblIdx !== -1 && row[lblIdx] ? row[lblIdx] : id;
          const type = typIdx !== -1 ? row[typIdx] : undefined;
          const partition = partitionIdx !== -1 ? row[partitionIdx] : undefined;
          const comm = commIdx !== -1 && row[commIdx] ? row[commIdx] : undefined;
          const abund = abnIdx !== -1 ? parseFloat(row[abnIdx]) : 10;

          if (nodesMap.has(id)) {
            const existing = nodesMap.get(id)!;
            const extraProps: any = {};
            for (let j = 0; j < nHeaders.length; j++) {
              if (j !== idIdx && j !== lblIdx && j !== typIdx && j !== partitionIdx && j !== commIdx && j !== abnIdx) {
                if (row[j] !== undefined && row[j] !== '') {
                  extraProps[nHeaders[j]] = row[j];
                }
              }
            }
            nodesMap.set(id, {
              ...existing,
              name: lblIdx !== -1 && row[lblIdx] ? name : existing.name,
              type: type || existing.type,
              partition: partition ?? existing.partition,
              community: comm || existing.community,
              abundance: isNaN(abund) ? existing.abundance : abund,
              ...extraProps,
            });
          } else {
            const extraProps: any = {};
            for (let j = 0; j < nHeaders.length; j++) {
              if (j !== idIdx && j !== lblIdx && j !== typIdx && j !== partitionIdx && j !== commIdx && j !== abnIdx) {
                if (row[j] !== undefined && row[j] !== '') {
                  extraProps[nHeaders[j]] = row[j];
                }
              }
            }
            nodesMap.set(id, { id, name, type, partition, community: comm, abundance: isNaN(abund) ? 10 : abund, ...extraProps });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error constructing graph:', err);
  }

  const finalNodes = Array.from(nodesMap.values());
  if (format !== 'Incidence Matrix') {
    finalNodes.forEach(n => {
      if (typeof n.abundance !== 'number' || isNaN(n.abundance) || n.abundance <= 0) n.abundance = 10;
    });
  } else {
    finalNodes.forEach(n => {
      if (typeof n.abundance !== 'number' || isNaN(n.abundance) || n.abundance <= 0) n.abundance = 1;
    });
  }

  return { nodes: finalNodes, edges };
}
