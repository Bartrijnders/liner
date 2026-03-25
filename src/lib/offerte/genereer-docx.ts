import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import fs from 'fs'
import path from 'path'

export type OfferteDOCXData = {
  klant_naam: string
  project_manager: string
  pm_email: string
  pm_telefoon: string
  datum: string
  referentie: string
  show_naam: string
  locatie: string
  m2: string
  show_begindatum: string
  show_einddatum: string
  subtotaal_standbuilder: string
  pm_kosten: string
  av_kosten: string
  opslag_kosten: string
  subtotaal_voor_korting: string
  korting_1: string
  korting_2: string
  eindtotaal: string
  categorieen: {
    naam: string
    regels: { omschrijving: string; hoeveelheid: string; eenheid: string; verkoopprijs: string }[]
    categorie_totaal: string
  }[]
}

const VARIANTS: Record<string, string> = {
  'nl-eu':     'offerte/nl-eu.docx',
  'en-eu':     'offerte/en-eu.docx',
  'en-non-eu': 'offerte/en-non-eu.docx',
  'en-us-ca':  'offerte/en-us-ca.docx',
  'de-eu':     'offerte/de-eu.docx',
}

export function genereerOfferteDOCX(data: OfferteDOCXData, variant = 'nl-eu'): Buffer {
  const templateFile = VARIANTS[variant] ?? VARIANTS['nl-eu']
  const templatePath = path.join(process.cwd(), 'public/templates', templateFile)
  const content = fs.readFileSync(templatePath, 'binary')
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: '{{', end: '}}' } })
  doc.render(data)
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}
