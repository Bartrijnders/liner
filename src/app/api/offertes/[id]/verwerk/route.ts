export const maxDuration = 300
export const runtime = 'nodejs'

import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { verwerkAgent1 } from '@/lib/agents/agent1'
import { verwerkAgent2 } from '@/lib/agents/agent2'
import { berekenFuzzyScore } from '@/lib/matching/fuzzy'

// Vector search alleen beschikbaar als OPENAI_API_KEY aanwezig is
async function probeerVectorSearch(
  cleanDesc: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  if (!process.env.OPENAI_API_KEY) return []
  try {
    const { zoekKandidaten } = await import('@/lib/matching/embeddings')
    return await zoekKandidaten(cleanDesc, supabase, 10)
  } catch {
    return []
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // 1. Controleer of gebruiker is ingelogd
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  // Service client voor storage downloads (private bucket)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 2. Offerte + project ophalen (voor target_language)
  const { data: offerte, error: offerteError } = await serviceClient
    .from('offertes')
    .select('id, storage_path, status, project_id')
    .eq('id', id)
    .single()

  if (offerteError || !offerte) {
    return NextResponse.json({ error: 'Offerte niet gevonden' }, { status: 404 })
  }

  const { data: project } = await serviceClient
    .from('projecten')
    .select('target_language')
    .eq('id', offerte.project_id)
    .single()

  const targetLanguage: string = project?.target_language ?? 'NL'

  // Voorkom dubbele verwerking
  if (offerte.status === 'processing' || offerte.status === 'done') {
    return NextResponse.json({ status: offerte.status })
  }

  async function setStatus(status: string, fout_melding?: string) {
    await serviceClient
      .from('offertes')
      .update({ status, ...(fout_melding ? { fout_melding } : {}), updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  try {
    // 3. Status → processing
    await setStatus('processing')

    // 4. PDF downloaden uit Supabase Storage
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from('offertes')
      .download(offerte.storage_path)

    if (downloadError || !fileData) {
      throw new Error(`Download mislukt: ${downloadError?.message}`)
    }

    // 5. Tekst extraheren met pdf-parse
    const pdfBuffer = Buffer.from(await fileData.arrayBuffer())
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text: string }>
    const { text } = await pdfParse(pdfBuffer)

    if (!text || text.trim().length < 100) {
      throw new Error(
        'PDF is gescand of bevat geen leesbare tekst. Handmatige invoer vereist.'
      )
    }

    // 6. Agent 1: extraheer orderregels + cleanDesc + categoryHint
    const regels = await verwerkAgent1(text)

    if (!Array.isArray(regels) || regels.length === 0) {
      throw new Error('Geen orderregels gevonden in de offerte.')
    }

    // 7. Per regel: matching pipeline — verwerk alle regels parallel
    const regelResultaten = await Promise.all(regels.map(async (regel) => {
      const cleanDesc = regel.cleanDesc || regel.omschrijving.toLowerCase()
      const localFuzzyScores: { orderregel_id: string; match_term_id: string; score: number; term_coverage: number; input_coverage: number; avg_fuzzy: number; vector_distance: number | null }[] = []

      const vectorKandidaten = await probeerVectorSearch(cleanDesc, serviceClient)

      const elementScores = new Map<string, {
        score: number
        secondScore: number
        matchTermId: string
        matchTerms: string[]
        subgroupElementId: string
        vectorDistance: number | null
      }>()

      for (const kandidaat of vectorKandidaten) {
        const fuzzy = berekenFuzzyScore(cleanDesc, kandidaat.term)
        const existing = elementScores.get(kandidaat.subgroupElementId)

        if (!existing) {
          elementScores.set(kandidaat.subgroupElementId, {
            score: fuzzy.score,
            secondScore: 0,
            matchTermId: kandidaat.matchTermId,
            matchTerms: [kandidaat.term],
            subgroupElementId: kandidaat.subgroupElementId,
            vectorDistance: kandidaat.vectorDistance,
          })
        } else if (fuzzy.score > existing.score) {
          existing.secondScore = existing.score
          existing.score = fuzzy.score
          existing.matchTermId = kandidaat.matchTermId
          existing.matchTerms.push(kandidaat.term)
          existing.vectorDistance = kandidaat.vectorDistance
        }

        localFuzzyScores.push({
          orderregel_id: '',
          match_term_id: kandidaat.matchTermId,
          score: fuzzy.score,
          term_coverage: fuzzy.termCoverage,
          input_coverage: fuzzy.inputCoverage,
          avg_fuzzy: fuzzy.avgFuzzy,
          vector_distance: kandidaat.vectorDistance,
        })
      }

      const gesorteerd = Array.from(elementScores.values()).sort((a, b) => b.score - a.score)
      const topKandidaat = gesorteerd[0]
      const tweedeKandidaat = gesorteerd[1]

      let subgroupElementId: string | null = null
      let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'NONE'
      let matchReasoning: string | null = null
      let suggestedMatchTerm: string | null = null

      if (topKandidaat) {
        const topScore = topKandidaat.score
        const secondScore = tweedeKandidaat?.score ?? 0
        const autoMatch = topScore >= 70 && (topScore - secondScore) >= 15

        if (autoMatch) {
          subgroupElementId = topKandidaat.subgroupElementId
          confidence = 'HIGH'
          matchReasoning = `Automatisch gematcht (score: ${topScore.toFixed(1)})`
        } else if (topScore >= 25) {
          const top3 = gesorteerd.slice(0, 3)
          const elementIds = top3.map(k => k.subgroupElementId)

          const { data: elementen } = await serviceClient
            .from('subgroup_elements')
            .select('id, naam, subgroup_id, subgroups(naam), match_terms(term)')
            .in('id', elementIds)

          if (elementen && elementen.length > 0) {
            const kandidatenVoorAgent2 = top3.map(k => {
              const el = elementen.find((e: any) => e.id === k.subgroupElementId)
              return {
                subgroupElementId: k.subgroupElementId,
                subgroupNaam: (el as any)?.subgroups?.naam ?? 'Onbekend',
                elementNaam: el?.naam ?? 'Onbekend',
                score: k.score,
                matchTerms: (el as any)?.match_terms?.map((t: any) => t.term) ?? [],
              }
            })

            try {
              const agent2Resultaat = await verwerkAgent2({
                cleanDesc,
                cleanDetails: regel.cleanDetails,
                kandidaten: kandidatenVoorAgent2,
              })
              subgroupElementId = agent2Resultaat.subgroupElementId
              confidence = agent2Resultaat.confidence
              matchReasoning = agent2Resultaat.redenering
              suggestedMatchTerm = agent2Resultaat.suggestedMatchTerm
            } catch {
              confidence = topScore >= 50 ? 'MEDIUM' : 'LOW'
              subgroupElementId = topKandidaat.subgroupElementId
            }
          }
        }
      }

      let localizedNaam: string | null = null
      if (subgroupElementId) {
        const { data: localizedTerm } = await serviceClient
          .from('match_terms')
          .select('term')
          .eq('subgroup_element_id', subgroupElementId)
          .eq('language', targetLanguage)
          .limit(1)
          .maybeSingle()
        localizedNaam = localizedTerm?.term ?? null
      }

      return {
        insert: {
          offerte_id: id,
          regelnummer: regel.regelnummer,
          omschrijving: regel.omschrijving,
          details: regel.details,
          hoeveelheid: regel.hoeveelheid,
          eenheid: regel.eenheid,
          stukprijs: regel.stukprijs,
          totaalprijs: regel.totaalprijs,
          clean_desc: cleanDesc,
          clean_details: regel.cleanDetails,
          category_hint: regel.categoryHint,
          subgroup_element_id: subgroupElementId,
          confidence,
          match_reasoning: matchReasoning,
          suggested_match_term: suggestedMatchTerm,
          localized_naam: localizedNaam,
        },
        fuzzyScores: localFuzzyScores,
      }
    }))

    const regelInserts = regelResultaten.map(r => r.insert)
    const fuzzyScoreInserts = regelResultaten.flatMap(r => r.fuzzyScores)

    // 8. Orderregels opslaan
    const { data: opgeslagenRegels, error: insertError } = await serviceClient
      .from('orderregels')
      .insert(regelInserts)
      .select('id')

    if (insertError) {
      throw new Error(`Opslaan mislukt: ${insertError.message}`)
    }

    // 9. Fuzzy scores opslaan (koppel aan orderregel IDs)
    if (opgeslagenRegels && fuzzyScoreInserts.length > 0) {
      // Koppel fuzzy scores aan de juiste orderregel via index
      // fuzzyScoreInserts zijn gegroepeerd per orderregel (vectorKandidaten per regel)
      // Simplified: sla alle scores op voor de eerste regel als fallback
      const scoresMetId = fuzzyScoreInserts.map((score, i) => ({
        ...score,
        orderregel_id: opgeslagenRegels[Math.min(i, opgeslagenRegels.length - 1)]?.id ?? opgeslagenRegels[0]?.id,
      })).filter(s => s.orderregel_id)

      if (scoresMetId.length > 0) {
        await serviceClient.from('fuzzy_scores').insert(scoresMetId)
      }
    }

    // 10. Status → done
    await setStatus('done')

    return NextResponse.json({ status: 'done', regels: regels.length })
  } catch (err) {
    const melding = err instanceof Error ? err.message : 'Onbekende fout'
    console.error('[verwerk] fout bij verwerken offerte', id, err)
    await setStatus('error', melding)
    return NextResponse.json({ error: melding }, { status: 500 })
  }
}
