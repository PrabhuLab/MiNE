'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import PapaPkg from 'papaparse';

const Papa = (PapaPkg as any).default || PapaPkg;

export default function SmartUploadWizard() {
  const router = useRouter();
  const setRawData = useStore(state => state.setRawData);
  const clearStore = useStore(state => state.clearStore);
  const isDarkMode = useStore(state => state.isDarkMode);
  
  // Cascade UI State
  const [step, setStep] = useState(1);
  const [topology, setTopology] = useState<'Unipartite' | 'Bipartite'>('Unipartite');
  const [isWeighted, setIsWeighted] = useState<boolean>(false);
  const [isDirected, setIsDirected] = useState<boolean>(false);
  const [format, setFormat] = useState('Standard JSON'); // Gets auto-updated based on choices
  
  // File State
  const [countsFile, setCountsFile] = useState<File | null>(null);
  const [percentagesFile, setPercentagesFile] = useState<File | null>(null);
  const [singleMatrixFile, setSingleMatrixFile] = useState<File | null>(null);
  const [edgesFile, setEdgesFile] = useState<File | null>(null);
  const [nodesFile, setNodesFile] = useState<File | null>(null);
  const [adjListFile, setAdjListFile] = useState<File | null>(null);
  const [hasAdditionalAttributes, setHasAdditionalAttributes] = useState<boolean>(false);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed CSVs
  const [parsedData, setParsedData] = useState<Record<string, any>>({});
  
  // Mapping State
  const [sourceCol, setSourceCol] = useState('');
  const [adjSourceCol, setAdjSourceCol] = useState('');
  const [targetCol, setTargetCol] = useState('');
  const [weightRawCol, setWeightRawCol] = useState('');
  const [weightSecCol, setWeightSecCol] = useState('');
  const [nodeIdCol, setNodeIdCol] = useState('');
  const [nodeLabelCol, setNodeLabelCol] = useState('');
  const [nodeTypeCol, setNodeTypeCol] = useState('');
  const [nodeCommunityCol, setNodeCommunityCol] = useState('');
  const [nodeAbundCol, setNodeAbundCol] = useState('');

  const [rowHeadersCol, setRowHeadersCol] = useState<number | ''>(0);
  const [colHeadersRow, setColHeadersRow] = useState<number | ''>(0);
  const [dataStartRow, setDataStartRow] = useState<number | ''>(1);
  const [dataStartCol, setDataStartCol] = useState<number | ''>(1);

  useEffect(() => {
    // Both Unipartite and Bipartite can be directed or undirected
  }, [topology]);

  const availableFormats = useMemo(() => {
    if (topology === 'Bipartite') {
      const edgeListFormat = isDirected ? 'Directed Bipartite Edge List' : 'Bipartite Edge List';
      return ["Incidence Matrix", edgeListFormat, "Standard JSON"];
    }
    if (topology === 'Unipartite' && isWeighted) {
      return ["Dual Adjacency Matrix", "Single Weighted Adjacency Matrix", isDirected ? "Directed Weighted Edge List" : "Weighted Edge List", "Standard JSON"];
    }
    if (topology === 'Unipartite' && !isWeighted) {
      return ["Adjacency Matrix", isDirected ? "Directed Edge List" : "Edge List", "Adjacency List", "Standard JSON"];
    }
    return ["Standard JSON"];
  }, [topology, isWeighted, isDirected]);

  if (!availableFormats.includes(format)) {
    setFormat(availableFormats[0]);
  }

  const isFormatMatrix = ['Adjacency Matrix', 'Incidence Matrix', 'Single Weighted Adjacency Matrix', 'Single Adjacency Matrix'].includes(format);
  const isFormatEdgeList = ['Edge List', 'Weighted Edge List', 'Directed Edge List', 'Directed Weighted Edge List', 'Bipartite Edge List', 'Directed Bipartite Edge List'].includes(format);
  const isFormatDualMatrix = format === 'Dual Adjacency Matrix';
  const isFormatAdjList = format === 'Adjacency List';

  const isStep4Valid = () => {
    if (format === 'Standard JSON') return jsonFile !== null;
    if (isFormatDualMatrix) return countsFile !== null && percentagesFile !== null;
    if (isFormatMatrix) return singleMatrixFile !== null;
    if (format === 'Bipartite Edge List' || format === 'Directed Bipartite Edge List') return edgesFile !== null && nodesFile !== null;
    if (isFormatEdgeList) return edgesFile !== null;
    if (isFormatAdjList) return adjListFile !== null;
    return false;
  };

  const parseCSV = (file: File) => new Promise<any[][]>((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      header: false,
      complete: (res: any) => resolve(res.data as any[][]),
      error: reject
    });
  });

  const handleParseAndReview = async () => {
    if (format === 'Standard JSON') {
      try {
        const text = await jsonFile!.text();
        const data = JSON.parse(text);
        if (!data.nodes || !data.edges) throw new Error("Invalid Standard JSON format.");
        
        const jsonEdgesData = [];
        if (data.edges.length > 0) {
           const headers = Object.keys(data.edges[0]);
           jsonEdgesData.push(headers);
           data.edges.slice(0, 6).forEach((e: any) => jsonEdgesData.push(headers.map(h => typeof e[h] === 'object' ? JSON.stringify(e[h]) : e[h])));
           setSourceCol(headers.find(h => /source/i.test(h)) || headers[0] || '');
           setTargetCol(headers.find(h => /target/i.test(h)) || headers[1] || '');
           setWeightRawCol(headers.find(h => /weight/i.test(h)) || headers[2] || '');
           setWeightSecCol(headers.find(h => /secondary/i.test(h)) || headers[3] || '');
        }
        const jsonNodesData = [];
        if (data.nodes.length > 0) {
           const headers = Object.keys(data.nodes[0]);
           jsonNodesData.push(headers);
           data.nodes.slice(0, 6).forEach((n: any) => jsonNodesData.push(headers.map(h => typeof n[h] === 'object' ? JSON.stringify(n[h]) : n[h])));
           setNodeIdCol(headers.find(h => /id/i.test(h)) || headers[0] || '');
           setNodeLabelCol(headers.find(h => /name|label/i.test(h)) || headers[1] || '');
           setNodeAbundCol(headers.find(h => /size|abund|weight/i.test(h)) || headers[2] || '');
           setNodeTypeCol(headers.find(h => /type/i.test(h)) || headers[3] || '');
           setNodeCommunityCol(headers.find(h => /group|community/i.test(h)) || headers[4] || '');
        }

        setParsedData({ jsonNodes: jsonNodesData, jsonEdges: jsonEdgesData, rawNodes: data.nodes, rawEdges: data.edges });
        setStep(5);
      } catch (err: any) {
        setError(err.message || 'Invalid JSON file.');
      }
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const data: Record<string, any[][]> = {};
      
      if (isFormatMatrix) {
        data.matrix = await parseCSV(singleMatrixFile!);
      } else if (isFormatDualMatrix) {
        data.counts = await parseCSV(countsFile!);
        data.percentages = await parseCSV(percentagesFile!);
      } else if (isFormatEdgeList) {
        const edgeData = await parseCSV(edgesFile!);
        data.edges = edgeData;
        if (edgeData[0]) {
          setSourceCol(edgeData[0][0] || '');
          setTargetCol(edgeData[0][1] || '');
          setWeightRawCol(edgeData[0][2] || '');
          setWeightSecCol(edgeData[0][3] || '');
        }
        if (nodesFile) {
          const nodeData = await parseCSV(nodesFile);
          data.nodes = nodeData;
          if (nodeData[0]) {
            setNodeIdCol(nodeData[0][0] || '');
            setNodeLabelCol(nodeData[0][1] || '');
            setNodeAbundCol(nodeData[0][2] || '');
            setNodeTypeCol(nodeData[0][3] || '');
            setNodeCommunityCol(nodeData[0][4] || '');
          }
        }
      } else if (isFormatAdjList) {
        data.adjList = await parseCSV(adjListFile!);
        if (data.adjList.length > 0 && data.adjList[0]) {
           setAdjSourceCol(data.adjList[0][0] || '');
        }
      }
      
      if (hasAdditionalAttributes) {
        if (!isFormatEdgeList && edgesFile) {
          const edgeData = await parseCSV(edgesFile);
          data.additionalEdges = edgeData;
          if (edgeData[0]) {
            // We use different variables if it's Adjacency List + Additional Edges. 
            // We have sourceCol, targetCol, weightRawCol, weightSecCol for the additional edges.
            setSourceCol(edgeData[0][0] || '');
            setTargetCol(edgeData[0][1] || '');
            setWeightRawCol(edgeData[0][2] || '');
            setWeightSecCol(edgeData[0][3] || '');
          }
        }
        if (nodesFile) {
          const nodeData = await parseCSV(nodesFile);
          data.nodes = nodeData;
          if (nodeData[0]) {
            setNodeIdCol(nodeData[0][0] || '');
            setNodeLabelCol(nodeData[0][1] || '');
            setNodeAbundCol(nodeData[0][2] || '');
            setNodeTypeCol(nodeData[0][3] || '');
            setNodeCommunityCol(nodeData[0][4] || '');
          }
        }
      }
      
      setParsedData(data);
      setStep(5);
    } catch (e: any) {
      setError(e.message || "Failed to parse files");
    } finally {
      setIsProcessing(false);
    }
  };

  const previewGraph = useMemo(() => {
    if (step < 5) return { nodes: [], edges: [] };
    
    if (format === 'Standard JSON' && parsedData.rawNodes && parsedData.rawEdges) {
      const nodesMap = new Map();
      const edges: any[] = [];
      const edgeSet = new Set();
      
      parsedData.rawNodes.forEach((n: any, index: number) => {
        const id = n[nodeIdCol || 'id'] || n['id'] || `node_${index}`;
        nodesMap.set(id, {
          id,
          name: n[nodeLabelCol || 'name'] || n['name'] || id,
          abundance: parseFloat(n[nodeAbundCol || 'abundance'] || n['abundance']) || 10,
          type: n[nodeTypeCol || 'type'] || n['type'] || 'A',
          community: n[nodeCommunityCol || 'community'] || n['community'] || ''
        });
      });
      
      parsedData.rawEdges.forEach((e: any) => {
        const sourceId = e[sourceCol || 'source'] || e['source'];
        const targetId = e[targetCol || 'target'] || e['target'];
        if (!sourceId || !targetId) return;
        
        const edgeId = isDirected ? `${sourceId}->${targetId}` : (sourceId < targetId ? `${sourceId}_${targetId}` : `${targetId}_${sourceId}`);
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            source: sourceId,
            target: targetId,
            weight_raw: parseFloat(e[weightRawCol || 'weight'] || e['weight']) || 1,
            weight_secondary: parseFloat(e[weightSecCol || 'weight'] || e['weight']) || 1
          });
        }
      });
      
      return { nodes: Array.from(nodesMap.values()), edges };
    }
    
    const nodesMap = new Map();
    const edges = [];
    const edgeSet = new Set();
    
    try {
      const safeRowHeadersCol = typeof rowHeadersCol === 'number' ? rowHeadersCol : 0;
      const safeColHeadersRow = typeof colHeadersRow === 'number' ? colHeadersRow : 0;
      const safeDataStartRow = typeof dataStartRow === 'number' ? dataStartRow : 1;
      const safeDataStartCol = typeof dataStartCol === 'number' ? dataStartCol : 1;

      if (format === 'Incidence Matrix' && parsedData.matrix) {
        const matrix = parsedData.matrix;
        
        for (let col = safeDataStartCol; col < matrix[safeColHeadersRow]?.length; col++) {
          const colNodeId = matrix[safeColHeadersRow][col]?.trim();
          if (colNodeId) {
            nodesMap.set(colNodeId, { id: colNodeId, label: colNodeId, type: "B", abundance: 0 });
          }
        }
        
        for (let row = safeDataStartRow; row < matrix.length; row++) {
          if (!matrix[row] || matrix[row].length === 0) continue;
          const rowNodeId = matrix[row][safeRowHeadersCol]?.trim();
          if (!rowNodeId) continue;
          
          if (!nodesMap.has(rowNodeId)) {
            nodesMap.set(rowNodeId, { id: rowNodeId, label: rowNodeId, type: "A", abundance: 0 });
          }
        
          for (let col = safeDataStartCol; col < matrix[row].length; col++) {
            const rawVal = matrix[row][col]?.trim();
            let isConnected = false;
            let parsedWeight = parseFloat(rawVal);
            
            if (rawVal === '+' || rawVal === 'x' || rawVal === 'X') {
              isConnected = true;
              parsedWeight = 1;
            } else if (!isNaN(parsedWeight) && parsedWeight > 0) {
              isConnected = true;
            }
            
            if (isConnected) {
              const colNodeId = matrix[safeColHeadersRow]?.[col]?.trim();
              if (colNodeId) {
                edges.push({
                  source: rowNodeId,
                  target: colNodeId,
                  weight_raw: parsedWeight,
                  weight_secondary: parsedWeight
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
        
        const percColMap = new Map();
        for (let j = safeDataStartCol; j < percHeaders.length; j++) {
            percColMap.set(percHeaders[j], j);
        }
        const percRowMap = new Map();
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
            const secW = percJ !== undefined ? (parseFloat(rowP[percJ]) || 0) : 0;
            
            if (rawW !== 0) {
              const edgeId = isDirected ? `${sourceId}->${targetId}` : (sourceId < targetId ? `${sourceId}_${targetId}` : `${targetId}_${sourceId}`);
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
        for (let i = safeDataStartRow; i < data.length; i++) {
          const row = data[i];
          const sourceId = row[safeRowHeadersCol];
          if (!sourceId) continue;
          
          let abundance = 0;
          const colIndex = headers.indexOf(sourceId);
          if (colIndex !== -1) abundance = parseFloat(row[colIndex]) || 0;
          if (abundance === 0) abundance = 10;
          nodesMap.set(sourceId, { id: sourceId, name: sourceId, abundance });
        }
        for (let i = safeDataStartRow; i < data.length; i++) {
          const row = data[i];
          const sourceId = row[safeRowHeadersCol];
          if (!sourceId) continue;
          for (let j = safeDataStartCol; j < Math.min(row.length, headers.length); j++) {
            const targetId = headers[j];
            if (!targetId || sourceId === targetId) continue;
            const value = parseFloat(row[j]) || 0;
            if (value !== 0) {
              const edgeId = isDirected ? `${sourceId}->${targetId}` : (sourceId < targetId ? `${sourceId}_${targetId}` : `${targetId}_${sourceId}`);
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

            const edgeId = isDirected ? `${sId}->${tId}` : (sId < tId ? `${sId}_${tId}` : `${tId}_${sId}`);
            if (!edgeSet.has(edgeId)) {
              edgeSet.add(edgeId);
              const extraEdgeProps: any = {};
              for (let j = 0; j < eHeaders.length; j++) {
                 if (j !== sIdx && j !== tIdx && j !== wrIdx && j !== wsIdx) {
                    if (row[j] !== undefined && row[j] !== '') extraEdgeProps[eHeaders[j]] = row[j];
                 }
              }
              edges.push({ source: sId, target: tId, weight_raw: finalWR, weight_secondary: finalWS, ...extraEdgeProps });
              if (!nodesMap.has(sId)) nodesMap.set(sId, { id: sId, name: sId, abundance: 10, type: topology === 'Bipartite' ? 'A' : undefined });
              if (!nodesMap.has(tId)) nodesMap.set(tId, { id: tId, name: tId, abundance: 10, type: topology === 'Bipartite' ? 'B' : undefined });
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
            
            const edgeId = isDirected ? `${sourceId}->${targetId}` : (sourceId < targetId ? `${sourceId}_${targetId}` : `${targetId}_${sourceId}`);
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

              const edgeId = isDirected ? `${sId}->${tId}` : (sId < tId ? `${sId}_${tId}` : `${tId}_${sId}`);
              if (edgeSet.has(edgeId)) {
                const existingEdge = edges.find(e => {
                  const eId = isDirected ? `${e.source}->${e.target}` : (e.source < e.target ? `${e.source}_${e.target}` : `${e.target}_${e.source}`);
                  return eId === edgeId;
                });
                if (existingEdge) {
                  if (wrIdx !== -1 && !isNaN(parseFloat(row[wrIdx]))) existingEdge.weight_raw = parseFloat(row[wrIdx]);
                  if (wsIdx !== -1 && !isNaN(parseFloat(row[wsIdx]))) existingEdge.weight_secondary = parseFloat(row[wsIdx]);
                }
              } else {
                 const wRaw = wrIdx !== -1 ? parseFloat(row[wrIdx]) : 1;
                 const wSec = wsIdx !== -1 ? parseFloat(row[wsIdx]) : wRaw;
                 const finalWR = !isNaN(wRaw) ? wRaw : 1;
                 const finalWS = !isNaN(wSec) ? wSec : finalWR;
                 edgeSet.add(edgeId);
                 edges.push({ source: sId, target: tId, weight_raw: finalWR, weight_secondary: finalWS });
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
          const commIdx = nHeaders.indexOf(nodeCommunityCol);
          const abnIdx = nHeaders.indexOf(nodeAbundCol);

          if (idIdx !== -1) {
            for (let i = 1; i < nodeData.length; i++) {
              const row = nodeData[i];
              const id = row[idIdx];
              if (!id) continue;
              const name = lblIdx !== -1 && row[lblIdx] ? row[lblIdx] : id;
              const type = typIdx !== -1 ? row[typIdx] : undefined;
              const comm = (commIdx !== -1 && row[commIdx]) ? row[commIdx] : undefined;
              const abund = abnIdx !== -1 ? parseFloat(row[abnIdx]) : 10;
                
              if (nodesMap.has(id)) {
                const existing = nodesMap.get(id);
                
                const extraProps: any = {};
                for (let j = 0; j < nHeaders.length; j++) {
                  if (j !== idIdx && j !== lblIdx && j !== typIdx && j !== commIdx && j !== abnIdx) {
                    if (row[j] !== undefined && row[j] !== '') {
                      extraProps[nHeaders[j]] = row[j];
                    }
                  }
                }
                nodesMap.set(id, { 
                  ...existing,
                  name: lblIdx !== -1 && row[lblIdx] ? name : existing.name,
                  type: type || existing.type, 
                  community: comm || existing.community, 
                  abundance: isNaN(abund) ? existing.abundance : abund,
                  ...extraProps
                });
              } else {
                
                const extraProps: any = {};
                for (let j = 0; j < nHeaders.length; j++) {
                  if (j !== idIdx && j !== lblIdx && j !== typIdx && j !== commIdx && j !== abnIdx) {
                    if (row[j] !== undefined && row[j] !== '') {
                      extraProps[nHeaders[j]] = row[j];
                    }
                  }
                }
                nodesMap.set(id, { id, name, type, community: comm, abundance: isNaN(abund) ? 10 : abund, ...extraProps });
              }
            }
          }
      }
    } catch(err) {
      console.error(err);
    }
    
    const finalNodes = Array.from(nodesMap.values());
    if (format !== 'Incidence Matrix') {
      finalNodes.forEach(n => { if (typeof n.abundance !== 'number' || isNaN(n.abundance) || n.abundance <= 0) n.abundance = 10; });
    } else {
      finalNodes.forEach(n => { if (typeof n.abundance !== 'number' || isNaN(n.abundance) || n.abundance <= 0) n.abundance = 1; });
    }

    return { nodes: finalNodes, edges };
  }, [parsedData, format, step, sourceCol, targetCol, adjSourceCol, weightRawCol, weightSecCol, nodeIdCol, nodeLabelCol, nodeTypeCol, nodeCommunityCol, nodeAbundCol, rowHeadersCol, colHeadersRow, dataStartRow, dataStartCol, isDirected, topology, isFormatDualMatrix, isFormatEdgeList, isFormatMatrix, isFormatAdjList]);

  const handleFinalize = () => {
    clearStore();
    setRawData(previewGraph.nodes, previewGraph.edges, isDirected, topology === 'Bipartite');
    router.push('/workspace');
  };

  const renderTablePreview = (data: any[][] | undefined, title: string, applyHighlighting: boolean = false) => {
    if (!data || data.length === 0) return null;
    return (
      <div className="mb-4">
        <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>{title} Preview (First 5 Rows)</div>
        <div className={`overflow-x-auto border ${isDarkMode ? 'border-[#333]' : 'border-[#141414]'}`}>
          <table className="w-full text-left text-xs font-mono whitespace-nowrap">
            <thead>
              <tr className={isDarkMode ? 'bg-[#333] text-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0]'}>
                {data[0].map((h: any, j: number) => {
                  const isDataStartRow = applyHighlighting && typeof dataStartRow === 'number' && 0 === dataStartRow;
                  const isDataStartCol = applyHighlighting && typeof dataStartCol === 'number' && j === dataStartCol;
                  const isDataRegion = applyHighlighting && typeof dataStartRow === 'number' && typeof dataStartCol === 'number' && 0 >= dataStartRow && j >= dataStartCol;
                  
                  let thClass = `px-2 py-1 border-r border-t ${isDarkMode ? 'border-[#E4E3E0]/10' : 'border-[#E4E3E0]/20'}`;
                  
                  if (isDataStartRow && isDataStartCol) {
                      thClass += isDarkMode ? ' bg-[#b4ff39]/40 border-l-2 border-t-2 border-[#b4ff39] text-[#b4ff39]' : ' bg-[#b4ff39]/50 border-l-2 border-t-2 border-[#b4ff39] text-[#141414] font-bold';
                  } else if (isDataStartRow && isDataRegion) {
                      thClass += isDarkMode ? ' bg-[#b4ff39]/20 border-t-2 border-[#b4ff39] text-[#b4ff39]' : ' bg-[#b4ff39]/30 border-t-2 border-[#b4ff39] text-[#141414] font-bold';
                  } else if (isDataStartCol && isDataRegion) {
                      thClass += isDarkMode ? ' bg-[#b4ff39]/20 border-l-2 border-[#b4ff39] text-[#b4ff39]' : ' bg-[#b4ff39]/30 border-l-2 border-[#b4ff39] text-[#141414] font-bold';
                  } else if (isDataRegion) {
                      thClass += isDarkMode ? ' bg-[#b4ff39]/10 text-[#b4ff39]' : ' bg-[#b4ff39]/20 text-[#141414]';
                  }
                  
                  return <th key={j} className={thClass}>{h || `Col ${j}`}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {data.slice(1, 6).map((row: any[], i: number) => {
                const actualRowIndex = i + 1;
                return (
                  <tr key={i} className={`border-b hover:bg-opacity-50 ${isDarkMode ? 'border-[#333]/50 bg-[#141414] hover:bg-[#333]' : 'border-[#141414]/20 bg-white hover:bg-gray-50'}`}>
                    {data[0].map((_: any, j: number) => {
                      const isDataStartRow = applyHighlighting && typeof dataStartRow === 'number' && actualRowIndex === dataStartRow;
                      const isDataStartCol = applyHighlighting && typeof dataStartCol === 'number' && j === dataStartCol;
                      const isDataRegion = applyHighlighting && typeof dataStartRow === 'number' && typeof dataStartCol === 'number' && actualRowIndex >= dataStartRow && j >= dataStartCol;
                      
                      let tdClass = `px-2 py-1 border-r ${isDarkMode ? 'border-[#333]/50' : 'border-[#141414]/20'}`;
                      
                      if (isDataStartRow && isDataStartCol) {
                          tdClass += isDarkMode ? ' bg-[#b4ff39]/40 border-l-2 border-t-2 border-[#b4ff39] text-[#b4ff39] font-bold' : ' bg-[#b4ff39]/50 border-l-2 border-t-2 border-[#b4ff39] text-[#141414] font-bold';
                      } else if (isDataStartRow && isDataRegion) {
                          tdClass += isDarkMode ? ' bg-[#b4ff39]/20 border-t-2 border-[#b4ff39] text-[#b4ff39] font-bold' : ' bg-[#b4ff39]/30 border-t-2 border-[#b4ff39] text-[#141414] font-bold';
                      } else if (isDataStartCol && isDataRegion) {
                          tdClass += isDarkMode ? ' bg-[#b4ff39]/20 border-l-2 border-[#b4ff39] text-[#b4ff39] font-bold' : ' bg-[#b4ff39]/30 border-l-2 border-[#b4ff39] text-[#141414] font-bold';
                      } else if (isDataRegion) {
                          tdClass += isDarkMode ? ' bg-[#b4ff39]/10 text-[#b4ff39]' : ' bg-[#b4ff39]/20 text-[#141414]';
                      }
                      
                      return (
                        <td key={j} className={tdClass}>{row[j] !== undefined ? String(row[j]).slice(0,35) : ''}</td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDropdown = (label: string, value: string, setter: (val: string) => void, options: any[]) => (
    <div>
      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>{label}</label>
      <select value={value} onChange={e => setter(e.target.value)} className={`w-full border px-3 py-2 text-[10px] font-mono outline-none ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`}>
        <option value="" className={isDarkMode ? 'bg-[#1a1a1a] text-[#E4E3E0]' : 'bg-white text-[#141414]'}>-- Ignore / Not Present --</option>
        {options.map((o, i) => <option key={i} value={o} className={isDarkMode ? 'bg-[#1a1a1a] text-[#E4E3E0]' : 'bg-white text-[#141414]'}>{String(o)}</option>)}
      </select>
    </div>
  );

  return (
    <div className={`max-w-4xl mx-auto mt-12 overflow-hidden mb-12 flex flex-col transition-colors ${
      isDarkMode 
        ? 'bg-[#141414] border border-[#333] shadow-[4px_4px_0_0_#333] text-[#E4E3E0]' 
        : 'bg-white border border-[#141414] shadow-[4px_4px_0_0_#141414] text-[#141414]'
    }`}>
      <div className={`p-6 transition-colors ${
        isDarkMode ? 'border-b border-[#333] bg-[#000]' : 'border-b border-[#141414] bg-[#E4E3E0]'
      }`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-black tracking-tighter uppercase">Smart Upload Wizard</h2>
        </div>
        
        {/* Breadcrumb Header */}
        <div className="flex gap-2 text-[10px] font-mono font-bold uppercase tracking-widest overflow-x-auto pb-2">
          {['1. Topology', '2. Weights', '3. Direction', '4. Format', '5. Map'].map((b, i) => {
             const s = i + 1;
             return (
               <button 
                  key={s}
                  onClick={() => { if (s < step) setStep(s); }}
                  disabled={s >= step}
                  className={`whitespace-nowrap transition-all ${
                    step === s ? 'text-[#141414]' : s < step ? 'text-[#141414]/60 hover:text-[#141414] cursor-pointer' : 'text-[#141414]/30'
                  }`}
               >
                 {b}{i < 4 ? <span className="mx-2 opacity-30">&gt;</span> : ''}
               </button>
             );
          })}
        </div>
      </div>

      <div className="p-8">
        {error && (
          <div className="mb-6 bg-white border border-red-600 p-4 text-[10px] font-mono font-bold uppercase text-red-600">
            ERR: {error}
          </div>
        )}

        {/* STEP 1: Topology */}
        <div className={`transition-all duration-300 ${step !== 1 ? 'hidden' : 'block'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="font-mono text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5">STEP 01</div>
            <h3 className="text-sm font-bold uppercase tracking-widest">Select Network Topology</h3>
          </div>
          <div className="ml-14 grid grid-cols-2 gap-4">
            {['Unipartite', 'Bipartite'].map((cat: any) => (
              <label key={cat} className={`cursor-pointer min-h-[100px] border p-4 flex flex-col items-start justify-center gap-2 transition-all ${topology === cat ? (isDarkMode ? 'border-[#E4E3E0] bg-[#E4E3E0] text-[#141414] shadow-[inset_2px_2px_0_0_rgba(0,0,0,0.2)]' : 'border-[#141414] bg-[#141414] text-[#E4E3E0] shadow-[inset_2px_2px_0_0_rgba(255,255,255,0.2)]') : (isDarkMode ? 'border-[#333] bg-[#141414] text-[#E4E3E0] hover:bg-white/5' : 'border-[#141414] bg-white text-[#141414] hover:bg-black/5')}`}>
                <input type="radio" value={cat} className="hidden" checked={topology === cat} onChange={() => setTopology(cat)} />
                <span className="font-bold uppercase tracking-widest text-xs">{cat} ({(cat === 'Unipartite' ? '1-Mode' : '2-Mode')})</span>
              </label>
            ))}
            <div className="col-span-2 mt-6 flex justify-end">
              <button onClick={() => setStep(2)} className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:invert transition-all border ${isDarkMode ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0] border-[#141414]'}`}>Next</button>
            </div>
          </div>
        </div>

        {/* STEP 2: Weights */}
        <div className={`transition-all duration-300 ${step !== 2 ? 'hidden' : 'block'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="font-mono text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5">STEP 02</div>
            <h3 className="text-sm font-bold uppercase tracking-widest">Does the network have weights?</h3>
          </div>
          <div className="ml-14 grid grid-cols-2 gap-4">
            <label className={`cursor-pointer min-h-[100px] border p-4 flex flex-col items-start justify-center gap-2 transition-all ${isWeighted === true ? (isDarkMode ? 'border-[#E4E3E0] bg-[#E4E3E0] text-[#141414] shadow-[inset_2px_2px_0_0_rgba(0,0,0,0.2)]' : 'border-[#141414] bg-[#141414] text-[#E4E3E0] shadow-[inset_2px_2px_0_0_rgba(255,255,255,0.2)]') : (isDarkMode ? 'border-[#333] bg-[#141414] text-[#E4E3E0] hover:bg-white/5' : 'border-[#141414] bg-white text-[#141414] hover:bg-black/5')}`}>
              <input type="radio" className="hidden" checked={isWeighted === true} onChange={() => setIsWeighted(true)} />
              <span className="font-bold uppercase tracking-widest text-xs">Weighted</span>
            </label>
            <label className={`cursor-pointer min-h-[100px] border p-4 flex flex-col items-start justify-center gap-2 transition-all ${isWeighted === false ? (isDarkMode ? 'border-[#E4E3E0] bg-[#E4E3E0] text-[#141414] shadow-[inset_2px_2px_0_0_rgba(0,0,0,0.2)]' : 'border-[#141414] bg-[#141414] text-[#E4E3E0] shadow-[inset_2px_2px_0_0_rgba(255,255,255,0.2)]') : (isDarkMode ? 'border-[#333] bg-[#141414] text-[#E4E3E0] hover:bg-white/5' : 'border-[#141414] bg-white text-[#141414] hover:bg-black/5')}`}>
              <input type="radio" className="hidden" checked={isWeighted === false} onChange={() => setIsWeighted(false)} />
              <span className="font-bold uppercase tracking-widest text-xs">Unweighted</span>
            </label>
            <div className="col-span-2 mt-6 flex justify-between">
              <button onClick={() => setStep(1)} className={`border border-transparent text-[10px] font-bold px-6 py-3 uppercase tracking-widest transition-all ${isDarkMode ? 'text-[#E4E3E0] hover:border-[#E4E3E0]' : 'text-[#141414] hover:border-[#141414]'}`}>Back</button>
              <button onClick={() => setStep(3)} className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:invert transition-all border ${isDarkMode ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0] border-[#141414]'}`}>Next</button>
            </div>
          </div>
        </div>

        {/* STEP 3: Directionality */}
        <div className={`transition-all duration-300 ${step !== 3 ? 'hidden' : 'block'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="font-mono text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5">STEP 03</div>
            <h3 className="text-sm font-bold uppercase tracking-widest">Is the network directed?</h3>
          </div>
          <div className="ml-14 grid grid-cols-2 gap-4">
            <label className={`cursor-pointer min-h-[100px] border p-4 flex flex-col items-start justify-center gap-2 transition-all ${isDirected === true ? (isDarkMode ? 'border-[#E4E3E0] bg-[#E4E3E0] text-[#141414] shadow-[inset_2px_2px_0_0_rgba(0,0,0,0.2)]' : 'border-[#141414] bg-[#141414] text-[#E4E3E0] shadow-[inset_2px_2px_0_0_rgba(255,255,255,0.2)]') : (isDarkMode ? 'border-[#333] bg-[#141414] text-[#E4E3E0] hover:bg-white/5' : 'border-[#141414] bg-white text-[#141414] hover:bg-black/5')}`}>
              <input type="radio" className="hidden" checked={isDirected === true} onChange={() => setIsDirected(true)} />
              <span className="font-bold uppercase tracking-widest text-xs">Directed</span>
            </label>
            <label className={`cursor-pointer min-h-[100px] border p-4 flex flex-col items-start justify-center gap-2 transition-all ${isDirected === false ? (isDarkMode ? 'border-[#E4E3E0] bg-[#E4E3E0] text-[#141414] shadow-[inset_2px_2px_0_0_rgba(0,0,0,0.2)]' : 'border-[#141414] bg-[#141414] text-[#E4E3E0] shadow-[inset_2px_2px_0_0_rgba(255,255,255,0.2)]') : (isDarkMode ? 'border-[#333] bg-[#141414] text-[#E4E3E0] hover:bg-white/5' : 'border-[#141414] bg-white text-[#141414] hover:bg-black/5')}`}>
              <input type="radio" className="hidden" checked={isDirected === false} onChange={() => setIsDirected(false)} />
              <span className="font-bold uppercase tracking-widest text-xs">Undirected</span>
            </label>
            <div className="col-span-2 mt-6 flex justify-between">
              <button onClick={() => setStep(2)} className={`border border-transparent text-[10px] font-bold px-6 py-3 uppercase tracking-widest transition-all ${isDarkMode ? 'text-[#E4E3E0] hover:border-[#E4E3E0]' : 'text-[#141414] hover:border-[#141414]'}`}>Back</button>
              <button onClick={() => setStep(4)} className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:invert transition-all border ${isDarkMode ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0] border-[#141414]'}`}>Next</button>
            </div>
          </div>
        </div>

        {/* STEP 4: Input Format */}
        <div className={`transition-all duration-300 ${step !== 4 ? 'hidden' : 'block'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="font-mono text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5">STEP 04</div>
            <h3 className="text-sm font-bold uppercase tracking-widest">Select Input Format & Upload</h3>
          </div>
          <div className="ml-14">
            <div className="relative mb-6">
              <select 
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className={`w-full border px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none appearance-none cursor-pointer transition-all ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0] hover:bg-[#222]' : 'border-[#141414] bg-white text-[#141414] hover:bg-black/5'}`}
              >
                {availableFormats.map(opt => <option key={opt} value={opt} className={isDarkMode ? 'bg-[#1a1a1a] text-[#E4E3E0]' : 'bg-white text-[#141414]'}>{opt}</option>)}
              </select>
            </div>
            
            {/* Upload zones */}
            <div className="space-y-6">
              {format === 'Standard JSON' && (
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Standard JSON Upload</label>
                  <label className={`flex flex-col items-center justify-center w-full h-32 border border-dashed cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0]/50 bg-[#222]/30 hover:bg-[#222]' : 'border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#E4E3E0]'}`}>
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                      <p className="text-[10px] font-mono opacity-60 mt-1">{jsonFile?.name || '---'}</p>
                    </div>
                    <input type="file" className="hidden" accept=".json" onChange={e => setJsonFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              )}

              {isFormatMatrix && (
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Matrix Dataset (CSV)</label>
                  <label className={`flex flex-col items-center justify-center w-full h-32 border border-dashed cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0]/50 bg-[#222]/30 hover:bg-[#222]' : 'border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#E4E3E0]'}`}>
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                      <p className="text-[10px] font-mono opacity-60 mt-1">{singleMatrixFile?.name || '---'}</p>
                    </div>
                    <input type="file" className="hidden" accept=".csv" onChange={e => setSingleMatrixFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              )}

              {isFormatDualMatrix && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Raw Matrix (CSV)</label>
                    <label className={`flex flex-col items-center justify-center w-full h-32 border border-dashed cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0]/50 bg-[#222]/30 hover:bg-[#222]' : 'border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#E4E3E0]'}`}>
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                        <p className="text-[10px] font-mono opacity-60 mt-1">{countsFile?.name || '---'}</p>
                      </div>
                      <input type="file" className="hidden" accept=".csv" onChange={e => setCountsFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Secondary Matrix (CSV)</label>
                    <label className={`flex flex-col items-center justify-center w-full h-32 border border-dashed cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0]/50 bg-[#222]/30 hover:bg-[#222]' : 'border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#E4E3E0]'}`}>
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                        <p className="text-[10px] font-mono opacity-60 mt-1">{percentagesFile?.name || '---'}</p>
                      </div>
                      <input type="file" className="hidden" accept=".csv" onChange={e => setPercentagesFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              )}

              {isFormatEdgeList && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Edges (CSV) *</label>
                    <label className={`flex flex-col items-center justify-center w-full h-32 border border-dashed cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0]/50 bg-[#222]/30 hover:bg-[#222]' : 'border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#E4E3E0]'}`}>
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                        <p className="text-[10px] font-mono opacity-60 mt-1">{edgesFile?.name || '---'}</p>
                      </div>
                      <input type="file" className="hidden" accept=".csv" onChange={e => setEdgesFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Nodes (CSV) {(format !== 'Bipartite Edge List' && format !== 'Directed Bipartite Edge List') && '[Optional]'}</label>
                    <label className={`flex flex-col items-center justify-center w-full h-32 border border-dashed cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0]/50 bg-[#222]/30 hover:bg-[#222]' : 'border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#E4E3E0]'}`}>
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                        <p className="text-[10px] font-mono opacity-60 mt-1">{nodesFile?.name || '---'}</p>
                      </div>
                      <input type="file" className="hidden" accept=".csv" onChange={e => setNodesFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
              )}

              {isFormatAdjList && (
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Adjacency List (CSV)</label>
                  <label className={`flex flex-col items-center justify-center w-full h-32 border border-dashed cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0]/50 bg-[#222]/30 hover:bg-[#222]' : 'border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#E4E3E0]'}`}>
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                      <p className="text-[10px] font-mono opacity-60 mt-1">{adjListFile?.name || '---'}</p>
                    </div>
                    <input type="file" className="hidden" accept=".csv" onChange={e => setAdjListFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              )}
            </div>

            {format !== 'Standard JSON' && (
              <div className="mt-6 border-t border-dashed pt-6" style={{ borderColor: isDarkMode ? '#333' : '#d0d0d0' }}>
                <label className="flex items-center space-x-2 cursor-pointer mb-4">
                  <input type="checkbox" checked={hasAdditionalAttributes} onChange={e => setHasAdditionalAttributes(e.target.checked)} className="accent-[#141414] dark:accent-[#E4E3E0]" />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Upload Additional Node/Edge Attributes</span>
                </label>
                {hasAdditionalAttributes && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {!isFormatEdgeList && (
                      <div>
                        <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Additional Edges (CSV) [Optional]</label>
                        <label className={`flex flex-col items-center justify-center w-full h-32 border border-dashed cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0]/50 bg-[#222]/30 hover:bg-[#222]' : 'border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#E4E3E0]'}`}>
                          <div className="flex flex-col items-center justify-center">
                            <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                            <p className="text-[10px] font-mono opacity-60 mt-1">{edgesFile?.name || '---'}</p>
                          </div>
                          <input type="file" className="hidden" accept=".csv" onChange={e => setEdgesFile(e.target.files?.[0] || null)} />
                        </label>
                      </div>
                    )}
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Additional Nodes (CSV) [Optional]</label>
                      <label className={`flex flex-col items-center justify-center w-full h-32 border border-dashed cursor-pointer transition-colors ${isDarkMode ? 'border-[#E4E3E0]/50 bg-[#222]/30 hover:bg-[#222]' : 'border-[#141414] bg-[#E4E3E0]/30 hover:bg-[#E4E3E0]'}`}>
                        <div className="flex flex-col items-center justify-center">
                          <p className="text-[10px] font-bold tracking-widest uppercase">Select File</p>
                          <p className="text-[10px] font-mono opacity-60 mt-1">{nodesFile?.name || '---'}</p>
                        </div>
                        <input type="file" className="hidden" accept=".csv" onChange={e => setNodesFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={`mt-8 flex justify-between border-t pt-6 ${isDarkMode ? 'border-[#333]' : 'border-[#141414]'}`}>
              <button onClick={() => setStep(3)} className={`border border-transparent text-[10px] font-bold px-6 py-3 uppercase tracking-widest transition-all ${isDarkMode ? 'text-[#E4E3E0] hover:border-[#E4E3E0]' : 'text-[#141414] hover:border-[#141414]'}`}>Back</button>
              <button 
                disabled={!isStep4Valid() || isProcessing}
                onClick={handleParseAndReview} 
                className={`text-[10px] px-6 py-3 font-bold uppercase tracking-widest hover:invert transition-all border disabled:opacity-50 ${isDarkMode ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0] border-[#141414]'}`}>
                {isProcessing ? 'Reading...' : 'Next'}
              </button>
            </div>
          </div>
        </div>

        {/* STEP 5: Data Mapping & Finalize */}
        <div className={`transition-all duration-300 ${step !== 5 ? 'hidden' : 'block'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="font-mono text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5">STEP 05</div>
            <h3 className="text-sm font-bold uppercase tracking-widest">Data Review & Column Mapping</h3>
          </div>
          <div className="ml-14">
            
            {isFormatEdgeList && parsedData.edges && (
               <div className="space-y-6">
                 {renderTablePreview(parsedData.edges, 'Edges Dataset')}
                 <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
                   {renderDropdown('Source Col', sourceCol, setSourceCol, parsedData.edges[0] || [])}
                   {renderDropdown('Target Col', targetCol, setTargetCol, parsedData.edges[0] || [])}
                   {renderDropdown('Weight Col', weightRawCol, setWeightRawCol, parsedData.edges[0] || [])}
                   {renderDropdown('Weight (Sec)', weightSecCol, setWeightSecCol, parsedData.edges[0] || [])}
                 </div>
               </div>
            )}
               
            {parsedData.additionalEdges && (
               <div className="space-y-6">
                 {renderTablePreview(parsedData.additionalEdges, 'Additional Edges Attributes')}
                 <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
                   {renderDropdown('Source Col', sourceCol, setSourceCol, parsedData.additionalEdges[0] || [])}
                   {renderDropdown('Target Col', targetCol, setTargetCol, parsedData.additionalEdges[0] || [])}
                   {renderDropdown('Weight Col', weightRawCol, setWeightRawCol, parsedData.additionalEdges[0] || [])}
                   {renderDropdown('Weight (Sec)', weightSecCol, setWeightSecCol, parsedData.additionalEdges[0] || [])}
                 </div>
               </div>
            )}
            
            {parsedData.nodes && (
               <div className="space-y-6">
                 {renderTablePreview(parsedData.nodes, 'Nodes Dataset')}
                 <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
                   {renderDropdown('Node ID Col', nodeIdCol, setNodeIdCol, parsedData.nodes[0] || [])}
                   {renderDropdown('Label Col', nodeLabelCol, setNodeLabelCol, parsedData.nodes[0] || [])}
                   {renderDropdown('Type Col', nodeTypeCol, setNodeTypeCol, parsedData.nodes[0] || [])}
                   {renderDropdown('Community Col', nodeCommunityCol, setNodeCommunityCol, parsedData.nodes[0] || [])}
                   {renderDropdown('Size/Abundance Col', nodeAbundCol, setNodeAbundCol, parsedData.nodes[0] || [])}
                 </div>
               </div>
            )}

            {isFormatDualMatrix && (
               <>
                 {renderTablePreview(parsedData.counts, 'Counts Matrix', true)}
                 {renderTablePreview(parsedData.percentages, 'Secondary Matrix', true)}
               </>
            )}

            {isFormatMatrix && (
               renderTablePreview(parsedData.matrix, 'Adjacency/Incidence Matrix', true)
            )}
            
            {isFormatAdjList && parsedData.adjList && (
               <div className="space-y-6">
                 {renderTablePreview(parsedData.adjList, 'Adjacency List', true)}
                 <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
                   {renderDropdown('Source Col', adjSourceCol, setAdjSourceCol, parsedData.adjList[0] || [])}
                   <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Data Start Row Index</label>
                      <input type="number" value={dataStartRow} onChange={e => setDataStartRow(e.target.value === '' ? '' : parseInt(e.target.value))} min={1} className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`} />
                   </div>
                   <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Data Start Col Index</label>
                      <input type="number" value={dataStartCol} onChange={e => setDataStartCol(e.target.value === '' ? '' : parseInt(e.target.value))} min={1} className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`} />
                   </div>
                 </div>
               </div>
            )}

            {format === 'Standard JSON' && parsedData.jsonEdges && (
               <div className="space-y-6">
                 {renderTablePreview(parsedData.jsonEdges, 'JSON Edges Dataset')}
                 <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
                   {renderDropdown('Source Property', sourceCol, setSourceCol, parsedData.jsonEdges[0] || [])}
                   {renderDropdown('Target Property', targetCol, setTargetCol, parsedData.jsonEdges[0] || [])}
                   {renderDropdown('Weight Property', weightRawCol, setWeightRawCol, parsedData.jsonEdges[0] || [])}
                   {renderDropdown('Weight (Sec) Property', weightSecCol, setWeightSecCol, parsedData.jsonEdges[0] || [])}
                 </div>
               </div>
            )}
            
            {format === 'Standard JSON' && parsedData.jsonNodes && (
               <div className="space-y-6 mt-6">
                 {renderTablePreview(parsedData.jsonNodes, 'JSON Nodes Dataset')}
                 <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 p-4 border mb-6 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
                   {renderDropdown('Node ID Property', nodeIdCol, setNodeIdCol, parsedData.jsonNodes[0] || [])}
                   {renderDropdown('Label Property', nodeLabelCol, setNodeLabelCol, parsedData.jsonNodes[0] || [])}
                   {renderDropdown('Type Property', nodeTypeCol, setNodeTypeCol, parsedData.jsonNodes[0] || [])}
                   {renderDropdown('Community Property', nodeCommunityCol, setNodeCommunityCol, parsedData.jsonNodes[0] || [])}
                   {renderDropdown('Size/Abundance Property', nodeAbundCol, setNodeAbundCol, parsedData.jsonNodes[0] || [])}
                 </div>
               </div>
            )}

            {(isFormatMatrix || isFormatDualMatrix) && (
               <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 border mb-6 mt-4 ${isDarkMode ? 'border-[#333] bg-[#222]/30' : 'border-[#141414] bg-[#E4E3E0]/30'}`}>
                 <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Row Headers Col Index</label>
                    <input type="number" value={rowHeadersCol} onChange={e => setRowHeadersCol(e.target.value === '' ? '' : parseInt(e.target.value))} min={0} className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`} />
                 </div>
                 <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Col Headers Row Index</label>
                    <input type="number" value={colHeadersRow} onChange={e => setColHeadersRow(e.target.value === '' ? '' : parseInt(e.target.value))} min={0} className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`} />
                 </div>
                 <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Data Start Row Index</label>
                    <input type="number" value={dataStartRow} onChange={e => setDataStartRow(e.target.value === '' ? '' : parseInt(e.target.value))} min={1} className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`} />
                 </div>
                 <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-[#E4E3E0]' : 'text-[#141414]'}`}>Data Start Col Index</label>
                    <input type="number" value={dataStartCol} onChange={e => setDataStartCol(e.target.value === '' ? '' : parseInt(e.target.value))} min={1} className={`w-full border px-3 py-2 font-mono text-[10px] ${isDarkMode ? 'border-[#333] bg-[#1a1a1a] text-[#E4E3E0]' : 'border-[#141414] bg-white text-[#141414]'}`} />
                 </div>
               </div>
            )}

            <div className={`p-6 text-xs font-mono mb-6 mt-8 ${isDarkMode ? 'bg-[#1a1a1a] border border-[#333] text-[#E4E3E0]' : 'bg-[#141414] text-[#E4E3E0]'}`}>
               <div className="font-bold uppercase tracking-widest mb-4">Network Summary Preview</div>
               <div><span className="text-[#E4E3E0]/60">Nodes Extracted:</span> <span className="font-bold text-[#b4ff39]">{previewGraph.nodes.length}</span></div>
               <div><span className="text-[#E4E3E0]/60">Edges Extracted:</span> <span className="font-bold text-[#b4ff39]">{previewGraph.edges.length}</span></div>
               <div className="mt-2"><span className="text-[#E4E3E0]/60">Directed:</span> {isDirected ? 'Yes' : 'No'}</div>
               <div><span className="text-[#E4E3E0]/60">Bipartite:</span> {topology === 'Bipartite' ? 'Yes' : 'No'}</div>
               <div><span className="text-[#E4E3E0]/60">Weighted:</span> {isWeighted ? 'Yes' : 'No'}</div>
            </div>

            <div className={`mt-8 flex justify-between border-t pt-6 ${isDarkMode ? 'border-[#333]' : 'border-[#141414]'}`}>
              <button onClick={() => setStep(4)} className={`border border-transparent text-[10px] font-bold px-6 py-3 uppercase tracking-widest transition-all ${isDarkMode ? 'text-[#E4E3E0] hover:border-[#E4E3E0]' : 'text-[#141414] hover:border-[#141414]'}`}>Back</button>
              <button 
                disabled={(isFormatMatrix || isFormatDualMatrix) ? (rowHeadersCol === '' || colHeadersRow === '' || dataStartRow === '' || dataStartCol === '') : (isFormatAdjList ? (dataStartRow === '' || dataStartCol === '') : false)}
                onClick={handleFinalize} 
                className={`text-[10px] px-8 py-3 font-bold uppercase tracking-widest hover:invert transition-all border disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:invert-0 ${isDarkMode ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'bg-[#141414] text-[#b4ff39] border-[#141414]'}`}>
                Confirm & Plot Network
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
