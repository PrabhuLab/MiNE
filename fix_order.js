const fs = require('fs');
let code = fs.readFileSync('./components/D3Graph.tsx', 'utf8');

// Extract the injected block
const injectedBlockRegex = /  const typeColorScale = useMemo\(\(\) => d3\.scaleOrdinal\(d3\.schemeCategory10\), \[\]\);\n  const getNodeColor = useCallback[\s\S]*?edgeOpacity\]\);\n/;
const match = code.match(injectedBlockRegex);

if (match) {
  // Remove it from the top
  code = code.replace(injectedBlockRegex, "");
  
  // Insert it after communityColorMap
  const insertTarget = "  }, [communityLabels]);\n";
  code = code.replace(insertTarget, insertTarget + "\n" + match[0]);
  fs.writeFileSync('./components/D3Graph.tsx', code);
}
