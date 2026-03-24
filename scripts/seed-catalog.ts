// scripts/seed-catalog.ts
// Draai met: npx tsx scripts/seed-catalog.ts
//
// JSON structuur verwacht in scripts/catalog.json:
// {
//   "Succes": true,
//   "Subgroups": [
//     {
//       "Name": "Flooring",
//       "MatchTerms": ["Vloeren", " Flooring", " Boden"],   ← synoniemen voor de subgroup
//       "Elements": [
//         {
//           "name": "Raised floor",
//           "Translation_NL": "verhoogde vloer",
//           "Translation_EN": " raised floor",
//           "Translation_DE": " erhöhter Fußboden"
//         }
//       ]
//     }
//   ]
// }
//
// Wat dit script doet:
// - Elke Subgroup → rij in `subgroups`
// - Elk Element → rij in `subgroup_elements`
// - Per element: Translation_NL + Translation_EN + Translation_DE → elk een MatchTerm met embedding
// - Subgroup-level MatchTerms worden NIET als match terms opgeslagen (te generiek),
//   maar wel als extra MatchTerms op een speciaal "Algemeen" element per subgroup (optioneel — zie onderaan)

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Laad .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Rate limiting: wacht even tussen embedding calls om OpenAI niet te overbelasten
function wacht(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function embedTerm(term: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: term.toLowerCase().trim(),
  })
  return response.data[0].embedding
}

function normaliseer(tekst: string): string {
  return tekst.toLowerCase().trim()
}

async function seed() {
  const catalogusPath = path.resolve(process.cwd(), 'scripts/catalog.json')
  const raw = fs.readFileSync(catalogusPath, 'utf-8')
  const data = JSON.parse(raw)
  const subgroups = data.Subgroups as any[]

  console.log(`\nCatalogus geladen: ${subgroups.length} subgroups gevonden\n`)

  let totaalElements = 0
  let totaalTerms = 0
  let overgeslagen = 0

  for (const subgroupData of subgroups) {
    // Sla subgroups zonder elements over
    if (!subgroupData.Elements || subgroupData.Elements.length === 0) {
      console.log(`⚠️  Overgeslagen (geen elements): ${subgroupData.Name}`)
      overgeslagen++
      continue
    }

    console.log(`\n📁 Subgroup: ${subgroupData.Name}`)

    // Upsert subgroup op naam
    const { data: subgroup, error: subgroupError } = await supabase
      .from('subgroups')
      .upsert({ naam: subgroupData.Name }, { onConflict: 'naam' })
      .select('id')
      .single()

    if (subgroupError) {
      console.error(`  ❌ Fout bij subgroup ${subgroupData.Name}:`, subgroupError.message)
      continue
    }

    for (const elementData of subgroupData.Elements) {
      // Verzamel unieke, niet-lege vertalingen als MatchTerms (met taalcode)
      const taalTerms = [
        { term: normaliseer(elementData.Translation_NL ?? ''), language: 'NL' },
        { term: normaliseer(elementData.Translation_EN ?? ''), language: 'EN' },
        { term: normaliseer(elementData.Translation_DE ?? ''), language: 'DE' },
      ].filter(t => t.term.length > 2)

      // Deduplicate op term (bewaar eerste taalcode)
      const gezien = new Set<string>()
      const termTeksten = taalTerms.filter(t => {
        if (gezien.has(t.term)) return false
        gezien.add(t.term)
        return true
      })

      if (termTeksten.length === 0) {
        console.log(`  ⚠️  Geen geldige vertalingen voor element: ${elementData.name}`)
        continue
      }

      console.log(`  📌 Element: ${elementData.name}`)

      // Upsert element
      const { data: element, error: elementError } = await supabase
        .from('subgroup_elements')
        .upsert(
          { naam: elementData.name, subgroup_id: subgroup.id },
          { onConflict: 'naam,subgroup_id' }
        )
        .select('id')
        .single()

      if (elementError) {
        console.error(`    ❌ Fout bij element ${elementData.name}:`, elementError.message)
        continue
      }

      totaalElements++

      // Voeg elke vertaling toe als MatchTerm met embedding
      for (const { term, language } of termTeksten) {
        try {
          const embedding = await embedTerm(term)

          const { error: termError } = await supabase
            .from('match_terms')
            .upsert(
              {
                term,
                language,
                embedding: JSON.stringify(embedding),
                subgroup_element_id: element.id,
                toegevoegd_door_feedback: false,
              },
              { onConflict: 'term,subgroup_element_id' }
            )

          if (termError) {
            console.error(`    ❌ Fout bij term "${term}" (${language}):`, termError.message)
          } else {
            console.log(`    ✓ [${language}] "${term}"`)
            totaalTerms++
          }

          // Kleine pauze om rate limits te vermijden
          await wacht(50)
        } catch (err: any) {
          console.error(`    ❌ Embedding fout voor "${term}":`, err.message)
        }
      }
    }
  }

  console.log(`\n✅ Seed klaar!`)
  console.log(`   Subgroups verwerkt: ${subgroups.length - overgeslagen}`)
  console.log(`   Elements aangemaakt: ${totaalElements}`)
  console.log(`   MatchTerms aangemaakt: ${totaalTerms}`)
  console.log(`   Overgeslagen subgroups: ${overgeslagen}`)
}

seed().catch(err => {
  console.error('\n💥 Onverwachte fout:', err)
  process.exit(1)
})