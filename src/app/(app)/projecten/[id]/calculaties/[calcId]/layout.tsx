import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TabNav from '@/components/TabNav'
import OfferteExportButton from '@/components/OfferteExportButton'

type Props = {
  children: React.ReactNode
  params: Promise<{ id: string; calcId: string }>
}

export default async function CalculatieLayout({ children, params }: Props) {
  const { id: projectId, calcId } = await params
  const supabase = await createClient()

  const [{ data: project }, { data: calculatie }] = await Promise.all([
    supabase.from('projecten').select('id, naam').eq('id', projectId).single(),
    supabase.from('calculaties').select('id, naam').eq('id', calcId).single(),
  ])

  const tabs = [
    { label: 'Calculatie', href: `/projecten/${projectId}/calculaties/${calcId}` },
    { label: 'Balans', href: `/projecten/${projectId}/calculaties/${calcId}/balans` },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-0">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-1">
          <Link
            href={`/projecten/${projectId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{ color: '#42474d' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            {project?.naam ?? 'Project'}
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#1c1c1a', fontFamily: 'var(--font-manrope)' }}>
            {calculatie?.naam ?? 'Calculatie'}
          </h1>
        </div>
        <OfferteExportButton calcId={calcId} />
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <TabNav tabs={tabs} />
      </div>

      {children}
    </div>
  )
}
