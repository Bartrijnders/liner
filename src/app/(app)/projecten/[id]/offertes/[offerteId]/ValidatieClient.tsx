'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, HelpCircle, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react'

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

export default function ValidatieClient({
  orderregels,
  allElementen,
}: {
  offerteId: string
  orderregels: Orderregel[]
  allElementen: SubgroupElement[]
}) {
  const supabase = createClient()

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

  // Editable field values per regel
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

  const [editingRegelId, setEditingRegelId] = useState<string | null>(null)
  const [openSelector, setOpenSelector] = useState<string | null>(null)
  const [selectorZoek, setSelectorZoek] = useState('')
  const [openNieuweTerm, setOpenNieuweTerm] = useState<string | null>(null)
  const [nieuweTermInput, setNieuweTermInput] = useState('')
  const [nieuweTermElement, setNieuweTermElement] = useState<string>('')
  const [nieuweTermZoek, setNieuweTermZoek] = useState('')
  const [bezig, setBezig] = useState<string | null>(null)
  const [opslaanBezig, setOpslaanBezig] = useState<string | null>(null)

  const bevestigdAantal = orderregels.filter((r) => {
    const s = regelStatussen[r.id]
    return !!s?.validatedAt || s?.confidence === 'HIGH'
  }).length

  // --- Match acties ---

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
    setOpenSelector(null)
    setSelectorZoek('')
    setBezig(null)
  }

  async function voegTermToeEnSelecteer(regelId: string) {
    if (!nieuweTermInput.trim() || !nieuweTermElement) return
    setBezig(regelId)
    await fetch('/api/match-terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        term: nieuweTermInput.trim(),
        subgroupElementId: nieuweTermElement,
        orderegelId: regelId,
      }),
    })
    setRegelStatussen((p) => ({ ...p, [regelId]: { ...p[regelId], overrideElementId: nieuweTermElement, validatedAt: new Date().toISOString() } }))
    setOpenNieuweTerm(null)
    setNieuweTermInput('')
    setNieuweTermElement('')
    setNieuweTermZoek('')
    setOpenSelector(null)
    setSelectorZoek('')
    setBezig(null)
  }

  // --- Veld opslaan ---

  async function slaVeldenOp(regelId: string) {
    setOpslaanBezig(regelId)
    const v = regelVelden[regelId]
    await supabase.from('orderregels').update({
      omschrijving: v.omschrijving || null,
      details: v.details || null,
      hoeveelheid: v.hoeveelheid || null,
      eenheid: v.eenheid || null,
      stukprijs: v.stukprijs || null,
      totaalprijs: v.totaalprijs || null,
    }).eq('id', regelId)
    setEditingRegelId(null)
    setOpslaanBezig(null)
  }

  // --- Dropdown helpers ---

  const gefilterdeElementen = (zoek: string) => allElementen.filter((el) => {
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

  return (
    <div className="space-y-4">
      {/* Voortgangsindicator */}
      <div className="space-y-1.5">
        <div className="text-sm text-muted-foreground">
          {bevestigdAantal} van {orderregels.length} regels bevestigd
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${orderregels.length > 0 ? (bevestigdAantal / orderregels.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Regels */}
      <div className="space-y-2">
        {orderregels.map((regel) => {
          const status = regelStatussen[regel.id]
          const isBevestigd = !!status?.validatedAt || status?.confidence === 'HIGH'
          const activeElementId = status?.overrideElementId ?? status?.subgroupElementId
          const matchedElement = allElementen.find((e) => e.id === activeElementId)
          const confidence = status?.confidence
          const isEditing = editingRegelId === regel.id
          const velden = regelVelden[regel.id]
          const termElementNaam = allElementen.find(e => e.id === nieuweTermElement)

          return (
            <div
              key={regel.id}
              className={`border rounded-lg overflow-hidden transition-colors ${isBevestigd ? 'border-green-200 bg-green-50/20' : 'border-border'}`}
            >
              {/* Header rij */}
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="text-xs text-muted-foreground font-mono mt-0.5 w-5 shrink-0">
                  {regel.regelnummer}
                </span>

                {/* Linker kolom: velden */}
                <div className="flex-1 min-w-0 space-y-2">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        className="w-full text-sm font-medium border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                        value={velden.omschrijving}
                        onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], omschrijving: e.target.value } }))}
                        placeholder="Omschrijving"
                      />
                      <input
                        className="w-full text-xs border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                        value={velden.details}
                        onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], details: e.target.value } }))}
                        placeholder="Details"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="text-xs border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                          value={velden.hoeveelheid}
                          onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], hoeveelheid: e.target.value } }))}
                          placeholder="Hoeveelheid"
                        />
                        <input
                          className="text-xs border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                          value={velden.eenheid}
                          onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], eenheid: e.target.value } }))}
                          placeholder="Eenheid"
                        />
                        <input
                          className="text-xs border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                          value={velden.stukprijs}
                          onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], stukprijs: e.target.value } }))}
                          placeholder="Stukprijs"
                        />
                        <input
                          className="text-xs border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                          value={velden.totaalprijs}
                          onChange={(e) => setRegelVelden(p => ({ ...p, [regel.id]: { ...p[regel.id], totaalprijs: e.target.value } }))}
                          placeholder="Totaalprijs"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" disabled={opslaanBezig === regel.id} onClick={() => slaVeldenOp(regel.id)}>
                          <Check className="size-3 mr-1" />
                          {opslaanBezig === regel.id ? 'Opslaan...' : 'Opslaan'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingRegelId(null)}>
                          Annuleren
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{velden.omschrijving || regel.omschrijving}</span>
                        <button
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setEditingRegelId(regel.id)}
                          title="Bewerken"
                        >
                          <Pencil className="size-3" />
                        </button>
                      </div>
                      {velden.details && (
                        <div className="text-xs text-muted-foreground">{velden.details}</div>
                      )}
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {velden.hoeveelheid && <span>Aantal: <span className="text-foreground">{velden.hoeveelheid}</span></span>}
                        {velden.eenheid && <span>Eenheid: <span className="text-foreground">{velden.eenheid}</span></span>}
                        {velden.stukprijs && <span>Stukprijs: <span className="text-foreground">{velden.stukprijs}</span></span>}
                        {velden.totaalprijs && <span>Totaal: <span className="text-foreground">{velden.totaalprijs}</span></span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rechter kolom: match */}
                <div className="w-64 shrink-0 space-y-2">
                  <div className="flex items-start gap-2">
                    <ConfidenceIcon confidence={confidence} isBevestigd={isBevestigd} />
                    <div className="min-w-0">
                      {matchedElement ? (
                        <div>
                          <div className="font-medium text-sm">
                            {regel.localized_naam ?? matchedElement.naam}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {matchedElement.subgroups?.naam} › {matchedElement.naam}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Geen match</span>
                      )}
                      {confidence && <ConfidenceBadge confidence={confidence} />}
                    </div>
                  </div>

                  {/* Acties */}
                  {!isBevestigd && (
                    <div className="flex flex-wrap gap-1.5">
                      {(confidence === 'MEDIUM' || confidence === 'LOW') && matchedElement && (
                        <Button size="sm" className="h-7 text-xs" disabled={bezig === regel.id} onClick={() => bevestig(regel.id)}>
                          Bevestigen
                        </Button>
                      )}
                      <Button
                        variant="outline" size="sm" className="h-7 text-xs"
                        disabled={bezig === regel.id}
                        onClick={() => {
                          setOpenSelector(openSelector === regel.id ? null : regel.id)
                          setOpenNieuweTerm(null)
                          setSelectorZoek('')
                        }}
                      >
                        {matchedElement ? 'Wijzigen' : 'Selecteren'}
                        {openSelector === regel.id ? <ChevronUp className="size-3 ml-1" /> : <ChevronDown className="size-3 ml-1" />}
                      </Button>
                      {matchedElement && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" disabled={bezig === regel.id} onClick={() => slaOver(regel.id)}>
                          Overslaan
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Element selector dropdown */}
              {openSelector === regel.id && (
                <div className="border-t border-border bg-muted/20 p-3 space-y-3">
                  <div className="flex gap-3">
                    {/* Element kiezen */}
                    <div className="flex-1 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Element selecteren als match</p>
                      <input
                        type="text"
                        placeholder="Zoek subgroup of element..."
                        value={selectorZoek}
                        onChange={(e) => setSelectorZoek(e.target.value)}
                        className="w-full text-xs border border-border rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring bg-background"
                        autoFocus
                      />
                      <div className="max-h-44 overflow-y-auto border border-border rounded bg-background">
                        {Object.entries(gegroepeerd(gefilterdeElementen(selectorZoek))).map(([sg, elementen]) => (
                          <div key={sg}>
                            <div className="text-xs font-medium text-muted-foreground px-2 py-1 bg-muted/40 sticky top-0">
                              {sg}
                            </div>
                            {elementen.map((el) => (
                              <button
                                key={el.id}
                                className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted transition-colors"
                                onClick={() => selecteerElement(regel.id, el.id)}
                              >
                                {el.naam}
                              </button>
                            ))}
                          </div>
                        ))}
                        {gefilterdeElementen(selectorZoek).length === 0 && (
                          <p className="text-xs text-muted-foreground px-3 py-2">Geen resultaten</p>
                        )}
                      </div>
                    </div>

                    {/* Nieuwe zoekterm toevoegen */}
                    <div className="w-56 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Nieuwe zoekterm toevoegen</p>

                      {/* Element picker voor nieuwe term */}
                      <div className="relative">
                        <button
                          className="w-full text-left text-xs border border-border rounded px-2 py-1.5 bg-background hover:bg-muted transition-colors flex items-center justify-between"
                          onClick={() => setOpenNieuweTerm(openNieuweTerm === regel.id ? null : regel.id)}
                        >
                          <span className={termElementNaam ? 'text-foreground' : 'text-muted-foreground'}>
                            {termElementNaam
                              ? `${termElementNaam.subgroups?.naam} › ${termElementNaam.naam}`
                              : 'Kies element...'}
                          </span>
                          <ChevronDown className="size-3 shrink-0" />
                        </button>

                        {openNieuweTerm === regel.id && (
                          <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-border rounded bg-background shadow-md">
                            <input
                              type="text"
                              placeholder="Zoek..."
                              value={nieuweTermZoek}
                              onChange={(e) => setNieuweTermZoek(e.target.value)}
                              className="w-full text-xs border-b border-border px-2 py-1.5 outline-none"
                              autoFocus
                            />
                            <div className="max-h-36 overflow-y-auto">
                              {Object.entries(gegroepeerd(gefilterdeElementen(nieuweTermZoek))).map(([sg, elementen]) => (
                                <div key={sg}>
                                  <div className="text-xs font-medium text-muted-foreground px-2 py-0.5 bg-muted/40">
                                    {sg}
                                  </div>
                                  {elementen.map((el) => (
                                    <button
                                      key={el.id}
                                      className="w-full text-left text-xs px-3 py-1 hover:bg-muted transition-colors"
                                      onClick={() => {
                                        setNieuweTermElement(el.id)
                                        setOpenNieuweTerm(null)
                                        setNieuweTermZoek('')
                                      }}
                                    >
                                      {el.naam}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Zoekterm (bijv. 'wanddoos 220v')"
                        value={nieuweTermInput}
                        onChange={(e) => setNieuweTermInput(e.target.value)}
                        className="w-full text-xs border border-border rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring bg-background"
                      />

                      <Button
                        size="sm"
                        className="h-7 text-xs w-full"
                        disabled={!nieuweTermInput.trim() || !nieuweTermElement || bezig === regel.id}
                        onClick={() => voegTermToeEnSelecteer(regel.id)}
                      >
                        Toevoegen & selecteren
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ConfidenceIcon({ confidence, isBevestigd }: { confidence: string | null; isBevestigd: boolean }) {
  if (isBevestigd || confidence === 'HIGH') return <CheckCircle className="size-4 text-green-600 shrink-0 mt-0.5" />
  if (confidence === 'MEDIUM' || confidence === 'LOW') return <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
  return <HelpCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const styles: Record<string, string> = {
    HIGH: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-amber-100 text-amber-800',
    LOW: 'bg-orange-100 text-orange-800',
    NONE: 'bg-muted text-muted-foreground',
  }
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-0.5 ${styles[confidence] ?? styles.NONE}`}>
      {confidence}
    </span>
  )
}
