export interface ElementLegendItem {
  id: string;
  label: string;
  Icon: React.ComponentType;
  color?: string;
  colorKey?: string;
}

export type { LegendCategoryItem, LegendCategories } from '@/services/graphStyles/types';
