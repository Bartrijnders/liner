'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Inloggen mislukt. Controleer je e-mailadres en wachtwoord.')
      setLoading(false)
    } else {
      router.push('/projecten')
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: '#fcf9f6' }}
    >
      <div className="w-full max-w-sm space-y-10">
        {/* Merk */}
        <div className="text-center space-y-1">
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'rgba(66, 71, 77, 0.6)' }}
          >
            The Doc
          </p>
          <h1
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: '#1c1c1a', fontFamily: 'var(--font-manrope)' }}
          >
            Liner
          </h1>
        </div>

        {/* Formulier */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px #e2e8f0' }}>
          <form onSubmit={handleSubmit}>
            <div className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[13px] font-semibold"
                  style={{ color: '#42474d' }}
                >
                  E-mailadres
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all focus:ring-2"
                  style={{ backgroundColor: '#ebe8e5', border: 'none', color: '#1c1c1a' }}
                  placeholder="naam@bedrijf.nl"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-[13px] font-semibold"
                  style={{ color: '#42474d' }}
                >
                  Wachtwoord
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all focus:ring-2"
                  style={{ backgroundColor: '#ebe8e5', border: 'none', color: '#1c1c1a' }}
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <p className="text-sm" style={{ color: '#ba1a1a' }}>{error}</p>
              )}
            </div>

            <div style={{ backgroundColor: '#f1f5f9', padding: '16px 32px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3"
              >
                {loading ? 'Laden...' : 'Inloggen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
