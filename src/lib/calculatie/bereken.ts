export function parseGeldBedrag(str: string | null | undefined): number | null {
  if (!str) return null
  // Strip valutasymbolen, spaties en letters
  let s = str.replace(/[€$£\s]/g, '').trim()
  if (!s) return null

  // Detecteer formaat: Europees (1.267,08) vs Angelsaksisch (1,267.08)
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    // Beide aanwezig — bepaal welke het decimaalscheidingsteken is op basis van positie
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    if (lastComma > lastDot) {
      // Europees: 1.267,08 → punt is duizendteken, komma is decimaal
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // Angelsaksisch: 1,267.08 → komma is duizendteken, punt is decimaal
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Alleen komma — check of het een duizendteken is (3 cijfers na komma) of decimaal
    const afterComma = s.split(',')[1] ?? ''
    if (afterComma.length === 3 && !afterComma.includes('.')) {
      // Waarschijnlijk duizendteken: 1,267
      s = s.replace(',', '')
    } else {
      // Decimaalkomma: 122,82
      s = s.replace(',', '.')
    }
  }
  // Verwijder resterende niet-numerieke tekens (behalve punt en min)
  s = s.replace(/[^0-9.\-]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export function parseHoeveelheid(str: string | null | undefined): number | null {
  if (!str) return null
  // Pak het eerste getal (inclusief decimalen) aan het begin van de string
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
  waarschuwing: boolean
}

export interface SubgroupCalculatie {
  subgroupId: string
  subgroupNaam: string
  regels: RegelCalculatie[]
  totaalInkoop: number
  verkoopprijs: number
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
    regels: { orderegelId: string; omschrijving: string; hoeveelheid: string | null; eenheid: string | null; stukprijs: string | null; totaalprijs: string | null }[]
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
        // Primair: stukprijs × hoeveelheid
        inkoop = hoev * prijs
      } else if (totaal !== null) {
        // Fallback: totaalprijs direct gebruiken
        inkoop = totaal
        // Leid stukprijs af als hoeveelheid bekend is
        if (hoev !== null && hoev > 0) stukprijs = totaal / hoev
      } else {
        inkoop = null
      }

      return {
        orderegelId: r.orderegelId,
        omschrijving: r.omschrijving,
        hoeveelheid: hoev,
        eenheid: r.eenheid,
        stukprijs,
        inkoop,
        waarschuwing: inkoop === null,
      }
    })

    const totaalInkoop = regels.reduce((sum, r) => sum + (r.inkoop ?? 0), 0)
    const verkoopprijs = berekenVerkoopprijs(totaalInkoop, fee)
    const marge = berekenMarge(totaalInkoop, verkoopprijs)

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
