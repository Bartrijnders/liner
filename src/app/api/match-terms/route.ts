import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { term, subgroupElementId, orderegelId } = body as {
    term: string
    subgroupElementId: string
    orderegelId: string
  }

  if (!term || !subgroupElementId || !orderegelId) {
    return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
  }

  const normalized = term.toLowerCase().trim()
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check op duplicaat
  const { data: bestaand } = await serviceClient
    .from('match_terms')
    .select('id')
    .eq('term', normalized)
    .eq('subgroup_element_id', subgroupElementId)
    .maybeSingle()

  let matchTermId = bestaand?.id

  if (!bestaand) {
    // Embedding genereren (alleen als OPENAI_API_KEY beschikbaar)
    let embedding: number[] | null = null
    if (process.env.OPENAI_API_KEY) {
      try {
        const { embedTekst } = await import('@/lib/matching/embeddings')
        embedding = await embedTekst(normalized)
      } catch (err) {
        console.error('[match-terms] Embedding fout:', err)
      }
    }

    const { data: nieuweTerm, error } = await serviceClient
      .from('match_terms')
      .insert({
        term: normalized,
        embedding: embedding ? JSON.stringify(embedding) : null,
        subgroup_element_id: subgroupElementId,
        toegevoegd_door_feedback: true,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: `Opslaan mislukt: ${error.message}` }, { status: 500 })
    }
    matchTermId = nieuweTerm.id
  }

  // Orderregel bijwerken
  await serviceClient
    .from('orderregels')
    .update({
      override_element_id: subgroupElementId,
      validated_at: new Date().toISOString(),
      validated_by: user.email,
    })
    .eq('id', orderegelId)

  return NextResponse.json({ matchTermId, created: !bestaand })
}
