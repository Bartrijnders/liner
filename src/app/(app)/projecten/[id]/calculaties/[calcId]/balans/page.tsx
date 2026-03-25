import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { berekenProjectCalculatie } from '@/lib/calculatie/bereken'
import BalansClient from './BalansClient'

type Props = { params: Promise<{ id: string; calcId: string }> }

export default async function BalansPage({ params }: Props) {
  const { id: projectId, calcId } = await params
  const supabase = await createClient()

  const [{ data: project }, { data: calculatie }] = await Promise.all([
    supabase
      .from('projecten')
      .select(`
        id, naam, show_naam, project_manager, m2,
        show_begindatum, show_einddatum, land, plaats, hubspot_deal_id,
        klanten ( naam )
      `)
      .eq('id', projectId)
      .single(),
    supabase
      .from('calculaties')
      .select('id, naam, fee, pm_kosten, korting_1, korting_2, av_kosten, opslag_kosten, budget_client')
      .eq('id', calcId)
      .single(),
  ])

  if (!project || !calculatie) notFound()

  // Geselecteerde offertes voor deze calculatie
  const { data: gekoppeldeOffertes } = await supabase
    .from('calculatie_offertes')
    .select('offerte_id')
    .eq('calculatie_id', calcId)

  const offerteIds = (gekoppeldeOffertes ?? []).map(r => r.offerte_id)

  let subtotaalInkoop = 0
  let subtotaalVerkoop = 0

  if (offerteIds.length > 0) {
    const { data: rawRegels } = await supabase
      .from('orderregels')
      .select(`
        id, hoeveelheid, eenheid, stukprijs, totaalprijs, verkoop_override,
        subgroup_elements!subgroup_element_id ( id, naam, subgroups ( id, naam ) )
      `)
      .in('offerte_id', offerteIds)

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
      calculatie.fee ?? 1.30,
      calculatie.pm_kosten ?? 0,
      calculatie.korting_1 ?? 0,
      calculatie.korting_2 ?? 0,
      calculatie.av_kosten ?? 0,
      calculatie.opslag_kosten ?? 0,
    )
    subtotaalInkoop = calc.subtotaalInkoop
    subtotaalVerkoop = calc.subtotaalVerkoop
  }

  const klantNaam = Array.isArray((project as any).klanten)
    ? ((project as any).klanten[0]?.naam ?? null)
    : ((project as any).klanten?.naam ?? null)

  return (
    <div className="space-y-8">
      <BalansClient
        calcId={calcId}
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
          fee: calculatie.fee ?? 1.30,
          pm_kosten: calculatie.pm_kosten ?? 0,
          korting_1: calculatie.korting_1 ?? 0,
          korting_2: calculatie.korting_2 ?? 0,
          av_kosten: calculatie.av_kosten ?? 0,
          opslag_kosten: calculatie.opslag_kosten ?? 0,
          budget_client: (calculatie as any).budget_client ?? 0,
        }}
        standbuilder={{ subtotaalInkoop, subtotaalVerkoop }}
      />
    </div>
  )
}
