'use client';

import { useMemo, useState } from 'react';
import {
  type MindatAttributeScope,
  type MindatDataset,
  type MindatDatasetQuery,
  type MindatNetworkQuery,
  type MindatNetworkTopology,
} from '@/services/mindat/client';

interface Props {
  isDarkMode: boolean;
  generating: boolean;
  error: string | null;
  onCreateDataset: (query: MindatDatasetQuery) => Promise<MindatDataset>;
  onBuildNetwork: (query: MindatNetworkQuery) => void;
}

const TOPOLOGIES: Array<{ value: MindatNetworkTopology; label: string; description: string }> = [
  { value: 'bipartite', label: 'Mineral ↔ Locality', description: 'Occurrence edges connect the two node types.' },
  { value: 'mineral', label: 'Mineral projection', description: 'Minerals connect when they share a locality.' },
  { value: 'locality', label: 'Locality projection', description: 'Localities connect when they share a mineral.' },
];

const DEFAULT_ATTRIBUTES: Record<MindatAttributeScope, string[]> = {
  mineral: ['mindat_formula', 'ima_formula', 'ima_status', 'entrytype_text', 'csystem'],
  locality: ['country', 'latitude', 'longitude', 'locality_type'],
  occurrence: ['typeloc', 'questioned', 'quality', 'rarity', 'datemodify'],
};

const parseIds = (value: string) => [...new Set(value.split(/[\s,]+/).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
const parseElements = (value: string) => [...new Set(value.split(/[\s,]+/).filter(Boolean).map((symbol) => `${symbol[0].toUpperCase()}${symbol.slice(1).toLowerCase()}`))];
const fieldLabel = (field: string) => field
  .replaceAll('_', ' ')
  .replace(/\bima\b/gi, 'IMA')
  .replace(/\bguid\b/gi, 'GUID')
  .replace(/\bid\b/gi, 'ID')
  .replace(/^./, (letter) => letter.toUpperCase());

const emptySelection = (): Record<MindatAttributeScope, string[]> => ({ mineral: [], locality: [], occurrence: [] });

export function MindatNetworkCard({ isDarkMode, generating, error, onCreateDataset, onBuildNetwork }: Props) {
  const [token, setToken] = useState('');
  const [mineralIds, setMineralIds] = useState('');
  const [localityIds, setLocalityIds] = useState('');
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [includeElements, setIncludeElements] = useState('');
  const [excludeElements, setExcludeElements] = useState('');
  const [essentialElementsOnly, setEssentialElementsOnly] = useState(false);
  const [maxGeomaterials, setMaxGeomaterials] = useState(250);
  const [maxOccurrences, setMaxOccurrences] = useState(1000);
  const [includeQuestioned, setIncludeQuestioned] = useState(false);
  const [dataset, setDataset] = useState<MindatDataset | null>(null);
  const [topology, setTopology] = useState<MindatNetworkTopology>('bipartite');
  const [selectedAttributes, setSelectedAttributes] = useState<Record<MindatAttributeScope, string[]>>(emptySelection);
  const inputClass = `mt-2 w-full border px-3 py-2 font-mono text-xs ${isDarkMode ? 'border-[#333] bg-[#1a1a1a]' : 'border-[#141414] bg-white'}`;
  const hasSearch = Boolean(
    parseIds(mineralIds).length || parseIds(localityIds).length || name.trim() || keywords.trim()
    || parseElements(includeElements).length || parseElements(excludeElements).length
  );

  const attributeGroups = useMemo(() => {
    if (!dataset) return [];
    return (['mineral', 'locality', 'occurrence'] as MindatAttributeScope[]).map((scope) => ({
      scope,
      label: `${scope[0].toUpperCase()}${scope.slice(1)} ${scope === 'occurrence' ? 'edge' : 'node'} attributes`,
      fields: [...(dataset.attributeCatalog[scope] || [])].sort((left, right) => fieldLabel(left).localeCompare(fieldLabel(right), undefined, { numeric: true, sensitivity: 'base' })),
    }));
  }, [dataset]);
  const visibleGroups = useMemo(() => attributeGroups.filter((group) => (
    topology === 'bipartite' || group.scope === topology || group.scope === 'occurrence'
  )), [attributeGroups, topology]);
  const visibleAttributeCount = visibleGroups.reduce((sum, group) => sum + group.fields.length, 0);
  const selectedVisibleCount = visibleGroups.reduce(
    (sum, group) => sum + group.fields.filter((field) => selectedAttributes[group.scope].includes(field)).length,
    0,
  );

  const createDataset = async () => {
    try {
      const result = await onCreateDataset({
        token,
        filters: {
          mineralIds: parseIds(mineralIds),
          localityIds: parseIds(localityIds),
          name: name.trim(),
          keywords: keywords.trim(),
          includeElements: parseElements(includeElements),
          excludeElements: parseElements(excludeElements),
          essentialElementsOnly,
        },
        maxGeomaterials: Math.max(1, Math.min(500, Math.round(maxGeomaterials || 250))),
        maxOccurrences: Math.max(1, Math.min(5000, Math.round(maxOccurrences || 1000))),
        includeQuestioned,
      });
      setDataset(result);
      setToken('');
      setSelectedAttributes({
        mineral: DEFAULT_ATTRIBUTES.mineral.filter((field) => result.attributeCatalog.mineral.includes(field)),
        locality: DEFAULT_ATTRIBUTES.locality.filter((field) => result.attributeCatalog.locality.includes(field)),
        occurrence: DEFAULT_ATTRIBUTES.occurrence.filter((field) => result.attributeCatalog.occurrence.includes(field)),
      });
    } catch {
      // The parent reports the backend error in the card.
    }
  };

  const downloadDataset = () => {
    if (!dataset) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mindat-dataset.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleAttribute = (scope: MindatAttributeScope, field: string) => {
    setSelectedAttributes((current) => ({
      ...current,
      [scope]: current[scope].includes(field)
        ? current[scope].filter((value) => value !== field)
        : [...current[scope], field],
    }));
  };

  const setAllVisible = (checked: boolean) => {
    setSelectedAttributes((current) => {
      const next = { mineral: [...current.mineral], locality: [...current.locality], occurrence: [...current.occurrence] };
      visibleGroups.forEach((group) => { next[group.scope] = checked ? [...group.fields] : []; });
      return next;
    });
  };

  const activeAttributes = (): Record<MindatAttributeScope, string[]> => {
    const visibleScopes = new Set(visibleGroups.map((group) => group.scope));
    return {
      mineral: visibleScopes.has('mineral') ? selectedAttributes.mineral : [],
      locality: visibleScopes.has('locality') ? selectedAttributes.locality : [],
      occurrence: selectedAttributes.occurrence,
    };
  };

  return (
    <section className={`order-4 border p-6 ${isDarkMode ? 'border-[#333] bg-[#141414]' : 'border-[#141414] bg-white'}`}>
      <h2 className="mb-2 text-xl font-black uppercase tracking-tighter">Build from Mindat</h2>
      <p className="mb-5 text-[10px] font-mono opacity-60">First create a reusable Mindat JSON dataset. Then choose its network structure and attributes.</p>

      {!dataset ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2 text-[10px] font-bold uppercase tracking-widest">Mindat API Token
              <input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Used for this request only" className={inputClass} />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Mineral IDs
              <input value={mineralIds} onChange={(event) => setMineralIds(event.target.value)} placeholder="e.g. 3337, 4060" className={inputClass} />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Locality IDs
              <input value={localityIds} onChange={(event) => setLocalityIds(event.target.value)} placeholder="e.g. 3154, 13611" className={inputClass} />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Mineral Name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Quartz or bario*" className={inputClass} />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest">General Search Term
              <input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="e.g. gemstone" className={inputClass} />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Contains Elements
              <input value={includeElements} onChange={(event) => setIncludeElements(event.target.value)} placeholder="e.g. Fe, Cu" className={inputClass} />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Does Not Contain Elements
              <input value={excludeElements} onChange={(event) => setExcludeElements(event.target.value)} placeholder="e.g. Pb, As" className={inputClass} />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Maximum Geomaterials
              <input type="number" min={1} max={500} value={maxGeomaterials} onChange={(event) => setMaxGeomaterials(Number(event.target.value))} className={inputClass} />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-widest">Maximum Occurrences
              <input type="number" min={1} max={5000} step={100} value={maxOccurrences} onChange={(event) => setMaxOccurrences(Number(event.target.value))} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
              <input type="checkbox" checked={essentialElementsOnly} onChange={(event) => setEssentialElementsOnly(event.target.checked)} />
              Match essential elements only
            </label>
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
              <input type="checkbox" checked={includeQuestioned} onChange={(event) => setIncludeQuestioned(event.target.checked)} />
              Include questioned occurrences
            </label>
          </div>
          <div className="mt-4 space-y-2 text-[9px] font-mono opacity-65">
            <p>Filters are combined. Names support OpenMindat&apos;s * and _ wildcards. Element inclusion, exclusion, and essential-only matching use OpenMindat chemical search.</p>
            <p>OpenMindat does not currently provide a dedicated chemical-formula search filter, so MiNE does not simulate one. Formula values are still included in the JSON when Mindat returns them.</p>
            <p>The token is sent only to your configured MiNE Python service and is not saved.</p>
          </div>
          <div className="mt-3 text-right text-[9px] font-mono">
            <a className="underline opacity-65" href="https://www.mindat.org/a/how_to_get_my_mindat_api_key" target="_blank" rel="noreferrer">Get API access</a>
          </div>
          {error && <div className="mt-4 border border-red-600 bg-red-600/10 p-3 text-[10px] font-mono text-red-600">{error}</div>}
          <button
            type="button"
            onClick={createDataset}
            disabled={generating || !token.trim() || !hasSearch}
            className="mt-4 w-full border border-current px-5 py-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
          >
            {generating ? 'Creating Mindat JSON…' : 'Create Mindat JSON'}
          </button>
        </>
      ) : (
        <>
          <div className={`mb-5 border p-4 ${isDarkMode ? 'border-[#333] bg-[#111]' : 'border-[#141414]/30 bg-[#fafafa]'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest">Mindat JSON ready</h3>
                <p className="mt-2 text-[9px] font-mono opacity-65">
                  {dataset.geomaterials.length} geomaterials · {dataset.localities.length} localities · {dataset.occurrences.length} occurrences
                </p>
              </div>
              <div className="flex gap-3 text-[9px] font-mono">
                <button type="button" className="underline" onClick={downloadDataset}>Download JSON</button>
                <button type="button" className="underline" onClick={() => { setDataset(null); setSelectedAttributes(emptySelection()); }}>New search</button>
              </div>
            </div>
          </div>

          <fieldset className="mb-5">
            <legend className="mb-2 text-[10px] font-bold uppercase tracking-widest">Network structure</legend>
            <div className="grid gap-2 md:grid-cols-3">
              {TOPOLOGIES.map((option) => (
                <label key={option.value} className={`cursor-pointer border p-3 text-left ${topology === option.value ? 'border-current' : 'border-current/20'}`}>
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                    <input type="radio" name="mindat-topology" value={option.value} checked={topology === option.value} onChange={() => setTopology(option.value)} />
                    {option.label}
                  </span>
                  <span className="mt-2 block text-[9px] font-mono opacity-60">{option.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="sr-only">Attributes to add to the network</legend>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest">Attributes to add to the network</span>
              <div className="flex items-center gap-3 text-[9px] font-mono">
                <span className="opacity-60">{selectedVisibleCount}/{visibleAttributeCount} selected</span>
                <button type="button" className="underline" onClick={() => setAllVisible(true)}>All</button>
                <button type="button" className="underline" onClick={() => setAllVisible(false)}>None</button>
              </div>
            </div>
            <p className="mb-2 text-[9px] font-mono opacity-60">The checklist comes from fields present in the created Mindat JSON. Occurrence fields are aggregated when several source records contribute to an edge.</p>
            <div className={`max-h-64 overflow-y-auto border p-3 ${isDarkMode ? 'border-[#333] bg-[#111]' : 'border-[#141414]/30 bg-[#fafafa]'}`}>
              {visibleGroups.map((group) => (
                <div key={group.scope} className="mb-4 last:mb-0">
                  <div className="sticky top-0 z-10 mb-2 border-b border-current/20 bg-inherit pb-1 text-[9px] font-black uppercase tracking-widest">{group.label}</div>
                  <div className="grid gap-x-4 gap-y-2 md:grid-cols-2">
                    {group.fields.map((field) => (
                      <label key={`${group.scope}:${field}`} className="flex cursor-pointer items-start gap-2 text-[10px]">
                        <input type="checkbox" checked={selectedAttributes[group.scope].includes(field)} onChange={() => toggleAttribute(group.scope, field)} />
                        <span>{fieldLabel(field)} <span className="font-mono text-[8px] opacity-50">({field})</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {!visibleAttributeCount && <p className="text-[9px] font-mono opacity-60">No optional fields were present for this result.</p>}
            </div>
          </fieldset>

          {error && <div className="mt-4 border border-red-600 bg-red-600/10 p-3 text-[10px] font-mono text-red-600">{error}</div>}
          <button
            type="button"
            onClick={() => onBuildNetwork({ dataset, topology, attributes: activeAttributes() })}
            disabled={generating || (!dataset.geomaterials.length && !dataset.localities.length)}
            className="mt-4 w-full border border-current px-5 py-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
          >
            {generating ? 'Building Network…' : 'Build Network from JSON'}
          </button>
        </>
      )}
    </section>
  );
}
