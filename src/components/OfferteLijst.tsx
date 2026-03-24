'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import OrderregelsTable from '@/components/OrderregelsTable'

type Offerte = {
  id: string
  bestandsnaam: string
  status: string
  fout_melding: string | null
  storage_path: string
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

  // Sync met server wanneer router.refresh() nieuwe props stuurt (na upload)
  useEffect(() => {
    setOffertes(initialOffertes)
  }, [initialOffertes])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(offerte: Offerte) {
    if (!confirm(`"${offerte.bestandsnaam}" verwijderen?`)) return
    setDeletingId(offerte.id)
    const supabase = createClient()
    await supabase.storage.from('offertes').remove([offerte.storage_path])
    await supabase.from('offertes').delete().eq('id', offerte.id)
    setOffertes((prev) => prev.filter((o) => o.id !== offerte.id))
    if (openRegelId === offerte.id) setOpenRegelId(null)
    setDeletingId(null)
  }

  // Poll elke 3s zolang er offertes in 'uploaded' of 'processing' zijn
  useEffect(() => {
    const hasActive = offertes.some((o) => o.status === 'processing' || o.status === 'uploaded')
    if (!hasActive) return

    const interval = setInterval(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('offertes')
        .select('id, bestandsnaam, status, fout_melding, storage_path, created_at')
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
                  <>
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
                    <Link
                      href={`/projecten/${projectId}/offertes/${offerte.id}`}
                      className="inline-flex items-center h-7 rounded-md border border-input px-2.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      Valideer regels
                    </Link>
                  </>
                )}
                <StatusBadge status={offerte.status} />
                <button
                  onClick={() => handleDelete(offerte)}
                  disabled={deletingId === offerte.id}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  title="Verwijderen"
                >
                  <Trash2 className="size-3.5" />
                </button>
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
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
        <Loader2 className="size-3 animate-spin" />
        Verwerken…
      </span>
    )
  }

  const styles: Record<string, string> = {
    uploaded: 'bg-muted text-muted-foreground',
    done: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    uploaded: 'Geüpload',
    done: 'Klaar',
    error: 'Fout',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${styles[status] ?? styles.uploaded}`}>
      {labels[status] ?? status}
    </span>
  )
}
