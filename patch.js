const fs = require('fs');
const content = fs.readFileSync('components/Workspace.tsx', 'utf8');

const target = `  const [activeTab, setActiveTab] = useState<"graph" | "data">("graph");`;
const replacement = `  const [activeTab, setActiveTab] = useState<"graph" | "data">("graph");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: "asc" | "desc" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleExport = (format: string) => {
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
`;

const updatedContent = content.replace(`  const [activeTab, setActiveTab] = useState<"graph" | "data">("graph");\n  const [sortConfig, setSortConfig] = useState<{ key: string, direction: "asc" | "desc" } | null>(null);\n  const [searchQuery, setSearchQuery] = useState("");`, replacement);
fs.writeFileSync('components/Workspace.tsx', updatedContent);
