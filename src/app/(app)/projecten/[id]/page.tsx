import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import OfferteUpload from '@/components/OfferteUpload'
import OfferteLijst from '@/components/OfferteLijst'
import ProjectBewerkenButton from '@/components/ProjectBewerkenButton'

type Props = { params: Promise<{ id: string }> }

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: project }, { data: offertes }, { data: klanten }] = await Promise.all([
    supabase
      .from('projecten')
      .select('*, klanten(naam)')
      .eq('id', id)
      .single(),
    supabase
      .from('offertes')
      .select('id, bestandsnaam, status, fout_melding, storage_path, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('klanten')
      .select('id, naam')
      .order('naam'),
  ])

  if (!project) notFound()

  const klantNaam = Array.isArray(project.klanten)
    ? project.klanten[0]?.naam
    : project.klanten?.naam

  return (
    <div className="space-y-12">
      {/* Terugknop */}
      <Link
        href="/projecten"
        className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
        style={{ color: '#42474d' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        Projecten
      </Link>

      {/* Projectkop */}
      <div>
        <p
          className="text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: 'rgba(66, 71, 77, 0.6)' }}
        >
          Project
        </p>
        <div className="flex items-start justify-between mb-8">
          <h1
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: '#1c1c1a', fontFamily: 'var(--font-manrope)' }}
          >
            {project.naam}
          </h1>
          <ProjectBewerkenButton
            project={{
              id: project.id,
              naam: project.naam,
              project_manager: project.project_manager ?? null,
              klant_id: project.klant_id ?? null,
              hubspot_deal_id: project.hubspot_deal_id ?? null,
              land: project.land ?? null,
              plaats: project.plaats ?? null,
              show_naam: project.show_naam ?? null,
              show_begindatum: project.show_begindatum ?? null,
              show_einddatum: project.show_einddatum ?? null,
              target_language: project.target_language ?? null,
              m2: project.m2 ?? null,
            }}
            klanten={klanten ?? []}
          />
        </div>

        <div
          className="rounded-2xl p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8"
          style={{ backgroundColor: '#ffffff' }}
        >
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
          <MetaVeld label="Oppervlakte" waarde={project.m2 != null ? `${project.m2} m²` : null} />
        </div>

        {offertes?.some(o => o.status === 'done') && (
          <div className="mt-6">
            <Link
              href={`/projecten/${id}/calculatie`}
              className="btn-primary inline-flex"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calculate</span>
              Bekijk calculatie
            </Link>
          </div>
        )}
      </div>

      {/* Offertes */}
      <div>
        <div className="flex items-end justify-between mb-6">
          <div className="space-y-1">
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: 'rgba(66, 71, 77, 0.6)' }}
            >
              Bestanden
            </p>
            <h2
              className="text-2xl font-extrabold tracking-tight"
              style={{ color: '#1c1c1a', fontFamily: 'var(--font-manrope)' }}
            >
              Offertes
            </h2>
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
      <p
        className="text-[10px] font-bold uppercase tracking-widest mb-1"
        style={{ color: 'rgba(66, 71, 77, 0.6)' }}
      >
        {label}
      </p>
      <p className="text-sm font-medium" style={{ color: '#1c1c1a' }}>
        {waarde ?? '—'}
      </p>
    </div>
  )
}
