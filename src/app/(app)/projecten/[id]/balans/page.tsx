import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { berekenProjectCalculatie } from '@/lib/calculatie/bereken'
import BalansClient from './BalansClient'

type Props = { params: Promise<{ id: string }> }

export default async function BalansPage({ params }: Props) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projecten')
    .select(`
      id, naam, show_naam, project_manager, m2,
      show_begindatum, show_einddatum, land, plaats, hubspot_deal_id,
      fee, pm_kosten, korting_1, korting_2, av_kosten, opslag_kosten,
      budget_client,
      klanten ( naam )
    `)
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  const { data: offertes } = await supabase
    .from('offertes').select('id').eq('project_id', projectId)

  const offerteIds = (offertes ?? []).map(o => o.id)

  // Haal calculatie-totalen op (dezelfde query als calculatie/page.tsx)
  let subtotaalInkoop = 0
  let subtotaalVerkoop = 0
  let totaalMarge = 0
  let margePercentage = 0

  if (offerteIds.length > 0) {
    const { data: rawRegels } = await supabase
      .from('orderregels')
      .select(`
        id, hoeveelheid, eenheid, stukprijs, totaalprijs, verkoop_override,
        subgroup_elements!subgroup_element_id ( id, naam, subgroups ( id, naam ) )
      `)
      .in('offerte_id', offerteIds)
      .not('subgroup_element_id', 'is', null)
      .or('validated_at.not.is.null,confidence.eq.HIGH')

    const regels = (rawRegels ?? []).map((r: any) => {
      const el = Array.isArray(r.subgroup_elements) ? (r.subgroup_elements[0] ?? null) : r.subgroup_elements
      const sg = el ? (Array.isArray(el.subgroups) ? (el.subgroups[0] ?? null) : el.subgroups) : null
      return {
        orderegelId: r.id as string,
        omschrijving: '',
        hoeveelheid: r.hoeveelheid as string | null,
        eenheid: r.eenheid as string | null,
        stukprijs: r.stukprijs as string | null,
        totaalprijs: r.totaalprijs as string | null,
        verkoopOverride: r.verkoop_override != null ? String(r.verkoop_override) : null,
        subgroupId: sg?.id as string | null,
        subgroupNaam: sg?.naam as string | null,
      }
    }).filter(r => r.subgroupId)

    const subgroupMap = new Map<string, any>()
    for (const r of regels) {
      const key = r.subgroupId!
      if (!subgroupMap.has(key)) subgroupMap.set(key, { subgroupId: key, subgroupNaam: r.subgroupNaam, regels: [] })
      subgroupMap.get(key)!.regels.push(r)
    }

    const calc = berekenProjectCalculatie(
      [...subgroupMap.values()],
      project.fee ?? 1.30,
      project.pm_kosten ?? 0,
      project.korting_1 ?? 0,
      project.korting_2 ?? 0,
      project.av_kosten ?? 0,
      project.opslag_kosten ?? 0,
    )
    subtotaalInkoop = calc.subtotaalInkoop
    subtotaalVerkoop = calc.subtotaalVerkoop
    totaalMarge = calc.totaalMarge
    margePercentage = calc.margePercentage
  }

  const klantNaam = Array.isArray((project as any).klanten)
    ? ((project as any).klanten[0]?.naam ?? null)
    : ((project as any).klanten?.naam ?? null)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href={`/projecten/${projectId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{ color: '#42474d' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            {project.naam}
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#1c1c1a', fontFamily: 'var(--font-manrope)' }}>
            Budget balans
          </h1>
        </div>
        <Link
          href={`/projecten/${projectId}/calculatie`}
          className="btn-secondary"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calculate</span>
          Calculatie
        </Link>
      </div>

      <BalansClient
        projectId={projectId}
        project={{
          naam: project.naam,
          show_naam: project.show_naam,
          project_manager: project.project_manager,
          klant_naam: klantNaam,
          m2: project.m2,
          show_begindatum: project.show_begindatum,
          show_einddatum: project.show_einddatum,
          land: project.land,
          plaats: project.plaats,
          hubspot_deal_id: project.hubspot_deal_id,
          fee: project.fee ?? 1.30,
          pm_kosten: project.pm_kosten ?? 0,
          korting_1: project.korting_1 ?? 0,
          korting_2: project.korting_2 ?? 0,
          av_kosten: project.av_kosten ?? 0,
          opslag_kosten: project.opslag_kosten ?? 0,
          budget_client: (project as any).budget_client ?? 0,
        }}
        standbuilder={{ subtotaalInkoop, subtotaalVerkoop }}
      />
    </div>
  )
}
