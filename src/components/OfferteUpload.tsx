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

          // 1. Upload naar Supabase Storage
          const { error: storageError } = await supabase.storage
            .from('offertes')
            .upload(path, file)

          if (storageError) {
            setError(`Upload mislukt voor ${file.name}: ${storageError.message}`)
            return
          }

          // 2. Rij aanmaken in offertes tabel
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

          // 3. AI extractie starten — fire-and-forget
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
        className={`
          border-2 border-dashed rounded-md px-8 py-12 text-center cursor-pointer transition-colors
          ${isDragActive
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <p className="text-sm font-medium">
          {uploading
            ? 'Bezig met uploaden...'
            : isDragActive
            ? 'Laat los om te uploaden'
            : 'Sleep PDF-bestanden hierheen'}
        </p>
        <p className="text-xs mt-1 opacity-70">
          {uploading ? '' : 'of klik om te bladeren — meerdere bestanden tegelijk mogelijk'}
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
