'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProjectModal from '@/components/ProjectModal'

type Klant = { id: string; naam: string }

type Project = {
  id: string
  naam: string
  project_manager: string | null
  show_begindatum: string | null
  show_einddatum: string | null
  klant_id: string | null
  klanten: { naam: string } | null
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
      {/* Header */}
      <header className="flex justify-between items-end mb-12">
        <div className="space-y-1">
          <h1
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: '#1c1c1a', fontFamily: 'var(--font-manrope)' }}
          >
            Projecten
          </h1>
          <p className="font-medium" style={{ color: '#42474d' }}>
            Beheer en overzicht van lopende projecten.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Nieuw project
        </button>
      </header>

      {/* Tabel */}
      {projecten.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ backgroundColor: '#ffffff' }}
        >
          <p style={{ color: '#42474d' }}>Nog geen projecten aangemaakt.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ backgroundColor: 'rgba(246, 243, 241, 0.5)' }}>
                  {['Naam', 'Project manager', 'Klant', 'Show begindatum', 'Show einddatum', ''].map((h) => (
                    <th
                      key={h}
                      className="px-8 py-5 text-xs font-bold uppercase tracking-wider"
                      style={{ color: 'rgba(66, 71, 77, 0.8)', fontFamily: 'var(--font-manrope)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projecten.map((project) => (
                  <tr
                    key={project.id}
                    className="group cursor-pointer transition-colors"
                    style={{ borderTop: '1px solid #f6f3f1' }}
                    onClick={() => router.push(`/projecten/${project.id}`)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#d6e3dd' }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ color: '#596561', fontSize: '20px' }}
                          >
                            folder_open
                          </span>
                        </div>
                        <span
                          className="font-bold text-lg"
                          style={{ color: '#1c1c1a', fontFamily: 'var(--font-manrope)' }}
                        >
                          {project.naam}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 font-medium" style={{ color: '#1c1c1a' }}>
                      {project.project_manager ?? '—'}
                    </td>
                    <td className="px-8 py-6 font-medium" style={{ color: '#42474d' }}>
                      {project.klanten?.naam ?? '—'}
                    </td>
                    <td className="px-8 py-6 text-center" style={{ color: '#42474d' }}>
                      {project.show_begindatum
                        ? new Date(project.show_begindatum).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-8 py-6 text-center" style={{ color: '#42474d' }}>
                      {project.show_einddatum
                        ? new Date(project.show_einddatum).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span
                        className="material-symbols-outlined transition-colors"
                        style={{ color: '#72787e', fontSize: '20px' }}
                      >
                        chevron_right
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="px-8 py-4 flex justify-between items-center"
            style={{ backgroundColor: 'rgba(246, 243, 241, 0.3)' }}
          >
            <p className="text-sm" style={{ color: '#42474d' }}>
              {projecten.length} project{projecten.length !== 1 ? 'en' : ''}
            </p>
          </div>
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
