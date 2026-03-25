import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CalculatieClient from './CalculatieClient'

type Props = { params: Promise<{ id: string; calcId: string }> }

export default async function CalculatiePage({ params }: Props) {
  const { id: projectId, calcId } = await params
  const supabase = await createClient()

  const [{ data: project }, { data: calculatie }, { data: alleOffertes }] = await Promise.all([
    supabase
      .from('projecten')
      .select('id, naam')
      .eq('id', projectId)
      .single(),
    supabase
      .from('calculaties')
      .select('id, naam, fee, pm_kosten, korting_1, korting_2, av_kosten, opslag_kosten')
      .eq('id', calcId)
      .single(),
    supabase
      .from('offertes')
      .select('id, bestandsnaam, status')
      .eq('project_id', projectId)
      .neq('bestandsnaam', '__handmatig__')
      .order('created_at', { ascending: true }),
  ])

  if (!project || !calculatie) notFound()

  // Geselecteerde offertes voor deze calculatie
  const { data: gekoppeldeOffertes } = await supabase
    .from('calculatie_offertes')
    .select('offerte_id')
    .eq('calculatie_id', calcId)

  const geselecteerdeIds = new Set((gekoppeldeOffertes ?? []).map(r => r.offerte_id))

  // Haal orderregels op uit geselecteerde offertes (geen validatiefilter)
  let subgroupsRaw: {
    subgroupId: string
    subgroupNaam: string
    regels: {
      orderegelId: string
      displayNaam: string
      omschrijving: string
      hoeveelheid: string | null
      eenheid: string | null
      stukprijs: string | null
      totaalprijs: string | null
      verkoopOverride: string | null
      elementId: string | null
    }[]
  }[] = []

  const subgroupElementMap: Record<string, string> = {}

  const offerteIds = [...geselecteerdeIds]

  if (offerteIds.length > 0) {
    const { data: rawRegels } = await supabase
      .from('orderregels')
      .select(`
        id, omschrijving, localized_naam, hoeveelheid, eenheid, stukprijs, totaalprijs, verkoop_override,
        subgroup_elements!subgroup_element_id (
          id, naam,
          subgroups ( id, naam )
        )
      `)
      .in('offerte_id', offerteIds)

    const regels = (rawRegels ?? []).map((r: any) => {
      const el = Array.isArray(r.subgroup_elements) ? (r.subgroup_elements[0] ?? null) : r.subgroup_elements
      const sg = el ? (Array.isArray(el.subgroups) ? (el.subgroups[0] ?? null) : el.subgroups) : null
      return {
        orderegelId: r.id as string,
        displayNaam: ((r.localized_naam ?? el?.naam ?? r.omschrijving ?? '') as string),
        elementId: (el?.id as string | null),
        omschrijving: (r.omschrijving ?? '') as string,
        verkoopOverride: r.verkoop_override != null ? String(r.verkoop_override) : null,
        hoeveelheid: r.hoeveelheid as string | null,
        eenheid: r.eenheid as string | null,
        stukprijs: r.stukprijs as string | null,
        totaalprijs: r.totaalprijs as string | null,
        subgroupId: sg?.id as string | null,
        subgroupNaam: sg?.naam as string | null,
      }
    })

    // Build first-element-per-subgroup map (for manual row creation)
    for (const r of regels) {
      if (r.subgroupId && r.elementId && !subgroupElementMap[r.subgroupId]) {
        subgroupElementMap[r.subgroupId] = r.elementId
      }
    }

    const subgroupMap = new Map<string, typeof subgroupsRaw[0]>()

    // Regels met subgroup
    for (const r of regels.filter(r => r.subgroupId)) {
      const key = r.subgroupId!
      if (!subgroupMap.has(key)) {
        subgroupMap.set(key, { subgroupId: key, subgroupNaam: r.subgroupNaam!, regels: [] })
      }
      subgroupMap.get(key)!.regels.push(r)
    }

    subgroupsRaw = [...subgroupMap.values()].sort((a, b) => a.subgroupNaam.localeCompare(b.subgroupNaam))

    // Regels zonder subgroup in aparte groep
    const ongecategoriseerd = regels.filter(r => !r.subgroupId)
    if (ongecategoriseerd.length > 0) {
      subgroupsRaw.push({
        subgroupId: '__geen__',
        subgroupNaam: 'Niet gecategoriseerd',
        regels: ongecategoriseerd,
      })
    }
  }

  return (
    <div className="space-y-8">
      <CalculatieClient
        projectId={projectId}
        calcId={calcId}
        subgroupsRaw={subgroupsRaw}
        subgroupElementMap={subgroupElementMap}
        alleOffertes={alleOffertes ?? []}
        geselecteerdeOfferteIds={[...geselecteerdeIds]}
        initialNaam={calculatie.naam}
        initialFee={calculatie.fee ?? 1.30}
        initialPmKosten={calculatie.pm_kosten ?? 0}
        initialKorting1={calculatie.korting_1 ?? 0}
        initialKorting2={calculatie.korting_2 ?? 0}
        initialAvKosten={calculatie.av_kosten ?? 0}
        initialOpslagKosten={calculatie.opslag_kosten ?? 0}
      />
    </div>
  )
}

