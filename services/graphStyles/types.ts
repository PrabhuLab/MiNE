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
