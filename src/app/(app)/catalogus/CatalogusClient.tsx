'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Check, X } from 'lucide-react'

type MatchTerm = {
  id: string
  term: string
  language: string | null
  toegevoegd_door_feedback: boolean
}

type Element = {
  id: string
  naam: string
  match_terms: MatchTerm[]
}

type Subgroup = {
  id: string
  naam: string
  subgroup_elements: Element[]
}

const TAAL_STIJL: Record<string, string> = {
  NL: 'bg-blue-100 text-blue-700 border-blue-200',
  EN: 'bg-green-100 text-green-700 border-green-200',
  DE: 'bg-amber-100 text-amber-700 border-amber-200',
}

export default function CatalogusClient({ subgroups: initialSubgroups }: { subgroups: Subgroup[] }) {
  const [subgroups, setSubgroups] = useState<Subgroup[]>(initialSubgroups)
  const [openSubgroups, setOpenSubgroups] = useState<Set<string>>(new Set())
  const [openElementen, setOpenElementen] = useState<Set<string>>(new Set())
  const [bezig, setBezig] = useState<string | null>(null)

  // Nieuwe subgroup
  const [nieuweSubgroupInput, setNieuweSubgroupInput] = useState('')
  const [subgroupFormOpen, setSubgroupFormOpen] = useState(false)

  // Nieuwe element inputs per subgroup
  const [nieuwElementInput, setNieuwElementInput] = useState<Record<string, string>>({})

  // Nieuwe term inputs per element
  const [nieuwTermInput, setNieuwTermInput] = useState<Record<string, string>>({})
  const [nieuwTermTaal, setNieuwTermTaal] = useState<Record<string, string>>({})

  // Rename states
  const [renamingSubgroup, setRenamingSubgroup] = useState<string | null>(null)
  const [renamingElement, setRenamingElement] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Delete confirmations
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const supabase = createClient()

  // Toggle helpers
  function toggleSubgroup(id: string) {
    setOpenSubgroups((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleElement(id: string) {
    setOpenElementen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // --- Subgroup CRUD ---

  async function voegSubgroupToe() {
    const naam = nieuweSubgroupInput.trim()
    if (!naam) return
    setBezig('new-sg')
    const { data, error } = await supabase.from('subgroups').insert({ naam }).select('id, naam').single()
    if (!error && data) {
      setSubgroups((p) => [...p, { ...data, subgroup_elements: [] }].sort((a, b) => a.naam.localeCompare(b.naam)))
      setNieuweSubgroupInput('')
      setSubgroupFormOpen(false)
    }
    setBezig(null)
  }

  async function hernoemetSubgroup(id: string) {
    const naam = renameValue.trim()
    if (!naam) return
    setBezig(id)
    const { error } = await supabase.from('subgroups').update({ naam }).eq('id', id)
    if (!error) {
      setSubgroups((p) => p.map((sg) => sg.id === id ? { ...sg, naam } : sg))
    }
    setRenamingSubgroup(null)
    setRenameValue('')
    setBezig(null)
  }

  async function verwijderSubgroup(id: string) {
    setBezig(id)
    const { error } = await supabase.from('subgroups').delete().eq('id', id)
    if (!error) {
      setSubgroups((p) => p.filter((sg) => sg.id !== id))
    }
    setDeleteConfirm(null)
    setBezig(null)
  }

  // --- Element CRUD ---

  async function voegElementToe(subgroupId: string) {
    const naam = nieuwElementInput[subgroupId]?.trim()
    if (!naam) return
    setBezig(subgroupId + '-el')
    const { data, error } = await supabase
      .from('subgroup_elements')
      .insert({ naam, subgroup_id: subgroupId })
      .select('id, naam')
      .single()
    if (!error && data) {
      setSubgroups((p) => p.map((sg) =>
        sg.id === subgroupId
          ? { ...sg, subgroup_elements: [...sg.subgroup_elements, { ...data, match_terms: [] }] }
          : sg
      ))
      setNieuwElementInput((p) => ({ ...p, [subgroupId]: '' }))
    }
    setBezig(null)
  }

  async function hernoemElement(subgroupId: string, elementId: string) {
    const naam = renameValue.trim()
    if (!naam) return
    setBezig(elementId)
    const { error } = await supabase.from('subgroup_elements').update({ naam }).eq('id', elementId)
    if (!error) {
      setSubgroups((p) => p.map((sg) =>
        sg.id === subgroupId
          ? { ...sg, subgroup_elements: sg.subgroup_elements.map((el) => el.id === elementId ? { ...el, naam } : el) }
          : sg
      ))
    }
    setRenamingElement(null)
    setRenameValue('')
    setBezig(null)
  }

  async function verwijderElement(subgroupId: string, elementId: string) {
    setBezig(elementId)
    const { error } = await supabase.from('subgroup_elements').delete().eq('id', elementId)
    if (!error) {
      setSubgroups((p) => p.map((sg) =>
        sg.id === subgroupId
          ? { ...sg, subgroup_elements: sg.subgroup_elements.filter((el) => el.id !== elementId) }
          : sg
      ))
    }
    setDeleteConfirm(null)
    setBezig(null)
  }

  // --- Term CRUD ---

  async function voegTermToe(subgroupId: string, elementId: string) {
    const term = nieuwTermInput[elementId]?.trim().toLowerCase()
    const language = nieuwTermTaal[elementId] || null
    if (!term) return
    setBezig(elementId + '-term')
    const { data, error } = await supabase
      .from('match_terms')
      .insert({ term, language, subgroup_element_id: elementId, toegevoegd_door_feedback: false })
      .select('id, term, language, toegevoegd_door_feedback')
      .single()
    if (!error && data) {
      setSubgroups((p) => p.map((sg) =>
        sg.id === subgroupId
          ? {
              ...sg,
              subgroup_elements: sg.subgroup_elements.map((el) =>
                el.id === elementId ? { ...el, match_terms: [...el.match_terms, data] } : el
              ),
            }
          : sg
      ))
      setNieuwTermInput((p) => ({ ...p, [elementId]: '' }))
    }
    setBezig(null)
  }

  async function verwijderTerm(subgroupId: string, elementId: string, termId: string) {
    setBezig(termId)
    const { error } = await supabase.from('match_terms').delete().eq('id', termId)
    if (!error) {
      setSubgroups((p) => p.map((sg) =>
        sg.id === subgroupId
          ? {
              ...sg,
              subgroup_elements: sg.subgroup_elements.map((el) =>
                el.id === elementId ? { ...el, match_terms: el.match_terms.filter((t) => t.id !== termId) } : el
              ),
            }
          : sg
      ))
    }
    setDeleteConfirm(null)
    setBezig(null)
  }

  if (subgroups.length === 0) {
    return (
      <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
        Geen catalogusdata gevonden. Draai eerst het seed script.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Nieuwe subgroup */}
      <div className="flex justify-end">
        {subgroupFormOpen ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Naam nieuwe subgroup..."
              value={nieuweSubgroupInput}
              onChange={(e) => setNieuweSubgroupInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && voegSubgroupToe()}
              className="text-sm border border-border rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-ring w-56"
              autoFocus
            />
            <Button size="sm" disabled={bezig === 'new-sg' || !nieuweSubgroupInput.trim()} onClick={voegSubgroupToe}>
              Toevoegen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setSubgroupFormOpen(false); setNieuweSubgroupInput('') }}>
              Annuleren
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setSubgroupFormOpen(true)}>
            <Plus className="size-3.5 mr-1.5" />
            Nieuwe subgroup
          </Button>
        )}
      </div>

      {/* Subgroups */}
      {subgroups.map((sg) => (
        <div key={sg.id} className="border border-border rounded-lg overflow-hidden">
          {/* Subgroup header */}
          <div className="flex items-center px-4 py-3 bg-muted/30 gap-2">
            <button className="flex items-center gap-2 flex-1 text-left" onClick={() => toggleSubgroup(sg.id)}>
              {openSubgroups.has(sg.id)
                ? <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="size-4 text-muted-foreground shrink-0" />}
              {renamingSubgroup === sg.id ? (
                <input
                  className="text-sm font-medium border border-border rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-ring"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') hernoemetSubgroup(sg.id); if (e.key === 'Escape') { setRenamingSubgroup(null); setRenameValue('') } }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span className="text-sm font-medium">{sg.naam}</span>
              )}
            </button>

            <span className="text-xs text-muted-foreground mr-2">{sg.subgroup_elements.length} elementen</span>

            {renamingSubgroup === sg.id ? (
              <>
                <button className="text-green-600 hover:text-green-700" onClick={() => hernoemetSubgroup(sg.id)}><Check className="size-4" /></button>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => { setRenamingSubgroup(null); setRenameValue('') }}><X className="size-4" /></button>
              </>
            ) : (
              <>
                <button className="text-muted-foreground hover:text-foreground" title="Hernoemen" onClick={(e) => { e.stopPropagation(); setRenamingSubgroup(sg.id); setRenameValue(sg.naam) }}>
                  <Pencil className="size-3.5" />
                </button>
                {deleteConfirm === sg.id ? (
                  <div className="flex items-center gap-1 ml-1">
                    <span className="text-xs text-destructive">Zeker?</span>
                    <button className="text-destructive hover:text-destructive/80 text-xs font-medium" disabled={bezig === sg.id} onClick={() => verwijderSubgroup(sg.id)}>Ja</button>
                    <button className="text-muted-foreground hover:text-foreground text-xs" onClick={() => setDeleteConfirm(null)}>Nee</button>
                  </div>
                ) : (
                  <button className="text-muted-foreground hover:text-destructive" title="Verwijderen" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(sg.id) }}>
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Elementen */}
          {openSubgroups.has(sg.id) && (
            <div className="divide-y divide-border/60">
              {sg.subgroup_elements.map((el) => (
                <div key={el.id} className="px-4 py-2">
                  {/* Element header */}
                  <div className="flex items-center gap-2 py-1">
                    <button className="flex items-center gap-2 flex-1 text-left" onClick={() => toggleElement(el.id)}>
                      {openElementen.has(el.id)
                        ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                        : <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}
                      {renamingElement === el.id ? (
                        <input
                          className="text-sm border border-border rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-ring"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') hernoemElement(sg.id, el.id); if (e.key === 'Escape') { setRenamingElement(null); setRenameValue('') } }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm">{el.naam}</span>
                      )}
                    </button>

                    <span className="text-xs text-muted-foreground mr-1">{el.match_terms.length} termen</span>

                    {renamingElement === el.id ? (
                      <>
                        <button className="text-green-600 hover:text-green-700" onClick={() => hernoemElement(sg.id, el.id)}><Check className="size-3.5" /></button>
                        <button className="text-muted-foreground hover:text-foreground" onClick={() => { setRenamingElement(null); setRenameValue('') }}><X className="size-3.5" /></button>
                      </>
                    ) : (
                      <>
                        <button className="text-muted-foreground hover:text-foreground" title="Hernoemen" onClick={(e) => { e.stopPropagation(); setRenamingElement(el.id); setRenameValue(el.naam) }}>
                          <Pencil className="size-3" />
                        </button>
                        {deleteConfirm === el.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-destructive">Zeker?</span>
                            <button className="text-destructive text-xs font-medium" disabled={bezig === el.id} onClick={() => verwijderElement(sg.id, el.id)}>Ja</button>
                            <button className="text-muted-foreground text-xs" onClick={() => setDeleteConfirm(null)}>Nee</button>
                          </div>
                        ) : (
                          <button className="text-muted-foreground hover:text-destructive" title="Verwijderen" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(el.id) }}>
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Match terms */}
                  {openElementen.has(el.id) && (
                    <div className="pl-5 pb-2 space-y-2">
                      {/* Termen per taal gegroepeerd */}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {el.match_terms.length === 0 && (
                          <span className="text-xs text-muted-foreground">Geen zoektermen</span>
                        )}
                        {el.match_terms.map((t) => (
                          <div key={t.id} className="group flex items-center gap-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              t.language && TAAL_STIJL[t.language]
                                ? TAAL_STIJL[t.language]
                                : t.toegevoegd_door_feedback
                                  ? 'border-purple-200 bg-purple-50 text-purple-700'
                                  : 'border-border bg-muted text-muted-foreground'
                            }`}>
                              {t.language && (
                                <span className="font-semibold opacity-70">{t.language}</span>
                              )}
                              {t.term}
                              {t.toegevoegd_door_feedback && !t.language && (
                                <span className="opacity-50 text-[10px]">fb</span>
                              )}
                            </span>
                            {deleteConfirm === t.id ? (
                              <div className="flex items-center gap-0.5">
                                <button className="text-destructive text-xs font-medium" disabled={bezig === t.id} onClick={() => verwijderTerm(sg.id, el.id, t.id)}>✕</button>
                                <button className="text-muted-foreground text-xs" onClick={() => setDeleteConfirm(null)}>↩</button>
                              </div>
                            ) : (
                              <button
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                onClick={() => setDeleteConfirm(t.id)}
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Nieuwe zoekterm */}
                      <div className="flex gap-2 items-center">
                        <select
                          value={nieuwTermTaal[el.id] ?? ''}
                          onChange={(e) => setNieuwTermTaal((p) => ({ ...p, [el.id]: e.target.value }))}
                          className="text-xs border border-border rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-ring h-7"
                        >
                          <option value="">Taal</option>
                          <option value="NL">NL</option>
                          <option value="EN">EN</option>
                          <option value="DE">DE</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Nieuwe zoekterm..."
                          value={nieuwTermInput[el.id] ?? ''}
                          onChange={(e) => setNieuwTermInput((p) => ({ ...p, [el.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && voegTermToe(sg.id, el.id)}
                          className="flex-1 text-xs border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                        />
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs shrink-0"
                          disabled={bezig === el.id + '-term' || !nieuwTermInput[el.id]?.trim()}
                          onClick={() => voegTermToe(sg.id, el.id)}
                        >
                          <Plus className="size-3 mr-1" />
                          Toevoegen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Nieuw element */}
              <div className="px-4 py-2 bg-muted/10">
                <div className="flex gap-2 pl-5">
                  <input
                    type="text"
                    placeholder="Nieuw element..."
                    value={nieuwElementInput[sg.id] ?? ''}
                    onChange={(e) => setNieuwElementInput((p) => ({ ...p, [sg.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && voegElementToe(sg.id)}
                    className="flex-1 text-xs border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs shrink-0"
                    disabled={bezig === sg.id + '-el' || !nieuwElementInput[sg.id]?.trim()}
                    onClick={() => voegElementToe(sg.id)}
                  >
                    <Plus className="size-3 mr-1" />
                    Nieuw element
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
