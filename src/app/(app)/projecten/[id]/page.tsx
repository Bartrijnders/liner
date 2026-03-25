import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import OfferteUpload from '@/components/OfferteUpload'
import OfferteLijst from '@/components/OfferteLijst'
import ProjectBewerkenButton from '@/components/ProjectBewerkenButton'
import NieuweCalculatieButton from '@/components/NieuweCalculatieButton'

type Props = { params: Promise<{ id: string }> }

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: project }, { data: offertes }, { data: klanten }, { data: calculaties }] = await Promise.all([
    supabase
      .from('projecten')
      .select('*, klanten(naam)')
      .eq('id', id)
      .single(),
    supabase
      .from('offertes')
      .select('id, bestandsnaam, status, fout_melding, storage_path, created_at')
      .eq('project_id', id)
      .neq('bestandsnaam', '__handmatig__')
      .order('created_at', { ascending: false }),
    supabase
      .from('klanten')
      .select('id, naam')
      .order('naam'),
    supabase
      .from('calculaties')
      .select('id, naam, fee, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!project) notFound()

  const klantNaam = Array.isArray(project.klanten)
    ? project.klanten[0]?.naam
    : project.klanten?.naam

  // Validatiestatus per offerte ophalen
  const doneOfferteIds = (offertes ?? []).filter(o => o.status === 'done').map(o => o.id)
  const validatieCounts: Record<string, { total: number; validated: number }> = {}

  if (doneOfferteIds.length > 0) {
    const { data: regels } = await supabase
      .from('orderregels')
      .select('id, offerte_id, validated_at, confidence')
      .in('offerte_id', doneOfferteIds)

    for (const r of regels ?? []) {
      if (!validatieCounts[r.offerte_id]) validatieCounts[r.offerte_id] = { total: 0, validated: 0 }
      validatieCounts[r.offerte_id].total++
      if (r.validated_at || r.confidence === 'HIGH') validatieCounts[r.offerte_id].validated++
    }
  }

  // Stapstatus berekenen
  const aantalOffertes = (offertes ?? []).filter(o => o.bestandsnaam !== '__handmatig__').length
  const stap1 = aantalOffertes > 0 ? 'done' : 'open'

  const doneCount = doneOfferteIds.length
  const validatieNodig = doneOfferteIds.some(id => {
    const c = validatieCounts[id]
    return c && c.validated < c.total
  })
  const stap2 = doneCount === 0 ? 'open'
    : validatieNodig ? 'pending'
    : 'done'

  // Eerste offerte die validatie nodig heeft
  const eersteTeValideren = doneOfferteIds.find(id => {
    const c = validatieCounts[id]
    return c && c.validated < c.total
  })

  const stap3 = (calculaties ?? []).length > 0 ? 'done' : 'open'

  const stapSubtitels = {
    stap1: aantalOffertes === 0 ? 'Nog geen' : `${aantalOffertes} geüpload`,
    stap2: doneCount === 0 ? 'Wacht op verwerking'
      : validatieNodig
        ? `${doneOfferteIds.filter(id => { const c = validatieCounts[id]; return c && c.validated < c.total }).length} te valideren`
        : 'Alles klaar',
    stap3: (calculaties ?? []).length === 0 ? 'Nog geen' : `${(calculaties ?? []).length} calculatie${(calculaties ?? []).length !== 1 ? 's' : ''}`,
  }

  return (
    <div className="space-y-10">
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
                    day: 'numeric', month: 'long', year: 'numeric',
                  })
                : null
            }
          />
          <MetaVeld
            label="Show einddatum"
            waarde={
              project.show_einddatum
                ? new Date(project.show_einddatum).toLocaleDateString('nl-NL', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })
                : null
            }
          />
          <MetaVeld label="HubSpot deal ID" waarde={project.hubspot_deal_id} />
          <MetaVeld label="Oppervlakte" waarde={project.m2 != null ? `${project.m2} m²` : null} />
        </div>
      </div>

      {/* Stap-indicator */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-slate-200">
          <StapTegel
            nummer="1"
            label="Offertes"
            subtitel={stapSubtitels.stap1}
            status={stap1}
          />
          <StapTegel
            nummer="2"
            label="Valideren"
            subtitel={stapSubtitels.stap2}
            status={stap2}
            href={eersteTeValideren ? `/projecten/${id}/offertes/${eersteTeValideren}` : undefined}
          />
          <StapTegel
            nummer="3"
            label="Calculeren"
            subtitel={stapSubtitels.stap3}
            status={stap3}
          />
        </div>
      </div>

      {/* 1 — Offertes */}
      <div>
        <div className="flex items-end justify-between mb-6">
          <div className="space-y-1">
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: 'rgba(66, 71, 77, 0.6)' }}
            >
              Stap 1
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
        <OfferteLijst
          initialOffertes={(offertes ?? []).filter(o => o.bestandsnaam !== '__handmatig__')}
          projectId={id}
          validatieCounts={validatieCounts}
        />
      </div>

      {/* 2 — Calculaties */}
      <div>
        <div className="flex items-end justify-between mb-6">
          <div className="space-y-1">
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: 'rgba(66, 71, 77, 0.6)' }}
            >
              Stap 2
            </p>
            <h2
              className="text-2xl font-extrabold tracking-tight"
              style={{ color: '#1c1c1a', fontFamily: 'var(--font-manrope)' }}
            >
              Calculaties
            </h2>
          </div>
          <NieuweCalculatieButton projectId={id} />
        </div>

        {(calculaties ?? []).length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center text-sm text-slate-400">
            {stap1 === 'open'
              ? 'Upload eerst een offerte voordat je een calculatie aanmaakt.'
              : 'Nog geen calculaties. Maak er een aan om te beginnen.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(calculaties ?? []).map(calc => (
              <Link
                key={calc.id}
                href={`/projecten/${id}/calculaties/${calc.id}`}
                className="rounded-2xl bg-white border border-slate-200 p-5 hover:border-slate-400 transition-colors block"
              >
                <p className="font-semibold text-slate-900 mb-1">{calc.naam}</p>
                <p className="text-xs text-slate-400">Fee: {calc.fee ?? 1.30}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stap Tegel ───────────────────────────────────────────────────────────────

function StapTegel({
  nummer, label, subtitel, status, href,
}: {
  nummer: string
  label: string
  subtitel: string
  status: 'done' | 'pending' | 'open'
  href?: string
}) {
  const dot = status === 'done'
    ? <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
    : status === 'pending'
    ? <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
    : <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 shrink-0" />

  const labelColor = status === 'done' ? 'text-slate-900'
    : status === 'pending' ? 'text-amber-700'
    : 'text-slate-400'

  const subtitelColor = status === 'pending' ? 'text-amber-600' : 'text-slate-400'

  const inner = (
    <div className={`flex items-center gap-3 px-6 py-4 ${href ? 'cursor-pointer hover:bg-slate-50 transition-colors' : ''}`}>
      {dot}
      <div>
        <p className={`text-xs font-bold uppercase tracking-widest ${labelColor}`}>{nummer} — {label}</p>
        <p className={`text-sm mt-0.5 ${subtitelColor}`}>{subtitel}</p>
      </div>
      {href && status === 'pending' && (
        <span className="material-symbols-outlined ml-auto text-amber-500" style={{ fontSize: '16px' }}>arrow_forward</span>
      )}
    </div>
  )

  if (href) return <a href={href}>{inner}</a>
  return inner
}

// ─── Meta Veld ────────────────────────────────────────────────────────────────

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
