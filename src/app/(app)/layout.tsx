import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-wide uppercase text-foreground/70">
            Liner
          </span>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/projecten" className="hover:text-foreground transition-colors">
              Projecten
            </Link>
            <Link href="/catalogus" className="hover:text-foreground transition-colors">
              Catalogus
            </Link>
          </nav>
        </div>
        <LogoutButton />
      </header>
      <main className="flex-1 px-8 py-10 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  )
}
