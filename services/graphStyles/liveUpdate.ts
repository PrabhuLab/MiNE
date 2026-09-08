export function graphSettings<T extends { liveUpdate: boolean }>(draft: T, applied: T): T {
  return draft.liveUpdate ? draft : applied;
}

export function liveNumericValue(value: string, live: boolean): number | undefined {
  const numeric = Number(value);
  // The store is the draft state. `appliedFilters` controls whether renderers
  // receive it, so valid numeric edits must always enter the draft store.
  void live;
  return value !== '' && Number.isFinite(numeric) ? numeric : undefined;
}
