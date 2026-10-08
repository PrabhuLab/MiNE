export interface BlockModelScore {
  clusters?: number;
  rowClusters?: number;
  columnClusters?: number;
  totalGroups: number;
  trainedSuccessfully: boolean;
  withinLimit: boolean;
  fitScore: number | null;
  penalty: number;
  penaltyTerms: Record<string, number>;
  icl: number | null;
}

export interface BlockModelDiagnostics {
  schemaVersion: 'mine-block-model-1';
  algorithm: 'sbm' | 'lbm';
  labelBase: 0;
  input: {
    fingerprint: string;
    fingerprintKind: string;
    nodeIds: string[];
    edgeSources: number[];
    edgeTargets: number[];
    partitions: string[] | null;
    rowNodeIds: string[];
    columnNodeIds: string[] | null;
    graphRevision: string;
    filterRevision: string;
    nodeOrderHash: string;
    edgeOrderHash: string;
  };
  settings: Record<string, unknown>;
  softwareVersions: Record<string, string>;
  selectedModel: BlockModelScore & {
    blockProbabilities: number[][];
    modelSettings: Record<string, unknown>;
    labels?: number[];
    softMemberships?: number[][];
    groupProportions?: number[];
    rowLabels?: number[];
    columnLabels?: number[];
    rowSoftMemberships?: number[][];
    columnSoftMemberships?: number[][];
    rowGroupProportions?: number[];
    columnGroupProportions?: number[];
  };
  candidates: Array<BlockModelScore & { candidateIndex: number; deltaIcl: number | null; strategy: string; partition?: string; phase?: string }>;
  search: {
    effectiveMaxGroups: number | null;
    selectedAtLimit: boolean;
    historyCoverage: string;
    scoreConvention: string;
    convergenceConvention: string;
  };
}

export interface BlockModelRun {
  runId: string;
  calculatedAt: string;
  algorithm: 'sbm' | 'lbm';
  memberships: Record<string, string>;
  provenance: Record<string, unknown>;
  diagnostics: BlockModelDiagnostics;
  comparisons: Array<{ runId: string; adjustedRandIndex?: number; rowAdjustedRandIndex?: number; columnAdjustedRandIndex?: number }>;
}

/** Compare partitions without assuming that their community numbers match. */
export function adjustedRandIndex(first: string[], second: string[]): number {
  if (first.length !== second.length) throw new Error('Partitions must have the same node count.');
  const pairs = (count: number) => count * (count - 1) / 2;
  const cells = new Map<string, Map<string, number>>();
  const rows = new Map<string, number>();
  const columns = new Map<string, number>();
  first.forEach((label, index) => {
    const other = second[index];
    const row = cells.get(label) || new Map<string, number>();
    row.set(other, (row.get(other) || 0) + 1);
    cells.set(label, row);
    rows.set(label, (rows.get(label) || 0) + 1);
    columns.set(other, (columns.get(other) || 0) + 1);
  });
  if (first.length < 2) return 1;
  const joint = [...cells.values()].reduce((sum, row) => sum + [...row.values()].reduce((value, count) => value + pairs(count), 0), 0);
  const a = [...rows.values()].reduce((sum, count) => sum + pairs(count), 0);
  const b = [...columns.values()].reduce((sum, count) => sum + pairs(count), 0);
  const expected = a * b / pairs(first.length);
  const denominator = (a + b) / 2 - expected;
  return denominator === 0 ? 1 : (joint - expected) / denominator;
}

export function appendBlockModelRun(history: BlockModelRun[], run: BlockModelRun): BlockModelRun[] {
  const input = run.diagnostics.input;
  const compatible = history.filter((previous) => previous.algorithm === run.algorithm
    && previous.diagnostics.input.fingerprint === input.fingerprint
    && previous.diagnostics.input.nodeIds.length === input.nodeIds.length
    && input.nodeIds.every((id) => typeof previous.memberships[id] === 'string'));
  const compare = (previous: BlockModelRun, ids: string[]) => adjustedRandIndex(
    ids.map((id) => previous.memberships[id]), ids.map((id) => run.memberships[id]),
  );
  return [...history, { ...run, comparisons: compatible.map((previous) => ({
    runId: previous.runId,
    ...(run.algorithm === 'lbm' ? {
      rowAdjustedRandIndex: compare(previous, input.rowNodeIds),
      columnAdjustedRandIndex: compare(previous, input.columnNodeIds!),
    } : { adjustedRandIndex: compare(previous, input.nodeIds) }),
  })) }];
}

/** Validate array alignment before retaining a cloud fit or importing an archive. */
export function validateBlockModelDiagnostics(value: BlockModelDiagnostics): void {
  const fail = () => { throw new Error('Block model results contain invalid or misaligned fitted data.'); };
  if (!value || value.schemaVersion !== 'mine-block-model-1' || !['sbm', 'lbm'].includes(value.algorithm) || value.labelBase !== 0) fail();
  const input = value.input;
  const model = value.selectedModel;
  if (!input || !model || typeof input.fingerprint !== 'string' || !Array.isArray(input.nodeIds)
    || !input.nodeIds.every((id) => typeof id === 'string') || new Set(input.nodeIds).size !== input.nodeIds.length
    || !Array.isArray(input.rowNodeIds) || !Array.isArray(value.candidates)) fail();
  const groups = (count: number | undefined): count is number => Number.isInteger(count) && Number(count) > 0;
  const distribution = (values: number[] | undefined, length: number) => Array.isArray(values) && values.length === length
    && values.every((p) => Number.isFinite(p) && p >= 0 && p <= 1)
    && Math.abs(values.reduce((sum, p) => sum + p, 0) - 1) < 1e-6;
  const side = (ids: string[], count: number, labels?: number[], probabilities?: number[][], proportions?: number[]) => {
    if (!Array.isArray(labels) || labels.length !== ids.length || !labels.every((label) => Number.isInteger(label) && label >= 0 && label < count)
      || !Array.isArray(probabilities) || probabilities.length !== ids.length || !probabilities.every((row) => distribution(row, count))
      || !distribution(proportions, count)) fail();
  };
  let k: number, l: number;
  if (value.algorithm === 'lbm') {
    if (!groups(model.rowClusters) || !groups(model.columnClusters) || !Array.isArray(input.columnNodeIds)) return fail();
    k = model.rowClusters; l = model.columnClusters;
    const ids = [...input.rowNodeIds, ...input.columnNodeIds];
    const nodeIds = new Set(input.nodeIds);
    if (ids.length !== input.nodeIds.length || new Set(ids).size !== ids.length || !ids.every((id) => nodeIds.has(id))) fail();
    side(input.rowNodeIds, k, model.rowLabels, model.rowSoftMemberships, model.rowGroupProportions);
    side(input.columnNodeIds, l, model.columnLabels, model.columnSoftMemberships, model.columnGroupProportions);
  } else {
    if (!groups(model.clusters)) return fail();
    k = l = model.clusters;
    if (input.rowNodeIds.length !== input.nodeIds.length || input.rowNodeIds.some((id, index) => id !== input.nodeIds[index])) fail();
    side(input.nodeIds, k, model.labels, model.softMemberships, model.groupProportions);
  }
  if (!Array.isArray(model.blockProbabilities) || model.blockProbabilities.length !== k
    || !model.blockProbabilities.every((row) => Array.isArray(row) && row.length === l && row.every((p) => Number.isFinite(p) && p >= 0 && p <= 1))) fail();
}

export function restoreBlockModelRuns(value: unknown): BlockModelRun[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Saved block model runs must be an array.');
  value.forEach((run: BlockModelRun) => {
    if (!run || typeof run.runId !== 'string' || typeof run.calculatedAt !== 'string' || !run.memberships || !Array.isArray(run.comparisons)) {
      throw new Error('Saved block model run is incomplete.');
    }
    validateBlockModelDiagnostics(run.diagnostics);
    if (run.algorithm !== run.diagnostics.algorithm || !run.diagnostics.input.nodeIds.every((id) => typeof run.memberships[id] === 'string')) {
      throw new Error('Saved block model assignments do not match the fitted input.');
    }
  });
  return value;
}
