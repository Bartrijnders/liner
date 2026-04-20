# AI PDF Processing — Troubleshooting Guide

## The Problem We Ran Into

When uploading large supplier quotes (7+ pages), the AI extraction step would either:
- **Fail silently** — status stuck on "processing" forever
- **Return a parse error** — `Geen geldige JSON array in het antwoord van Agent 1`
- **Extract too few items** — consistently 54 out of 84 order lines

All three symptoms had the same root cause.

---

## Root Cause: Output Token Limits

The AI model (Claude Haiku) has a hard **output token limit of 8,192 tokens**.

Each extracted order line requires roughly **150 output tokens** (JSON object with 10 fields).

| Items in quote | Tokens needed | Haiku limit | Result |
|---|---|---|---|
| 30 items | ~4,500 tokens | 8,192 | ✅ Works |
| 54 items | ~8,100 tokens | 8,192 | ⚠️ Near limit |
| 84 items | ~12,600 tokens | 8,192 | ❌ Truncated |

When Haiku hit the limit mid-JSON, the response was cut off — no closing `]` — causing the JSON parser to fail.

---

## What We Tried (and Why It Didn't Work)

### 1. Chunking the PDF
Split the PDF text into 8k-character pieces and process each separately.

**Why it failed:** The items weren't spread evenly across chunks. Each chunk still contained enough items to hit the 8,192 token output limit on its own. 84 items ÷ 6 chunks = ~14 items/chunk × 150 tokens = 2,100 tokens per chunk — this should have worked, but in practice the distribution was uneven and some chunks had many more items than others.

The deeper issue: chunking adds complexity (boundary items get missed, deduplication by description removes legitimate duplicate items like "PVC kabel" ordered twice) without solving the actual ceiling.

### 2. Adding Chunk Overlap + Deduplication
Added 800-character overlap between chunks so boundary items appeared in both.

**Why it made things worse:** Deduplication matched on `omschrijving` (item description). A real quote often has the same article ordered multiple times with different quantities — deduplication by name alone removed legitimate rows.

---

## The Fix

Switch from **Claude Haiku** to **Claude Sonnet 4.6**, which has a **64,000 output token limit** — enough for any realistic supplier quote.

Process the **entire PDF in a single API call** using streaming (`client.messages.stream()`), which is required by the Anthropic SDK for large output requests.

```
84 items × 150 tokens = 12,600 tokens  →  well within Sonnet's 64k limit
```

The Vercel function timeout also needed to be raised from 60s to 300s (requires Vercel Pro) because Sonnet + streaming on a large PDF takes longer than 60 seconds.

### Final configuration in `src/lib/agents/agent1.ts`

```typescript
const stream = client.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 16000,   // 16k is sufficient; Sonnet supports up to 64k
  ...
})
const response = await stream.finalMessage()
```

### Final configuration in `src/app/api/offertes/[id]/verwerk/route.ts`

```typescript
export const maxDuration = 300  // Vercel Pro required for >60s
```

---

## Rules of Thumb for the Future

| Situation | Recommendation |
|---|---|
| Extraction produces fewer items than expected | Check `stop_reason` in logs — if `max_tokens`, raise the limit or switch to a model with a higher ceiling |
| Switching models for "speed" | Haiku is fast but limited (8k output). Sonnet is slower but handles large outputs. Match the model to the task. |
| Chunking as a workaround | Only use chunking if the **input** is too large. Never use it to work around an **output** limit — it doesn't help and adds bugs. |
| Streaming requirement | The Anthropic SDK requires streaming (`client.messages.stream()`) when `max_tokens` is high enough that the request could take >10 minutes. Always use streaming for large output calls. |
| Vercel timeout | Default Vercel timeout is 60s (Hobby) / 300s (Pro). AI calls on large documents can exceed 60s. Set `export const maxDuration = 300` and ensure the project is on Vercel Pro. |

---

## Model Output Limits (as of April 2026)

| Model | Max output tokens |
|---|---|
| claude-haiku-4-5 | 8,192 |
| claude-sonnet-4-6 | 64,000 |
| claude-opus-4-7 | 32,000+ |

Always verify limits at [docs.anthropic.com](https://docs.anthropic.com) — these change between model versions.
