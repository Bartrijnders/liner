import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { berekenProjectCalculatie } from '@/lib/calculatie/bereken'

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

  // Project ophalen
  const { data: project } = await supabase
    .from('projecten')
    .select('id, naam, fee, pm_kosten, korting_1, korting_2, av_kosten, opslag_kosten')
    .eq('id', projectId)
    .single()

  if (!project) return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })

  // Alle offertes voor dit project
  const { data: offertes } = await supabase
    .from('offertes')
    .select('id')
    .eq('project_id', projectId)

  if (!offertes || offertes.length === 0) {
    return NextResponse.json({ subgroupsRaw: [], project })
  }

  const offerteIds = offertes.map(o => o.id)

  // Gevalideerde orderregels met subgroup info
  const { data: rawRegels } = await supabase
    .from('orderregels')
    .select(`
      id, omschrijving, hoeveelheid, eenheid, stukprijs, totaalprijs,
      subgroup_element_id,
      subgroup_elements!subgroup_element_id (
        id, naam,
        subgroups ( id, naam )
      )
    `)
    .in('offerte_id', offerteIds)
    .not('subgroup_element_id', 'is', null)
    .or('validated_at.not.is.null,confidence.eq.HIGH')

  // Normaliseer joins
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

  // Groepeer op subgroup
  const subgroupMap = new Map<string, { subgroupId: string; subgroupNaam: string; regels: typeof regels }>()
  for (const r of regels) {
    const key = r.subgroupId!
    if (!subgroupMap.has(key)) {
      subgroupMap.set(key, { subgroupId: r.subgroupId!, subgroupNaam: r.subgroupNaam!, regels: [] })
    }
    subgroupMap.get(key)!.regels.push(r)
  }

  const subgroupsRaw = [...subgroupMap.values()].sort((a, b) => a.subgroupNaam.localeCompare(b.subgroupNaam))

  const calculatie = berekenProjectCalculatie(
    subgroupsRaw,
    project.fee ?? 1.30,
    project.pm_kosten ?? 0,
    project.korting_1 ?? 0,
    project.korting_2 ?? 0,
    project.av_kosten ?? 0,
    project.opslag_kosten ?? 0,
  )

  return NextResponse.json({ calculatie, subgroupsRaw, project })
}
