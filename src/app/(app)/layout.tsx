import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from './AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f4f0' }}>
      {/* Fixed top nav */}
      <nav
        className="fixed top-0 w-full z-50 flex items-center px-8 h-16"
        style={{
          backgroundColor: 'rgba(245, 244, 240, 0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <span
          className="text-xl font-extrabold tracking-tight text-slate-900"
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          Liner
        </span>
      </nav>

      <div className="flex pt-16">
        <AppShell>{children}</AppShell>
      </div>
    </div>
  )
}
