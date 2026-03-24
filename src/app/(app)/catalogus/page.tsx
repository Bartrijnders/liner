import { createClient } from '@/lib/supabase/server'
import CatalogusClient from './CatalogusClient'

export default async function CatalogusPage() {
  const supabase = await createClient()

  const { data: subgroups } = await supabase
    .from('subgroups')
    .select(`
      id, naam,
      subgroup_elements (
        id, naam,
        match_terms ( id, term, language, toegevoegd_door_feedback )
      )
    `)
    .order('naam', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Catalogus</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Subgroups, elementen en zoektermen
        </p>
      </div>

      <CatalogusClient subgroups={subgroups ?? []} />
    </div>
  )
}
