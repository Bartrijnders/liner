import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export interface Agent1Resultaat {
  regelnummer: number
  omschrijving: string
  details: string | null
  hoeveelheid: string | null
  eenheid: string | null
  stukprijs: string | null
  totaalprijs: string | null
  cleanDesc: string
  cleanDetails: string | null
  categoryHint: string | null
}

// Haiku max output = 8192 tokens ≈ 100 items per chunk.
// 15k chars input → ~50-80 items → ~10-15s per chunk → stays within Vercel's 60s limit.
const CHUNK_SIZE = 15_000

async function verwerkChunk(tekst: string, regelOffset: number): Promise<Agent1Resultaat[]> {
  const stream = client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `Je bent een assistent die leveranciersoffertes uitleest.

Analyseer de onderstaande offerte tekst en extraheer alle orderregels.
Geef je antwoord ALLEEN als een geldig JSON array, zonder uitleg, zonder markdown code blocks.

Elk object in de array heeft deze velden:
- regelnummer: number (volgorde in de offerte, begin bij ${regelOffset + 1})
- omschrijving: string (de productnaam/omschrijving, zo letterlijk mogelijk)
- details: string | null (aanvullende specificaties, afmetingen, etc.)
- hoeveelheid: string | null (ruwe hoeveelheid zoals "2", "10 stuks", "50m")
- eenheid: string | null (m, st, m², stuk, etc. — extraheer uit hoeveelheid als mogelijk)
- stukprijs: string | null (prijs per eenheid, inclusief valutasymbool)
- totaalprijs: string | null (totaalprijs voor de regel)
- cleanDesc: string (genormaliseerde omschrijving: lowercase, behoud productnaam, modelnummer/typenaam, kleur en materiaal volledig — verwijder ALLEEN losse leveranciers-SKU's of interne bestelnummers die geen deel zijn van de productnaam, zoals "ART-12345" of "REF: 9980-A")
- cleanDetails: string | null (genormaliseerde details, of null als geen details)
- categoryHint: string | null (beste schatting van de productcategorie, bijv. "Bekabeling", "Bevestiging", "Verlichting" — of null als onduidelijk)

Regels om te negeren: kopteksten, tussentitels, subtotalen, BTW-regels, en lege regels.

Offerte tekst:
---
${tekst}
---

Geef nu de JSON array:`,
      },
    ],
  })

  const response = await stream.finalMessage()
  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Onverwacht antwoord van Agent 1')

  const raw = content.text
  console.log(`[agent1] chunk offset=${regelOffset} stop_reason=${response.stop_reason} lengte=${raw.length}`)

  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `Geen geldige JSON array (chunk offset ${regelOffset}). ` +
      `stop_reason=${response.stop_reason} begin=${raw.slice(0, 200)}`
    )
  }
  return JSON.parse(raw.slice(start, end + 1)) as Agent1Resultaat[]
}

export async function verwerkAgent1(pdfTekst: string): Promise<Agent1Resultaat[]> {
  const chunks: string[] = []
  let pos = 0
  while (pos < pdfTekst.length) {
    let end = pos + CHUNK_SIZE
    if (end < pdfTekst.length) {
      const nl = pdfTekst.lastIndexOf('\n', end)
      if (nl > pos) end = nl
    }
    chunks.push(pdfTekst.slice(pos, end))
    pos = end
  }

  console.log(`[agent1] verwerking in ${chunks.length} chunk(s), totaal ${pdfTekst.length} tekens`)

  const alleRegels: Agent1Resultaat[] = []
  for (const chunk of chunks) {
    const regels = await verwerkChunk(chunk, alleRegels.length)
    alleRegels.push(...regels)
  }

  alleRegels.forEach((r, i) => { r.regelnummer = i + 1 })
  return alleRegels
}
