'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

const NAV_ITEMS = [
  { href: '/projecten', icon: 'folder_open', label: 'Projecten' },
  { href: '/catalogus', icon: 'category', label: 'Catalogus' },
]

const EXPANDED_W = 256
const COLLAPSED_W = 64

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const w = collapsed ? COLLAPSED_W : EXPANDED_W

  return (
    <>
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-16 h-[calc(100vh-4rem)] flex flex-col z-40 transition-[width] duration-200 overflow-hidden"
        style={{ width: w, backgroundColor: '#eeece8' }}
      >
        {/* Toggle */}
        <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'} px-3 pt-4 pb-2`}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            title={collapsed ? 'Uitklappen' : 'Inklappen'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 flex-1 px-2">
          {NAV_ITEMS.map(({ href, icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-150 whitespace-nowrap
                  ${active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <span
                  className="material-symbols-outlined shrink-0"
                  style={{
                    fontSize: '20px',
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {icon}
                </span>
                {!collapsed && (
                  <span style={{ fontFamily: 'var(--font-manrope)' }}>{label}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Uitloggen */}
        <div
          className={`px-2 pb-6 pt-3 border-t border-slate-200/60 ${collapsed ? 'flex justify-center' : ''}`}
        >
          <LogoutButton collapsed={collapsed} />
        </div>
      </aside>

      {/* Main — schuift mee */}
      <main
        className="flex-1 p-10 min-h-[calc(100vh-4rem)] transition-[padding-left] duration-200"
        style={{ paddingLeft: `calc(${w}px + 2.5rem)` }}
      >
        {children}
      </main>
    </>
  )
}
