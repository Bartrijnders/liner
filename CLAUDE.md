@AGENTS.md
# Liner — Claude Code Build Plan (Phase 1)

> Read this before writing any code.
> This is the Phase 1 MVP: auth + projecten + offertes uploaden + AI regelextractie.
> Alle architectuurkeuzes zijn intentioneel. Vraag niet opnieuw of je ze wilt volgen — doe het gewoon.

---

## Wat we bouwen in Phase 1

Een interne webapplicatie voor The Doc waarmee gebruikers:

1. Kunnen inloggen (email + wachtwoord)
2. Projecten kunnen aanmaken en beheren
3. Per project meerdere supplier-offertes (PDF) kunnen uploaden
4. De AI (Claude) elke offerte laat uitlezen → orderregels worden opgeslagen in de database
5. De geëxtraheerde orderregels per offerte kunnen bekijken

Matching, validatie-UI, en catalogusbeheer vallen buiten Phase 1. Die komen later.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Database + Auth + Storage**: Supabase (PostgreSQL, Supabase Auth, Supabase Storage)
- **Data access**: Supabase JS client (`@supabase/supabase-js`) — geen Prisma in Phase 1
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) — claude-3-5-sonnet-latest
- **UI**: shadcn/ui + Tailwind CSS
- **PDF tekst extractie**: `pdf-parse` (server-side, in API route)
- **Deployment**: Vercel

---

## Database Schema

Maak deze tabellen aan in Supabase via de SQL editor. Gebruik UUIDs als primary keys.

```sql
-- Klanten (simpele lookup tabel)
create table klanten (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  created_at timestamptz default now()
);

-- Projecten
create table projecten (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  project_manager text,
  klant_id uuid references klanten(id) on delete set null,
  hubspot_deal_id text,
  land text,
  plaats text,
  show_naam text,
  show_begindatum date,
  show_einddatum date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Offertes (één PDF per rij)
create table offertes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projecten(id) on delete cascade,
  bestandsnaam text not null,          -- originele bestandsnaam
  storage_path text not null,          -- pad in Supabase Storage
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'done', 'error')),
  fout_melding text,                   -- gevuld als status = 'error'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Orderregels (geëxtraheerd door AI uit de offerte)
create table orderregels (
  id uuid primary key default gen_random_uuid(),
  offerte_id uuid not null references offertes(id) on delete cascade,
  regelnummer int,                     -- volgorde in de originele PDF
  omschrijving text,                   -- ruwe omschrijving
  details text,                        -- aanvullende specs/details
  hoeveelheid text,                    -- ruwe hoeveelheid ("2 stuks")
  eenheid text,                        -- eenheid (m, st, m², etc.)
  stukprijs text,                      -- ruwe prijs
  totaalprijs text,
  created_at timestamptz default now()
);
```

### RLS (Row Level Security)

Zet RLS aan op alle tabellen. Voor Phase 1 is een simpele policy voldoende:
alleen ingelogde gebruikers kunnen lezen en schrijven.

```sql
-- Herhaal dit patroon voor elke tabel:
alter table projecten enable row level security;
create policy "Authenticated users can do everything" on projecten
  for all using (auth.role() = 'authenticated');

-- Herhaal voor: klanten, offertes, orderregels
```

### Supabase Storage Bucket

Maak een private bucket aan met de naam `offertes`. Zet RLS aan:
alleen authenticated users mogen uploaden en lezen.

---

## Supabase Auth Setup

Gebruik Supabase Auth met email + wachtwoord.

- Geen magic links, geen social login in Phase 1
- Maak handmatig 1 of 2 testgebruikers aan via Supabase dashboard
- Gebruik de Supabase SSR helper voor Next.js zodat de session correct werkt
  in zowel Server Components als Route Handlers

Packages:
```bash
npm install @supabase/supabase-js @supabase/ssr
```

Maak twee Supabase clients:
- `lib/supabase/server.ts` — voor Server Components en Route Handlers (gebruikt cookies)
- `lib/supabase/client.ts` — voor Client Components (browser)

Gebruik de standaard Supabase Next.js SSR setup zoals beschreven in hun docs.
Voeg middleware toe (`middleware.ts`) om niet-ingelogde gebruikers naar `/login` te sturen.

---

## Mappenstructuur

```text
liner/
├── CLAUDE.md
├── middleware.ts                        ← auth redirect middleware
├── src/
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx                ← login formulier
│   │   ├── (app)/                      ← route group, vereist auth
│   │   │   ├── layout.tsx              ← haalt session op, toont nav
│   │   │   ├── projecten/
│   │   │   │   ├── page.tsx            ← projectenlijst + aanmaken
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx        ← project detail + offertes
│   │   │   └── ...
│   │   └── api/
│   │       └── offertes/
│   │           └── [id]/
│   │               └── verwerk/
│   │                   └── route.ts    ← trigger AI extractie
│   ├── components/
│   │   ├── ProjectModal.tsx            ← aanmaken/bewerken project
│   │   ├── OfferteUpload.tsx           ← drag-and-drop upload
│   │   └── OrderregelsTable.tsx        ← tabel met geëxtraheerde regels
│   └── lib/
│       ├── supabase/
│       │   ├── server.ts
│       │   └── client.ts
│       └── ai/
│           └── extract-orderregels.ts  ← Claude extractie logica
```

---

## Schermen & Flows

### 1. Login (`/login`)

- Simpel formulier: email + wachtwoord + knop "Inloggen"
- Bij succes: redirect naar `/projecten`
- Bij fout: toon foutmelding onder het formulier
- Als al ingelogd: redirect direct naar `/projecten`
- Gebruik Supabase `signInWithPassword`

### 2. Projectenlijst (`/projecten`)

- Toont alle projecten als kaarten of tabelrijen
- Elke rij: Naam, Project manager, Klant, Show begindatum, Show einddatum
- Knop "Nieuw project" → opent `ProjectModal`
- Klikken op een project → navigeert naar `/projecten/[id]`
- Knop "Uitloggen" in de navigatie (Supabase `signOut`)

### 3. Project aanmaken/bewerken (`ProjectModal`)

Formuliervelden (zie screenshot):
- **Naam** (verplicht, text input)
- **Project manager** (text input — geen user lookup, gewoon een string)
- **Klant** (dropdown, geladen uit `klanten` tabel; optie "Klant aanmaken" onderaan)
- **HubSpot deal ID** (text input)
- **Land** (text input)
- **Plaats** (text input)
- **Show** (text input — naam van het evenement/show)
- **Show begindatum** (date picker)
- **Show einddatum** (date picker)

Knoppen: "Annuleren" + "Opslaan"
Onderaan links: "Klant aanmaken" → inline mini-formulier of tweede modal voor nieuwe klant

### 4. Project detail (`/projecten/[id]`)

Bovenaan: projectnaam + metadata (project manager, klant, data)

Daarna: sectie "Offertes"
- Drag-and-drop uploadzone voor PDF bestanden (meerdere tegelijk)
- Per geüploade offerte een kaart met:
  - Bestandsnaam
  - Status badge: `uploaded` | `processing` | `done` | `error`
  - Als status = `done`: knop "Bekijk regels" (toggles een tabel eronder)
  - Als status = `error`: foutmelding zichtbaar
- Upload flow (zie hieronder)

---

## Upload & AI Extractie Flow

Dit is de kern van Phase 1. Stap voor stap:

```text
Gebruiker sleept PDF naar uploadzone
        │
        ▼
Client: upload PDF naar Supabase Storage (bucket: offertes)
        │ path: projecten/{project_id}/{uuid}-{bestandsnaam}
        ▼
Client: maak rij aan in `offertes` tabel
        │ status = 'uploaded'
        ▼
Client: roep POST /api/offertes/[id]/verwerk aan (fire-and-forget)
        │
        ▼
Server (Route Handler):
  1. Controleer of gebruiker is ingelogd
  2. Zet status = 'processing'
  3. Download PDF van Supabase Storage
  4. Extraheer tekst met pdf-parse
  5. Stuur tekst naar Claude → ontvang gestructureerde JSON met orderregels
  6. Sla orderregels op in `orderregels` tabel
  7. Zet status = 'done'
  Bij fout: zet status = 'error', sla foutmelding op
        │
        ▼
Client: pollt de offerte-status elke 3 seconden (met setInterval of SWR)
        │ → toont processing spinner → verandert naar 'done' badge
        ▼
Gebruiker klikt "Bekijk regels" → orderregels tabel verschijnt
```

### PDF Tekst Extractie & Vercel Config

Gebruik `pdf-parse` in de Route Handler (`api/offertes/[id]/verwerk/route.ts`).
**Belangrijk**: Voeg deze configuratie bovenaan de route file toe om Vercel timeouts te voorkomen en Node API's te ondersteunen:

```typescript
export const maxDuration = 60; // Sta tot 60 seconden toe voor Claude API
export const runtime = 'nodejs'; // Forceer Node in plaats van Edge voor pdf-parse

import pdfParse from 'pdf-parse'

// Binnen de POST handler:
const pdfBuffer = await fetch(signedUrl).then(r => r.arrayBuffer())
const { text } = await pdfParse(Buffer.from(pdfBuffer))
```

Als `text` leeg is (<100 tekens): gooi een error met bericht
"PDF is gescand of bevat geen leesbare tekst. Handmatige invoer vereist."
(Geen OCR in Phase 1 — dat is voor later.)

### Claude Extractie Prompt

```typescript
// lib/ai/extract-orderregels.ts

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function extractOrderregels(pdfTekst: string) {
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Je bent een assistent die leveranciersoffertes uitleest.
        
Analyseer de onderstaande offerte tekst en extraheer alle orderregels.
Geef je antwoord ALLEEN als een geldig JSON array, zonder uitleg, zonder markdown code blocks.

Elk object in de array heeft deze velden:
- regelnummer: number (volgorde in de offerte, begin bij 1)
- omschrijving: string (de productnaam/omschrijving, zo letterlijk mogelijk)
- details: string | null (aanvullende specificaties, afmetingen, etc.)
- hoeveelheid: string | null (ruwe hoeveelheid zoals "2", "10 stuks", "50m")
- eenheid: string | null (m, st, m², stuk, etc. — extraheer uit hoeveelheid als mogelijk)
- stukprijs: string | null (prijs per eenheid, inclusief valutasymbool)
- totaalprijs: string | null (totaalprijs voor de regel)

Regels om te negeren: kopteksten, tussentitels, subtotalen, BTW-regels, en lege regels.

Offerte tekst:
---
${pdfTekst}
---

Geef nu de JSON array:`
      }
    ]
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Onverwacht antwoord van Claude')
  
  return JSON.parse(content.text) as OrderregelExtract[]
}

interface OrderregelExtract {
  regelnummer: number
  omschrijving: string
  details: string | null
  hoeveelheid: string | null
  eenheid: string | null
  stukprijs: string | null
  totaalprijs: string | null
}
```

---

## Orderregels Tabel (UI)

Kolommen:
| # | Omschrijving | Details | Hoeveelheid | Eenheid | Stukprijs | Totaalprijs |
|---|---|---|---|---|---|---|

- Toon `—` voor lege velden
- Geen edit-functionaliteit in Phase 1
- Toon het aantal regels boven de tabel: "X orderregels gevonden"

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # alleen server-side, voor storage downloads

# Anthropic
ANTHROPIC_API_KEY=
```

Let op: de Route Handler die PDF's verwerkt heeft de `SERVICE_ROLE_KEY` nodig
om bestanden uit de private storage bucket te kunnen lezen.

---

## Bouwvolgorde — Volg deze stappen in volgorde

- [ ] **Stap 1** — Next.js project aanmaken
  ```bash
  npx create-next-app@latest liner --typescript --tailwind --app --src-dir
  ```
  Daarna: shadcn/ui installeren (`npx shadcn@latest init`), packages installeren

- [ ] **Stap 2** — Supabase setup
  - SQL schema uitvoeren in Supabase SQL editor (alle tabellen + RLS policies)
  - Storage bucket `offertes` aanmaken (private)
  - `.env.local` vullen met Supabase URL en keys

- [ ] **Stap 3** — Supabase clients + middleware
  - `lib/supabase/server.ts` en `lib/supabase/client.ts`
  - `middleware.ts` — beschermt alle routes behalve `/login`

- [ ] **Stap 4** — Login pagina (`/login`)
  - Formulier: email + wachtwoord
  - Supabase `signInWithPassword`
  - Redirect bij succes, foutmelding bij fout

- [ ] **Stap 5** — App layout + navigatie
  - `(app)/layout.tsx` — toont naam app + uitlog-knop
  - Haalt session op via server component

- [ ] **Stap 6** — Klanten (mini-CRUD)
  - Dropdown component met data uit `klanten` tabel
  - Inline formulier voor nieuwe klant aanmaken

- [ ] **Stap 7** — Projecten lijst + aanmaken
  - `/projecten/page.tsx` — overzicht als tabel of kaarten
  - `ProjectModal.tsx` — alle velden uit het screenshot
  - Supabase insert/update

- [ ] **Stap 8** — Project detail pagina
  - `/projecten/[id]/page.tsx`
  - Toont projectinfo bovenaan
  - Laadt offertes voor dit project

- [ ] **Stap 9** — Offerte upload
  - `OfferteUpload.tsx` — drag-and-drop zone (gebruik `react-dropzone`)
  - Upload naar Supabase Storage
  - Rij aanmaken in `offertes` tabel
  - Direct daarna: POST naar `/api/offertes/[id]/verwerk` (fire-and-forget)

- [ ] **Stap 10** — AI extractie Route Handler
  - `api/offertes/[id]/verwerk/route.ts`
  - Controleer eerst via Supabase of de gebruiker is ingelogd.
  - Download PDF, extraheer tekst, stuur naar Claude, sla orderregels op
  - Zet status correct (processing → done / error)

- [ ] **Stap 11** — Status polling + orderregels tabel
  - Client pollt elke 3s de offerte-status met `setInterval` (of SWR). Gebruik GEEN Supabase Realtime in Phase 1.
  - `OrderregelsTable.tsx` — tabel met alle geëxtraheerde regels

---

## Implementatieregels

1. **Supabase client in Server Components**: gebruik altijd `lib/supabase/server.ts`.
2. **Supabase client in Client Components**: gebruik altijd `lib/supabase/client.ts`.
3. **SERVICE_ROLE_KEY**: alleen gebruiken in Route Handlers, nooit in client code.
4. **PDF parse**: altijd in een Route Handler (server-side), nooit in de browser.
5. **Claude errors**: altijd opvangen, status op 'error' zetten met beschrijvende melding.
6. **Storage paths**: gebruik patroon `projecten/{project_id}/{uuid}-{bestandsnaam}`.
7. **Geen skeleton/loading states bouwen** voor Phase 1 — simpele tekst "Laden..." is voldoende.
8. **Geen optimistische updates** — laad data opnieuw na mutaties.
9. **Taal**: UI is Nederlands (labels, knoppen, meldingen).
10. **Next.js 15 Cookies**: Next.js 15 gebruikt asynchrone cookies. Gebruik altijd `await cookies()` bij het configureren van de Supabase SSR server client.

---

## Wat valt BUITEN Phase 1

De volgende onderdelen worden in latere fases gebouwd:

- Matching tegen productcatalogus (fuzzy + vector)
- Validatie-UI (Stap 2 scherm)
- Catalogusbeheer (Subgroups / Elements / MatchTerms)
- Scanned PDF support (OCR via vision)
- Export naar verkoopofferte
- Gebruikersbeheer / rollen
- Klantportaal

---

*Phase 1 — Liner @ The Doc — Maart 2026*

---

# Liner — Claude Code Build Plan (Phase 2)

> Lees dit volledig door voordat je iets doet.
> Phase 1 is af: auth, projecten, offerte-upload, AI regelextractie werkt.
> Phase 2 voegt toe: productcatalogus, fuzzy matching, vector search, Agent 2, validatie-UI, en de feedback loop.
> Alle architectuurkeuzes zijn intentioneel. Niet opnieuw bespreken — gewoon doen.

---

## Wat we bouwen in Phase 2

1. Database uitbreiden met catalogustabellen + pgvector
2. Catalogusdata importeren via seed script (JSON aangeleverd door gebruiker)
3. Fuzzy match engine (`lib/matching/fuzzy.ts`)
4. Vector search via pgvector (`lib/matching/embeddings.ts`)
5. Agent 1 uitbreiden — voeg `categoryHint` toe aan extractie output
6. Agent 2 bouwen — valideert matches en wijst confidence toe
7. Verwerkings-pipeline uitbreiden met matching na Agent 1
8. Validatie-UI (`/projecten/[id]/offertes/[offerteId]`)
9. Feedback loop — nieuwe MatchTerms aanmaken bij correcties
10. Catalogusbeheer UI (`/catalogus`)

---

## Tech Stack (aanvulling op Phase 1)

- **Vector search**: pgvector extensie in Supabase (al beschikbaar)
- **Embeddings**: OpenAI `text-embedding-3-small` via `openai` npm package
- **Fuzzy matching**: `fastest-levenshtein` voor token-level similarity
- **Geen Prisma** — blijf de Supabase JS client gebruiken voor standaard queries
- **Raw SQL via Supabase** — voor pgvector operaties (`supabase.rpc` of `.from().select()` met raw)

---

## Database Uitbreiding

Voer dit uit in de Supabase SQL editor. Voer eerst de pgvector extensie in.

```sql
-- pgvector extensie (waarschijnlijk al actief, anders aanzetten)
create extension if not exists vector;

-- Subgroups (bovenste laag catalogus)
create table subgroups (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  created_at timestamptz default now()
);

-- SubgroupElements (middelste laag)
create table subgroup_elements (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  subgroup_id uuid not null references subgroups(id) on delete cascade,
  created_at timestamptz default now()
);

-- MatchTerms (zoektermen per element, met vector embedding)
create table match_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null,                          -- altijd lowercase opslaan
  embedding vector(1536),                      -- OpenAI text-embedding-3-small
  subgroup_element_id uuid not null references subgroup_elements(id) on delete cascade,
  toegevoegd_door_feedback boolean default false,
  created_at timestamptz default now()
);

-- Index voor vector search (cosine similarity)
create index on match_terms using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- FuzzyScores (scores per orderregel per matchterm, voor analytics)
create table fuzzy_scores (
  id uuid primary key default gen_random_uuid(),
  orderregel_id uuid not null references orderregels(id) on delete cascade,
  match_term_id uuid not null references match_terms(id) on delete cascade,
  score float not null,              -- composite 0-100
  term_coverage float not null,
  input_coverage float not null,
  avg_fuzzy float not null,
  vector_distance float,             -- cosine afstand uit pgvector
  created_at timestamptz default now()
);

-- Orderregels uitbreiden met match-resultaat kolommen
alter table orderregels
  add column if not exists clean_desc text,
  add column if not exists clean_details text,
  add column if not exists category_hint text,
  add column if not exists subgroup_element_id uuid references subgroup_elements(id) on delete set null,
  add column if not exists confidence text check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'NONE')),
  add column if not exists match_reasoning text,
  add column if not exists suggested_match_term text,
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by text,
  add column if not exists override_element_id uuid references subgroup_elements(id) on delete set null;
```

### RLS voor nieuwe tabellen

```sql
alter table subgroups enable row level security;
create policy "Authenticated users can do everything" on subgroups
  for all using (auth.role() = 'authenticated');

alter table subgroup_elements enable row level security;
create policy "Authenticated users can do everything" on subgroup_elements
  for all using (auth.role() = 'authenticated');

alter table match_terms enable row level security;
create policy "Authenticated users can do everything" on match_terms
  for all using (auth.role() = 'authenticated');

alter table fuzzy_scores enable row level security;
create policy "Authenticated users can do everything" on fuzzy_scores
  for all using (auth.role() = 'authenticated');
```

### Supabase RPC functie voor vector search

Maak deze SQL functie aan — dit is de vector search query die we vanuit de app aanroepen:

```sql
create or replace function zoek_match_terms(
  query_embedding vector(1536),
  limiet int default 10
)
returns table (
  match_term_id uuid,
  term text,
  subgroup_element_id uuid,
  vector_distance float
)
language sql stable
as $$
  select
    id as match_term_id,
    term,
    subgroup_element_id,
    embedding <=> query_embedding as vector_distance
  from match_terms
  where embedding is not null
  order by embedding <=> query_embedding
  limit limiet;
$$;
```

---

## Environment Variables (aanvulling)

Voeg toe aan `.env.local`:

```env
OPENAI_API_KEY=sk-...    # voor text-embedding-3-small
```

---

## Seed Script

### JSON formaat (verwacht van gebruiker)

Het seed script verwacht een JSON bestand op `scripts/catalog.json` in dit formaat:

```json
[
  {
    "subgroup": "Bekabeling",
    "element": "PVC kabel 3-fase",
    "matchTerms": ["pvc kabel", "3x2.5 kabel", "installatiekabel 3f"]
  },
  {
    "subgroup": "Bekabeling",
    "element": "PVC kabel 1-fase",
    "matchTerms": ["pvc kabel 1f", "installatiekabel 1f"]
  }
]
```

### Seed script (`scripts/seed-catalog.ts`)

```typescript
// Draai met: npx ts-node scripts/seed-catalog.ts
// Of: npx tsx scripts/seed-catalog.ts

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import catalogData from './catalog.json'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function embedTerm(term: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: term.toLowerCase(),
  })
  return response.data[0].embedding
}

async function seed() {
  console.log('Seeding catalogus...')

  for (const item of catalogData) {
    // Upsert subgroup
    const { data: subgroup } = await supabase
      .from('subgroups')
      .upsert({ naam: item.subgroup }, { onConflict: 'naam' })
      .select()
      .single()

    // Upsert element
    const { data: element } = await supabase
      .from('subgroup_elements')
      .upsert(
        { naam: item.element, subgroup_id: subgroup.id },
        { onConflict: 'naam,subgroup_id' }
      )
      .select()
      .single()

    // Voeg matchterms toe met embeddings
    for (const termTekst of item.matchTerms) {
      const normalized = termTekst.toLowerCase().trim()
      const embedding = await embedTerm(normalized)

      await supabase.from('match_terms').upsert(
        {
          term: normalized,
          embedding: JSON.stringify(embedding), // pgvector accepteert JSON array
          subgroup_element_id: element.id,
        },
        { onConflict: 'term,subgroup_element_id' }
      )

      console.log(`  ✓ ${item.subgroup} > ${item.element} > "${normalized}"`)
    }
  }

  console.log('Klaar!')
}

seed().catch(console.error)
```

---

## Mappenstructuur (aanvulling op Phase 1)

```text
liner/
├── scripts/
│   ├── catalog.json               ← catalogusdata aangeleverd door gebruiker
│   └── seed-catalog.ts            ← seed script
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── offertes/
│   │   │   │   └── [id]/
│   │   │   │       └── verwerk/
│   │   │   │           └── route.ts   ← UITBREIDEN met matching pipeline
│   │   │   └── match-terms/
│   │   │       └── route.ts           ← POST nieuwe matchterm (feedback loop)
│   │   └── (app)/
│   │       ├── projecten/
│   │       │   └── [id]/
│   │       │       └── offertes/
│   │       │           └── [offerteId]/
│   │       │               └── page.tsx   ← Validatie-UI (Stap 2 scherm)
│   │       └── catalogus/
│   │           └── page.tsx           ← Catalogusbeheer UI
│   ├── lib/
│   │   ├── matching/
│   │   │   ├── fuzzy.ts               ← Fuzzy match engine
│   │   │   └── embeddings.ts          ← Embed tekst + vector search
│   │   └── agents/
│   │       ├── agent1.ts              ← UITBREIDEN met categoryHint output
│   │       └── agent2.ts              ← NIEUW: valideer matches + confidence
```

---

## Fuzzy Match Engine (`lib/matching/fuzzy.ts`)

```typescript
import { distance } from 'fastest-levenshtein'

function tokeniseer(tekst: string): string[] {
  return tekst
    .toLowerCase()
    .split(/[\s\-\/\(\)\[\]\.,:;]+/)
    .filter(t => t.length > 0)
}

function fuzzyGelijkenis(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - distance(a, b) / maxLen
}

export interface FuzzyScoreResultaat {
  score: number          // composiet 0-100
  termCoverage: number
  inputCoverage: number
  avgFuzzy: number
}

export function berekenFuzzyScore(
  input: string,           // CleanDesc van de orderregel
  matchTerm: string        // een MatchTerm uit de catalogus (al lowercase)
): FuzzyScoreResultaat {
  const inputTokens = tokeniseer(input)
  const termTokens = tokeniseer(matchTerm)

  if (inputTokens.length === 0 || termTokens.length === 0) {
    return { score: 0, termCoverage: 0, inputCoverage: 0, avgFuzzy: 0 }
  }

  // Vind voor elke termToken de beste match in inputTokens
  const DREMPEL = 0.8
  let matchedTermTokens = 0
  let matchedInputTokens = new Set<number>()
  let fuzzyScores: number[] = []

  for (const termToken of termTokens) {
    let besteGelijkenis = 0
    let besteIndex = -1

    for (let i = 0; i < inputTokens.length; i++) {
      const gelijkenis = fuzzyGelijkenis(termToken, inputTokens[i])
      if (gelijkenis > besteGelijkenis) {
        besteGelijkenis = gelijkenis
        besteIndex = i
      }
    }

    if (besteGelijkenis >= DREMPEL) {
      matchedTermTokens++
      matchedInputTokens.add(besteIndex)
      fuzzyScores.push(besteGelijkenis)
    }
  }

  const termCoverage = (matchedTermTokens / termTokens.length) * 100
  const inputCoverage = (matchedInputTokens.size / inputTokens.length) * 100
  const avgFuzzy = fuzzyScores.length > 0
    ? (fuzzyScores.reduce((a, b) => a + b, 0) / fuzzyScores.length) * 100
    : 0

  const score = (termCoverage * 0.50) + (inputCoverage * 0.30) + (avgFuzzy * 0.20)

  return { score, termCoverage, inputCoverage, avgFuzzy }
}
```

**Implementatieregel**: Score per MatchTerm berekenen, maar alleen de **hoogste score per SubgroupElement** bewaren. Nooit een lagere score een hogere laten overschrijven.

---

## Embeddings & Vector Search (`lib/matching/embeddings.ts`)

```typescript
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

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
  supabase: ReturnType<typeof createClient>,
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
```

---

## Agent 1 Uitbreiden

Voeg `categoryHint` toe aan het output schema van Agent 1.
Dit is een best-guess subgroup naam — optioneel, mag null zijn.

Pas de prompt aan zodat Claude ook dit veld invult:
```
- categoryHint: string | null (best guess voor de productcategorie, bijv. "Bekabeling", "Bevestiging")
```

---

## Agent 2 (`lib/agents/agent2.ts`)

**Input**: cleanDesc + cleanDetails + top 3 kandidaat SubgroupElements met scores
**Output**: confidence toewijzing + suggestie voor nieuwe MatchTerm

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export interface Agent2Input {
  cleanDesc: string
  cleanDetails: string | null
  kandidaten: {
    subgroupElementId: string
    subgroupNaam: string
    elementNaam: string
    score: number
    matchTerms: string[]
  }[]
}

export interface Agent2Output {
  subgroupElementId: string | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  redenering: string
  suggestedMatchTerm: string | null
}

export async function verwerkAgent2(input: Agent2Input): Promise<Agent2Output> {
  const kandidatenTekst = input.kandidaten
    .map((k, i) =>
      `${i + 1}. ${k.subgroupNaam} > ${k.elementNaam} (score: ${k.score.toFixed(1)})
         Zoektermen: ${k.matchTerms.join(', ')}`
    )
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Je bent een assistent die leveranciersofferteregels categoriseert in een productcatalogus.

Orderregel:
- Omschrijving: ${input.cleanDesc}
- Details: ${input.cleanDetails || 'geen'}

Top kandidaten uit de catalogus:
${kandidatenTekst}

Bepaal welke kandidaat het beste past. Geef je antwoord ALLEEN als JSON object zonder uitleg of markdown:
{
  "subgroupElementId": "<id van de beste kandidaat, of null als geen match>",
  "confidence": "<HIGH | MEDIUM | LOW | NONE>",
  "redenering": "<één zin uitleg voor de gebruiker>",
  "suggestedMatchTerm": "<nieuwe zoekterm als de huidige zoektermen niet goed passen, anders null>"
}

Confidence regels:
- HIGH: score ≥ 70 EN verschil met tweede kandidaat ≥ 15
- MEDIUM: score ≥ 50 OF verschil < 15
- LOW: score 25-49
- NONE: score < 25 of geen goede match`
      }
    ]
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Onverwacht antwoord van Agent 2')

  return JSON.parse(content.text) as Agent2Output
}
```

---

## Verwerkings-Pipeline Uitbreiden (`api/offertes/[id]/verwerk/route.ts`)

Breid de bestaande Route Handler uit. Na Agent 1 en vóór het opslaan van orderregels:

```
Voor elke orderregel:
  1. Agent 1 output: cleanDesc, cleanDetails, qty, unit, price, categoryHint
  2. Vector search: zoek top 10 kandidaten op basis van cleanDesc embedding
  3. Fuzzy scoring: bereken composite score voor elke kandidaat MatchTerm
     - Groepeer op SubgroupElement, bewaar hoogste score per element
     - Bewaar ook de tweede hoogste score (voor gap check)
  4. Sla top 3 SubgroupElements op als input voor Agent 2
  5. Agent 2: wijs confidence toe
  6. Sla alles op:
     - orderregel: cleanDesc, confidence, subgroup_element_id, match_reasoning, suggested_match_term
     - fuzzy_scores: één rij per (orderregel, matchterm) combinatie
```

### Auto-match logica

```typescript
function bepaalAutoMatch(topScore: number, secondScore: number): boolean {
  return topScore >= 70 && (topScore - secondScore) >= 15
}
// Als autoMatch === true → confidence = 'HIGH', geen gebruikersreview nodig
// Agent 2 alleen aanroepen voor MEDIUM / LOW kandidaten om kosten te besparen
```

---

## Validatie-UI (`/projecten/[id]/offertes/[offerteId]/page.tsx`)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ← Terug naar project    Offerte: leverancier.pdf   [Export] │
├───────────────────────┬─────────────────────────────────────┤
│ Leverancier omschr.   │ Match resultaat                      │
├───────────────────────┼─────────────────────────────────────┤
│ PVC kabel 3x2.5 grijs │ 🟢 Bekabeling > PVC kabel 3-fase    │
│                       │    Score: 87 | HIGH | Auto ✓        │
├───────────────────────┼─────────────────────────────────────┤
│ Montageprofiel 41/21  │ 🟡 Bevestiging > Montageprofiel     │
│                       │    Score: 61 | MEDIUM               │
│                       │    [Bevestigen] [Wijzigen] [Overslaan]│
├───────────────────────┼─────────────────────────────────────┤
│ XYZABC 993-44-B       │ 🔴 Geen match | NONE                │
│                       │    [Handmatig selecteren]            │
└───────────────────────┴─────────────────────────────────────┘
```

### Gedrag per confidence niveau

- **HIGH**: toon groen vinkje, geen actie vereist
- **MEDIUM**: toon pre-geselecteerde match + drie knoppen: Bevestigen / Wijzigen / Overslaan
- **LOW**: toon match-suggestie maar niet pre-geselecteerd + zelfde knoppen
- **NONE**: toon "Geen match gevonden" + knop "Handmatig selecteren" → opent dropdown met volledige catalogus

### "Wijzigen" flow

Opent een `MatchSelector` component:
- Zoekbalk die live filtert op subgroups + elements
- Toon subgroup naam als groepheader
- Selecteer element → sla op als `override_element_id`

### Voortgangsindicator

Boven de tabel: `X van Y regels bevestigd` als progress bar.
Knop "Export" is disabled zolang er nog MEDIUM/LOW/NONE regels zijn zonder beslissing.

---

## Feedback Loop (`api/match-terms/route.ts`)

Wanneer een gebruiker een match corrigeert of een NONE regel handmatig toewijst:

```typescript
// POST /api/match-terms
// Body: { term: string, subgroupElementId: string, orderegelId: string }

// 1. Normaliseer term naar lowercase
// 2. Check of de term al bestaat voor dit element (voorkom duplicaten)
// 3. Genereer embedding via OpenAI
// 4. Sla op in match_terms met toegevoegd_door_feedback = true
// 5. Update orderregel: override_element_id + validated_at + validated_by
```

**Implementatieregel**: Nooit MatchTerms verwijderen — alleen toevoegen.

---

## Catalogusbeheer UI (`/catalogus/page.tsx`)

Eenvoudige beheerpagina voor de catalogus. Geen complexe features in Phase 2.

### Layout

- Accordion per Subgroup
- Per Subgroup: lijst van SubgroupElements
- Per Element: lijst van MatchTerms als badges
- Knop "Nieuw element" per subgroup
- Knop "Nieuwe zoekterm" per element
- Geen delete functionaliteit (bewust — data-integriteit)

---

## Bouwvolgorde Phase 2

- [ ] **Stap 1** — Database uitbreiden
  - SQL uitvoeren: nieuwe tabellen, pgvector index, RPC functie
  - RLS policies toevoegen
  - `orderregels` tabel uitbreiden met nieuwe kolommen

- [ ] **Stap 2** — Seed script
  - `catalog.json` plaatsen in `scripts/`
  - `seed-catalog.ts` bouwen en draaien
  - Verificeer in Supabase table editor dat data + embeddings correct zijn

- [ ] **Stap 3** — Fuzzy match engine
  - `lib/matching/fuzzy.ts` bouwen
  - Schrijf unit tests: `berekenFuzzyScore('pvc kabel 3x2.5', 'pvc kabel')` → score ~75

- [ ] **Stap 4** — Embeddings + vector search
  - `lib/matching/embeddings.ts` bouwen
  - Test via een korte script: embed een term, roep de RPC aan, check resultaten

- [ ] **Stap 5** — Agent 1 uitbreiden
  - Voeg `categoryHint` toe aan output schema en prompt

- [ ] **Stap 6** — Agent 2 bouwen
  - `lib/agents/agent2.ts`
  - Test los met een paar voorbeeldinputs

- [ ] **Stap 7** — Pipeline uitbreiden
  - `api/offertes/[id]/verwerk/route.ts` aanpassen
  - Voeg vector search + fuzzy scoring + Agent 2 toe na Agent 1
  - Test end-to-end met een echte offerte

- [ ] **Stap 8** — Validatie-UI
  - `/projecten/[id]/offertes/[offerteId]/page.tsx`
  - Voeg link toe vanuit de offerte-kaart op de project detail pagina

- [ ] **Stap 9** — Feedback loop
  - `api/match-terms/route.ts`
  - Koppel aan de "Wijzigen" en "Handmatig selecteren" acties in de UI

- [ ] **Stap 10** — Catalogusbeheer UI
  - `/catalogus/page.tsx`
  - Voeg link toe in de navigatie

---

## Implementatieregels Phase 2

1. **Lowercase altijd**: MatchTerm.term opslaan én vergelijken altijd in lowercase.
2. **Score nooit overschrijven**: bij het groeperen op SubgroupElement altijd de hoogste score bewaren.
3. **SecondBest bijhouden**: voor de gap-check heb je zowel de hoogste als de tweede score nodig.
4. **Embed bij aanmaken**: zodra een nieuwe MatchTerm wordt opgeslagen, direct embedding genereren.
5. **Agent 2 alleen voor twijfelgevallen**: als auto-match logica HIGH geeft, sla Agent 2 over.
6. **Geen MatchTerms verwijderen**: feedback loop is altijd additief.
7. **Service Role Key**: gebruik die in alle server-side routes die embeddings genereren of data schrijven.
8. **Supabase RPC voor vector search**: gebruik de `zoek_match_terms` functie, geen raw SQL strings in de app code.

---

## Wat valt BUITEN Phase 2

- Export naar verkoopofferte (Excel/JSON) → Phase 3
- Scanned PDF support (OCR) → Phase 3
- Gebruikersbeheer / rollen → Phase 3
- Klantportaal → later

---

*Phase 2 — Liner @ The Doc — Maart 2026*