import { createClient } from '@/lib/supabase/server'
import ProjectenClient from './ProjectenClient'

export default async function ProjectenPage() {
  const supabase = await createClient()

  const [{ data: projecten }, { data: klanten }] = await Promise.all([
    supabase
      .from('projecten')
      .select('id, naam, project_manager, show_begindatum, show_einddatum, klant_id, klanten(naam)')
      .order('created_at', { ascending: false }),
    supabase.from('klanten').select('id, naam').order('naam'),
  ])

  return (
    <ProjectenClient
      projecten={projecten ?? []}
      klanten={klanten ?? []}
    />
  )
}
