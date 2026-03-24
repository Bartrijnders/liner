'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import OrderregelsTable from '@/components/OrderregelsTable'

type Offerte = {
  id: string
  bestandsnaam: string
  status: string
  fout_melding: string | null
  created_at: string
}

export default function OfferteLijst({
  initialOffertes,
  projectId,
}: {
  initialOffertes: Offerte[]
  projectId: string
}) {
  const [offertes, setOffertes] = useState<Offerte[]>(initialOffertes)
  const [openRegelId, setOpenRegelId] = useState<string | null>(null)

  // Poll elke 3s zolang er offertes in 'processing' zijn
  useEffect(() => {
    const hasProcessing = offertes.some((o) => o.status === 'processing')
    if (!hasProcessing) return

    const interval = setInterval(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('offertes')
        .select('id, bestandsnaam, status, fout_melding, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (data) setOffertes(data)
    }, 3000)

    return () => clearInterval(interval)
  }, [offertes, projectId])

  if (offertes.length === 0) return null

  return (
    <div className="mt-6 space-y-2">
      {offertes.map((offerte) => (
        <div key={offerte.id} className="space-y-1">
          <div className="border border-border/60 rounded-md px-5 py-3.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium truncate">{offerte.bestandsnaam}</span>
              <div className="flex items-center gap-3 shrink-0">
                {offerte.status === 'done' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setOpenRegelId(openRegelId === offerte.id ? null : offerte.id)
                    }
                  >
                    {openRegelId === offerte.id ? 'Verberg regels' : 'Bekijk regels'}
                  </Button>
                )}
                <StatusBadge status={offerte.status} />
              </div>
            </div>
          </div>

          {offerte.status === 'error' && offerte.fout_melding && (
            <p className="text-xs text-destructive px-1">{offerte.fout_melding}</p>
          )}

          {openRegelId === offerte.id && (
            <OrderregelsTable offerteId={offerte.id} />
          )}
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    uploaded: 'bg-muted text-muted-foreground',
    processing: 'bg-amber-100 text-amber-800',
    done: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    uploaded: 'Geüpload',
    processing: 'Verwerken…',
    done: 'Klaar',
    error: 'Fout',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${styles[status] ?? styles.uploaded}`}>
      {labels[status] ?? status}
    </span>
  )
}
