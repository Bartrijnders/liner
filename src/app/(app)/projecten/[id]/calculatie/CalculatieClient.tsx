'use client'

import { useRef, useState } from 'react'
import { berekenProjectCalculatie, type ProjectCalculatie, type SubgroupCalculatie } from '@/lib/calculatie/bereken'

type SubgroupRaw = {
  subgroupId: string
  subgroupNaam: string
  regels: { orderegelId: string; omschrijving: string; hoeveelheid: string | null; eenheid: string | null; stukprijs: string | null; totaalprijs: string | null }[]
}

type Props = {
  projectId: string
  subgroupsRaw: SubgroupRaw[]
  initialCalculatie: ProjectCalculatie
  initialFee: number
  initialPmKosten: number
  initialKorting1: number
  initialKorting2: number
  initialAvKosten: number
  initialOpslagKosten: number
}

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

const pct = (n: number) => `${n.toFixed(1)}%`

export default function CalculatieClient({
  projectId,
  subgroupsRaw,
  initialCalculatie,
  initialFee,
  initialPmKosten,
  initialKorting1,
  initialKorting2,
  initialAvKosten,
  initialOpslagKosten,
}: Props) {
  const [fee, setFee] = useState(initialFee)
  const [pmKosten, setPmKosten] = useState(initialPmKosten)
  const [korting1, setKorting1] = useState(initialKorting1)
  const [korting2, setKorting2] = useState(initialKorting2)
  const [avKosten, setAvKosten] = useState(initialAvKosten)
  const [opslagKosten, setOpslagKosten] = useState(initialOpslagKosten)

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Herbereken client-side op basis van huidige state
  const calc = berekenProjectCalculatie(subgroupsRaw, fee, pmKosten, korting1, korting2, avKosten, opslagKosten)

  function debouncedSave(field: string, value: number) {
    clearTimeout(saveTimers.current[field])
    saveTimers.current[field] = setTimeout(() => {
      fetch(`/api/projecten/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
    }, 600)
  }

  function handleFee(val: string) {
    const n = parseFloat(val)
    if (!isNaN(n)) {
      setFee(n)
      debouncedSave('fee', n)
    }
  }

  function handleKosten(setter: (v: number) => void, field: string, val: string) {
    const n = parseFloat(val) || 0
    setter(n)
    debouncedSave(field, n)
  }

  const kostenInput = 'w-full text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 text-right'

  return (
    <div className="space-y-6">
      {/* Samenvatting + fee balk */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Fee factor</p>
          <input
            type="number"
            step="0.01"
            min="1"
            max="3"
            value={fee}
            onChange={e => handleFee(e.target.value)}
            className="w-full text-xl font-bold text-slate-900 border-b-2 border-slate-300 focus:border-slate-700 outline-none bg-transparent pb-1 text-center"
            style={{ fontFamily: 'var(--font-manrope)' }}
          />
        </div>
        <SummaryTile label="Subtotaal inkoop" waarde={euro(calc.subtotaalInkoop)} />
        <SummaryTile label="Subtotaal verkoop" waarde={euro(calc.subtotaalVerkoop)} />
        <SummaryTile
          label="Totale marge"
          waarde={`${euro(calc.eindtotaalVerkoop - calc.subtotaalInkoop)} (${pct(calc.margePercentage)})`}
          highlight
        />
      </div>

      {/* Subgroups */}
      {calc.subgroups.length === 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center text-sm text-slate-400">
          Geen gevalideerde orderregels met een gekoppeld element gevonden.
        </div>
      )}

      {calc.subgroups.map(sg => (
        <SubgroupCard key={sg.subgroupId} sg={sg} />
      ))}

      {/* Summary */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Summary</span>
        </div>
        <div className="p-6 space-y-3 max-w-lg">
          <SummaryRij label="Stand totaal inkoop" waarde={euro(calc.subtotaalInkoop)} />
          <SummaryRij label="Stand totaal verkoop" waarde={euro(calc.subtotaalVerkoop)} />
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <KostenRij
              label="PM kosten"
              value={pmKosten}
              onChange={v => handleKosten(setPmKosten, 'pm_kosten', v)}
              inputCls={kostenInput}
            />
            <KostenRij
              label="Korting 1"
              value={korting1}
              onChange={v => handleKosten(setKorting1, 'korting_1', v)}
              inputCls={kostenInput}
              isKorting
            />
            <KostenRij
              label="Korting 2"
              value={korting2}
              onChange={v => handleKosten(setKorting2, 'korting_2', v)}
              inputCls={kostenInput}
              isKorting
            />
            <KostenRij
              label="AV kosten"
              value={avKosten}
              onChange={v => handleKosten(setAvKosten, 'av_kosten', v)}
              inputCls={kostenInput}
            />
            <KostenRij
              label="Opslag kosten"
              value={opslagKosten}
              onChange={v => handleKosten(setOpslagKosten, 'opslag_kosten', v)}
              inputCls={kostenInput}
            />
          </div>
          <div className="border-t-2 border-slate-300 pt-3 space-y-1">
            <SummaryRij label="Eindtotaal verkoop" waarde={euro(calc.eindtotaalVerkoop)} bold />
            <SummaryRij
              label="Totale marge"
              waarde={`${euro(calc.eindtotaalVerkoop - calc.subtotaalInkoop)} (${pct(calc.margePercentage)})`}
              bold
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryTile({ label, waarde, highlight }: { label: string; waarde: string; highlight?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-slate-800' : 'text-slate-900'}`} style={{ fontFamily: 'var(--font-manrope)' }}>
        {waarde}
      </p>
    </div>
  )
}

function SubgroupCard({ sg }: { sg: SubgroupCalculatie }) {
  const heeftWaarschuwingen = sg.regels.some(r => r.waarschuwing)
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-600">{sg.subgroupNaam}</span>
        {heeftWaarschuwingen && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
            Waarschuwing: sommige regels missen prijs of hoeveelheid
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-slate-100">
              <th className="px-6 py-3">Omschrijving</th>
              <th className="px-4 py-3 w-24 text-right">Hoeveelheid</th>
              <th className="px-4 py-3 w-28 text-right">Stukprijs</th>
              <th className="px-4 py-3 w-28 text-right">Inkoop</th>
            </tr>
          </thead>
          <tbody>
            {sg.regels.map(r => (
              <tr key={r.orderegelId} className={`border-t border-slate-100 ${r.waarschuwing ? 'bg-amber-50' : ''}`}>
                <td className="px-6 py-3 text-sm text-slate-700">{r.omschrijving}</td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">
                  {r.hoeveelheid !== null ? `${r.hoeveelheid}${r.eenheid ? ' ' + r.eenheid : ''}` : <span className="text-amber-500">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">
                  {r.stukprijs !== null ? euro(r.stukprijs) : <span className="text-amber-500">—</span>}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">
                  {r.inkoop !== null ? euro(r.inkoop) : <span className="text-amber-500">!</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td colSpan={3} className="px-6 py-3 text-xs font-semibold text-slate-500 text-right">Totaal inkoop</td>
              <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{euro(sg.totaalInkoop)}</td>
            </tr>
            <tr className="border-t border-slate-100 bg-slate-50">
              <td colSpan={3} className="px-6 py-2 text-xs font-semibold text-slate-500 text-right">Verkoopprijs</td>
              <td className="px-4 py-2 text-sm font-bold text-slate-900 text-right">{euro(sg.verkoopprijs)}</td>
            </tr>
            <tr className="border-t border-slate-100 bg-slate-50">
              <td colSpan={3} className="px-6 py-2 text-xs font-semibold text-slate-500 text-right">Marge</td>
              <td className="px-4 py-2 text-sm font-semibold text-green-700 text-right">{euro(sg.marge)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function SummaryRij({ label, waarde, bold }: { label: string; waarde: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{waarde}</span>
    </div>
  )
}

function KostenRij({ label, value, onChange, inputCls, isKorting }: {
  label: string
  value: number
  onChange: (v: string) => void
  inputCls: string
  isKorting?: boolean
}) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className={`text-sm shrink-0 ${isKorting ? 'text-red-600' : 'text-slate-600'}`}>{label}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="0,00"
        className={inputCls}
        style={{ maxWidth: '140px' }}
      />
    </div>
  )
}
