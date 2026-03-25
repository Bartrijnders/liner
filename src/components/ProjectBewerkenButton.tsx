'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProjectModal from './ProjectModal'

type Klant = { id: string; naam: string }

type Project = {
  id: string
  naam: string
  project_manager: string | null
  klant_id: string | null
  hubspot_deal_id: string | null
  land: string | null
  plaats: string | null
  show_naam: string | null
  show_begindatum: string | null
  show_einddatum: string | null
  target_language: string | null
  m2: number | null
}

export default function ProjectBewerkenButton({ project, klanten }: { project: Project; klanten: Klant[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
        Bewerken
      </button>
      <ProjectModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => { setOpen(false); router.refresh() }}
        klanten={klanten}
        project={project}
      />
    </>
  )
}
