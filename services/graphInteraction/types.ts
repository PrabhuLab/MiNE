export interface TooltipData {
  x: number;
  y: number;
  title: string;
  items?: { label: string; value: string | number }[];
}
