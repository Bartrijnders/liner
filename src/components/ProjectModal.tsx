'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Klant = { id: string; naam: string }

type ProjectData = {
  id: string
  naam: string
  project_manager: string | null
  klant_id: string | null
  hubspot_deal_id: string | null
  land: string | null
  plaats: string | null
  show_naam: string | null
  show_begindatum: string | null
  show_einddatum: string | null
  target_language: string | null
  m2: number | null
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  klanten: Klant[]
  project?: ProjectData
}

const EMPTY_FORM = {
  naam: '',
  project_manager: '',
  klant_id: '',
  hubspot_deal_id: '',
  land: '',
  plaats: '',
  show_naam: '',
  show_begindatum: '',
  show_einddatum: '',
  target_language: 'NL',
  m2: '',
}

const field = 'w-full rounded-lg px-4 py-3 text-sm border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 transition-all placeholder:text-slate-400'

export default function ProjectModal({ open, onClose, onSaved, klanten: initialKlanten, project }: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [klanten, setKlanten] = useState<Klant[]>(initialKlanten)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nieuwKlantNaam, setNieuwKlantNaam] = useState('')
  const [klantAanmakenOpen, setKlantAanmakenOpen] = useState(false)
  const [klantLoading, setKlantLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (project) {
      setForm({
        naam: project.naam,
        project_manager: project.project_manager ?? '',
        klant_id: project.klant_id ?? '',
        hubspot_deal_id: project.hubspot_deal_id ?? '',
        land: project.land ?? '',
        plaats: project.plaats ?? '',
        show_naam: project.show_naam ?? '',
        show_begindatum: project.show_begindatum ?? '',
        show_einddatum: project.show_einddatum ?? '',
        target_language: project.target_language ?? 'NL',
        m2: project.m2 != null ? String(project.m2) : '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open])

  function set(f: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [f]: value }))
  }

  function handleClose() {
    setForm(EMPTY_FORM)
    setError(null)
    setKlantAanmakenOpen(false)
    setNieuwKlantNaam('')
    onClose()
  }

  async function handleKlantAanmaken() {
    if (!nieuwKlantNaam.trim()) return
    setKlantLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('klanten')
      .insert({ naam: nieuwKlantNaam.trim() })
      .select('id, naam')
      .single()
    if (error || !data) { setKlantLoading(false); return }
    setKlanten((prev) => [...prev, data].sort((a, b) => a.naam.localeCompare(b.naam)))
    setForm((prev) => ({ ...prev, klant_id: data.id }))
    setNieuwKlantNaam('')
    setKlantAanmakenOpen(false)
    setKlantLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.naam.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const payload = {
      naam: form.naam.trim(),
      project_manager: form.project_manager || null,
      klant_id: form.klant_id || null,
      hubspot_deal_id: form.hubspot_deal_id || null,
      land: form.land || null,
      plaats: form.plaats || null,
      show_naam: form.show_naam || null,
      show_begindatum: form.show_begindatum || null,
      show_einddatum: form.show_einddatum || null,
      target_language: form.target_language,
      m2: form.m2 ? parseFloat(form.m2) : null,
    }
    const { error } = project
      ? await supabase.from('projecten').update(payload).eq('id', project.id)
      : await supabase.from('projecten').insert(payload)
    if (error) { setError('Opslaan mislukt. Probeer het opnieuw.'); setLoading(false); return }
    setLoading(false)
    onSaved()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh] bg-white shadow-2xl">

        {/* Header */}
        <div className="px-8 py-6 flex justify-between items-center bg-slate-50 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>
              {project ? 'Project bewerken' : 'Nieuw project'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{project ? 'Pas de projectgegevens aan.' : 'Vul de projectgegevens in.'}</p>
          </div>
          <button onClick={handleClose} className="btn-ghost w-9 h-9 p-0">
            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto">
          <div className="p-8 space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Naam <span className="text-red-500">*</span>
                </label>
                <input className={field} placeholder="Projectnaam" value={form.naam} onChange={(e) => set('naam', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Project manager</label>
                <input className={field} placeholder="Naam manager" value={form.project_manager} onChange={(e) => set('project_manager', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Klant</label>
                <Select value={form.klant_id} onValueChange={(v) => set('klant_id', v ?? '')}>
                  <SelectTrigger className="w-full h-[46px] rounded-lg border-slate-200 bg-slate-50 text-slate-900">
                    <SelectValue placeholder="Kies klant">
                      {klanten.find(k => k.id === form.klant_id)?.naam ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {klanten.map((k) => (
                      <SelectItem key={k.id} value={k.id}>{k.naam}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {klantAanmakenOpen ? (
                  <div className="flex gap-2 pt-1">
                    <input
                      className={field}
                      placeholder="Naam klant"
                      value={nieuwKlantNaam}
                      onChange={(e) => setNieuwKlantNaam(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleKlantAanmaken() } }}
                      autoFocus
                    />
                    <button type="button" onClick={handleKlantAanmaken} disabled={klantLoading} className="btn-primary btn-sm shrink-0">
                      {klantLoading ? '...' : 'OK'}
                    </button>
                    <button type="button" onClick={() => setKlantAanmakenOpen(false)} className="btn-secondary btn-sm shrink-0">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setKlantAanmakenOpen(true)}
                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1 mt-1"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                    Klant aanmaken
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">HubSpot deal ID</label>
                <input className={field} placeholder="HS-..." value={form.hubspot_deal_id} onChange={(e) => set('hubspot_deal_id', e.target.value)} />
              </div>
            </div>

            {/* Locatie & Show */}
            <div className="rounded-xl p-5 space-y-5 bg-slate-50 border border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Locatie &amp; Show</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Land</label>
                  <input className={field} placeholder="Land" value={form.land} onChange={(e) => set('land', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Plaats</label>
                  <input className={field} placeholder="Stad" value={form.plaats} onChange={(e) => set('plaats', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Show naam</label>
                <input className={field} placeholder="Naam van de show" value={form.show_naam} onChange={(e) => set('show_naam', e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Show begindatum</label>
                  <input type="date" className={field} value={form.show_begindatum} onChange={(e) => set('show_begindatum', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Show einddatum</label>
                  <input type="date" className={field} value={form.show_einddatum} onChange={(e) => set('show_einddatum', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Oppervlakte (m²)</label>
                <input type="number" min="0" step="0.01" className={field} placeholder="0" value={form.m2} onChange={(e) => set('m2', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Uitvoertaal</label>
              <Select value={form.target_language} onValueChange={(v) => set('target_language', v ?? 'NL')}>
                <SelectTrigger className="w-full h-[46px] rounded-lg border-slate-200 bg-slate-50 text-slate-900">
                  <SelectValue>
                    {form.target_language === 'NL' ? 'Nederlands' : form.target_language === 'EN' ? 'English' : 'Deutsch'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="NL">Nederlands</SelectItem>
                  <SelectItem value="EN">English</SelectItem>
                  <SelectItem value="DE">Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* Footer */}
          <div className="px-8 py-5 flex justify-end items-center gap-3 bg-slate-50 border-t border-slate-200">
            <button type="button" onClick={handleClose} className="btn-secondary">Annuleren</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Opslaan...' : 'Opslaan'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
