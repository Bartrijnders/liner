# Liner

> Interne offerteverwerking voor The Doc — van leveranciers-PDF naar gevalideerde orderregels.

Liner verwerkt supplier-offertes automatisch: upload een PDF, en AI extraheert alle orderregels, matcht ze tegen de productcatalogus, en vraagt een gebruiker alleen om te bevestigen wat twijfelachtig is.

---

## Hoe het werkt

```
PDF upload
    ↓
Agent 1 — extraheert orderregels (omschrijving, qty, prijs, cleanDesc)
    ↓
Vector search + fuzzy matching — vindt kandidaten in de catalogus
    ↓
Agent 2 — wijst confidence toe (HIGH / MEDIUM / LOW / NONE)
    ↓
Validatie-UI — gebruiker bevestigt of corrigeert matches
    ↓
Feedback loop — correcties worden nieuwe zoektermen in de catalogus
```

---

## Stack

| Laag | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Database + Auth + Storage | Supabase (PostgreSQL, Auth, Storage) |
| AI extractie | Anthropic Claude Haiku |
| Embeddings | OpenAI `text-embedding-3-small` |
| Fuzzy matching | `fastest-levenshtein` |
| UI | shadcn/ui + Tailwind CSS v4 |
| PDF parsing | `pdf-parse` |
| Deployment | Vercel |

---

## Features

### Projectbeheer
- Projecten aanmaken met metadata: klant, project manager, show-datums, locatie, HubSpot deal ID
- Uitvoertaal per project (NL / EN / DE) — bepaalt welke vertaling van een catalogusmatch getoond wordt

### Offerte-upload & verwerking
- Drag-and-drop upload van meerdere PDF's tegelijk
- Automatische tekstextractie en AI-analyse op de server
- Live statuspolling: `uploaded → processing → done`
- Foutafhandeling met beschrijvende melding (bijv. gescande PDF)

### Matching engine
- **Fuzzy matching** — token-level Levenshtein similarity, composite score op basis van termCoverage, inputCoverage en avgFuzzy
- **Vector search** — OpenAI embeddings opgeslagen in pgvector, cosine similarity via Supabase RPC
- **Agent 2** — valideert de top-3 kandidaten en wijst confidence toe met redenering
- Auto-match bij score ≥ 70 met gap ≥ 15 punten t.o.v. de tweede kandidaat

### Validatie-UI
- Alle orderregel-velden inline bewerkbaar: omschrijving, details, hoeveelheid, eenheid, stukprijs, totaalprijs
- Per regel: match bevestigen, wijzigen of overslaan
- Element selecteren vanuit volledige catalogus met zoekfunctie
- Nieuwe zoekterm toevoegen en direct koppelen aan een element + subgroup
- Voortgangsbalk: X van Y regels bevestigd

### Productcatalogus
- Hiërarchie: **Subgroup → Element → MatchTerms**
- Zoektermen per taal gekleurd: **NL** blauw · **EN** groen · **DE** amber · feedback paars
- Volledige CRUD: subgroups, elementen en zoektermen aanmaken, hernoemen en verwijderen
- Feedback-termen (vanuit validatie toegevoegd) visueel onderscheiden

---

## Lokaal draaien

```bash
# 1. Installeer dependencies
npm install

# 2. Maak .env.local aan en vul de keys in (zie hieronder)

# 3. Voer het database schema uit in de Supabase SQL editor (zie CLAUDE.md)

# 4. Seed de productcatalogus
npx tsx scripts/seed-catalog.ts

# 5. Start de dev server
npm run dev
```

---

## Catalogus seeden

Plaats `scripts/catalog.json` in dit formaat:

```json
{
  "Subgroups": [
    {
      "Name": "Flooring",
      "Elements": [
        {
          "name": "Raised floor",
          "Translation_NL": "verhoogde vloer",
          "Translation_EN": "raised floor",
          "Translation_DE": "erhöhter Fußboden"
        }
      ]
    }
  ]
}
```

Het script is idempotent — opnieuw draaien overschrijft bestaande data zonder duplicaten.

---

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

---

## Roadmap

- [ ] Export naar verkoopofferte (Excel / JSON)
- [ ] OCR-ondersteuning voor gescande PDF's
- [ ] Gebruikersbeheer en rollen
- [ ] Klantportaal

---

*Liner — The Doc © 2026*
