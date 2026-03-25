'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Trash2 } from 'lucide-react'
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

type ValidatieCount = { total: number; validated: number }

export default function OfferteLijst({
  initialOffertes,
  projectId,
  validatieCounts = {},
}: {
  initialOffertes: Offerte[]
  projectId: string
  validatieCounts?: Record<string, ValidatieCount>
}) {
  const [offertes, setOffertes] = useState<Offerte[]>(initialOffertes)
  const [openRegelId, setOpenRegelId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    setOffertes(initialOffertes)
  }, [initialOffertes])

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
    <div className="mt-4 space-y-2">
      {offertes.map((offerte) => (
        <div key={offerte.id}>
          <div className="bg-white rounded-xl px-5 py-3.5 border border-slate-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="material-symbols-outlined text-slate-400 shrink-0" style={{ fontSize: '18px' }}>
                  description
                </span>
                <span className="font-medium text-slate-900 truncate text-sm">
                  {offerte.bestandsnaam}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {offerte.status === 'done' && (
                  <>
                    <ValidatieBadge counts={validatieCounts[offerte.id]} />
                    <button
                      onClick={() => setOpenRegelId(openRegelId === offerte.id ? null : offerte.id)}
                      className="btn-secondary btn-sm"
                    >
                      {openRegelId === offerte.id ? 'Verberg regels' : 'Bekijk regels'}
                    </button>
                    <Link
                      href={`/projecten/${projectId}/offertes/${offerte.id}`}
                      className="btn-primary btn-sm"
                    >
                      Valideer regels
                    </Link>
                  </>
                )}
                <StatusBadge status={offerte.status} />
                <button
                  onClick={() => handleDelete(offerte)}
                  disabled={deletingId === offerte.id}
                  className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 p-1"
                  title="Verwijderen"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {offerte.status === 'error' && offerte.fout_melding && (
              <p className="text-xs text-red-600 mt-2">{offerte.fout_melding}</p>
            )}
          </div>

          {openRegelId === offerte.id && (
            <div className="mt-2">
              <OrderregelsTable offerteId={offerte.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ValidatieBadge({ counts }: { counts?: ValidatieCount }) {
  if (!counts || counts.total === 0) return null
  if (counts.validated >= counts.total) {
    return (
      <span className="text-xs font-medium px-2 py-1 rounded-md bg-green-100 text-green-700">
        Gevalideerd
      </span>
    )
  }
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-md bg-amber-100 text-amber-700">
      {counts.validated} / {counts.total} gevalideerd
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-1 rounded-md">
        <Loader2 size={10} className="animate-spin" />
        Verwerken…
      </span>
    )
  }
  const config: Record<string, string> = {
    uploaded: 'bg-slate-100 text-slate-500',
    done: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-600',
  }
  const labels: Record<string, string> = {
    uploaded: 'Geüpload',
    done: 'Klaar',
    error: 'Fout',
  }
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-md ${config[status] ?? config.uploaded}`}>
      {labels[status] ?? status}
    </span>
  )
}
