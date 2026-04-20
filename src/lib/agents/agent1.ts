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

export async function verwerkAgent1(pdfTekst: string): Promise<Agent1Resultaat[]> {
  console.log(`[agent1] verwerking, totaal ${pdfTekst.length} tekens`)

  // Sonnet 4.6 + streaming: 64k output tokens, ruim genoeg voor elke offerte.
  // maxDuration = 300 in de route handler vangt de langere verwerkingstijd op.
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [
      {
        role: 'user',
        content: `Je bent een assistent die leveranciersoffertes uitleest.

Analyseer de onderstaande offerte tekst en extraheer ALLE orderregels zonder uitzondering.
Geef je antwoord ALLEEN als een geldig JSON array, zonder uitleg, zonder markdown code blocks.

Elk object in de array heeft deze velden:
- regelnummer: number (volgorde in de offerte, begin bij 1)
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
${pdfTekst}
---

Geef nu de JSON array:`,
      },
    ],
  })

  const response = await stream.finalMessage()
  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Onverwacht antwoord van Agent 1')

  const raw = content.text
  console.log(`[agent1] stop_reason=${response.stop_reason} output_tokens=${response.usage.output_tokens}`)

  const start = raw.indexOf('[')
  if (start === -1) {
    throw new Error(`Geen JSON array gevonden. stop_reason=${response.stop_reason} begin=${raw.slice(0, 200)}`)
  }

  const end = raw.lastIndexOf(']')
  if (end > start) {
    const regels = JSON.parse(raw.slice(start, end + 1)) as Agent1Resultaat[]
    console.log(`[agent1] ${regels.length} regels geëxtraheerd`)
    return regels
  }

  // Afgekapt door output limiet — herstel voltooide objecten
  if (response.stop_reason === 'max_tokens') {
    console.warn(`[agent1] output afgekapt op ${response.usage.output_tokens} tokens, gedeeltelijk herstel`)
    const lastClose = raw.lastIndexOf('}')
    if (lastClose > start) {
      try {
        const regels = JSON.parse(raw.slice(start, lastClose + 1) + ']') as Agent1Resultaat[]
        console.log(`[agent1] ${regels.length} regels hersteld na afkapping`)
        return regels
      } catch { /* fall through */ }
    }
  }

  throw new Error(`Geen geldige JSON array. stop_reason=${response.stop_reason} begin=${raw.slice(0, 200)}`)
}
