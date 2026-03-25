'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'

export default function OfferteUpload({ projectId }: { projectId: string }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const onDrop = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setUploading(true)
      setError(null)

      const supabase = createClient()

      await Promise.all(
        files.map(async (file) => {
          const uuid = crypto.randomUUID()
          const path = `projecten/${projectId}/${uuid}-${file.name}`

          const { error: storageError } = await supabase.storage
            .from('offertes')
            .upload(path, file)

          if (storageError) {
            setError(`Upload mislukt voor ${file.name}: ${storageError.message}`)
            return
          }

          const { data: offerte, error: dbError } = await supabase
            .from('offertes')
            .insert({
              project_id: projectId,
              bestandsnaam: file.name,
              storage_path: path,
              status: 'uploaded',
            })
            .select('id')
            .single()

          if (dbError || !offerte) {
            setError(`Fout bij opslaan van ${file.name}.`)
            return
          }

          fetch(`/api/offertes/${offerte.id}/verwerk`, { method: 'POST' })
        })
      )

      setUploading(false)
      router.refresh()
    },
    [projectId, router]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    disabled: uploading,
  })

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`rounded-xl px-8 py-10 text-center cursor-pointer transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{
          border: `2px dashed ${isDragActive ? '#1e293b' : '#e2e8f0'}`,
          backgroundColor: isDragActive ? '#f8fafc' : '#ffffff',
        }}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '32px', color: isDragActive ? '#1e293b' : '#94a3b8' }}
          >
            upload_file
          </span>
          <p
            className="text-sm font-semibold"
            style={{ color: isDragActive ? '#1e293b' : '#64748b' }}
          >
            {uploading
              ? 'Bezig met uploaden...'
              : isDragActive
              ? 'Laat los om te uploaden'
              : 'Sleep PDF-bestanden hierheen'}
          </p>
          {!uploading && (
            <p className="text-xs" style={{ color: '#72787e' }}>
              of klik om te bladeren — meerdere bestanden tegelijk mogelijk
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: '#ba1a1a' }}>{error}</p>
      )}
    </div>
  )
}
