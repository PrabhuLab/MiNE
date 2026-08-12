import type { MetricsRequest, MetricsResult } from './types';

export interface MetricsEngine {
  compute(request: MetricsRequest): Promise<MetricsResult>;
}
