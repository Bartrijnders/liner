'use client'

import { useRef, useState } from 'react'

const VARIANTEN = [
  { label: 'NL (EU)',       value: 'nl-eu' },
  { label: 'EN (EU)',       value: 'en-eu' },
  { label: 'EN (Non-EU)',   value: 'en-non-eu' },
  { label: 'EN (VS & CA)', value: 'en-us-ca' },
  { label: 'DE (EU)',       value: 'de-eu' },
]

export default function OfferteExportButton({ calcId }: { calcId: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  function handleSelect(variant: string) {
    setOpen(false)
    window.location.href = `/api/calculaties/${calcId}/offerte-export?variant=${variant}`
  }

  // Close on outside click
  function handleBlur(e: React.FocusEvent) {
    if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false)
  }

  return (
    <div ref={ref} className="relative" onBlur={handleBlur}>
      <button
        onClick={() => setOpen(v => !v)}
        className="btn-primary flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
        Offerte
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-slate-200 shadow-lg py-1 z-50">
          {VARIANTEN.map(v => (
            <button
              key={v.value}
              onClick={() => handleSelect(v.value)}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
