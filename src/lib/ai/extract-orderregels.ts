import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface OrderregelExtract {
  regelnummer: number
  omschrijving: string
  details: string | null
  hoeveelheid: string | null
  eenheid: string | null
  stukprijs: string | null
  totaalprijs: string | null
}

export async function extractOrderregels(pdfTekst: string): Promise<OrderregelExtract[]> {
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Je bent een assistent die leveranciersoffertes uitleest.

Analyseer de onderstaande offerte tekst en extraheer alle orderregels.
Geef je antwoord ALLEEN als een geldig JSON array, zonder uitleg, zonder markdown code blocks.

Elk object in de array heeft deze velden:
- regelnummer: number (volgorde in de offerte, begin bij 1)
- omschrijving: string (de productnaam/omschrijving, zo letterlijk mogelijk)
- details: string | null (aanvullende specificaties, afmetingen, etc.)
- hoeveelheid: string | null (ruwe hoeveelheid zoals "2", "10 stuks", "50m")
- eenheid: string | null (m, st, m², stuk, etc. — extraheer uit hoeveelheid als mogelijk)
- stukprijs: string | null (prijs per eenheid, inclusief valutasymbool)
- totaalprijs: string | null (totaalprijs voor de regel)

Regels om te negeren: kopteksten, tussentitels, subtotalen, BTW-regels, en lege regels.

Offerte tekst:
---
${pdfTekst}
---

Geef nu de JSON array:`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Onverwacht antwoord van Claude')

  return JSON.parse(content.text) as OrderregelExtract[]
}
