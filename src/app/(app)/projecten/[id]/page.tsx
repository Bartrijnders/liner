import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import OfferteUpload from '@/components/OfferteUpload'
import OfferteLijst from '@/components/OfferteLijst'

type Props = { params: Promise<{ id: string }> }

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: project }, { data: offertes }] = await Promise.all([
    supabase
      .from('projecten')
      .select('*, klanten(naam)')
      .eq('id', id)
      .single(),
    supabase
      .from('offertes')
      .select('id, bestandsnaam, status, fout_melding, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!project) notFound()

  const klantNaam = Array.isArray(project.klanten)
    ? project.klanten[0]?.naam
    : project.klanten?.naam

  return (
    <div className="space-y-10">
      {/* Terugknop */}
      <div>
        <Link
          href="/projecten"
          className="text-xs uppercase tracking-wide font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Projecten
        </Link>
      </div>

      {/* Projectkop */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">
          Project
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{project.naam}</h1>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-5">
          <MetaVeld label="Project manager" waarde={project.project_manager} />
          <MetaVeld label="Klant" waarde={klantNaam} />
          <MetaVeld label="Land" waarde={project.land} />
          <MetaVeld label="Plaats" waarde={project.plaats} />
          <MetaVeld label="Show" waarde={project.show_naam} />
          <MetaVeld
            label="Show begindatum"
            waarde={
              project.show_begindatum
                ? new Date(project.show_begindatum).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : null
            }
          />
          <MetaVeld
            label="Show einddatum"
            waarde={
              project.show_einddatum
                ? new Date(project.show_einddatum).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : null
            }
          />
          <MetaVeld label="HubSpot deal ID" waarde={project.hubspot_deal_id} />
        </div>
      </div>

      {/* Offertes */}
      <div>
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">
              Bestanden
            </p>
            <h2 className="text-lg font-semibold tracking-tight">Offertes</h2>
          </div>
        </div>

        <OfferteUpload projectId={id} />

        <OfferteLijst initialOffertes={offertes ?? []} projectId={id} />
      </div>
    </div>
  )
}

function MetaVeld({ label, waarde }: { label: string; waarde?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm">{waarde ?? '—'}</p>
    </div>
  )
}

