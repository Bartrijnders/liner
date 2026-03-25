'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { projectId: string }

export default function NieuweCalculatieButton({ projectId }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [naam, setNaam] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (expanded) {
      setNaam('Nieuwe calculatie')
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [expanded])

  async function handleAanmaken() {
    setLoading(true)
    const res = await fetch('/api/calculaties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, naam: naam.trim() || 'Nieuwe calculatie' }),
    })
    const data = await res.json()
    if (data.id) {
      router.push(`/projecten/${projectId}/calculaties/${data.id}`)
    } else {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAanmaken()
    if (e.key === 'Escape') { setExpanded(false); setNaam('') }
  }

  if (expanded) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={naam}
          onChange={e => setNaam(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="text-sm rounded-lg px-3 py-2 border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-slate-400 w-48"
          placeholder="Naam calculatie"
        />
        <button
          onClick={handleAanmaken}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Aanmaken…' : 'Aanmaken'}
        </button>
        <button
          onClick={() => { setExpanded(false); setNaam('') }}
          disabled={loading}
          className="text-slate-400 hover:text-slate-700 transition-colors p-1"
          title="Annuleren"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setExpanded(true)} className="btn-primary">
      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
      Nieuwe calculatie
    </button>
  )
}
