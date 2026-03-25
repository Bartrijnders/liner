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
  const { subgroupId, elementNaam, vertalingen, orderegelId } = body as {
    subgroupId: string
    elementNaam: string
    vertalingen: { nl: string; de: string; en: string }
    orderegelId: string
  }

  if (!subgroupId || !elementNaam?.trim() || !orderegelId) {
    return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
  }

  const termen = [vertalingen.nl, vertalingen.de, vertalingen.en].filter(t => t?.trim())
  if (termen.length === 0) {
    return NextResponse.json({ error: 'Minimaal één vertaling vereist' }, { status: 400 })
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Element aanmaken
  const { data: element, error: elementError } = await serviceClient
    .from('subgroup_elements')
    .insert({ naam: elementNaam.trim(), subgroup_id: subgroupId })
    .select('id')
    .single()

  if (elementError) {
    return NextResponse.json({ error: `Element aanmaken mislukt: ${elementError.message}` }, { status: 500 })
  }

  // Match terms aanmaken per vertaling
  const matchTermIds: string[] = []
  for (const term of termen) {
    const normalized = term.toLowerCase().trim()

    let embedding: number[] | null = null
    if (process.env.OPENAI_API_KEY) {
      try {
        const { embedTekst } = await import('@/lib/matching/embeddings')
        embedding = await embedTekst(normalized)
      } catch (err) {
        console.error('[elementen] Embedding fout:', err)
      }
    }

    const { data: matchTerm } = await serviceClient
      .from('match_terms')
      .insert({
        term: normalized,
        embedding: embedding ? JSON.stringify(embedding) : null,
        subgroup_element_id: element.id,
        toegevoegd_door_feedback: true,
      })
      .select('id')
      .single()

    if (matchTerm) matchTermIds.push(matchTerm.id)
  }

  // Orderregel koppelen
  await serviceClient
    .from('orderregels')
    .update({
      override_element_id: element.id,
      validated_at: new Date().toISOString(),
      validated_by: user.email,
    })
    .eq('id', orderegelId)

  return NextResponse.json({ elementId: element.id, matchTermIds })
}
