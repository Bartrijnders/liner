'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (collapsed) {
    return (
      <button
        onClick={handleLogout}
        title="Uitloggen"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition-colors"
    >
      <span className="material-symbols-outlined shrink-0" style={{ fontSize: '20px' }}>logout</span>
      <span style={{ fontFamily: 'var(--font-manrope)' }}>Uitloggen</span>
    </button>
  )
}
