/**
 * Converts the 5 branded offerte templates to docxtemplater-compatible
 * versions with {{placeholder}} syntax. Saves output to public/templates/offerte/.
 *
 * Run with: node scripts/prepare-templates.js
 */

const PizZip = require('pizzip')
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '../public/templates/diverse offerte sjablonen')
const DEST = path.join(__dirname, '../public/templates/offerte')

if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAllParas(xml) {
  const regex = /<w:p[ >][\s\S]*?<\/w:p>/g
  const matches = []
  let m
  while ((m = regex.exec(xml)) !== null) {
    matches.push({ index: m.index, end: m.index + m[0].length, xml: m[0] })
  }
  return matches
}

/** Replace all run content in a paragraph with a single run containing newText.
 *  Preserves <w:pPr> and the first <w:rPr>. */
function transformPara(paraXml, newText) {
  const pStart = paraXml.match(/^<w:p[^>]*>/)?.[0] ?? '<w:p>'
  const pPr = paraXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
  const rPr = paraXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? ''

  if (!newText && newText !== '') return `${pStart}${pPr}</w:p>`

  const escaped = newText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const space = ' xml:space="preserve"'
  const run = `<w:r>${rPr}<w:t${space}>${escaped}</w:t></w:r>`
  return `${pStart}${pPr}${run}</w:p>`
}

/** Replace every <w:t> run that matches /x+/i in a paragraph with {{klant_naam}}. */
function replaceXxxInPara(paraXml) {
  return paraXml.replace(/<w:t([^>]*)>([^<]*x{2,}[^<]*)<\/w:t>/gi, (_, attr, text) => {
    const replaced = text.replace(/x{2,}/gi, '{{klant_naam}}')
    return `<w:t xml:space="preserve">${replaced}</w:t>`
  })
}

/** Apply a list of {paraIndex, newText, partial?} transformations to XML.
 *  partial=true → only replace xxx patterns, keep rest intact. */
function applyTransforms(xml, transforms) {
  const paras = getAllParas(xml)
  const map = new Map(transforms.map(t => [t.i, t]))

  // Work from end to start to keep offsets valid
  const sorted = [...map.entries()].sort((a, b) => b[0] - a[0])

  let result = xml
  for (const [idx, t] of sorted) {
    const para = paras[idx]
    if (!para) { console.warn(`  ⚠ Para ${idx} not found`); continue }
    const newParaXml = t.partial
      ? replaceXxxInPara(para.xml)
      : transformPara(para.xml, t.text)
    result = result.substring(0, para.index) + newParaXml + result.substring(para.end)
  }
  return result
}

/** OOXML for a detail table with category + regel loops (docxtemplater syntax).
 *  Layout based on Hoynck PDF offer format:
 *  - 3 columns: omschrijving (wide, left) | EUR (narrow, right) | prijs (narrow, right)
 *  - Subgroep header row: naam bold left, categorie_totaal bold right
 *  - Per regel: [hoeveelheid] x [omschrijving] | EUR | verkoopprijs
 *  - Closing total row per subgroup: bold + underline
 *  Marker rows ({#categorieen}, {/categorieen}) are dropped by docxtemplater.
 */
const DETAIL_TABLE_XML = `<w:tbl>
<w:tblPr>
  <w:tblW w:w="8618" w:type="dxa"/>
  <w:tblBorders>
    <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
    <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
    <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
    <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
    <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
    <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
  </w:tblBorders>
  <w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar>
</w:tblPr>
<w:tblGrid>
  <w:gridCol w:w="6500"/>
  <w:gridCol w:w="700"/>
  <w:gridCol w:w="1418"/>
</w:tblGrid>
<w:tr><w:tc><w:p><w:r><w:t>{{#categorieen}}</w:t></w:r></w:p></w:tc><w:tc><w:p/></w:tc><w:tc><w:p/></w:tc></w:tr>
<w:tr>
  <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{{naam}}</w:t></w:r></w:p></w:tc>
  <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>EUR</w:t></w:r></w:p></w:tc>
  <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{{categorie_totaal}}</w:t></w:r></w:p></w:tc>
</w:tr>
<w:tr>
  <w:tc><w:p><w:r><w:t xml:space="preserve">{{#regels}}{{hoeveelheid}} x {{omschrijving}}</w:t></w:r></w:p></w:tc>
  <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>EUR</w:t></w:r></w:p></w:tc>
  <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t xml:space="preserve">{{verkoopprijs}}{{/regels}}</w:t></w:r></w:p></w:tc>
</w:tr>
<w:tr>
  <w:tc><w:p><w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">Totaal {{naam}}</w:t></w:r></w:p></w:tc>
  <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t>EUR</w:t></w:r></w:p></w:tc>
  <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{categorie_totaal}}</w:t></w:r></w:p></w:tc>
</w:tr>
<w:tr><w:tc><w:p><w:r><w:t>{{/categorieen}}</w:t></w:r></w:p></w:tc><w:tc><w:p/></w:tc><w:tc><w:p/></w:tc></w:tr>
</w:tbl>`

/** Process a single template file. */
function processTemplate(srcName, destName, docTransforms, footerTransforms = [], options = {}) {
  console.log(`\nProcessing: ${destName}`)
  const content = fs.readFileSync(path.join(SRC, srcName), 'binary')
  const zip = new PizZip(content)

  // document.xml
  let docXml = zip.files['word/document.xml'].asText()
  docXml = applyTransforms(docXml, docTransforms)
  if (options.insertDetailTableBefore) {
    const searchText = options.insertDetailTableBefore
    const insertIdx = docXml.indexOf(searchText)
    if (insertIdx !== -1) {
      const pStart = docXml.lastIndexOf('<w:p ', insertIdx)
      docXml = docXml.substring(0, pStart) + DETAIL_TABLE_XML + docXml.substring(pStart)
      console.log(`  ✓ Detail table inserted before "${searchText.slice(0, 30)}..."`)
    } else {
      console.warn(`  ⚠ Could not find insertion point: "${searchText.slice(0, 30)}"`)
    }
  }
  zip.file('word/document.xml', docXml)

  // footer1.xml
  const footerFile = zip.files['word/footer1.xml']
  if (footerFile && footerTransforms.length > 0) {
    let fXml = footerFile.asText()
    fXml = applyTransforms(fXml, footerTransforms)
    zip.file('word/footer1.xml', fXml)
  }

  const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  fs.writeFileSync(path.join(DEST, destName), buffer)
  console.log(`  ✓ Saved to public/templates/offerte/${destName}`)
}

// ─── Template: NL EU ──────────────────────────────────────────────────────────

processTemplate(
  'Standaard concept offerte Nederlands incl. AVW EU kolom - we elevate brands.docx',
  'nl-eu.docx',
  [
    // Address block
    { i: 1,   text: '{{klant_naam}}' },
    { i: 2,   text: '' },
    { i: 3,   text: '' },
    // Header table
    { i: 11,  text: '{{datum}}' },
    { i: 15,  text: '{{referentie}}' },
    { i: 17,  text: '{{project_manager}}' },
    { i: 18,  text: '{{pm_email}}' },
    { i: 19,  text: '{{pm_telefoon}}' },
    // Project info
    { i: 23,  text: 'Onderwerp Project: {{show_naam}}' },
    { i: 24,  text: 'Stand oppervlakte: {{m2}} m\u00B2' },
    { i: 25,  text: 'Beursdata:{{show_begindatum}} \u2013 {{show_einddatum}}' },
    { i: 26,  text: 'Beurslocatie:{{locatie}}' },
    // Body text
    { i: 30,  text: 'Geachte {{klant_naam}},' },
    { i: 43,  partial: true },
    // Financial overview
    { i: 118, text: 'Financieel overzicht{{klant_naam}}' },
    { i: 119, text: 'Project: {{show_naam}}' },
    { i: 120, text: 'Stand oppervlakte: {{m2}} m\u00B2' },
    { i: 121, text: 'Beursdata:{{show_begindatum}} \u2013 {{show_einddatum}}' },
    { i: 122, text: 'Beurslocatie:{{locatie}}' },
    // Pricing table amounts
    { i: 131, text: '{{subtotaal_standbuilder}}' },
    { i: 134, text: '{{av_kosten}}' },
    { i: 137, text: '{{opslag_kosten}}' },
    { i: 140, text: '{{pm_kosten}}' },
    { i: 146, text: '{{subtotaal_voor_korting}}' },
    { i: 152, text: '{{korting_1}}' },
    { i: 156, text: 'Totaal {{show_naam}}' },
    { i: 158, text: '{{eindtotaal}}' },
    // Signing block
    { i: 259, text: '{{locatie}}' },
    { i: 261, text: '{{klant_naam}}' },
  ],
  [
    { i: 0, text: '{{klant_naam}}' },
    { i: 1, text: '{{datum}}' },
    { i: 2, text: 'Offerte {{show_naam}}' },
  ],
  { insertDetailTableBefore: 'Financieel overzicht' }
)

// ─── Template: EN EU ──────────────────────────────────────────────────────────

processTemplate(
  'Standard concept offerte Engels incl AVW EU kolom - we elevate brands.docx',
  'en-eu.docx',
  [
    // Address block
    { i: 0,   text: '{{klant_naam}}' },
    // Header table
    { i: 7,   text: '{{datum}}' },
    { i: 10,  text: '{{referentie}}' },
    { i: 12,  text: '{{project_manager}}' },
    { i: 13,  text: '{{pm_email}}' },
    { i: 14,  text: '{{pm_telefoon}}' },
    // Project info
    { i: 15,  text: 'Subject Event: {{show_naam}}' },
    { i: 16,  text: 'Stand space:{{m2}} m\u00B2' },
    { i: 17,  text: 'Date of event:{{show_begindatum}} \u2013 {{show_einddatum}}' },
    { i: 18,  text: 'Location:{{locatie}}' },
    // Body text
    { i: 22,  text: 'Dear {{klant_naam}},' },
    { i: 23,  partial: true },
    { i: 24,  partial: true },
    { i: 27,  partial: true },
    // Financial overview
    { i: 117, text: 'Financial Overview{{klant_naam}}' },
    { i: 118, text: 'Event: {{show_naam}}' },
    { i: 119, text: 'Stand space:{{m2}} m\u00B2' },
    { i: 120, text: 'Date of event:{{show_begindatum}} \u2013 {{show_einddatum}}' },
    { i: 121, text: 'Location:{{locatie}}' },
    // Pricing table amounts (EN EU has real numbers here)
    { i: 130, text: '{{subtotaal_standbuilder}}' },
    { i: 133, text: '{{opslag_kosten}}' },
    { i: 136, text: '{{pm_kosten}}' },
    { i: 140, text: 'Total {{show_naam}}' },
    { i: 142, text: '{{eindtotaal}}' },
  ],
  [
    { i: 0, text: '{{klant_naam}}' },
    { i: 1, text: '{{datum}}' },
    { i: 2, text: 'Offer {{show_naam}}' },
  ]
)

// ─── Template: EN non-EU ──────────────────────────────────────────────────────

processTemplate(
  'Standard concept offerte Engels incl AVW non EU kolom - we elevate brands.docx',
  'en-non-eu.docx',
  [
    // Address block
    { i: 0,   text: '{{klant_naam}}' },
    // Header table
    { i: 7,   text: '{{datum}}' },
    { i: 10,  text: '{{referentie}}' },
    { i: 12,  text: '{{project_manager}}' },
    { i: 13,  text: '{{pm_email}}' },
    { i: 14,  text: '{{pm_telefoon}}' },
    // Project info
    { i: 16,  text: 'Subject Event: {{show_naam}}' },
    { i: 17,  text: 'Stand space:{{m2}} m\u00B2' },
    { i: 18,  text: 'Date of event:{{show_begindatum}} \u2013 {{show_einddatum}}' },
    { i: 19,  text: 'Location:{{locatie}}' },
    // Body text
    { i: 22,  text: 'Dear {{klant_naam}},' },
    { i: 23,  partial: true },
    { i: 27,  partial: true },
    // Financial overview
    { i: 171, text: 'Financial Overview{{klant_naam}}' },
    { i: 172, text: 'Event: {{show_naam}}' },
    { i: 173, text: 'Stand space:{{m2}} m\u00B2' },
    { i: 174, text: 'Date of event:{{show_begindatum}} \u2013 {{show_einddatum}}' },
    { i: 175, text: 'Location:{{locatie}}' },
    // Pricing table (empty cells — inserts placeholders)
    { i: 180, text: '{{subtotaal_standbuilder}}' },
    { i: 183, text: '{{opslag_kosten}}' },
    { i: 186, text: '{{pm_kosten}}' },
    { i: 190, text: 'Subtotal {{show_naam}}' },
    { i: 192, text: '{{subtotaal_voor_korting}}' },
    { i: 197, text: '{{av_kosten}}' },
    { i: 201, text: 'Total {{show_naam}}' },
    { i: 203, text: '{{eindtotaal}}' },
  ],
  [
    { i: 0, text: '{{klant_naam}}' },
    { i: 1, text: '{{datum}}' },
    { i: 2, text: 'Offer {{show_naam}}' },
  ]
)

// ─── Template: EN US/CA ───────────────────────────────────────────────────────

processTemplate(
  'Standard concept offerte Engels incl AVW VS en Canada - we elevate brands.docx',
  'en-us-ca.docx',
  [
    // Address block
    { i: 0,   text: '{{klant_naam}}' },
    // Header table
    { i: 7,   text: '{{datum}}' },
    { i: 10,  text: '{{referentie}}' },
    { i: 12,  text: '{{project_manager}}' },
    { i: 13,  text: '{{pm_email}}' },
    { i: 14,  text: '{{pm_telefoon}}' },
    // Project info
    { i: 15,  text: 'Subject Event: {{show_naam}}' },
    { i: 16,  text: 'Stand space:{{m2}} m\u00B2' },
    { i: 17,  text: 'Date of event:{{show_begindatum}} \u2013 {{show_einddatum}}' },
    { i: 18,  text: 'Location:{{locatie}}' },
    // Body text
    { i: 21,  text: 'Dear {{klant_naam}},' },
    { i: 22,  partial: true },
    { i: 23,  partial: true },
    // Financial overview
    { i: 107, text: 'Financial Overview{{klant_naam}}' },
    { i: 108, text: 'Event: {{show_naam}}' },
    { i: 109, text: 'Stand space:{{m2}} m\u00B2' },
    { i: 110, text: 'Date of event:{{show_begindatum}} \u2013 {{show_einddatum}}' },
    { i: 111, text: 'Location:{{locatie}}' },
    // Pricing table amounts
    { i: 120, text: '{{subtotaal_standbuilder}}' },
    { i: 123, text: '{{av_kosten}}' },
    { i: 126, text: '{{opslag_kosten}}' },
    { i: 129, text: '{{pm_kosten}}' },
    { i: 133, text: 'Total {{show_naam}}' },
    { i: 135, text: '{{eindtotaal}}' },
    // Signing block
    { i: 254, text: '{{klant_naam}}' },
    { i: 256, text: '{{klant_naam}}' },
  ],
  [
    { i: 0, text: '{{klant_naam}}' },
    { i: 1, text: '{{datum}}' },
    { i: 2, text: 'Offer {{show_naam}}' },
  ]
)

// ─── Template: DE EU ──────────────────────────────────────────────────────────

processTemplate(
  'Standard concept offerte Duits incl. AVW EU kolom - we elevate brands.docx',
  'de-eu.docx',
  [
    // Address block
    { i: 0,   text: '{{klant_naam}}' },
    // Header table
    { i: 7,   text: '{{datum}}' },
    { i: 11,  text: '{{referentie}}' },
    { i: 14,  text: '{{project_manager}}' },
    { i: 15,  text: '{{pm_email}}' },
    { i: 16,  text: '{{pm_telefoon}}' },
    // Project info
    { i: 21,  text: 'Betreff Veranstaltung: {{show_naam}}' },
    { i: 22,  text: 'Standf\u00E4che:{{m2}} m\u00B2' },
    { i: 23,  text: 'Veranstaltungsdauer:{{show_begindatum}} \u2013 {{show_einddatum}}' },
    { i: 24,  text: 'Veranstaltungsort:{{locatie}}' },
    // Body text
    { i: 28,  text: 'Sehr geehrte(r) {{klant_naam}},' },
    // Financial overview
    { i: 133, text: 'Finanzielle \u00DCbersicht{{klant_naam}}' },
    { i: 134, text: 'Veranstaltung: {{show_naam}}' },
    { i: 135, text: 'Standf\u00E4che:{{m2}} m\u00B2' },
    { i: 136, text: 'Veranstaltungsdauer:{{show_begindatum}} \u2013 {{show_einddatum}}' },
    { i: 137, text: 'Veranstaltungsort:{{locatie}}' },
    // Pricing table amounts
    { i: 145, text: '{{subtotaal_standbuilder}}' },
    { i: 148, text: '{{av_kosten}}' },
    { i: 151, text: '{{opslag_kosten}}' },
    { i: 154, text: '{{pm_kosten}}' },
    { i: 158, text: 'Gesamtbetrag {{show_naam}}' },
    { i: 160, text: '{{eindtotaal}}' },
  ],
  [
    { i: 0, text: '{{klant_naam}}' },
    { i: 1, text: '{{datum}}' },
    { i: 2, text: 'Angebot {{show_naam}}' },
  ]
)

console.log('\n✅ Alle templates verwerkt naar public/templates/offerte/')
