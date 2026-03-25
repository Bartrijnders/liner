export function parseGeldBedrag(str: string | null | undefined): number | null {
  if (!str) return null
  // Strip valutasymbolen, spaties en letters
  let s = str.replace(/[€$£\s]/g, '').trim()
  if (!s) return null

  // Detecteer formaat: Europees (1.267,08) vs Angelsaksisch (1,267.08)
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    const afterComma = s.split(',')[1] ?? ''
    if (afterComma.length === 3 && !afterComma.includes('.')) {
      s = s.replace(',', '')
    } else {
      s = s.replace(',', '.')
    }
  }
  s = s.replace(/[^0-9.\-]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export function parseHoeveelheid(str: string | null | undefined): number | null {
  if (!str) return null
  const match = str.trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)/)
  if (!match) return null
  const n = parseFloat(match[1])
  return isNaN(n) ? null : n
}

export function berekenVerkoopprijs(inkoop: number, fee: number): number {
  // Exact de Excel formule: ROUNDUP((inkoop * fee / 5), 0) * 5
  return Math.ceil((inkoop * fee) / 5) * 5
}

export function berekenMarge(inkoop: number, verkoopprijs: number): number {
  return verkoopprijs - inkoop
}

export function berekenMargePercentage(inkoop: number, verkoopprijs: number): number {
  if (verkoopprijs === 0) return 0
  return ((verkoopprijs - inkoop) / verkoopprijs) * 100
}

export interface RegelCalculatie {
  orderegelId: string
  omschrijving: string
  hoeveelheid: number | null
  eenheid: string | null
  stukprijs: number | null
  inkoop: number | null
  verkoopprijs: number | null   // per-regel verkoopprijs (formula of override)
  marge: number | null          // per-regel marge (verkoopprijs - inkoop)
  waarschuwing: boolean
}

export interface SubgroupCalculatie {
  subgroupId: string
  subgroupNaam: string
  regels: RegelCalculatie[]
  totaalInkoop: number
  verkoopprijs: number          // som van per-regel verkoopprijzen
  marge: number
}

export interface ProjectCalculatie {
  fee: number
  subgroups: SubgroupCalculatie[]
  subtotaalInkoop: number
  subtotaalVerkoop: number
  pmKosten: number
  korting1: number
  korting2: number
  avKosten: number
  opslagKosten: number
  eindtotaalVerkoop: number
  totaalMarge: number
  margePercentage: number
}

export function berekenProjectCalculatie(
  subgroupsRaw: {
    subgroupId: string
    subgroupNaam: string
    regels: {
      orderegelId: string
      omschrijving: string
      hoeveelheid: string | null
      eenheid: string | null
      stukprijs: string | null
      totaalprijs: string | null
      verkoopOverride?: string | null
    }[]
  }[],
  fee: number,
  pmKosten: number,
  korting1: number,
  korting2: number,
  avKosten: number,
  opslagKosten: number
): ProjectCalculatie {
  const subgroups: SubgroupCalculatie[] = subgroupsRaw.map((sg) => {
    const regels: RegelCalculatie[] = sg.regels.map((r) => {
      const hoev = parseHoeveelheid(r.hoeveelheid)
      const prijs = parseGeldBedrag(r.stukprijs)
      const totaal = parseGeldBedrag(r.totaalprijs)

      let inkoop: number | null
      let stukprijs: number | null = prijs

      if (hoev !== null && prijs !== null) {
        inkoop = hoev * prijs
      } else if (totaal !== null) {
        inkoop = totaal
        if (hoev !== null && hoev > 0) stukprijs = totaal / hoev
      } else {
        inkoop = null
      }

      // Per-regel verkoopprijs: override of ROUNDUP-formule (zoals Excel col F)
      const overrideVal = r.verkoopOverride ? parseGeldBedrag(r.verkoopOverride) : null
      const verkoopprijs = inkoop !== null
        ? (overrideVal ?? berekenVerkoopprijs(inkoop, fee))
        : null
      const marge = verkoopprijs !== null && inkoop !== null ? verkoopprijs - inkoop : null

      return {
        orderegelId: r.orderegelId,
        omschrijving: r.omschrijving,
        hoeveelheid: hoev,
        eenheid: r.eenheid,
        stukprijs,
        inkoop,
        verkoopprijs,
        marge,
        waarschuwing: inkoop === null,
      }
    })

    const totaalInkoop = regels.reduce((sum, r) => sum + (r.inkoop ?? 0), 0)
    // Som van per-regel verkoopprijzen (niet ROUNDUP van het subtotaal — exact als Excel)
    const verkoopprijs = regels.reduce((sum, r) => sum + (r.verkoopprijs ?? 0), 0)
    const marge = verkoopprijs - totaalInkoop

    return { subgroupId: sg.subgroupId, subgroupNaam: sg.subgroupNaam, regels, totaalInkoop, verkoopprijs, marge }
  })

  const subtotaalInkoop = subgroups.reduce((s, sg) => s + sg.totaalInkoop, 0)
  const subtotaalVerkoop = subgroups.reduce((s, sg) => s + sg.verkoopprijs, 0)
  const eindtotaalVerkoop = subtotaalVerkoop + pmKosten - korting1 - korting2 + avKosten + opslagKosten
  const totaalMarge = eindtotaalVerkoop - subtotaalInkoop
  const margePercentage = berekenMargePercentage(subtotaalInkoop, eindtotaalVerkoop)

  return {
    fee,
    subgroups,
    subtotaalInkoop,
    subtotaalVerkoop,
    pmKosten,
    korting1,
    korting2,
    avKosten,
    opslagKosten,
    eindtotaalVerkoop,
    totaalMarge,
    margePercentage,
  }
}
