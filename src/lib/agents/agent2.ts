import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export interface Agent2Input {
  cleanDesc: string
  cleanDetails: string | null
  kandidaten: {
    subgroupElementId: string
    subgroupNaam: string
    elementNaam: string
    score: number
    matchTerms: string[]
  }[]
}

export interface Agent2Output {
  subgroupElementId: string | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  redenering: string
  suggestedMatchTerm: string | null
}

interface Agent2RawOutput {
  kandidaatNummer: number | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  redenering: string
  suggestedMatchTerm: string | null
}

export async function verwerkAgent2(input: Agent2Input): Promise<Agent2Output> {
  const kandidatenTekst = input.kandidaten
    .map(
      (k, i) =>
        `${i + 1}. ${k.subgroupNaam} > ${k.elementNaam} (score: ${k.score.toFixed(1)})\n   Zoektermen: ${k.matchTerms.join(', ')}`
    )
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Je bent een assistent die leveranciersofferteregels categoriseert in een productcatalogus.

Orderregel:
- Omschrijving: ${input.cleanDesc}
- Details: ${input.cleanDetails || 'geen'}

Top kandidaten uit de catalogus:
${kandidatenTekst}

Bepaal welke kandidaat het beste past. Geef je antwoord ALLEEN als JSON object zonder uitleg of markdown:
{
  "kandidaatNummer": <1, 2 of 3 — het nummer van de beste kandidaat, of null als geen match>,
  "confidence": "<HIGH | MEDIUM | LOW | NONE>",
  "redenering": "<één zin uitleg voor de gebruiker>",
  "suggestedMatchTerm": "<nieuwe zoekterm als de huidige zoektermen niet goed passen, anders null>"
}

Confidence regels:
- HIGH: score ≥ 70 EN verschil met tweede kandidaat ≥ 15
- MEDIUM: score ≥ 50 OF verschil < 15
- LOW: score 25-49
- NONE: score < 25 of geen goede match`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Onverwacht antwoord van Agent 2')

  let jsonText = content.text.trim()
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }

  const raw = JSON.parse(jsonText) as Agent2RawOutput

  // Vertaal kandidaatNummer terug naar de echte UUID
  const gekozenKandidaat =
    raw.kandidaatNummer != null
      ? (input.kandidaten[raw.kandidaatNummer - 1] ?? null)
      : null

  return {
    subgroupElementId: gekozenKandidaat?.subgroupElementId ?? null,
    confidence: raw.confidence,
    redenering: raw.redenering,
    suggestedMatchTerm: raw.suggestedMatchTerm,
  }
}
