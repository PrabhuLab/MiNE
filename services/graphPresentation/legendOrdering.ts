const legendCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
});

export function sortLegendEntries<T>(
  entries: readonly T[],
  labelFor: (entry: T) => string,
): T[] {
  return [...entries].sort((left, right) =>
    legendCollator.compare(labelFor(left), labelFor(right)),
  );
}
