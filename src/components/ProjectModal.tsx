'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Klant = { id: string; naam: string }

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  klanten: Klant[]
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
}

export default function ProjectModal({ open, onClose, onSaved, klanten: initialKlanten }: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [klanten, setKlanten] = useState<Klant[]>(initialKlanten)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inline klant aanmaken
  const [nieuwKlantNaam, setNieuwKlantNaam] = useState('')
  const [klantAanmakenOpen, setKlantAanmakenOpen] = useState(false)
  const [klantLoading, setKlantLoading] = useState(false)

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
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

    if (error || !data) {
      setKlantLoading(false)
      return
    }

    setKlanten((prev) => [...prev, data].sort((a, b) => (a.naam ?? '').localeCompare(b.naam ?? '')))
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
    const { error } = await supabase.from('projecten').insert({
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
    })

    if (error) {
      setError('Opslaan mislukt. Probeer het opnieuw.')
      setLoading(false)
      return
    }

    setLoading(false)
    setForm(EMPTY_FORM)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nieuw project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="naam">Naam *</Label>
            <Input
              id="naam"
              value={form.naam}
              onChange={(e) => set('naam', e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="project_manager">Project manager</Label>
            <Input
              id="project_manager"
              value={form.project_manager}
              onChange={(e) => set('project_manager', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Klant</Label>
            <Select value={form.klant_id} onValueChange={(v) => set('klant_id', v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecteer klant" />
              </SelectTrigger>
              <SelectContent>
                {klanten.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.naam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {klantAanmakenOpen ? (
              <div className="flex gap-2 pt-1">
                <Input
                  value={nieuwKlantNaam}
                  onChange={(e) => setNieuwKlantNaam(e.target.value)}
                  placeholder="Naam klant"
                  className="h-7 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleKlantAanmaken()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-7"
                  onClick={handleKlantAanmaken}
                  disabled={klantLoading}
                >
                  {klantLoading ? '...' : 'OK'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setKlantAanmakenOpen(false)}
                >
                  Annuleren
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setKlantAanmakenOpen(true)}
              >
                + Klant aanmaken
              </button>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="hubspot_deal_id">HubSpot deal ID</Label>
            <Input
              id="hubspot_deal_id"
              value={form.hubspot_deal_id}
              onChange={(e) => set('hubspot_deal_id', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="land">Land</Label>
              <Input
                id="land"
                value={form.land}
                onChange={(e) => set('land', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plaats">Plaats</Label>
              <Input
                id="plaats"
                value={form.plaats}
                onChange={(e) => set('plaats', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="show_naam">Show</Label>
            <Input
              id="show_naam"
              value={form.show_naam}
              onChange={(e) => set('show_naam', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="show_begindatum">Show begindatum</Label>
              <Input
                id="show_begindatum"
                type="date"
                value={form.show_begindatum}
                onChange={(e) => set('show_begindatum', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="show_einddatum">Show einddatum</Label>
              <Input
                id="show_einddatum"
                type="date"
                value={form.show_einddatum}
                onChange={(e) => set('show_einddatum', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Uitvoertaal</Label>
            <Select value={form.target_language} onValueChange={(v) => set('target_language', v ?? 'NL')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NL">Nederlands</SelectItem>
                <SelectItem value="EN">English</SelectItem>
                <SelectItem value="DE">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuleren
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Opslaan...' : 'Opslaan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
