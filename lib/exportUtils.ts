import Papa from 'papaparse';
import JSZip from 'jszip';

export const downloadStringAsFile = (content: string, filename: string, type: string = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadBlobAsFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportSvg = (svgElement: SVGSVGElement | null, filename: string) => {
  if (!svgElement) return;
  const serializer = new XMLSerializer();
  
  // Clone to avoid modifying the original during export if we needed to inline styles
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  
  // Get SVG string
  const source = serializer.serializeToString(clone);
  
  // Add namespaces if missing
  let svgString = source;
  if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!svgString.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
    svgString = svgString.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  // Prepend XML declaration
  svgString = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;
  
  downloadStringAsFile(svgString, filename, 'image/svg+xml;charset=utf-8');
};

export const exportImage = (svgElement: SVGSVGElement | null, format: 'png' | 'jpeg', filename: string, isDarkMode: boolean = false) => {
  if (!svgElement) return;

  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  
  // Find zoom group to get actual content bounding box
  const zoomGroupDom = svgElement.querySelector('.zoom-group') as SVGGElement | null;
  const zoomGroupClone = clone.querySelector('.zoom-group') as SVGGElement | null;
  
  let exportWidth = 2000;
  let exportHeight = 2000;

  if (zoomGroupDom && zoomGroupClone) {
    const bbox = zoomGroupDom.getBBox();
    const padding = 50;
    
    const vbX = bbox.x - padding;
    const vbY = bbox.y - padding;
    const vbWidth = bbox.width + padding * 2;
    const vbHeight = bbox.height + padding * 2;
    
    // Set viewBox on clone to exactly match the content
    clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbWidth} ${vbHeight}`);
    
    // Remove the current zoom transform from the clone so it doesn't get offset
    zoomGroupClone.removeAttribute('transform');
    
    // Set explicit export dimensions based on bounding box ratio to ensure high res
    exportWidth = 4000; // High resolution base width
    exportHeight = exportWidth * (vbHeight / vbWidth);
    
    clone.setAttribute('width', `${exportWidth}`);
    clone.setAttribute('height', `${exportHeight}`);
  } else {
    exportWidth = (svgElement.clientWidth || 1000) * 4;
    exportHeight = (svgElement.clientHeight || 1000) * 4;
    clone.setAttribute('width', `${exportWidth}`);
    clone.setAttribute('height', `${exportHeight}`);
  }

  // Prepend XML declaration and namespaces
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(clone);
  
  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  
  const img = new Image();
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set background if it's jpeg or if we want a solid background
    if (format === 'jpeg') {
      ctx.fillStyle = isDarkMode ? '#141414' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.drawImage(img, 0, 0, exportWidth, exportHeight);
    
    const imgUrl = canvas.toDataURL(`image/${format}`, 1.0);
    const a = document.createElement('a');
    a.href = imgUrl;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  };
  
  img.src = url;
};

export const exportCsv = (data: any[], filename: string) => {
  const csv = Papa.unparse(data);
  downloadStringAsFile(csv, filename, 'text/csv;charset=utf-8;');
};

export const exportCsvZip = async (nodes: any[], edges: any[], filename: string) => {
  const zip = new JSZip();
  const nodesCsv = Papa.unparse(nodes);
  const edgesCsv = Papa.unparse(edges);
  
  zip.file("nodes.csv", nodesCsv);
  zip.file("edges.csv", edgesCsv);
  
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlobAsFile(blob, filename);
};

export const exportJson = (data: any, filename: string) => {
  const json = JSON.stringify(data, null, 2);
  downloadStringAsFile(json, filename, 'application/json;charset=utf-8;');
};

const escapeXml = (unsafe: any) => {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe).replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

export const exportGraphML = (nodes: any[], edges: any[], directed: boolean, filename: string) => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns"\n';
  xml += '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
  xml += '  xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns\n';
  xml += '  http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">\n';
  
  // Define standard keys based on the network structure
  xml += '  <key id="label" for="node" attr.name="label" attr.type="string"/>\n';
  xml += '  <key id="abundance" for="node" attr.name="abundance" attr.type="double"/>\n';
  xml += '  <key id="community" for="node" attr.name="community" attr.type="string"/>\n';
  xml += '  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>\n';
  
  xml += `  <graph id="G" edgedefault="${directed ? 'directed' : 'undirected'}">\n`;
  
  nodes.forEach(n => {
    xml += `    <node id="${escapeXml(n.id)}">\n`;
    if (n.label || n.name) xml += `      <data key="label">${escapeXml(n.label || n.name)}</data>\n`;
    if (n.abundance !== undefined) xml += `      <data key="abundance">${escapeXml(n.abundance)}</data>\n`;
    if (n.community !== undefined || n.comm !== undefined) xml += `      <data key="community">${escapeXml(n.community || n.comm)}</data>\n`;
    xml += `    </node>\n`;
  });
  
  edges.forEach(e => {
    // using e.source and e.target directly since edges represent strings here usually
    const s = typeof e.source === 'object' ? e.source.id : e.source;
    const t = typeof e.target === 'object' ? e.target.id : e.target;
    xml += `    <edge source="${escapeXml(s)}" target="${escapeXml(t)}">\n`;
    if (e.weight_raw !== undefined) xml += `      <data key="weight">${escapeXml(e.weight_raw)}</data>\n`;
    else if (e.weight !== undefined) xml += `      <data key="weight">${escapeXml(e.weight)}</data>\n`;
    xml += `    </edge>\n`;
  });
  
  xml += '  </graph>\n';
  xml += '</graphml>';
  
  downloadStringAsFile(xml, filename, 'application/xml;charset=utf-8;');
};
