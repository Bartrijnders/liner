import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { berekenProjectCalculatie } from '@/lib/calculatie/bereken'
import { genereerOfferteDOCX, type OfferteDOCXData } from '@/lib/offerte/genereer-docx'

export const runtime = 'nodejs'

const fmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

function fmtDatum(d: string | null | undefined): string {
  if (!d) return '—'
  const dt = new Date(d)
  const day = String(dt.getUTCDate()).padStart(2, '0')
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const year = dt.getUTCFullYear()
  return `${day}/${month}/${year}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: calcId } = await params
  const variant = request.nextUrl.searchParams.get('variant') ?? 'nl-eu'

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

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch calculatie + project + klant
  const { data: calculatie } = await serviceClient
    .from('calculaties')
    .select(`
      id, naam, fee, pm_kosten, korting_1, korting_2, av_kosten, opslag_kosten,
      projecten (
        id, naam, show_naam, project_manager, m2,
        show_begindatum, show_einddatum, land, plaats,
        klanten ( naam )
      )
    `)
    .eq('id', calcId)
    .single()

  if (!calculatie) return NextResponse.json({ error: 'Calculatie niet gevonden' }, { status: 404 })

  const project = calculatie.projecten as any
  const klantNaam = Array.isArray(project?.klanten)
    ? (project.klanten[0]?.naam ?? '')
    : (project?.klanten?.naam ?? '')

  // Fetch selected offertes
  const { data: gekoppeld } = await serviceClient
    .from('calculatie_offertes')
    .select('offerte_id')
    .eq('calculatie_id', calcId)

  const offerteIds = (gekoppeld ?? []).map((r: any) => r.offerte_id)

  // Fetch orderregels
  const subgroupMap = new Map<string, any>()

  if (offerteIds.length > 0) {
    const { data: rawRegels } = await serviceClient
      .from('orderregels')
      .select(`
        id, omschrijving, localized_naam, hoeveelheid, eenheid, stukprijs, totaalprijs, verkoop_override,
        subgroup_elements!subgroup_element_id ( id, naam, subgroups ( id, naam ) )
      `)
      .in('offerte_id', offerteIds)

    for (const r of rawRegels ?? []) {
      const el = Array.isArray(r.subgroup_elements) ? (r.subgroup_elements[0] ?? null) : r.subgroup_elements
      const sg = el ? (Array.isArray(el.subgroups) ? (el.subgroups[0] ?? null) : el.subgroups) : null
      if (!sg) continue

      const key = sg.id
      if (!subgroupMap.has(key)) subgroupMap.set(key, { subgroupId: key, subgroupNaam: sg.naam, regels: [] })
      subgroupMap.get(key)!.regels.push({
        orderegelId: r.id,
        omschrijving: (r as any).localized_naam ?? r.omschrijving ?? '',
        hoeveelheid: r.hoeveelheid,
        eenheid: r.eenheid,
        stukprijs: r.stukprijs,
        totaalprijs: r.totaalprijs,
        verkoopOverride: r.verkoop_override != null ? String(r.verkoop_override) : null,
      })
    }
  }

  const fee = calculatie.fee ?? 1.30
  const pmKosten = calculatie.pm_kosten ?? 0
  const korting1 = calculatie.korting_1 ?? 0
  const korting2 = calculatie.korting_2 ?? 0
  const avKosten = calculatie.av_kosten ?? 0
  const opslagKosten = calculatie.opslag_kosten ?? 0

  const calc = berekenProjectCalculatie(
    [...subgroupMap.values()],
    fee,
    pmKosten,
    korting1,
    korting2,
    avKosten,
    opslagKosten,
  )

  // Build OfferteDOCXData
  const locatie = [project?.plaats, project?.land].filter(Boolean).join(', ')

  const categorieen = calc.subgroups
    .filter(sg => sg.regels.length > 0)
    .map(sg => ({
      naam: sg.subgroupNaam,
      regels: sg.regels.map(r => ({
        omschrijving: r.omschrijving,
        hoeveelheid: r.hoeveelheid != null ? String(r.hoeveelheid) : '—',
        eenheid: r.eenheid ?? '—',
        verkoopprijs: r.verkoopprijs != null ? fmt.format(r.verkoopprijs) : '—',
      })),
      categorie_totaal: fmt.format(sg.verkoopprijs),
    }))

  const data: OfferteDOCXData = {
    klant_naam: klantNaam,
    project_manager: project?.project_manager ?? '',
    pm_email: '',
    pm_telefoon: '',
    datum: fmtDatum(new Date().toISOString()),
    referentie: `SO-${calcId.slice(0, 8).toUpperCase()}`,
    show_naam: project?.show_naam ?? project?.naam ?? '',
    locatie,
    m2: project?.m2 != null ? String(project.m2) : '—',
    show_begindatum: fmtDatum(project?.show_begindatum),
    show_einddatum: fmtDatum(project?.show_einddatum),
    subtotaal_standbuilder: fmt.format(calc.subtotaalVerkoop),
    subtotaal_voor_korting: fmt.format(calc.subtotaalVerkoop + pmKosten + avKosten + opslagKosten),
    pm_kosten: fmt.format(pmKosten),
    av_kosten: fmt.format(avKosten),
    opslag_kosten: fmt.format(opslagKosten),
    korting_1: fmt.format(korting1),
    korting_2: fmt.format(korting2),
    eindtotaal: fmt.format(calc.eindtotaalVerkoop),
    categorieen,
  }

  try {
    const buffer = genereerOfferteDOCX(data, variant)
    const veiligNaam = (project?.naam ?? 'Offerte').replace(/[^a-z0-9\-_\s]/gi, '').trim()

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Offerte-${veiligNaam}.docx"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Genereren mislukt' }, { status: 500 })
  }
}
