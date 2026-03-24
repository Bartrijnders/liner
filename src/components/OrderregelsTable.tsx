'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Orderregel = {
  id: string
  regelnummer: number | null
  omschrijving: string | null
  details: string | null
  hoeveelheid: string | null
  eenheid: string | null
  stukprijs: string | null
  totaalprijs: string | null
}

export default function OrderregelsTable({ offerteId }: { offerteId: string }) {
  const [regels, setRegels] = useState<Orderregel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('orderregels')
      .select('*')
      .eq('offerte_id', offerteId)
      .order('regelnummer')
      .then(({ data }) => {
        setRegels(data ?? [])
        setLoading(false)
      })
  }, [offerteId])

  if (loading) return <p className="text-sm text-muted-foreground px-1">Laden...</p>

  if (regels.length === 0)
    return <p className="text-sm text-muted-foreground px-1">Geen orderregels gevonden.</p>

  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground mb-2 px-1">
        {regels.length} orderregel{regels.length !== 1 ? 's' : ''} gevonden
      </p>
      <div className="border border-border/60 rounded-md overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60">
              {['#', 'Omschrijving', 'Details', 'Hoeveelheid', 'Eenheid', 'Stukprijs', 'Totaalprijs'].map(
                (col) => (
                  <th
                    key={col}
                    className="text-left px-3 py-2 font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {regels.map((regel) => (
              <tr key={regel.id} className="border-t border-border/40 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 text-muted-foreground">{regel.regelnummer ?? '—'}</td>
                <td className="px-3 py-2 font-medium max-w-xs truncate">{regel.omschrijving ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">{regel.details ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{regel.hoeveelheid ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{regel.eenheid ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{regel.stukprijs ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{regel.totaalprijs ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
