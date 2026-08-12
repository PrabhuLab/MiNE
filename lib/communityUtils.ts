export interface CommunityDisplayResult {
  displayMap: Record<string, number>;
  rawToDisplayMap: Record<string, number>;
  displayToRawMap: Record<number, string>;
}

/**
 * Normalizes community assignments to 0-indexed contiguous integer IDs.
 */
export function normalize_communities(communities: Record<string, number | string>): Record<string, number> {
  const uniqueVals = Array.from(new Set(Object.values(communities)))
    .map((v) => String(v))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const valToIdxMap: Record<string, number> = {};
  uniqueVals.forEach((val, idx) => {
    valToIdxMap[val] = idx;
  });

  const result: Record<string, number> = {};
  Object.keys(communities).forEach((nodeId) => {
    const rawVal = String(communities[nodeId]);
    result[nodeId] = valToIdxMap[rawVal] !== undefined ? valToIdxMap[rawVal] : 0;
  });

  return result;
}

/**
 * Converts HSL to Hex
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Persistent color registry to preserve mapping across live updates, refreshes, filtering, and D3/Sigma switching
const communityColorRegistry = new Map<string, string>();
let startHue: number | null = null;

/**
 * Converts OKLCH (Lightness 0..1, Chroma 0..0.4, Hue 0..360) to sRGB Hex string (#RRGGBB).
 */
export function oklchToHex(l: number, c: number, hDeg: number): string {
  const hRad = (hDeg * Math.PI) / 180;
  const aLab = c * Math.cos(hRad);
  const bLab = c * Math.sin(hRad);

  // OKLab to LMS
  const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
  const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
  const s_ = l - 0.0894841775 * aLab - 1.291485548 * bLab;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  // LMS to Linear sRGB
  const rLin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLin = -0.041119829 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // Linear sRGB to gamma-corrected sRGB
  const gamma = (x: number) => {
    if (x <= 0.0031308) return 12.92 * x;
    return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };

  const r = Math.min(255, Math.max(0, Math.round(gamma(rLin) * 255)));
  const g = Math.min(255, Math.max(0, Math.round(gamma(gLin) * 255)));
  const b = Math.min(255, Math.max(0, Math.round(gamma(bLin) * 255)));

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Resets community color cache and picks a fresh random starting hue for new network imports.
 */
export function resetCommunityColorCache() {
  communityColorRegistry.clear();
  startHue = Math.floor(Math.random() * 360);
}

/**
 * Generates restrained OKLCH color using golden-angle sequence from random starting hue.
 */
export function generateRandomRestrainedColor(index?: number): string {
  if (startHue === null) {
    startHue = Math.floor(Math.random() * 360);
  }
  const idx = index ?? communityColorRegistry.size;
  const GOLDEN_ANGLE = 137.50776405003785;
  const hue = (startHue + idx * GOLDEN_ANGLE) % 360;
  return oklchToHex(0.68, 0.15, hue);
}

/**
 * Gets or generates a stable community color keyed by raw community ID.
 */
export function getCommunityColor(community: string | number, allCommunities?: string[]): string {
  const strVal = String(community);
  if (strVal === '-1' || strVal === 'unassigned') return '#777777';

  if (communityColorRegistry.has(strVal)) {
    return communityColorRegistry.get(strVal)!;
  }

  const color = generateRandomRestrainedColor();
  communityColorRegistry.set(strVal, color);
  return color;
}

/**
 * Helper for legacy or contiguous index color lookup.
 */
export function getDistinctColor(displayIndex: number): string {
  if (displayIndex < 0) return '#777777';
  const strVal = `display_${displayIndex}`;
  if (!communityColorRegistry.has(strVal)) {
    communityColorRegistry.set(strVal, generateRandomRestrainedColor(displayIndex));
  }
  return communityColorRegistry.get(strVal)!;
}

/**
 * Builds a deterministic contiguous display mapping for community IDs (0, 1, 2, 3...)
 * ignoring noise / unassigned (-1).
 */
export function getCommunityDisplayMap(
  nodes: { id: string; community?: string | number; [key: string]: any }[],
  communityMap: Record<string, string>,
  networkMetrics?: any[],
  nodeColorBase?: string,
  customNodeAttribute?: string,
): CommunityDisplayResult {
  const rawSet = new Set<string>();

  nodes.forEach((n) => {
    let rawVal: string | undefined;
    if (nodeColorBase === 'louvain' || nodeColorBase === 'infomap' || nodeColorBase === 'fast_greedy') {
      const net = (networkMetrics || []).find((m) => m.id === n.id);
      if (net && net[nodeColorBase]) rawVal = String(net[nodeColorBase]);
    } else if (nodeColorBase === 'custom' && customNodeAttribute) {
      rawVal = n[customNodeAttribute] !== undefined ? String(n[customNodeAttribute]) : undefined;
    } else {
      rawVal = communityMap[n.id] ?? (n.community !== undefined ? String(n.community) : undefined);
    }

    if (rawVal !== undefined && rawVal !== null && rawVal !== '' && rawVal !== '-1' && rawVal !== 'unassigned') {
      rawSet.add(rawVal);
    }
  });

  // Sort raw IDs deterministically
  const sortedRaw = Array.from(rawSet).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  const displayMap: Record<string, number> = {};
  const rawToDisplayMap: Record<string, number> = {};
  const displayToRawMap: Record<number, string> = {};

  sortedRaw.forEach((raw, index) => {
    rawToDisplayMap[raw] = index;
    displayToRawMap[index] = raw;
    
    // Pre-populate color registry for each active community
    if (!communityColorRegistry.has(raw)) {
      communityColorRegistry.set(raw, generateRandomRestrainedColor(index));
    }
  });

  nodes.forEach((n) => {
    let rawVal: string | undefined;
    if (nodeColorBase === 'louvain' || nodeColorBase === 'infomap' || nodeColorBase === 'fast_greedy') {
      const net = (networkMetrics || []).find((m) => m.id === n.id);
      if (net && net[nodeColorBase]) rawVal = String(net[nodeColorBase]);
    } else if (nodeColorBase === 'custom' && customNodeAttribute) {
      rawVal = n[customNodeAttribute] !== undefined ? String(n[customNodeAttribute]) : undefined;
    } else {
      rawVal = communityMap[n.id] ?? (n.community !== undefined ? String(n.community) : undefined);
    }

    if (rawVal !== undefined && rawToDisplayMap[rawVal] !== undefined) {
      displayMap[n.id] = rawToDisplayMap[rawVal];
    } else {
      displayMap[n.id] = -1;
    }
  });

  return { displayMap, rawToDisplayMap, displayToRawMap };
}
