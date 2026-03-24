'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import ProjectModal from '@/components/ProjectModal'

type Klant = { id: string; naam: string }

type Project = {
  id: string
  naam: string
  project_manager: string | null
  show_begindatum: string | null
  show_einddatum: string | null
  klant_id: string | null
  klanten: { naam: string }[] | null
}

export default function ProjectenClient({
  projecten,
  klanten,
}: {
  projecten: Project[]
  klanten: Klant[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const router = useRouter()

  function handleSaved() {
    setModalOpen(false)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">
            Overzicht
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Projecten</h1>
        </div>
        <Button onClick={() => setModalOpen(true)}>Nieuw project</Button>
      </div>

      {projecten.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nog geen projecten aangemaakt.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projecten.map((project) => (
            <Link
              key={project.id}
              href={`/projecten/${project.id}`}
              className="group block border border-border/60 rounded-md p-5 hover:border-primary/40 hover:bg-muted/30 transition-all"
            >
              <p className="font-semibold group-hover:text-primary transition-colors truncate">
                {project.naam}
              </p>
              {project.klanten?.[0]?.naam && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {project.klanten[0].naam}
                </p>
              )}
              <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-2 gap-y-2 text-xs">
                <div>
                  <p className="uppercase tracking-wide text-muted-foreground font-medium">PM</p>
                  <p className="mt-0.5 truncate">{project.project_manager ?? '—'}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-muted-foreground font-medium">Show</p>
                  <p className="mt-0.5 truncate">
                    {project.show_begindatum
                      ? new Date(project.show_begindatum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        klanten={klanten}
      />
    </div>
  )
}
