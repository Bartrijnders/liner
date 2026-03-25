import ExcelJS from 'exceljs'
import path from 'path'
import { berekenVerkoopprijs, parseGeldBedrag, parseHoeveelheid } from './bereken'

// Mapping: subgroup naam (lowercase) → Excel row range in "Calc 1" sheet
const SUBGROUP_RIJEN: Record<string, { start: number; eind: number }> = {
  'flooring': { start: 15, eind: 24 },
  'walls and doors': { start: 29, eind: 41 },
  'ceiling': { start: 45, eind: 51 },
  'kitchen/storage': { start: 53, eind: 68 },
  'furniture': { start: 72, eind: 85 },
  'audiovisual equipment': { start: 89, eind: 96 },
  'interior': { start: 98, eind: 108 },
  'decoration': { start: 110, eind: 124 },
  'various': { start: 126, eind: 134 },
  'electricity': { start: 136, eind: 149 },
  'general': { start: 164, eind: 183 },
  'oss': { start: 191, eind: 198 },
}

// Extra aliassen voor veelvoorkomende variaties
const SUBGROUP_ALIASSEN: Record<string, string> = {
  'floor': 'flooring',
  'walls': 'walls and doors',
  'rigging': 'ceiling',
  'pantry': 'kitchen/storage',
  'storage': 'kitchen/storage',
  'kitchen': 'kitchen/storage',
  'av': 'audiovisual equipment',
  'audio visual': 'audiovisual equipment',
  'display': 'interior',
  'general costs': 'general',
  'facilities': 'oss',
  'electrical': 'electricity',
}

function resolveRijen(subgroupNaam: string) {
  const lower = subgroupNaam.toLowerCase().trim()
  return SUBGROUP_RIJEN[lower] ?? SUBGROUP_RIJEN[SUBGROUP_ALIASSEN[lower] ?? ''] ?? null
}

type SubgroupRaw = {
  subgroupId: string
  subgroupNaam: string
  regels: { orderegelId: string; omschrijving: string; hoeveelheid: string | null; eenheid: string | null; stukprijs: string | null; totaalprijs: string | null }[]
}

type ProjectInfo = {
  naam: string
  show_naam: string | null
  project_manager: string | null
  m2: number | null
  fee: number
  pm_kosten: number
  korting_1: number
  korting_2: number
  av_kosten: number
  opslag_kosten: number
}

export async function genereerExcel(project: ProjectInfo, subgroupsRaw: SubgroupRaw[]): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'calc-template.xlsx')

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)

  // --- Budget show 1 sheet ---
  const budgetSheet = workbook.getWorksheet('Budget show 1')
  if (budgetSheet) {
    budgetSheet.getCell('E4').value = project.naam
    budgetSheet.getCell('E5').value = project.show_naam ?? ''
    budgetSheet.getCell('E10').value = project.m2 ?? 0
    budgetSheet.getCell('E14').value = project.project_manager ?? ''
  }

  // --- Calc 1 sheet ---
  const calcSheet = workbook.getWorksheet('Calc 1')
  if (calcSheet) {
    calcSheet.getCell('E1').value = project.fee

    // Schrijf per subgroup de regels in de juiste rijen
    for (const sg of subgroupsRaw) {
      const rijen = resolveRijen(sg.subgroupNaam)
      if (!rijen) continue

      let rijIndex = rijen.start
      for (const regel of sg.regels) {
        if (rijIndex > rijen.eind) break

        const hoev = parseHoeveelheid(regel.hoeveelheid)
        const prijs = parseGeldBedrag(regel.stukprijs)
        const inkoop = hoev !== null && prijs !== null ? hoev * prijs : null

        if (inkoop === null) continue // Sla regels zonder prijs over

        const row = calcSheet.getRow(rijIndex)
        row.getCell(1).value = hoev    // Kolom A: hoeveelheid
        row.getCell(4).value = inkoop  // Kolom D: inkooptotaal per regel
        row.commit()

        rijIndex++
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
