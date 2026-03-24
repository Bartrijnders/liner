import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function embedTekst(tekst: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: tekst.toLowerCase(),
  })
  return response.data[0].embedding
}

export interface VectorKandidaat {
  matchTermId: string
  term: string
  subgroupElementId: string
  vectorDistance: number
}

export async function zoekKandidaten(
  cleanDesc: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  limiet = 10
): Promise<VectorKandidaat[]> {
  const embedding = await embedTekst(cleanDesc)

  const { data, error } = await supabase.rpc('zoek_match_terms', {
    query_embedding: JSON.stringify(embedding),
    limiet,
  })

  if (error) throw new Error(`Vector search fout: ${error.message}`)

  return (data || []).map((r: any) => ({
    matchTermId: r.match_term_id,
    term: r.term,
    subgroupElementId: r.subgroup_element_id,
    vectorDistance: r.vector_distance,
  }))
}
