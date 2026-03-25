import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

// PUT — vervang de geselecteerde offertes voor een calculatie
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: calcId } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { offerteIds } = await request.json() as { offerteIds: string[] }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verwijder bestaande koppelingen
  const { error: deleteError } = await serviceClient
    .from('calculatie_offertes')
    .delete()
    .eq('calculatie_id', calcId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  // Voeg nieuwe koppelingen in
  if (offerteIds.length > 0) {
    const rows = offerteIds.map(offerteId => ({ calculatie_id: calcId, offerte_id: offerteId }))
    const { error: insertError } = await serviceClient
      .from('calculatie_offertes')
      .insert(rows)

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
