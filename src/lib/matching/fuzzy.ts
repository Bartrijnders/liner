import { distance } from 'fastest-levenshtein'

function tokeniseer(tekst: string): string[] {
  return tekst
    .toLowerCase()
    .split(/[\s\-\/\(\)\[\]\.,:;]+/)
    .filter(t => t.length > 0)
}

function fuzzyGelijkenis(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - distance(a, b) / maxLen
}

export interface FuzzyScoreResultaat {
  score: number
  termCoverage: number
  inputCoverage: number
  avgFuzzy: number
}

export function berekenFuzzyScore(
  input: string,
  matchTerm: string
): FuzzyScoreResultaat {
  const inputTokens = tokeniseer(input)
  const termTokens = tokeniseer(matchTerm)

  if (inputTokens.length === 0 || termTokens.length === 0) {
    return { score: 0, termCoverage: 0, inputCoverage: 0, avgFuzzy: 0 }
  }

  const DREMPEL = 0.8
  let matchedTermTokens = 0
  const matchedInputTokens = new Set<number>()
  const fuzzyScores: number[] = []

  for (const termToken of termTokens) {
    let besteGelijkenis = 0
    let besteIndex = -1

    for (let i = 0; i < inputTokens.length; i++) {
      const gelijkenis = fuzzyGelijkenis(termToken, inputTokens[i])
      if (gelijkenis > besteGelijkenis) {
        besteGelijkenis = gelijkenis
        besteIndex = i
      }
    }

    if (besteGelijkenis >= DREMPEL) {
      matchedTermTokens++
      matchedInputTokens.add(besteIndex)
      fuzzyScores.push(besteGelijkenis)
    }
  }

  const termCoverage = (matchedTermTokens / termTokens.length) * 100
  const inputCoverage = (matchedInputTokens.size / inputTokens.length) * 100
  const avgFuzzy =
    fuzzyScores.length > 0
      ? (fuzzyScores.reduce((a, b) => a + b, 0) / fuzzyScores.length) * 100
      : 0

  const score = termCoverage * 0.5 + inputCoverage * 0.3 + avgFuzzy * 0.2

  return { score, termCoverage, inputCoverage, avgFuzzy }
}
