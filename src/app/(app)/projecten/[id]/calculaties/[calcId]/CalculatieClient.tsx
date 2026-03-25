'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { berekenProjectCalculatie, berekenVerkoopprijs, parseGeldBedrag, parseHoeveelheid } from '@/lib/calculatie/bereken'
import { Plus } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type RegelRaw = {
  orderegelId: string
  displayNaam: string
  omschrijving: string
  hoeveelheid: string | null
  eenheid: string | null
  stukprijs: string | null
  totaalprijs: string | null
  verkoopOverride: string | null
  elementId?: string | null
}

type SubgroupRaw = {
  subgroupId: string
  subgroupNaam: string
  regels: RegelRaw[]
}

type OfferteInfo = {
  id: string
  bestandsnaam: string
  status: string
}

type EditableRegel = {
  orderegelId: string
  displayNaam: string
  hoeveelheid: string
  eenheid: string
  stukprijs: string
  totaalprijs: string | null
  verkoopOverride: string
}

type EditableSubgroup = {
  subgroupId: string
  subgroupNaam: string
  regels: EditableRegel[]
}

type Props = {
  projectId: string
  calcId: string
  subgroupsRaw: SubgroupRaw[]
  subgroupElementMap: Record<string, string>
  alleOffertes: OfferteInfo[]
  geselecteerdeOfferteIds: string[]
  initialNaam: string
  initialFee: number
  initialPmKosten: number
  initialKorting1: number
  initialKorting2: number
  initialAvKosten: number
  initialOpslagKosten: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

const pct = (n: number) => `${n.toFixed(1)}%`

function toEditable(sg: SubgroupRaw): EditableSubgroup {
  return {
    subgroupId: sg.subgroupId,
    subgroupNaam: sg.subgroupNaam,
    regels: sg.regels.map(r => ({
      orderegelId: r.orderegelId,
      displayNaam: r.displayNaam || r.omschrijving || '',
      hoeveelheid: r.hoeveelheid ?? '',
      eenheid: r.eenheid ?? '',
      stukprijs: r.stukprijs ?? '',
      totaalprijs: r.totaalprijs ?? null,
      verkoopOverride: r.verkoopOverride ?? '',
    })),
  }
}

function toCalcInput(editableSubgroups: EditableSubgroup[]) {
  return editableSubgroups.map(sg => ({
    subgroupId: sg.subgroupId,
    subgroupNaam: sg.subgroupNaam,
    regels: sg.regels.map(r => ({
      orderegelId: r.orderegelId,
      omschrijving: r.displayNaam,
      hoeveelheid: r.hoeveelheid || null,
      eenheid: r.eenheid || null,
      stukprijs: r.stukprijs || null,
      totaalprijs: r.totaalprijs,
      verkoopOverride: r.verkoopOverride || null,
    })),
  }))
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CalculatieClient({
  projectId,
  calcId,
  subgroupsRaw,
  subgroupElementMap,
  alleOffertes,
  geselecteerdeOfferteIds,
  initialNaam,
  initialFee,
  initialPmKosten,
  initialKorting1,
  initialKorting2,
  initialAvKosten,
  initialOpslagKosten,
}: Props) {
  const [naam, setNaam] = useState(initialNaam)
  const [editableSubgroups, setEditableSubgroups] = useState<EditableSubgroup[]>(
    subgroupsRaw.map(toEditable)
  )
  const [fee, setFee] = useState(initialFee)
  const [pmKosten, setPmKosten] = useState(initialPmKosten)
  const [korting1, setKorting1] = useState(initialKorting1)
  const [korting2, setKorting2] = useState(initialKorting2)
  const [avKosten, setAvKosten] = useState(initialAvKosten)
  const [opslagKosten, setOpslagKosten] = useState(initialOpslagKosten)
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set(geselecteerdeOfferteIds))
  const [offertesSaving, setOffertesSaving] = useState(false)
  const [sgElementMap, setSgElementMap] = useState<Record<string, string>>(subgroupElementMap)

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const manualOfferteRef = useRef<string | null>(null)

  const calc = berekenProjectCalculatie(
    toCalcInput(editableSubgroups),
    fee, pmKosten, korting1, korting2, avKosten, opslagKosten
  )
  const calcSubgroupMap = new Map(calc.subgroups.map(sg => [sg.subgroupId, sg]))

  function debouncedSave(field: string, value: unknown) {
    clearTimeout(saveTimers.current[field])
    saveTimers.current[field] = setTimeout(() => {
      fetch(`/api/calculaties/${calcId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
    }, 600)
  }

  function handleFee(val: string) {
    const n = parseFloat(val)
    if (!isNaN(n)) { setFee(n); debouncedSave('fee', n) }
  }

  function handleKosten(setter: (v: number) => void, field: string, val: string) {
    const n = parseFloat(val) || 0
    setter(n)
    debouncedSave(field, n)
  }

  function handleNaamBlur() {
    debouncedSave('naam', naam)
  }

  async function fetchRegels(offerteIds: string[]) {
    if (offerteIds.length === 0) {
      setEditableSubgroups([])
      setSgElementMap({})
      return
    }
    const supabase = createClient()
    const { data: rawRegels } = await supabase
      .from('orderregels')
      .select(`
        id, omschrijving, localized_naam, hoeveelheid, eenheid, stukprijs, totaalprijs, verkoop_override,
        subgroup_elements!subgroup_element_id (
          id, naam,
          subgroups ( id, naam )
        )
      `)
      .in('offerte_id', offerteIds)

    const newSgElementMap: Record<string, string> = {}
    const subgroupMap = new Map<string, SubgroupRaw>()
    const uncategorised: RegelRaw[] = []

    for (const r of rawRegels ?? []) {
      const el = Array.isArray(r.subgroup_elements) ? (r.subgroup_elements[0] ?? null) : r.subgroup_elements
      const sg = el ? (Array.isArray(el.subgroups) ? (el.subgroups[0] ?? null) : el.subgroups) : null
      const regel: RegelRaw = {
        orderegelId: r.id,
        displayNaam: r.localized_naam ?? el?.naam ?? r.omschrijving ?? '',
        omschrijving: r.omschrijving ?? '',
        hoeveelheid: r.hoeveelheid,
        eenheid: r.eenheid,
        stukprijs: r.stukprijs,
        totaalprijs: r.totaalprijs,
        verkoopOverride: r.verkoop_override != null ? String(r.verkoop_override) : null,
        elementId: el?.id ?? null,
      }
      if (!sg) { uncategorised.push(regel); continue }
      if (sg.id && el?.id && !newSgElementMap[sg.id]) newSgElementMap[sg.id] = el.id
      if (!subgroupMap.has(sg.id)) subgroupMap.set(sg.id, { subgroupId: sg.id, subgroupNaam: sg.naam, regels: [] })
      subgroupMap.get(sg.id)!.regels.push(regel)
    }

    const sorted = [...subgroupMap.values()].sort((a, b) => a.subgroupNaam.localeCompare(b.subgroupNaam))
    if (uncategorised.length > 0) sorted.push({ subgroupId: '__geen__', subgroupNaam: 'Niet gecategoriseerd', regels: uncategorised })

    setSgElementMap(newSgElementMap)
    setEditableSubgroups(sorted.map(toEditable))
  }

  async function toggleOfferte(offerteId: string) {
    const nieuw = new Set(geselecteerd)
    if (nieuw.has(offerteId)) nieuw.delete(offerteId)
    else nieuw.add(offerteId)
    setGeselecteerd(nieuw)
    setOffertesSaving(true)
    await fetch(`/api/calculaties/${calcId}/offertes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerteIds: [...nieuw] }),
    })
    await fetchRegels([...nieuw])
    setOffertesSaving(false)
  }

  function updateRegel(subgroupId: string, orderegelId: string, updates: Partial<EditableRegel>) {
    setEditableSubgroups(prev => prev.map(sg =>
      sg.subgroupId !== subgroupId ? sg : {
        ...sg,
        regels: sg.regels.map(r => r.orderegelId !== orderegelId ? r : { ...r, ...updates }),
      }
    ))
  }

  async function saveRegel(orderegelId: string, dbUpdates: Record<string, string | number | null>) {
    const supabase = createClient()
    await supabase.from('orderregels').update(dbUpdates).eq('id', orderegelId)
  }

  async function getOrCreateManualOfferte(): Promise<string> {
    if (manualOfferteRef.current) return manualOfferteRef.current
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('offertes').select('id').eq('project_id', projectId)
      .eq('bestandsnaam', '__handmatig__').maybeSingle()
    if (existing) { manualOfferteRef.current = existing.id; return existing.id }
    const { data: created } = await supabase
      .from('offertes')
      .insert({ project_id: projectId, bestandsnaam: '__handmatig__', storage_path: '__handmatig__', status: 'done' })
      .select('id').single()
    if (!created) throw new Error('Kon handmatige offerte niet aanmaken')
    manualOfferteRef.current = created.id
    return created.id
  }

  async function addManualRow(subgroupId: string) {
    if (subgroupId === '__geen__') return
    const elementId = sgElementMap[subgroupId]
    if (!elementId) return
    const offerteId = await getOrCreateManualOfferte()
    const supabase = createClient()
    const { data } = await supabase.from('orderregels').insert({
      offerte_id: offerteId,
      omschrijving: 'Nieuwe regel',
      localized_naam: 'Nieuwe regel',
      subgroup_element_id: elementId,
    }).select('id').single()
    if (!data) return
    setEditableSubgroups(prev => prev.map(sg =>
      sg.subgroupId !== subgroupId ? sg : {
        ...sg,
        regels: [...sg.regels, {
          orderegelId: data.id,
          displayNaam: 'Nieuwe regel',
          hoeveelheid: '',
          eenheid: '',
          stukprijs: '',
          totaalprijs: null,
          verkoopOverride: '',
        }],
      }
    ))
  }

  const kostenInput = 'w-full text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 text-right'

  return (
    <div className="space-y-6">
      {/* Naam + Offertes selector */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Naam calculatie</p>
            <input
              type="text"
              value={naam}
              onChange={e => setNaam(e.target.value)}
              onBlur={handleNaamBlur}
              className="w-full text-base font-semibold text-slate-900 border-b-2 border-slate-200 focus:border-slate-700 outline-none bg-transparent pb-1"
            />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Inkoop offertes {offertesSaving && <span className="font-normal normal-case text-slate-400">opslaan…</span>}
          </p>
          {alleOffertes.length === 0 ? (
            <p className="text-sm text-slate-400">Nog geen offertes geüpload.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {alleOffertes.map(o => (
                <button
                  key={o.id}
                  onClick={() => toggleOfferte(o.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                    geselecteerd.has(o.id)
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {geselecteerd.has(o.id) && (
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check</span>
                  )}
                  {o.bestandsnaam}
                  {o.status !== 'done' && (
                    <span className="text-amber-500 ml-1">({o.status})</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fee + Summary bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Fee factor</p>
          <input
            type="number" step="0.01" min="1" max="3" value={fee}
            onChange={e => handleFee(e.target.value)}
            className="w-full text-xl font-bold text-slate-900 border-b-2 border-slate-300 focus:border-slate-700 outline-none bg-transparent pb-1 text-center"
            style={{ fontFamily: 'var(--font-manrope)' }}
          />
        </div>
        <SummaryTile label="Subtotaal inkoop" waarde={euro(calc.subtotaalInkoop)} />
        <SummaryTile label="Subtotaal verkoop" waarde={euro(calc.subtotaalVerkoop)} />
        <SummaryTile
          label="Totale marge"
          waarde={`${euro(calc.eindtotaalVerkoop - calc.subtotaalInkoop)} (${pct(calc.margePercentage)})`}
          highlight
        />
      </div>

      {editableSubgroups.length === 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center text-sm text-slate-400">
          Selecteer één of meer offertes om de calculatie te vullen.
        </div>
      )}

      {editableSubgroups.map(sg => {
        const calcSg = calcSubgroupMap.get(sg.subgroupId)
        return (
          <EditableSubgroupCard
            key={sg.subgroupId}
            sg={sg}
            fee={fee}
            totaalInkoop={calcSg?.totaalInkoop ?? 0}
            verkoopprijs={calcSg?.verkoopprijs ?? 0}
            marge={calcSg?.marge ?? 0}
            onUpdateRegel={(id, updates) => updateRegel(sg.subgroupId, id, updates)}
            onSaveRegel={saveRegel}
            onAddRow={() => addManualRow(sg.subgroupId)}
            canAddRow={sg.subgroupId !== '__geen__' && !!sgElementMap[sg.subgroupId]}
          />
        )
      })}

      {/* Summary */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Summary</span>
        </div>
        <div className="p-6 space-y-3 max-w-lg">
          <SummaryRij label="Stand totaal inkoop" waarde={euro(calc.subtotaalInkoop)} />
          <SummaryRij label="Stand totaal verkoop" waarde={euro(calc.subtotaalVerkoop)} />
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <KostenRij label="PM kosten" value={pmKosten} onChange={v => handleKosten(setPmKosten, 'pm_kosten', v)} inputCls={kostenInput} />
            <KostenRij label="Korting 1" value={korting1} onChange={v => handleKosten(setKorting1, 'korting_1', v)} inputCls={kostenInput} isKorting />
            <KostenRij label="Korting 2" value={korting2} onChange={v => handleKosten(setKorting2, 'korting_2', v)} inputCls={kostenInput} isKorting />
            <KostenRij label="AV kosten" value={avKosten} onChange={v => handleKosten(setAvKosten, 'av_kosten', v)} inputCls={kostenInput} />
            <KostenRij label="Opslag kosten" value={opslagKosten} onChange={v => handleKosten(setOpslagKosten, 'opslag_kosten', v)} inputCls={kostenInput} />
          </div>
          <div className="border-t-2 border-slate-300 pt-3 space-y-1">
            <SummaryRij label="Eindtotaal verkoop" waarde={euro(calc.eindtotaalVerkoop)} bold />
            <SummaryRij label="Totale marge" waarde={`${euro(calc.eindtotaalVerkoop - calc.subtotaalInkoop)} (${pct(calc.margePercentage)})`} bold />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Editable Subgroup Card ───────────────────────────────────────────────────

function EditableSubgroupCard({
  sg, fee, totaalInkoop, verkoopprijs, marge, onUpdateRegel, onSaveRegel, onAddRow, canAddRow,
}: {
  sg: EditableSubgroup
  fee: number
  totaalInkoop: number
  verkoopprijs: number
  marge: number
  onUpdateRegel: (orderegelId: string, updates: Partial<EditableRegel>) => void
  onSaveRegel: (orderegelId: string, dbUpdates: Record<string, string | number | null>) => void
  onAddRow: () => void
  canAddRow: boolean
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">{sg.subgroupNaam}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100">
              <th className="px-4 py-3">Omschrijving</th>
              <th className="px-3 py-3 w-24 text-right">Hoev.</th>
              <th className="px-3 py-3 w-16">Eenh.</th>
              <th className="px-3 py-3 w-28 text-right">Stukprijs</th>
              <th className="px-3 py-3 w-28 text-right">Inkoop</th>
              <th className="px-3 py-3 w-28 text-right">Marge</th>
              <th className="px-3 py-3 w-32 text-right">Verkoopprijs</th>
            </tr>
          </thead>
          <tbody>
            {sg.regels.map(r => (
              <RegelRow
                key={r.orderegelId}
                r={r}
                fee={fee}
                onUpdate={updates => onUpdateRegel(r.orderegelId, updates)}
                onSave={dbUpdates => onSaveRegel(r.orderegelId, dbUpdates)}
              />
            ))}
          </tbody>
          <tfoot>
            {canAddRow && (
              <tr>
                <td colSpan={7} className="px-4 py-2">
                  <button
                    onClick={onAddRow}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <Plus size={12} />
                    Regel toevoegen
                  </button>
                </td>
              </tr>
            )}
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td colSpan={4} className="px-6 py-3 text-xs font-semibold text-slate-500 text-right">Totaal inkoop</td>
              <td className="px-3 py-3 text-sm font-bold text-slate-900 text-right">{euro(totaalInkoop)}</td>
              <td className="px-3 py-3 text-sm font-semibold text-green-700 text-right">{euro(marge)}</td>
              <td className="px-3 py-3 text-sm font-bold text-slate-900 text-right">{euro(verkoopprijs)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Regel Row ────────────────────────────────────────────────────────────────

function RegelRow({
  r, fee, onUpdate, onSave,
}: {
  r: EditableRegel
  fee: number
  onUpdate: (updates: Partial<EditableRegel>) => void
  onSave: (dbUpdates: Record<string, string | number | null>) => void
}) {
  const [editingMarge, setEditingMarge] = useState<string | null>(null)
  const [editingVerkoop, setEditingVerkoop] = useState<string | null>(null)

  const hoev = parseHoeveelheid(r.hoeveelheid)
  const prijs = parseGeldBedrag(r.stukprijs)
  const totaal = r.totaalprijs ? parseGeldBedrag(r.totaalprijs) : null
  const inkoop = (hoev !== null && prijs !== null) ? hoev * prijs : totaal

  const overrideVal = r.verkoopOverride ? parseGeldBedrag(r.verkoopOverride) : null
  const verkoopprijs = inkoop !== null ? (overrideVal ?? berekenVerkoopprijs(inkoop, fee)) : null
  const marge = verkoopprijs !== null && inkoop !== null ? verkoopprijs - inkoop : null
  const isOverridden = r.verkoopOverride !== ''
  const waarschuwing = inkoop === null

  const inp = (extra?: string) =>
    `w-full text-sm bg-transparent outline-none rounded px-2 py-1 focus:bg-slate-50 focus:ring-1 focus:ring-slate-300 ${extra ?? ''}`

  function onMargeChange(val: string) {
    setEditingMarge(val)
    const n = parseFloat(val.replace(',', '.'))
    if (!isNaN(n) && inkoop !== null) {
      onUpdate({ verkoopOverride: (inkoop + n).toString() })
    }
  }

  function onMargeBlur() {
    setEditingMarge(null)
    if (verkoopprijs !== null) onSave({ verkoop_override: verkoopprijs })
  }

  function onVerkoopChange(val: string) {
    setEditingVerkoop(val)
    onUpdate({ verkoopOverride: val })
  }

  function onVerkoopBlur() {
    setEditingVerkoop(null)
    const n = parseGeldBedrag(r.verkoopOverride)
    onSave({ verkoop_override: n })
  }

  const margeDisplay = editingMarge ?? (marge !== null ? marge.toFixed(2) : '')
  const verkoopDisplay = editingVerkoop
    ? editingVerkoop
    : (r.verkoopOverride !== '' ? r.verkoopOverride : (verkoopprijs !== null ? verkoopprijs.toFixed(2) : ''))

  return (
    <tr className={`border-t border-slate-100 ${waarschuwing ? 'bg-amber-50' : ''}`}>
      <td className="px-4 py-1.5">
        <input
          type="text"
          value={r.displayNaam}
          onChange={e => onUpdate({ displayNaam: e.target.value })}
          onBlur={e => onSave({ localized_naam: e.target.value })}
          className={inp('text-slate-700')}
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="text"
          value={r.hoeveelheid}
          onChange={e => onUpdate({ hoeveelheid: e.target.value })}
          onBlur={e => onSave({ hoeveelheid: e.target.value || null })}
          placeholder="—"
          className={inp('text-right text-slate-600')}
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="text"
          value={r.eenheid}
          onChange={e => onUpdate({ eenheid: e.target.value })}
          onBlur={e => onSave({ eenheid: e.target.value || null })}
          placeholder="—"
          className={inp('text-slate-600')}
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="text"
          value={r.stukprijs}
          onChange={e => onUpdate({ stukprijs: e.target.value })}
          onBlur={e => onSave({ stukprijs: e.target.value || null })}
          placeholder="—"
          className={inp('text-right text-slate-600')}
        />
      </td>
      <td className="px-3 py-1.5 text-sm text-slate-700 text-right whitespace-nowrap">
        {inkoop !== null ? euro(inkoop) : <span className="text-amber-500">!</span>}
      </td>
      <td className="px-3 py-1.5">
        <input
          type="text"
          value={margeDisplay}
          onChange={e => onMargeChange(e.target.value)}
          onBlur={onMargeBlur}
          placeholder="—"
          className={inp(`text-right ${marge !== null && marge < 0 ? 'text-red-600' : 'text-green-700'}`)}
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="text"
          value={verkoopDisplay}
          onChange={e => onVerkoopChange(e.target.value)}
          onBlur={onVerkoopBlur}
          placeholder="—"
          className={inp(`text-right font-medium ${isOverridden ? 'text-blue-700' : 'text-slate-900'}`)}
          title={isOverridden ? 'Overschreven (afwijkt van formule)' : 'Berekend via fee-formule'}
        />
      </td>
    </tr>
  )
}

// ─── Shared Sub-components ────────────────────────────────────────────────────

function SummaryTile({ label, waarde, highlight }: { label: string; waarde: string; highlight?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-slate-800' : 'text-slate-900'}`} style={{ fontFamily: 'var(--font-manrope)' }}>
        {waarde}
      </p>
    </div>
  )
}

function SummaryRij({ label, waarde, bold }: { label: string; waarde: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{waarde}</span>
    </div>
  )
}

function KostenRij({ label, value, onChange, inputCls, isKorting }: {
  label: string; value: number; onChange: (v: string) => void; inputCls: string; isKorting?: boolean
}) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className={`text-sm shrink-0 ${isKorting ? 'text-red-600' : 'text-slate-600'}`}>{label}</span>
      <input
        type="number" min="0" step="0.01" value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder="0,00" className={inputCls} style={{ maxWidth: '140px' }}
      />
    </div>
  )
}
