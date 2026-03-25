'use client'

import { useRef, useState } from 'react'

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

const pct = (n: number) => `${n.toFixed(1)}%`

type ProjectFields = {
  naam: string
  show_naam: string | null
  project_manager: string | null
  klant_naam: string | null
  m2: number | null
  show_begindatum: string | null
  show_einddatum: string | null
  land: string | null
  plaats: string | null
  hubspot_deal_id: string | null
  fee: number
  pm_kosten: number
  korting_1: number
  korting_2: number
  av_kosten: number
  opslag_kosten: number
  budget_client: number
}

type Props = {
  calcId: string
  project: ProjectFields
  standbuilder: { subtotaalInkoop: number; subtotaalVerkoop: number }
}

export default function BalansClient({ calcId, project: initial, standbuilder }: Props) {
  const [p, setP] = useState(initial)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  function update<K extends keyof ProjectFields>(key: K, value: ProjectFields[K]) {
    setP(prev => ({ ...prev, [key]: value }))
  }

  function debouncedSave(field: string, value: unknown) {
    clearTimeout(saveTimers.current[field])
    saveTimers.current[field] = setTimeout(() => {
      fetch(`/api/calculaties/${calcId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
    }, 600)
  }

  function handleNum(key: keyof ProjectFields, dbField: string, val: string) {
    const n = parseFloat(val) || 0
    update(key, n as any)
    debouncedSave(dbField, n)
  }

  // Berekeningen
  const standMarge = standbuilder.subtotaalVerkoop - standbuilder.subtotaalInkoop
  const standMargePct = standbuilder.subtotaalVerkoop > 0
    ? (standMarge / standbuilder.subtotaalVerkoop) * 100 : 0

  const pmVerkoop = p.pm_kosten
  const avVerkoop = p.av_kosten
  const opslagVerkoop = p.opslag_kosten

  const totaalInkoop = standbuilder.subtotaalInkoop
  const totaalVerkoop = standbuilder.subtotaalVerkoop + pmVerkoop + avVerkoop + opslagVerkoop
    - p.korting_1 - p.korting_2
  const totaalMarge = totaalVerkoop - totaalInkoop
  const eindMargePct = totaalVerkoop > 0 ? (totaalMarge / totaalVerkoop) * 100 : 0

  const budgetVerschil = p.budget_client > 0 ? totaalVerkoop - p.budget_client : null
  const budgetPerM2 = p.m2 && p.m2 > 0 ? totaalVerkoop / p.m2 : null

  const field = 'w-full text-sm rounded-lg px-3 py-2 border border-slate-200 bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 transition-all'
  const numField = field + ' text-right'

  return (
    <div className="space-y-6">

      {/* ── Project info ── */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Project informatie</span>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoField label="Client" value={p.klant_naam ?? p.naam} />
          <InfoField label="Show" value={p.show_naam} />
          <InfoField label="Project manager" value={p.project_manager} />
          <InfoField label="Locatie" value={[p.plaats, p.land].filter(Boolean).join(', ') || null} />
          <InfoField
            label="Datum"
            value={[p.show_begindatum, p.show_einddatum].filter(Boolean).join(' – ') || null}
          />
          <InfoField label="Stand m²" value={p.m2 != null ? String(p.m2) : null} />
          <InfoField label="HubSpot" value={p.hubspot_deal_id} />
          <InfoField label="Fee factor" value={String(p.fee)} />
        </div>
      </div>

      {/* ── Financieel overzicht ── */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Financieel overzicht</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                <th className="px-6 py-3">Categorie</th>
                <th className="px-4 py-3 w-36 text-right">Inkoop</th>
                <th className="px-4 py-3 w-36 text-right">Marge</th>
                <th className="px-4 py-3 w-36 text-right">Verkoopprijs</th>
                <th className="px-4 py-3 w-20 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-6 py-3 text-sm text-slate-700 font-medium">Standbuilder</td>
                <td className="px-4 py-3 text-sm text-slate-700 text-right">{euro(standbuilder.subtotaalInkoop)}</td>
                <td className="px-4 py-3 text-sm text-green-700 text-right">{euro(standMarge)}</td>
                <td className="px-4 py-3 text-sm text-slate-900 font-medium text-right">{euro(standbuilder.subtotaalVerkoop)}</td>
                <td className="px-4 py-3 text-sm text-slate-500 text-right">{pct(standMargePct)}</td>
              </tr>

              <tr className="border-t border-slate-100">
                <td className="px-6 py-3 text-sm text-slate-700">PM &amp; Design</td>
                <td className="px-4 py-1.5 text-sm text-slate-400 text-right">—</td>
                <td className="px-4 py-1.5 text-sm text-slate-400 text-right">—</td>
                <td className="px-4 py-1.5">
                  <input type="number" min="0" step="0.01" value={p.pm_kosten || ''}
                    onChange={e => handleNum('pm_kosten', 'pm_kosten', e.target.value)}
                    placeholder="0,00" className={numField} />
                </td>
                <td className="px-4 py-1.5 text-sm text-slate-400 text-right">—</td>
              </tr>

              <tr className="border-t border-slate-100">
                <td className="px-6 py-3 text-sm text-slate-700">AV provision</td>
                <td className="px-4 py-1.5 text-sm text-slate-400 text-right">—</td>
                <td className="px-4 py-1.5 text-sm text-slate-400 text-right">—</td>
                <td className="px-4 py-1.5">
                  <input type="number" min="0" step="0.01" value={p.av_kosten || ''}
                    onChange={e => handleNum('av_kosten', 'av_kosten', e.target.value)}
                    placeholder="0,00" className={numField} />
                </td>
                <td className="px-4 py-1.5 text-sm text-slate-400 text-right">—</td>
              </tr>

              <tr className="border-t border-slate-100">
                <td className="px-6 py-3 text-sm text-slate-700">Opslag &amp; overig</td>
                <td className="px-4 py-1.5 text-sm text-slate-400 text-right">—</td>
                <td className="px-4 py-1.5 text-sm text-slate-400 text-right">—</td>
                <td className="px-4 py-1.5">
                  <input type="number" min="0" step="0.01" value={p.opslag_kosten || ''}
                    onChange={e => handleNum('opslag_kosten', 'opslag_kosten', e.target.value)}
                    placeholder="0,00" className={numField} />
                </td>
                <td className="px-4 py-1.5 text-sm text-slate-400 text-right">—</td>
              </tr>
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-6 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide">Subtotaal</td>
                <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{euro(totaalInkoop)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-green-700 text-right">{euro(standMarge)}</td>
                <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">
                  {euro(standbuilder.subtotaalVerkoop + pmVerkoop + avVerkoop + opslagVerkoop)}
                </td>
                <td />
              </tr>

              <tr className="border-t border-slate-100">
                <td className="px-6 py-3 text-sm text-red-600">Korting 1</td>
                <td /><td />
                <td className="px-4 py-1.5">
                  <input type="number" min="0" step="0.01" value={p.korting_1 || ''}
                    onChange={e => handleNum('korting_1', 'korting_1', e.target.value)}
                    placeholder="0,00" className={numField + ' text-red-600'} />
                </td>
                <td />
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-6 py-3 text-sm text-red-600">Korting 2</td>
                <td /><td />
                <td className="px-4 py-1.5">
                  <input type="number" min="0" step="0.01" value={p.korting_2 || ''}
                    onChange={e => handleNum('korting_2', 'korting_2', e.target.value)}
                    placeholder="0,00" className={numField + ' text-red-600'} />
                </td>
                <td />
              </tr>

              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="px-6 py-4 text-sm font-bold text-slate-900">Eindtotaal</td>
                <td className="px-4 py-4 text-sm font-bold text-slate-900 text-right">{euro(totaalInkoop)}</td>
                <td className="px-4 py-4 text-sm font-bold text-green-700 text-right">{euro(totaalMarge)}</td>
                <td className="px-4 py-4 text-sm font-bold text-slate-900 text-right">{euro(totaalVerkoop)}</td>
                <td className="px-4 py-4 text-sm font-bold text-slate-600 text-right">{pct(eindMargePct)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Targets & metrics ── */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Budget client (target)</p>
          <input
            type="number" min="0" step="0.01"
            value={p.budget_client || ''}
            onChange={e => handleNum('budget_client', 'budget_client', e.target.value)}
            placeholder="0,00"
            className="w-full text-xl font-bold text-slate-900 border-b-2 border-slate-300 focus:border-slate-700 outline-none bg-transparent pb-1 text-right"
            style={{ fontFamily: 'var(--font-manrope)' }}
          />
        </div>
        <MetricTile
          label="Verschil vs budget"
          waarde={budgetVerschil !== null ? euro(budgetVerschil) : '—'}
          color={budgetVerschil !== null ? (budgetVerschil >= 0 ? 'text-green-700' : 'text-red-600') : undefined}
        />
        <MetricTile label="Marge %" waarde={pct(eindMargePct)} />
        <MetricTile
          label="Verkoopprijs / m²"
          waarde={budgetPerM2 !== null ? euro(budgetPerM2) : '—'}
        />
      </div>

    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm text-slate-700">{value || <span className="text-slate-300">—</span>}</p>
    </div>
  )
}

function MetricTile({ label, waarde, color }: { label: string; waarde: string; color?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${color ?? 'text-slate-900'}`} style={{ fontFamily: 'var(--font-manrope)' }}>
        {waarde}
      </p>
    </div>
  )
}
