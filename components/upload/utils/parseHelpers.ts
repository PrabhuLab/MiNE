import PapaPkg from 'papaparse';

const Papa = (PapaPkg as any).default || PapaPkg;

export async function parseCSVFile(file: File): Promise<any[][]> {
  return new Promise<any[][]>((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      header: false,
      complete: (res: any) => resolve(res.data as any[][]),
      error: reject,
    });
  });
}

export async function parseJSONFile(file: File): Promise<{ rawNodes: any[]; rawEdges: any[]; jsonNodesData: any[][]; jsonEdgesData: any[][] }> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data.nodes || !data.edges) {
    throw new Error('Invalid Standard JSON format. Missing "nodes" or "edges" property.');
  }

  const jsonEdgesData: any[][] = [];
  if (data.edges.length > 0) {
    const headers = Object.keys(data.edges[0]);
    jsonEdgesData.push(headers);
    data.edges.slice(0, 6).forEach((e: any) => {
      jsonEdgesData.push(headers.map(h => (typeof e[h] === 'object' ? JSON.stringify(e[h]) : e[h])));
    });
  }

  const jsonNodesData: any[][] = [];
  if (data.nodes.length > 0) {
    const headers = Object.keys(data.nodes[0]);
    jsonNodesData.push(headers);
    data.nodes.slice(0, 6).forEach((n: any) => {
      jsonNodesData.push(headers.map(h => (typeof n[h] === 'object' ? JSON.stringify(n[h]) : n[h])));
    });
  }

  return {
    rawNodes: data.nodes,
    rawEdges: data.edges,
    jsonNodesData,
    jsonEdgesData,
  };
}
