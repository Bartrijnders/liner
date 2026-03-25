import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ValidatieClient from './ValidatieClient'

export default async function ValidatiePage({
  params,
}: {
  params: Promise<{ id: string; offerteId: string }>
}) {
  const { id: projectId, offerteId } = await params
  const supabase = await createClient()

  const { data: offerte } = await supabase
    .from('offertes')
    .select('id, bestandsnaam, status, project_id')
    .eq('id', offerteId)
    .single()

  if (!offerte || offerte.project_id !== projectId) notFound()

  const { data: rawOrderregels } = await supabase
    .from('orderregels')
    .select(`
      id, regelnummer, omschrijving, details,
      hoeveelheid, eenheid, stukprijs, totaalprijs,
      clean_desc, clean_details, category_hint,
      confidence, match_reasoning, suggested_match_term,
      subgroup_element_id, override_element_id, validated_at, localized_naam,
      subgroup_elements!subgroup_element_id (
        id, naam,
        subgroups ( naam )
      )
    `)
    .eq('offerte_id', offerteId)
    .order('regelnummer', { ascending: true })

  const { data: rawElementen } = await supabase
    .from('subgroup_elements')
    .select('id, naam, subgroups(naam)')
    .order('naam', { ascending: true })

  const { data: rawSubgroups } = await supabase
    .from('subgroups')
    .select('id, naam')
    .order('naam', { ascending: true })

  // Supabase returns joined relations as arrays; cast to expected shape
  const orderregels = (rawOrderregels ?? []).map((r: any) => ({
    ...r,
    subgroup_elements: Array.isArray(r.subgroup_elements)
      ? (r.subgroup_elements[0] ?? null)
      : r.subgroup_elements,
  }))

  const allElementen = (rawElementen ?? []).map((e: any) => ({
    ...e,
    subgroups: Array.isArray(e.subgroups) ? (e.subgroups[0] ?? null) : e.subgroups,
  }))

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/projecten/${projectId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Terug naar project
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{offerte.bestandsnaam}</h1>
        <p className="text-sm text-muted-foreground mt-1">Valideer de geëxtraheerde orderregels</p>
      </div>

      <ValidatieClient
        offerteId={offerteId}
        orderregels={orderregels}
        allElementen={allElementen}
        allSubgroups={rawSubgroups ?? []}
      />
    </div>
  )
}
