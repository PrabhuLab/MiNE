export function meaningful(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function numeric(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function serializableValue(value: any): any {
  if (value === undefined || typeof value === 'function') return undefined;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function cleanAttributes(attributes: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  Object.entries(attributes || {}).forEach(([key, value]) => {
    if (key === 'rawNode' || key === 'rawEdge') return;
    const cleaned = serializableValue(value);
    if (cleaned !== undefined) result[key] = cleaned;
  });
  return result;
}
