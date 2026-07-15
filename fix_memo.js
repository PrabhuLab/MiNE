const fs = require('fs');
let code = fs.readFileSync('./components/D3Graph.tsx', 'utf8');

code = code.replace(
  "const communityLabels = (Array.from(new Set(Object.values(communityMap))) as string[]).sort((a, b) => \n    a.toString().localeCompare(b.toString(), undefined, { numeric: true, sensitivity: 'base' })\n  );",
  "const communityLabels = useMemo(() => (Array.from(new Set(Object.values(communityMap))) as string[]).sort((a, b) => \n    a.toString().localeCompare(b.toString(), undefined, { numeric: true, sensitivity: 'base' })\n  ), [communityMap]);"
);

fs.writeFileSync('./components/D3Graph.tsx', code);
