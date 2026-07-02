const fs = require('fs');
let content = fs.readFileSync('components/Workspace.tsx', 'utf8');

content = content.replace(`  const handleExport = (format: string) => {
    setShowExportMenu(false);
    if (activeTab === "graph") {
      const svgElement = document.querySelector('svg');
      if (format === 'svg') exportSvg(svgElement, 'network.svg');
      else if (format === 'png') exportImage(svgElement, 'png', 'network.png');
      else if (format === 'jpeg') exportImage(svgElement, 'jpeg', 'network.jpg');
      else if (format === 'json') {
        exportJson({ nodes: validNodes, edges: validEdges }, 'network.json');
      } else if (format === 'nodelist') {
        exportCsv(validNodes, 'nodes.csv');
      } else if (format === 'edgelist') {
        exportCsv(validEdges, 'edges.csv');
      }
    } else {
      if (format === 'csv') {
        exportCsv(tableData, 'table_data.csv');
      }
    }
  };\n`, '');

const target2 = `  const handleSort = (key: string) => {`;
const replacement2 = `  const handleExport = (format: string) => {
    setShowExportMenu(false);
    if (activeTab === "graph") {
      const svgElement = document.querySelector('svg');
      if (format === 'svg') exportSvg(svgElement, 'network.svg');
      else if (format === 'png') exportImage(svgElement, 'png', 'network.png');
      else if (format === 'jpeg') exportImage(svgElement, 'jpeg', 'network.jpg');
      else if (format === 'json') {
        exportJson({ nodes: validNodes, edges: validEdges }, 'network.json');
      } else if (format === 'nodelist') {
        exportCsv(validNodes, 'nodes.csv');
      } else if (format === 'edgelist') {
        exportCsv(validEdges, 'edges.csv');
      }
    } else {
      if (format === 'csv') {
        exportCsv(tableData, 'table_data.csv');
      }
    }
  };

  const handleSort = (key: string) => {`;

content = content.replace(target2, replacement2);
fs.writeFileSync('components/Workspace.tsx', content);
