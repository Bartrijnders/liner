export const maxDuration = 60
export const runtime = 'nodejs'

import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { extractOrderregels } from '@/lib/ai/extract-orderregels'

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

  // 2. Offerte ophalen
  const { data: offerte, error: offerteError } = await serviceClient
    .from('offertes')
    .select('id, storage_path, status')
    .eq('id', id)
    .single()

  if (offerteError || !offerte) {
    return NextResponse.json({ error: 'Offerte niet gevonden' }, { status: 404 })
  }

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
    const parser = new PDFParse({ data: pdfBuffer })
    const { text } = await parser.getText()

    if (!text || text.trim().length < 100) {
      throw new Error(
        'PDF is gescand of bevat geen leesbare tekst. Handmatige invoer vereist.'
      )
    }

    // 6. Orderregels extraheren via Claude
    const regels = await extractOrderregels(text)

    if (!Array.isArray(regels) || regels.length === 0) {
      throw new Error('Geen orderregels gevonden in de offerte.')
    }

    // 7. Orderregels opslaan
    const { error: insertError } = await serviceClient.from('orderregels').insert(
      regels.map((regel) => ({
        offerte_id: id,
        regelnummer: regel.regelnummer,
        omschrijving: regel.omschrijving,
        details: regel.details,
        hoeveelheid: regel.hoeveelheid,
        eenheid: regel.eenheid,
        stukprijs: regel.stukprijs,
        totaalprijs: regel.totaalprijs,
      }))
    )

    if (insertError) {
      throw new Error(`Opslaan mislukt: ${insertError.message}`)
    }

    // 8. Status → done
    await setStatus('done')

    return NextResponse.json({ status: 'done', regels: regels.length })
  } catch (err) {
    const melding = err instanceof Error ? err.message : 'Onbekende fout'
    await setStatus('error', melding)
    return NextResponse.json({ error: melding }, { status: 500 })
  }
}
