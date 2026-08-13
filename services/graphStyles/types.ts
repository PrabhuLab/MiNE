export interface LegendMetricScale {
  title: string;
  min: number;
  max: number;
  ticks: number[];
  scale: (value: number) => string;
}
