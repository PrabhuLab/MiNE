export interface ElementLegendItem {
  id: string;
  label: string;
  Icon: React.ComponentType;
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
