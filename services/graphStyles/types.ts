export interface LegendMetricScale {
  title: string;
  description?: string;
  visual?: 'color' | 'size' | 'width';
  min: number;
  max: number;
  ticks: number[];
  scale?: (value: number) => string;
  colorKeys?: { min: string; max: string };
  colors?: { min: string; max: string };
}

export interface LegendCategoryItem {
  label: string;
  id: string;
  color: string;
  nodes?: string[];
  nodeIds?: string[];
  edgeIds?: string[];
  allIds: string[];
  colorKey?: string;
}

export interface LegendCategories {
  title: string;
  items: LegendCategoryItem[];
}
