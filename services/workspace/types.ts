export interface GraphFocusRequest {
  id: string;
  type: 'node' | 'edge';
  requestId: number;
  source?: string;
  target?: string;
}
