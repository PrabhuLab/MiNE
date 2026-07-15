const fs = require('fs');
let code = fs.readFileSync('./components/D3Graph.tsx', 'utf8');

// First, remove them from inside useEffect
code = code.replace("const typeColorScale = d3.scaleOrdinal(d3.schemeCategory10);\n", "");
code = code.replace(/const getNodeColor = \(d: any\) => \{[\s\S]*?\};\n/, "");
code = code.replace(/const maxRaw = [^\n]+\n/g, "");
code = code.replace(/const maxSec = [^\n]+\n/g, "");
code = code.replace(/const rawColorScale = [^\n]+\n/g, "");
code = code.replace(/const secColorScale = [^\n]+\n/g, "");
code = code.replace(/const getEdgeColor = \(d: any\) => \{[\s\S]*?\};\n/, "");
code = code.replace(/const getEdgeOpacity = \(d: any\) => \{[\s\S]*?\};\n/, "");

// Then add them to the top of the component (e.g. before useEffects)
const functions = `
  const typeColorScale = useMemo(() => d3.scaleOrdinal(d3.schemeCategory10), []);
  const getNodeColor = useCallback((d: any) => {
    const defaultNodeColor = isDarkMode ? '#bbbbbb' : '#141414';
    if (nodeColorBase === 'community') return communityColorMap[communityMap[d.id]] || defaultNodeColor;
    if (nodeColorBase === 'type' && d.type) return typeColorScale(d.type);
    return defaultNodeColor;
  }, [isDarkMode, nodeColorBase, communityColorMap, communityMap, typeColorScale]);

  const maxRaw = useMemo(() => d3.max(edges, (d: any) => d.weight_raw) || 1, [edges]);
  const maxSec = useMemo(() => d3.max(edges, (d: any) => d.weight_secondary) || 1, [edges]);
  const rawColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateGnBu : d3.interpolateBlues).domain([0, maxRaw]), [isDarkMode, maxRaw]);
  const secColorScale = useMemo(() => d3.scaleSequential(isDarkMode ? d3.interpolateOrRd : d3.interpolateOranges).domain([0, maxSec]), [isDarkMode, maxSec]);

  const getEdgeColor = useCallback((d: any) => {
    if (edgeColorBase === 'weight_raw' && d.weight_raw !== undefined) return rawColorScale(d.weight_raw);
    if (edgeColorBase === 'weight_secondary' && d.weight_secondary !== undefined) return secColorScale(d.weight_secondary);
    return isDarkMode ? '#eeeeee' : '#141414';
  }, [edgeColorBase, rawColorScale, secColorScale, isDarkMode]);

  const getEdgeOpacity = useCallback((d: any) => {
    if (edgeOpacityBase === 'weight_raw' && d.weight_raw !== undefined) return 0.1 + 0.9 * (d.weight_raw / maxRaw);
    if (edgeOpacityBase === 'weight_secondary' && d.weight_secondary !== undefined) return 0.1 + 0.9 * (d.weight_secondary / maxSec);
    return edgeOpacity;
  }, [edgeOpacityBase, maxRaw, maxSec, edgeOpacity]);
`;

code = code.replace("const runtimeRef = useRef({ livePhysics, isFrozen });", functions + "\n  const runtimeRef = useRef({ livePhysics, isFrozen });");

fs.writeFileSync('./components/D3Graph.tsx', code);
