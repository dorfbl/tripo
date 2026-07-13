# TRIPO — AI features & token costs

**Model:** `claude-sonnet-4-5-20250929` (override with `ANTHROPIC_MODEL`)  
**Default price assumptions** (set real rates via env):

| | USD / 1M tokens |
|--|--:|
| Input | `$AI_PRICE_INPUT_PER_MTOK` default **3** |
| Output | `$AI_PRICE_OUTPUT_PER_MTOK` default **15** |

Confirm live prices: https://www.anthropic.com/pricing

---

## What uses Claude (and what does not)

### LIVE — wired to product

| Feature key | When it runs | API / UI | max_tokens | Notes |
|-------------|--------------|----------|------------|--------|
| **`timeline_day_stories`** | User taps AI recap on timeline | `POST /api/timeline/:tripId/ai-recap` · Timeline page | **2500** | One call → day-by-day story cards for up to **14** days of events |
| **`notification_polish`** | “התראות חכמות” when AI allowed | `POST /api/notifications/smart/:tripId` | **1024** | Polishes rule-based assistant tips into friendlier Hebrew. Some tip types are **not** sent to AI (schedule overlap, hours conflicts) |
| **`ai_schedule`** | Planner “AI סידור לפי הצבעות” | `POST /api/planner/:tripId/ai-schedule` then apply | **3500** | Builds draft calendar from votes + trip days; user OK/Cancel. Apply does **not** call Claude again |

Each successful product call also increments **`UsageMonth.aiCalls`** via `recordAiCall` (plan quota).

### CODE exists — not primary UI path

| Feature key | Function | max_tokens | Status |
|-------------|----------|------------|--------|
| **`timeline_line_polish`** | `polishTimelineLine()` | 1024 | Optional single timeline line polish — **not hooked** to create flows currently |
| **`smart_notifications_digest`** | `generateSmartNotifications()` | 1024 | Free-form 1–3 digests from context string — **not** the main smart-notif path |

### NOT AI (rules / external APIs only)

- Decisions & voting  
- Opening-hours checks (Google Places + heuristics)  
- Assistant tip **engine** (before optional polish)  
- Flights (AviationStack), weather (Open-Meteo), settlements, maps  

There is **no** “AI decisions suggestions” feature in the current codebase.

---

## How to measure tokens yourself

Every Anthropic call now logs:

```text
[ai:tokens] <feature> model=… in=… out=… total=… ~$… ok=true
```

Usage is also accumulated in-process (`getAiUsageLog()` / `summarizeAiUsage()`).

### Benchmark script (runs all Claude features)

```bash
cd server
npx ts-node --transpile-only scripts/ai-token-benchmark.ts
npx ts-node --transpile-only scripts/ai-token-benchmark.ts --trip=<TRIP_ID>
```

---

## Sample run (טיול חברים 40 — sparse timeline)

| Feature | Input | Output | Total | Est. USD* |
|---------|------:|-------:|------:|----------:|
| timeline_day_stories | 457 | 281 | 738 | $0.0056 |
| timeline_line_polish | 121 | 60 | 181 | $0.0013 |
| notification_polish | 430 | 399 | 829 | $0.0073 |
| smart_notifications_digest | 488 | 332 | 820 | $0.0064 |
| **TOTAL (4 calls)** | **1496** | **1072** | **2568** | **~$0.021** |

\*At $3/M in + $15/M out. Timeline cost **scales with number of days/events** in the prompt (more days → more input + more output).

### Rough product cost per user action

| User action | Claude calls | Typical tokens (order of magnitude) |
|-------------|-------------:|-------------------------------------|
| Timeline AI recap (full multi-day) | 1 | ~700–3000+ total (grows with trip richness) |
| Smart notifications (AI polish) | 0–1 | ~500–1200 total when polish runs |
| Profile AI off / trip AI off / quota | 0 | — |

---

## Plan quota (product limit, not Anthropic)

Defaults (overridable in `PlanConfig`):

| Plan | AI calls / month |
|------|-----------------:|
| FREE | 10 |
| PRO | 150 |
| BUSINESS | 1000 |

One “AI call” in the product = one successful `recordAiCall` (timeline recap or notification polish), **not** equal to token count.

---

## Logging forever in production

Token lines already print to server logs on every call. To export:

```bash
pm2 logs tripo-server --lines 500 | grep '\[ai:tokens\]'
```
