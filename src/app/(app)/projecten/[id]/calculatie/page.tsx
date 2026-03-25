import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { berekenProjectCalculatie } from '@/lib/calculatie/bereken'
import CalculatieClient from './CalculatieClient'

type Props = { params: Promise<{ id: string }> }

export default async function CalculatiePage({ params }: Props) {
  const { id: projectId } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projecten')
    .select('id, naam, show_naam, project_manager, m2, fee, pm_kosten, korting_1, korting_2, av_kosten, opslag_kosten')
    .eq('id', projectId)
    .single()

  if (!project) notFound()

  const { data: offertes } = await supabase
    .from('offertes')
    .select('id')
    .eq('project_id', projectId)

  const offerteIds = (offertes ?? []).map(o => o.id)

  let subgroupsRaw: {
    subgroupId: string
    subgroupNaam: string
    regels: { orderegelId: string; omschrijving: string; hoeveelheid: string | null; eenheid: string | null; stukprijs: string | null; totaalprijs: string | null }[]
  }[] = []

  if (offerteIds.length > 0) {
    const { data: rawRegels } = await supabase
      .from('orderregels')
      .select(`
        id, omschrijving, hoeveelheid, eenheid, stukprijs, totaalprijs,
        subgroup_elements!subgroup_element_id (
          id, naam,
          subgroups ( id, naam )
        )
      `)
      .in('offerte_id', offerteIds)
      .not('subgroup_element_id', 'is', null)
      .or('validated_at.not.is.null,confidence.eq.HIGH')

    const regels = (rawRegels ?? []).map((r: any) => {
      const el = Array.isArray(r.subgroup_elements) ? (r.subgroup_elements[0] ?? null) : r.subgroup_elements
      const sg = el ? (Array.isArray(el.subgroups) ? (el.subgroups[0] ?? null) : el.subgroups) : null
      return {
        orderegelId: r.id as string,
        omschrijving: (r.omschrijving ?? '') as string,
        hoeveelheid: r.hoeveelheid as string | null,
        eenheid: r.eenheid as string | null,
        stukprijs: r.stukprijs as string | null,
        totaalprijs: r.totaalprijs as string | null,
        subgroupId: sg?.id as string | null,
        subgroupNaam: sg?.naam as string | null,
      }
    }).filter(r => r.subgroupId && r.subgroupNaam)

    const subgroupMap = new Map<string, typeof subgroupsRaw[0]>()
    for (const r of regels) {
      const key = r.subgroupId!
      if (!subgroupMap.has(key)) subgroupMap.set(key, { subgroupId: r.subgroupId!, subgroupNaam: r.subgroupNaam!, regels: [] })
      subgroupMap.get(key)!.regels.push(r)
    }
    subgroupsRaw = [...subgroupMap.values()].sort((a, b) => a.subgroupNaam.localeCompare(b.subgroupNaam))
  }

  const calculatie = berekenProjectCalculatie(
    subgroupsRaw,
    project.fee ?? 1.30,
    project.pm_kosten ?? 0,
    project.korting_1 ?? 0,
    project.korting_2 ?? 0,
    project.av_kosten ?? 0,
    project.opslag_kosten ?? 0,
  )

  return (
    <div className="max-w-6xl mx-auto space-y-8">
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
            Calculatie
          </h1>
        </div>
        <a
          href={`/api/projecten/${projectId}/export`}
          className="btn-primary"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
          Exporteren
        </a>
      </div>

      <CalculatieClient
        projectId={projectId}
        subgroupsRaw={subgroupsRaw}
        initialCalculatie={calculatie}
        initialFee={project.fee ?? 1.30}
        initialPmKosten={project.pm_kosten ?? 0}
        initialKorting1={project.korting_1 ?? 0}
        initialKorting2={project.korting_2 ?? 0}
        initialAvKosten={project.av_kosten ?? 0}
        initialOpslagKosten={project.opslag_kosten ?? 0}
      />
    </div>
  )
}
