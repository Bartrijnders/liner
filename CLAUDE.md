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