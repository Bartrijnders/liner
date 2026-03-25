'use client'

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, Check } from 'lucide-react'

type Subgroup = {
  id: string
  naam: string
}

type SubgroupElement = {
  id: string
  naam: string
  subgroups: { naam: string } | null
}

type Orderregel = {
  id: string
  regelnummer: number
  omschrijving: string
  details: string | null
  hoeveelheid: string | null
  eenheid: string | null
  stukprijs: string | null
  totaalprijs: string | null
  clean_desc: string | null
  category_hint: string | null
  confidence: string | null
  match_reasoning: string | null
  subgroup_element_id: string | null
  override_element_id: string | null
  validated_at: string | null
  localized_naam: string | null
  subgroup_elements: { id: string; naam: string; subgroups: { naam: string } | null } | null
}

type RegelStatus = {
  subgroupElementId: string | null
  overrideElementId: string | null
  confidence: string | null
  validatedAt: string | null
}

type RegelVelden = {
  omschrijving: string
  details: string
  hoeveelheid: string
  eenheid: string
  stukprijs: string
  totaalprijs: string
}

const inputCls = 'w-full bg-transparent text-xs border-b px-1 py-0.5 outline-none placeholder:opacity-30 transition-colors'

export default function ValidatieClient({
  orderregels,
  allElementen,
  allSubgroups,
}: {
  offerteId: string
  orderregels: Orderregel[]
  allElementen: SubgroupElement[]
  allSubgroups: Subgroup[]
}) {
  const supabase = createClient()
  const router = useRouter()

  const [regelStatussen, setRegelStatussen] = useState<Record<string, RegelStatus>>(
    Object.fromEntries(
      orderregels.map((r) => [r.id, {
        subgroupElementId: r.subgroup_element_id,
        overrideElementId: r.override_element_id,
        confidence: r.confidence,
        validatedAt: r.validated_at,
      }])
    )
  )

  const [regelVelden, setRegelVelden] = useState<Record<string, RegelVelden>>(
    Object.fromEntries(
      orderregels.map((r) => [r.id, {
        omschrijving: r.omschrijving ?? '',
        details: r.details ?? '',
        hoeveelheid: r.hoeveelheid ?? '',
        eenheid: r.eenheid ?? '',
        stukprijs: r.stukprijs ?? '',
        totaalprijs: r.totaalprijs ?? '',
      }])
    )
  )

  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved'>>({})
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const blurTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [openSelector, setOpenSelector] = useState<string | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number; height: number } | null>(null)
  const wijzigenRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [selectorZoek, setSelectorZoek] = useState('')
  const [bezig, setBezig] = useState<string | null>(null)

  // Lokaal bijgehouden nieuw-aangemaakte elementen (zodat display direct bijwerkt)
  const [lokalElementen, setLokalElementen] = useState<SubgroupElement[]>([])
  const alleElementen = useMemo(() => [...allElementen, ...lokalElementen], [allElementen, lokalElementen])

  // Nieuw element formulier
  const [nieuwElement, setNieuwElement] = useState({ naam: '', subgroupId: '', nl: '', de: '', en: '' })
  const [nieuwElementSubgroupOpen, setNieuwElementSubgroupOpen] = useState(false)

  const bevestigdAantal = orderregels.filter((r) => {
    const s = regelStatussen[r.id]
    return !!s?.validatedAt || s?.confidence === 'HIGH'
  }).length

  const voortgang = orderregels.length > 0 ? (bevestigdAantal / orderregels.length) * 100 : 0

  function sluitPopover() {
    setOpenSelector(null)
    setPopoverAnchor(null)
    setSelectorZoek('')
    setNieuwElement({ naam: '', subgroupId: '', nl: '', de: '', en: '' })
    setNieuwElementSubgroupOpen(false)
  }

  function openWijzigen(regelId: string) {
    if (openSelector === regelId) { sluitPopover(); return }
    const rect = wijzigenRefs.current[regelId]?.getBoundingClientRect()
    if (rect) setPopoverAnchor({ top: rect.top, left: rect.left, height: rect.height })
    setOpenSelector(regelId)
    setSelectorZoek('')
    setNieuwElement({ naam: '', subgroupId: '', nl: '', de: '', en: '' })
    setNieuwElementSubgroupOpen(false)
  }

  useEffect(() => {
    if (!openSelector) return
    const handler = () => sluitPopover()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [openSelector])

  function onVeldBlur(regelId: string) {
    clearTimeout(blurTimers.current[regelId])
    blurTimers.current[regelId] = setTimeout(() => slaVeldenOp(regelId), 150)
  }

  function onVeldFocus(regelId: string) {
    clearTimeout(blurTimers.current[regelId])
  }

  async function slaVeldenOp(regelId: string) {
    setSaveStatus((p) => ({ ...p, [regelId]: 'saving' }))
    const v = regelVelden[regelId]
    await supabase.from('orderregels').update({
      omschrijving: v.omschrijving || null,
      details: v.details || null,
      hoeveelheid: v.hoeveelheid || null,
      eenheid: v.eenheid || null,
      stukprijs: v.stukprijs || null,
      totaalprijs: v.totaalprijs || null,
    }).eq('id', regelId)
    setSaveStatus((p) => ({ ...p, [regelId]: 'saved' }))
    clearTimeout(saveTimers.current[regelId])
    saveTimers.current[regelId] = setTimeout(() => {
      setSaveStatus((p) => { const n = { ...p }; delete n[regelId]; return n })
    }, 2000)
  }

  async function bevestig(regelId: string) {
    setBezig(regelId)
    await supabase.from('orderregels').update({ validated_at: new Date().toISOString() }).eq('id', regelId)
    setRegelStatussen((p) => ({ ...p, [regelId]: { ...p[regelId], validatedAt: new Date().toISOString() } }))
    setBezig(null)
  }

  async function slaOver(regelId: string) {
    setBezig(regelId)
    await supabase.from('orderregels').update({
      validated_at: new Date().toISOString(),
      subgroup_element_id: null,
      confidence: 'NONE',
    }).eq('id', regelId)
    setRegelStatussen((p) => ({ ...p, [regelId]: { ...p[regelId], validatedAt: new Date().toISOString(), subgroupElementId: null, confidence: 'NONE' } }))
    setBezig(null)
  }

  async function selecteerElement(regelId: string, elementId: string) {
    setBezig(regelId)
    await supabase.from('orderregels').update({
      override_element_id: elementId,
      validated_at: new Date().toISOString(),
    }).eq('id', regelId)
    setRegelStatussen((p) => ({ ...p, [regelId]: { ...p[regelId], overrideElementId: elementId, validatedAt: new Date().toISOString() } }))
    sluitPopover()
    setBezig(null)
  }

  async function maakElementAan(regelId: string) {
    const { naam, subgroupId, nl, de, en } = nieuwElement
    if (!naam.trim() || !subgroupId) return
    if (!nl.trim() && !de.trim() && !en.trim()) return
    setBezig(regelId)

    const subgroup = allSubgroups.find(s => s.id === subgroupId)

    const res = await fetch('/api/elementen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subgroupId, elementNaam: naam.trim(), vertalingen: { nl, de, en }, orderegelId: regelId }),
    })
    const { elementId } = await res.json()

    setLokalElementen(p => [...p, { id: elementId, naam: naam.trim(), subgroups: subgroup ? { naam: subgroup.naam } : null }])
    setRegelStatussen((p) => ({ ...p, [regelId]: { ...p[regelId], overrideElementId: elementId, validatedAt: new Date().toISOString() } }))
    sluitPopover()
    setBezig(null)
    router.refresh()
  }

  const gefilterdeElementen = (zoek: string) => alleElementen.filter((el) => {
    const q = zoek.toLowerCase()
    return el.naam.toLowerCase().includes(q) || (el.subgroups?.naam ?? '').toLowerCase().includes(q)
  })

  const gegroepeerd = (elementen: SubgroupElement[]) =>
    elementen.reduce<Record<string, SubgroupElement[]>>((acc, el) => {
      const sg = el.subgroups?.naam ?? 'Overig'
      if (!acc[sg]) acc[sg] = []
      acc[sg].push(el)
      return acc
    }, {})

  const groepen = useMemo(() => {
    const map = new Map<string, Orderregel[]>()
    for (const regel of orderregels) {
      const status = regelStatussen[regel.id]
      const activeId = status?.overrideElementId ?? status?.subgroupElementId
      const el = alleElementen.find(e => e.id === activeId)
      const groep = el?.subgroups?.naam ?? regel.category_hint ?? 'Geen match'
      if (!map.has(groep)) map.set(groep, [])
      map.get(groep)!.push(regel)
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'Geen match') return 1
      if (b === 'Geen match') return -1
      return a.localeCompare(b)
    })
  }, [orderregels, regelStatussen, alleElementen])

  return (
    <div className="space-y-6">
      {/* Voortgangsindicator */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-600">
            {bevestigdAantal} van {orderregels.length} regels bevestigd
          </span>
          <span className="text-xs font-semibold text-slate-500">
            {Math.round(voortgang)}%
          </span>
        </div>
        <div className="relative w-full h-1.5 rounded-full overflow-hidden bg-slate-200">
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 bg-slate-800"
            style={{ width: `${voortgang}%` }}
          />
        </div>
      </div>

      {/* Groepen */}
      <div className="space-y-6">
        {groepen.map(([groepNaam, regels]) => (
          <div
            key={groepNaam}
            className="rounded-xl overflow-hidden bg-white border border-slate-200"
          >
            {/* Groepheader */}
            <div className="px-6 py-3 flex items-center gap-3 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {groepNaam}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200 text-slate-600">
                {regels.length} items
              </span>
            </div>

            {/* Tabel */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase tracking-widest bg-white text-slate-400 border-b border-slate-200">
                    <th className="px-4 py-4 w-10 shrink-0">#</th>
                    <th className="px-4 py-4 min-w-[220px]">Omschrijving / Details</th>
                    <th className="px-4 py-4 w-24">Hoeveelheid</th>
                    <th className="px-4 py-4 w-20">Eenheid</th>
                    <th className="px-4 py-4 w-28">Stukprijs</th>
                    <th className="px-4 py-4 w-28">Totaalprijs</th>
                    <th className="px-4 py-4 w-44">Match</th>
                    <th className="px-4 py-4 w-40 text-right">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {regels.map((regel) => {
                    const status = regelStatussen[regel.id]
                    const isBevestigd = !!status?.validatedAt || status?.confidence === 'HIGH'
                    const activeElementId = status?.overrideElementId ?? status?.subgroupElementId
                    const matchedElement = alleElementen.find((e) => e.id === activeElementId)
                    const confidence = status?.confidence
                    const velden = regelVelden[regel.id]
                    const rs = saveStatus[regel.id]

                    const accentColor = isBevestigd || confidence === 'HIGH'
                      ? '#86efac'
                      : confidence === 'MEDIUM'
                        ? '#fcd34d'
                        : confidence === 'LOW'
                          ? '#fdba74'
                          : '#e2e8f0'

                    return (
                      <tr
                        key={regel.id}
                        className="align-top transition-colors border-t border-slate-100"
                        style={{ borderLeft: `3px solid ${accentColor}` }}
                      >
                        {/* # */}
                        <td className="px-4 py-4 text-sm font-medium text-slate-400 w-10">
                          {String(regel.regelnummer).padStart(2, '0')}
                        </td>

                        {/* Omschrijving + Details */}
                        <td className="px-4 py-4 min-w-[220px]">
                          <input
                            className={inputCls}
                            style={{ borderColor: '#e2e8f0', color: '#0f172a', fontSize: '13px', fontWeight: 600, wordBreak: 'break-word' }}
                            value={velden.omschrijving}
                            onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], omschrijving: e.target.value } }))}
                            onBlur={() => onVeldBlur(regel.id)}
                            onFocus={() => onVeldFocus(regel.id)}
                            placeholder="Omschrijving"
                          />
                          <input
                            className={`${inputCls} mt-1`}
                            style={{ borderColor: '#e2e8f0', color: '#64748b', fontSize: '11px', wordBreak: 'break-word' }}
                            value={velden.details}
                            onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], details: e.target.value } }))}
                            onBlur={() => onVeldBlur(regel.id)}
                            onFocus={() => onVeldFocus(regel.id)}
                            placeholder=""
                          />
                        </td>

                        {/* Hoeveelheid */}
                        <td className="px-4 py-4 w-24">
                          <input
                            className={inputCls}
                            style={{ borderColor: '#e2e8f0', color: '#0f172a', fontSize: '13px' }}
                            value={velden.hoeveelheid}
                            onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], hoeveelheid: e.target.value } }))}
                            onBlur={() => onVeldBlur(regel.id)}
                            onFocus={() => onVeldFocus(regel.id)}
                            placeholder="—"
                          />
                        </td>

                        {/* Eenheid */}
                        <td className="px-4 py-4 w-20">
                          <input
                            className={inputCls}
                            style={{ borderColor: '#e2e8f0', color: '#0f172a', fontSize: '13px' }}
                            value={velden.eenheid}
                            onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], eenheid: e.target.value } }))}
                            onBlur={() => onVeldBlur(regel.id)}
                            onFocus={() => onVeldFocus(regel.id)}
                            placeholder="—"
                          />
                        </td>

                        {/* Stukprijs */}
                        <td className="px-4 py-4 w-28">
                          <input
                            className={inputCls}
                            style={{ borderColor: '#e2e8f0', color: '#0f172a', fontSize: '13px' }}
                            value={velden.stukprijs}
                            onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], stukprijs: e.target.value } }))}
                            onBlur={() => onVeldBlur(regel.id)}
                            onFocus={() => onVeldFocus(regel.id)}
                            placeholder="—"
                          />
                        </td>

                        {/* Totaalprijs */}
                        <td className="px-4 py-4 w-28">
                          <input
                            className={inputCls}
                            style={{ borderColor: '#e2e8f0', color: '#0f172a', fontSize: '13px', fontWeight: 600 }}
                            value={velden.totaalprijs}
                            onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], totaalprijs: e.target.value } }))}
                            onBlur={() => onVeldBlur(regel.id)}
                            onFocus={() => onVeldFocus(regel.id)}
                            placeholder="—"
                          />
                        </td>

                        {/* Match */}
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <ConfidenceBadge confidence={confidence} isBevestigd={isBevestigd} />
                            {matchedElement && (
                              <div className="text-xs leading-snug">
                                <span className="text-slate-500">{matchedElement.subgroups?.naam} › </span>
                                <span className="text-slate-900 font-semibold">{matchedElement.naam}</span>
                              </div>
                            )}
                            {!matchedElement && (
                              <span className="text-xs text-slate-400">Geen match</span>
                            )}
                          </div>
                        </td>

                        {/* Acties */}
                        <td className="px-6 py-5 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {!isBevestigd && (confidence === 'MEDIUM' || confidence === 'LOW') && matchedElement && (
                              <button
                                onClick={() => bevestig(regel.id)}
                                disabled={bezig === regel.id}
                                className="btn-primary btn-sm"
                              >
                                Bevestigen
                              </button>
                            )}
                            <button
                              ref={(el) => { wijzigenRefs.current[regel.id] = el }}
                              onClick={() => openWijzigen(regel.id)}
                              disabled={bezig === regel.id}
                              className="btn-secondary btn-sm flex items-center gap-1"
                            >
                              {matchedElement ? 'Wijzigen' : 'Selecteren'}
                              <ChevronDown size={11} />
                            </button>
                            {!isBevestigd && matchedElement && (
                              <button
                                onClick={() => slaOver(regel.id)}
                                disabled={bezig === regel.id}
                                className="btn-ghost btn-sm"
                              >
                                Overslaan
                              </button>
                            )}
                          </div>
                          {rs && (
                            <div className={`flex items-center justify-end gap-1 text-xs mt-1.5 ${rs === 'saved' ? 'text-green-600' : 'text-slate-400'}`}>
                              {rs === 'saving' ? <span>Opslaan...</span> : <><Check size={12} /><span>Opgeslagen</span></>}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Wijzigen-popover */}
      {openSelector && popoverAnchor && (
        <WijzigenPopover
          anchor={popoverAnchor}
          selectorZoek={selectorZoek}
          onSelectorZoekChange={setSelectorZoek}
          nieuwElement={nieuwElement}
          onNieuwElement={setNieuwElement}
          subgroupOpen={nieuwElementSubgroupOpen}
          onSubgroupOpen={setNieuwElementSubgroupOpen}
          allSubgroups={allSubgroups}
          bezig={bezig === openSelector}
          gefilterdeElementen={gefilterdeElementen}
          gegroepeerd={gegroepeerd}
          onSelecteerElement={(elId) => selecteerElement(openSelector, elId)}
          onMaakElementAan={() => maakElementAan(openSelector)}
          onClose={sluitPopover}
        />
      )}
    </div>
  )
}

// --- Popover ---

type WijzigenPopoverProps = {
  anchor: { top: number; left: number; height: number }
  selectorZoek: string
  onSelectorZoekChange: (v: string) => void
  nieuwElement: { naam: string; subgroupId: string; nl: string; de: string; en: string }
  onNieuwElement: (v: { naam: string; subgroupId: string; nl: string; de: string; en: string }) => void
  subgroupOpen: boolean
  onSubgroupOpen: (v: boolean) => void
  allSubgroups: Subgroup[]
  bezig: boolean
  gefilterdeElementen: (zoek: string) => SubgroupElement[]
  gegroepeerd: (els: SubgroupElement[]) => Record<string, SubgroupElement[]>
  onSelecteerElement: (elId: string) => void
  onMaakElementAan: () => void
  onClose: () => void
}

function WijzigenPopover({
  anchor,
  selectorZoek, onSelectorZoekChange,
  nieuwElement, onNieuwElement,
  subgroupOpen, onSubgroupOpen,
  allSubgroups,
  bezig,
  gefilterdeElementen, gegroepeerd,
  onSelecteerElement, onMaakElementAan, onClose,
}: WijzigenPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const subgroupBtnRef = useRef<HTMLButtonElement>(null)
  const [subgroupDir, setSubgroupDir] = useState<'down' | 'up'>('down')

  // Start hidden; useLayoutEffect meet hoogte en bepaalt richting vóór eerste paint
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    visibility: 'hidden',
    width: 540,
    zIndex: 50,
    boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
  })

  useLayoutEffect(() => {
    if (!popoverRef.current) return
    const left = Math.min(anchor.left, window.innerWidth - 548)
    const MARGIN = 12
    const spaceBelow = window.innerHeight - (anchor.top + anchor.height + MARGIN) - MARGIN
    const spaceAbove = anchor.top - MARGIN - MARGIN
    const openDown = spaceBelow >= spaceAbove || spaceBelow >= 200

    const maxHeight = Math.max((openDown ? spaceBelow : spaceAbove), 200)

    setPopoverStyle({
      position: 'fixed',
      left,
      width: 540,
      zIndex: 50,
      boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
      visibility: 'visible',
      maxHeight,
      display: 'flex',
      flexDirection: 'column',
      ...(openDown
        ? { top: anchor.top + anchor.height + MARGIN }
        : { bottom: window.innerHeight - anchor.top + MARGIN }),
    })
  }, [anchor])

  function handleSubgroupOpen() {
    if (!subgroupOpen && subgroupBtnRef.current) {
      const rect = subgroupBtnRef.current.getBoundingClientRect()
      const estDropHeight = Math.min(allSubgroups.length * 32 + 8, 160)
      setSubgroupDir(rect.bottom + estDropHeight > window.innerHeight ? 'up' : 'down')
    }
    onSubgroupOpen(!subgroupOpen)
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const selectedSubgroup = allSubgroups.find(s => s.id === nieuwElement.subgroupId)
  const kanAanmaken = nieuwElement.naam.trim() && nieuwElement.subgroupId &&
    (nieuwElement.nl.trim() || nieuwElement.de.trim() || nieuwElement.en.trim())

  function setField(field: keyof typeof nieuwElement, value: string) {
    onNieuwElement({ ...nieuwElement, [field]: value })
  }

  const inputRow = 'flex-1 text-xs rounded-lg px-2 py-1.5 outline-none border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-slate-300'

  return (
    <div
      ref={popoverRef}
      className="bg-white rounded-xl border border-slate-200 p-4"
      style={popoverStyle}
    >
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Bestaand element selecteren */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
          <p className="text-xs font-semibold text-slate-500">Bestaand element</p>
          <input
            type="text"
            placeholder="Zoek subgroup of element..."
            value={selectorZoek}
            onChange={(e) => onSelectorZoekChange(e.target.value)}
            className="w-full text-xs rounded-lg px-3 py-2 outline-none border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-slate-300"
            autoFocus
          />
          <div className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-slate-50 border border-slate-200">
            {Object.entries(gegroepeerd(gefilterdeElementen(selectorZoek))).map(([sg, elementen]) => (
              <div key={sg}>
                <div className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 sticky top-0 bg-slate-100 text-slate-500">
                  {sg}
                </div>
                {elementen.map((el) => (
                  <button
                    key={el.id}
                    className="w-full text-left text-xs px-4 py-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
                    onClick={() => onSelecteerElement(el.id)}
                  >
                    {el.naam}
                  </button>
                ))}
              </div>
            ))}
            {gefilterdeElementen(selectorZoek).length === 0 && (
              <p className="text-xs text-slate-400 px-3 py-2">Geen resultaten</p>
            )}
          </div>
        </div>

        {/* Scheidingslijn */}
        <div className="w-px bg-slate-200 self-stretch" />

        {/* Nieuw element aanmaken */}
        <div className="w-56 shrink-0 space-y-2">
          <p className="text-xs font-semibold text-slate-500">Nieuw element</p>

          {/* Subgroup picker */}
          <div className="relative">
            <button
              ref={subgroupBtnRef}
              className="w-full text-left text-xs rounded-lg px-3 py-2 flex items-center justify-between border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
              onClick={handleSubgroupOpen}
              type="button"
            >
              <span className={selectedSubgroup ? 'text-slate-900 truncate' : 'text-slate-400'}>
                {selectedSubgroup?.naam ?? 'Kies subgroup...'}
              </span>
              <ChevronDown size={12} className="shrink-0 text-slate-400 ml-1" />
            </button>
            {subgroupOpen && (
              <div className={`absolute ${subgroupDir === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'} left-0 right-0 z-10 rounded-lg shadow-md overflow-hidden bg-white border border-slate-200 max-h-40 overflow-y-auto`}>
                {allSubgroups.map(sg => (
                  <button
                    key={sg.id}
                    className="w-full text-left text-xs px-3 py-1.5 text-slate-700 hover:bg-slate-100 transition-colors"
                    onClick={() => { setField('subgroupId', sg.id); onSubgroupOpen(false) }}
                    type="button"
                  >
                    {sg.naam}
                  </button>
                ))}
                {allSubgroups.length === 0 && (
                  <p className="text-xs text-slate-400 px-3 py-2">Geen subgroups</p>
                )}
              </div>
            )}
          </div>

          {/* Element naam */}
          <input
            type="text"
            placeholder="Element naam"
            value={nieuwElement.naam}
            onChange={(e) => setField('naam', e.target.value)}
            className="w-full text-xs rounded-lg px-3 py-2 outline-none border border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-slate-300"
          />

          {/* Vertalingen */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Vertalingen → zoektermen</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">NL</span>
              <input type="text" placeholder="Nederlandse zoekterm" value={nieuwElement.nl}
                onChange={(e) => setField('nl', e.target.value)} className={inputRow} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">DE</span>
              <input type="text" placeholder="Deutscher Suchbegriff" value={nieuwElement.de}
                onChange={(e) => setField('de', e.target.value)} className={inputRow} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">EN</span>
              <input type="text" placeholder="English search term" value={nieuwElement.en}
                onChange={(e) => setField('en', e.target.value)} className={inputRow} />
            </div>
          </div>

          <button
            className="btn-primary btn-sm w-full justify-center mt-1"
            disabled={!kanAanmaken || bezig}
            onClick={onMaakElementAan}
            type="button"
          >
            {bezig ? 'Bezig...' : 'Aanmaken & koppelen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Badge ---

function ConfidenceBadge({ confidence, isBevestigd }: { confidence: string | null; isBevestigd: boolean }) {
  if (isBevestigd || confidence === 'HIGH') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-100 text-green-700">
        HIGH
      </span>
    )
  }
  if (confidence === 'MEDIUM') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700">
        MEDIUM
      </span>
    )
  }
  if (confidence === 'LOW') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-100 text-orange-700">
        LOW
      </span>
    )
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500">
      NONE
    </span>
  )
}
