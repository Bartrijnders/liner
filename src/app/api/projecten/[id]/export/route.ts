export const runtime = 'nodejs'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { genereerExcel } from '@/lib/calculatie/excel-export'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: project } = await supabase
    .from('projecten')
    .select('id, naam, show_naam, project_manager, m2, fee, pm_kosten, korting_1, korting_2, av_kosten, opslag_kosten')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })

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

  try {
    const buffer = await genereerExcel(
      {
        naam: project.naam,
        show_naam: project.show_naam ?? null,
        project_manager: project.project_manager ?? null,
        m2: project.m2 ?? null,
        fee: project.fee ?? 1.30,
        pm_kosten: project.pm_kosten ?? 0,
        korting_1: project.korting_1 ?? 0,
        korting_2: project.korting_2 ?? 0,
        av_kosten: project.av_kosten ?? 0,
        opslag_kosten: project.opslag_kosten ?? 0,
      },
      subgroupsRaw
    )

    const veiligNaam = project.naam.replace(/[^a-zA-Z0-9\-_]/g, '_')
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Calculatie-${veiligNaam}.xlsx"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Export mislukt' }, { status: 500 })
  }
}
