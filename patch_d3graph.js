const fs = require('fs');
let code = fs.readFileSync('./components/D3Graph.tsx', 'utf8');

// We need to inject scale mapping
const typeColorScale = "const typeColorScale = d3.scaleOrdinal(d3.schemeCategory10);\n";
const getNodeColor = `
    const getNodeColor = (d: any) => {
      const defaultNodeColor = isDarkMode ? '#bbbbbb' : '#141414';
      if (nodeColorBase === 'community') return communityColorMap[communityMap[d.id]] || defaultNodeColor;
      if (nodeColorBase === 'type' && d.type) return typeColorScale(d.type);
      return defaultNodeColor;
    };
`;

const getEdgeColor = `
    const maxRaw = d3.max(graphLinks, (d: any) => d.weight_raw) || 1;
    const maxSec = d3.max(graphLinks, (d: any) => d.weight_secondary) || 1;
    const rawColorScale = d3.scaleSequential(isDarkMode ? d3.interpolateGnBu : d3.interpolateBlues).domain([0, maxRaw]);
    const secColorScale = d3.scaleSequential(isDarkMode ? d3.interpolateOrRd : d3.interpolateOranges).domain([0, maxSec]);

    const getEdgeColor = (d: any) => {
      if (edgeColorBase === 'weight_raw' && d.weight_raw !== undefined) return rawColorScale(d.weight_raw);
      if (edgeColorBase === 'weight_secondary' && d.weight_secondary !== undefined) return secColorScale(d.weight_secondary);
      return isDarkMode ? '#eeeeee' : '#141414';
    };

    const getEdgeOpacity = (d: any) => {
      if (edgeOpacityBase === 'weight_raw' && d.weight_raw !== undefined) return 0.1 + 0.9 * (d.weight_raw / maxRaw);
      if (edgeOpacityBase === 'weight_secondary' && d.weight_secondary !== undefined) return 0.1 + 0.9 * (d.weight_secondary / maxSec);
      return edgeOpacity;
    };
`;

code = code.replace(
  "const strokeWidthScale = d3.scaleLinear().domain([0, maxWeight]).range([0.5, 4]);",
  "const strokeWidthScale = d3.scaleLinear().domain([0, maxWeight]).range([0.5, 4]);\n" + typeColorScale + getNodeColor + getEdgeColor
);

code = code.replace(
  ".attr('stroke', isDarkMode ? '#eeeeee' : '#141414')",
  ".attr('stroke', (d: any) => getEdgeColor(d))"
);
code = code.replace(
  ".attr('stroke-opacity', 0.25)",
  ".attr('stroke-opacity', (d: any) => getEdgeOpacity(d) * 0.3)" // scale down base opacity for dense graph slightly or just use it? No, wait, opacity is 0.25 normally.
);

// We need to replace `.attr('fill', (d: any) => communityColorMap[communityMap[d.id]] || defaultNodeColor)`
code = code.replaceAll(
  ".attr('fill', (d: any) => communityColorMap[communityMap[d.id]] || defaultNodeColor)",
  ".attr('fill', (d: any) => getNodeColor(d))"
);

fs.writeFileSync('./components/D3Graph.tsx', code);
