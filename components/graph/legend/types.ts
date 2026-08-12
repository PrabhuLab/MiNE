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
  allIds: string[];
}

export interface LegendCategories {
  title: string;
  items: LegendCategoryItem[];
}
