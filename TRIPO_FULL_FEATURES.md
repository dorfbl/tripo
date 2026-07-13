# TRIPO — Full Product Features Document

**Last updated:** 2026-07-11  
**Product name:** TRIPO  
**Tagline:** תכנון טיולים קבוצתיים  
**Production URL:** `https://trip.kefar-sava.co.il`  
**Language / direction:** Hebrew, RTL everywhere  

This document describes **everything the app currently does** — every major page, option, role, limit, integration, and API surface — based on the live codebase (not older design notes).

---

## Table of contents

1. [What TRIPO is](#1-what-tripo-is)
2. [Product principles](#2-product-principles)
3. [Tech stack & architecture](#3-tech-stack--architecture)
4. [Navigation structure](#4-navigation-structure)
5. [Complete page catalog](#5-complete-page-catalog)
6. [Feature modules (deep dive)](#6-feature-modules-deep-dive)
7. [Roles & permissions](#7-roles--permissions)
8. [Subscriptions & limits](#8-subscriptions--limits)
9. [Super admin](#9-super-admin)
10. [AI system](#10-ai-system)
11. [Offline & PWA](#11-offline--pwa)
12. [Data model](#12-data-model)
13. [API reference](#13-api-reference)
14. [External integrations](#14-external-integrations)
15. [Design system](#15-design-system)
16. [End-to-end user journeys](#16-end-to-end-user-journeys)
17. [What is not in the product](#17-what-is-not-in-the-product)
18. [Ops & deploy](#18-ops--deploy)

---

## 1. What TRIPO is

TRIPO is a **Hebrew, mobile-first Progressive Web App** for **group trip coordination**.

### The problem it solves

Group trip planning usually lives in WhatsApp: flight PDFs, hotel links, “who owes whom”, “what did we decide?”, “what are we doing tomorrow?”, and photos of restaurants — all scattered, unsearchable, and lost after the trip.

### The product answer

TRIPO is **one shared trip hub** for the full lifecycle:

| Phase | What TRIPO covers |
|-------|-------------------|
| **Before** | Invite friends, vote on decisions, save bookings/docs, vote on activities, build schedule & map |
| **During** | Home dashboard (today’s plan, weather, flights), log expenses, pin places, notifications, offline use |
| **After** | Settlements (who pays whom), timeline of memories + AI day recaps, finished trip archive |

### Core idea (one sentence)

**Not a todo app — a shared timeline of group experience: from decision → booking → day plan → spend → memory.**

---

## 2. Product principles

| Principle | In practice |
|-----------|-------------|
| Shared hub, not chat | One source of truth per trip |
| Hebrew + RTL | All UI copy, errors, dates, layout |
| Mobile-first | Bottom nav, sheets, safe-area, large touch targets |
| Trip-scoped data | Almost everything belongs to a `tripId` |
| Roles matter | Admins manage members, trip settings, pins, AI trip switch |
| Multi-currency | Expenses + trip default currency + live FX |
| Optional AI | Timeline polish, multi-day recaps, smart notifications — toggleable per user & trip |
| Quotas | FREE / PRO / BUSINESS limit trips, members, AI calls, storage |
| Lightweight group tools | Cards, votes, maps — not enterprise PM |

---

## 3. Tech stack & architecture

### Frontend (`client/`)

| Layer | Technology |
|-------|------------|
| Framework | React + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v3 |
| Routing | React Router |
| State | Zustand (`authStore`, `tripStore`, `activeTripStore`, `offlineStore`) |
| HTTP | Axios (`Authorization: Bearer <JWT>`) |
| Maps | Google Maps (`@react-google-maps/api`) |
| Drag & drop | `@dnd-kit` (planner schedule) |
| Offline | IndexedDB (`tripo-offline`) + mutation queue |
| PWA | `vite-plugin-pwa` (service worker, installable) |

### Backend (`server/`)

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + Express 5 |
| Language | TypeScript (`ts-node-dev` in prod via pm2) |
| Database | PostgreSQL |
| ORM | Prisma 5 |
| Auth | JWT + bcrypt |
| Uploads | Multer → `/home/dor/tripo/uploads/` |
| Image processing | Sharp (avatars, place photos) |
| AI | Anthropic Claude (`claude-sonnet-4-5-20250929`) |
| Port | **3018** (pm2 process `tripo-server`) |

### High-level architecture

```
┌──────────────────────────────────┐
│  React PWA (client/dist)         │
│  Hebrew RTL · 5-tab bottom nav   │
│  Zustand + axios + IndexedDB     │
└───────────────┬──────────────────┘
                │ HTTPS /api/*
┌───────────────▼──────────────────┐
│  Express API                     │
│  JWT middleware · controllers    │
│  services: AI, flights, weather  │
│  limits, timeline, notifications │
└───────────────┬──────────────────┘
                │
┌───────────────▼──────────────────┐
│  PostgreSQL (Prisma)             │
│  Users, Trips, Expenses, Places, │
│  Decisions, Links, Planner,      │
│  Timeline, Flights, Notifications│
│  Plans, UsageMonth               │
└──────────────────────────────────┘
         │
         ├── uploads/avatars
         ├── uploads/places
         ├── uploads/links
         └── uploads/planner
```

### Unified trip items

`TripItem` is a shared conceptual object that can back:

- Map places (`TripPlace`)
- Planner activities (`PlannerActivity`)
- Planner calendar events (`PlannerEvent`)

Same “thing” (e.g. a restaurant) can exist across map + schedule without full conceptual duplication.

---

## 4. Navigation structure

### 4.1 Bottom navigation (5 tabs)

Shown when a trip is active (`AppShell` + `BottomNav`). Last-used tab and plan sub-tab are **remembered** in `activeTripStore` and restored when re-opening a trip.

| Tab ID | Hebrew label | Primary route | Purpose |
|--------|--------------|---------------|---------|
| `home` | **בית** | `/trip/:id/home` | Live trip dashboard |
| `plan` | **תכנון** | `/trip/:id/plan/*` | Decisions, activity votes, schedule |
| `map` | **מפה** | `/trip/:id/map` | Shared places map |
| `money` | **כסף** | `/trip/:id/expenses` | Expenses & settlements |
| `trip` | **טיול** | `/trip/:id/hub` | Members, settings, links, timeline |

### 4.2 Plan sub-tabs (`PlanSubNav`)

Under **תכנון**:

| Sub-tab | Hebrew | Route | Page |
|---------|--------|-------|------|
| `decisions` | ✅ החלטות | `/trip/:id/plan/decisions` | `DecisionsPage` |
| `activities` | 🗳️ פעילויות | `/trip/:id/plan/activities` | `QuestionnairePage` |
| `schedule` | 📅 לוח זמנים | `/trip/:id/plan/schedule` | `PlannerPage` |

Default plan entry (`/trip/:id/plan`) redirects to **החלטות**.

### 4.3 Global / non-trip routes

| Route | Page | Auth |
|-------|------|------|
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/join/:inviteCode` | Join trip | Public URL (joins when logged in) |
| `/` | Dashboard (trip list) | Protected |
| `/create-trip` | Create trip | Protected |
| `/profile` | Profile & settings | Protected |
| `/profile/edit` | Edit profile | Protected |
| `/notifications` | Notification center | Protected |
| `/subscription` | Plan & quotas | Protected |
| `/admin/plans` | Super-admin plans | Protected + super admin |

### 4.4 Trip-scoped routes

| Route | Page |
|-------|------|
| `/trip/:id` | Smart redirect → last tab |
| `/trip/:id/home` | Home dashboard |
| `/trip/:id/hub` | Trip hub |
| `/trip/:id/timeline` | Timeline |
| `/trip/:id/plan/decisions` | Decisions list |
| `/trip/:id/plan/decisions/new` | Create decision |
| `/trip/:id/plan/activities` | Activity voting quiz |
| `/trip/:id/plan/schedule` | Planner schedule |
| `/trip/:id/map` | Map |
| `/trip/:id/expenses` | Expenses |
| `/trip/:id/expenses/new` | New expense |
| `/trip/:id/expenses/edit/:expenseId` | Edit expense |
| `/trip/:id/links` | Links |
| `/trip/:id/links/new` | Create link |
| `/trip/:id/links/edit/:linkId` | Edit link |

### 4.5 Legacy redirects (bookmarks still work)

| Old path | New path |
|----------|----------|
| `/trip/:id/decisions` | `/trip/:id/plan/decisions` |
| `/trip/:id/decisions/new` | `/trip/:id/plan/decisions/new` |
| `/trip/:id/planner` | `/trip/:id/plan/schedule` |
| `/trip/:id/questionnaire` | `/trip/:id/plan/activities` |

### 4.6 Shell chrome

- **Navbar** — trip context, profile entry, **notification bell** (unread badge)
- **Offline chip** — shows offline / pending sync status above bottom nav
- **Safe-area** padding for iOS notch / home indicator
- Focus / visibility refresh: when app returns to foreground, trips reload

---

## 5. Complete page catalog

### Auth

| Page | File | What the user can do |
|------|------|----------------------|
| Login | `LoginPage.tsx` | Email + password → JWT stored in localStorage |
| Register | `RegisterPage.tsx` | Name, email, password (min 6) → account + JWT |

### Trip selection

| Page | File | What the user can do |
|------|------|----------------------|
| Dashboard | `DashboardPage.tsx` | List trips; create trip; join by invite code; auto-open last/only trip; force “all trips” via profile |
| Create trip | `CreateTripPage.tsx` | Name a new trip (creator becomes ADMIN/owner); subject to trip quota |
| Join | `JoinPage.tsx` | Join via `/join/:inviteCode` deep link |

### Trip hub tabs

| Page | File | What the user can do |
|------|------|----------------------|
| Home | `HomePage.tsx` | See today’s schedule, open decisions, money snapshot, weather, flights, assistant tips, timeline preview; add/refresh flights; offline prefetch |
| Trip hub | `TripPage.tsx` | Members list; invite copy; admin edit name/dates/status; currency; AI trip toggle; roles; remove members; open links & timeline |
| Timeline | `TimelinePage.tsx` | Filterable story of the trip; add memories; AI multi-day recap; delete own/admin events |
| Decisions | `DecisionsPage.tsx` | List/vote/close/reopen/delete decisions; results; secret votes |
| Create decision | `CreateDecisionPage.tsx` | New decision wizard (type, options, category, privacy flags) |
| Activities quiz | `QuestionnairePage.tsx` | Vote MUST→AGAINST on planner activities; results by category |
| Planner | `PlannerPage.tsx` | Activity bank + multi-day calendar; drag/resize; files; templates |
| Map | `MapPage.tsx` | Google Map markers; search/add places; photos; day assignment; reorder |
| Expenses | `ExpensesPage.tsx` | List expenses; settlements; one-tap repayments |
| Expense form | `ExpenseFormPage.tsx` | Add/edit expense (payer, split, multi-currency, FX) |
| Links | `LinksPage.tsx` | Filterable catalog of URLs/files; pin; status |
| Create/Edit link | `CreateLinkPage` / `EditLinkPage` | Full link metadata + upload |

### Account

| Page | File | What the user can do |
|------|------|----------------------|
| Profile | `ProfilePage.tsx` | Avatar, AI personal toggle, notifications, subscription, super-admin entry, edit profile, all trips, logout |
| Edit profile | `EditProfilePage.tsx` | Change name; upload avatar |
| Notifications | `NotificationsPage.tsx` | Inbox; mark read / read-all; open deep links; generate smart tips |
| Subscription | `SubscriptionPage.tsx` | Usage bars; plan catalog; switch plan (self-serve demo); super-admin entry |
| Admin plans | `AdminPlansPage.tsx` | Super admin: assign user plans; edit global plan quotas |

---

## 6. Feature modules (deep dive)

### 6.1 Authentication & profile

**Capabilities**

- Register with name, email, password
- Login → long-lived JWT (~365 days)
- `GET /api/auth/me` restores session
- Update profile fields
- Avatar upload (resized/compressed with Sharp; size limit ~5MB)
- Personal **AI toggle** (`user.aiEnabled`) — controls timeline polish + smart notifications for that user
- Logout clears auth + active trip

**Protected routes:** everything except login/register (and invite URL landing).

---

### 6.2 Trips & members

**Trip fields**

| Field | Meaning |
|-------|---------|
| `name` | Display name |
| `startDate` / `endDate` | Trip window (powers weather range, planner days, home “day X of Y”) |
| `status` | `PLAN` · `LIVE` · `FINISHED` · `CANCELED` |
| `inviteCode` | Unique join code / shareable link |
| `defaultCurrency` | Default for new expenses |
| `ownerId` | Creator/owner |
| `aiEnabled` | Trip-level AI master switch (admin) |

**Status labels (UI)**

| Code | Hebrew |
|------|--------|
| PLAN | תכנון / בתכנון |
| LIVE | בדרך! |
| FINISHED | הסתיים |
| CANCELED | בוטל |

**Member roles**

| Role | Meaning |
|------|---------|
| `ADMIN` | Can edit trip, manage members, pin links, close decisions (admin paths), toggle trip AI |
| `MEMBER` | Full content participation (expenses, votes, places, memories…) |

**Admin actions on Trip hub**

- Edit name, start/end dates, status
- Change default currency (ILS, USD, EUR, GBP, CHF, JPY, THB, CZK, HUF, PLN, AUD, CAD…)
- Promote / demote members (`ADMIN` ↔ `MEMBER`)
- Remove members (with confirm; owner protections)
- Toggle **trip AI** on/off
- Copy invite link: `{origin}/join/{inviteCode}`

**Join**

- Dashboard form (paste code)
- Deep link `/join/:inviteCode`
- Subject to **max members per trip** of the trip owner’s plan

**Create trip**

- Subject to **max trips** the user may own/admin
- Creator becomes ADMIN + owner

**Dashboard smart routing**

1. If user has a remembered active trip → open last tab
2. Else if exactly one trip → auto-open it
3. Else show trip list
4. Profile → “כל הטיולים שלי” forces list (`showDashboard: true`)

---

### 6.3 Home dashboard (`בית`)

The operational “during the trip” screen. Loads in parallel:

| Widget | Source | What it shows / does |
|--------|--------|----------------------|
| Trip header | Trip | Name, status, “day X of Y” or days until departure |
| Today’s schedule | Planner events | Events for today with times |
| Open decisions | Decisions | Count of `VOTING` decisions + shortcut |
| Money snapshot | Expenses | Trip total ILS, today’s spend, open settlements |
| Weather | Open-Meteo | Today / tomorrow emoji, temps, rain %; multi-day strip |
| Flights | TripFlight + AviationStack | Flight number, direction, status, boarding countdown; add flight sheet |
| Assistant tips | Rule engine | Severity-ranked tips with deep-link actions |
| Timeline preview | Timeline | Last ~5 events |
| Offline | Prefetch | Caches trip data for offline |

**Add flight sheet (from Home)**

- Flight number (e.g. `LY1`)
- Date
- Direction: `outbound` | `return` | `other`
- Optional departure / arrival airport codes (helps free-tier flight matching)
- Creates DB row + attempts live lookup

**Live flight status (Hebrew labels)**

מתוכנן · באוויר · נחת · בוטל · תקרית · הוסט · מתעכב · עלייה למטוס · לא ידוע  

Notes when API date does **not** match planned date (free-tier AviationStack limitation).

---

### 6.4 Decisions (`החלטות`)

**Purpose:** Replace “what did we actually decide?” WhatsApp chaos.

**Statuses**

| Status | Meaning |
|--------|---------|
| `VOTING` | Open for votes |
| `DECIDED` | Closed with final result |

**Types**

| Type | Behavior |
|------|----------|
| `YES_NO` | Yes / No style |
| `SINGLE_CHOICE` | Pick one option |
| `MULTI_CHOICE` | Pick several options |
| `TOP3` | Rank top 3 preferences (ranked votes) |

**Categories**

`DESTINATION` · `DATES` · `HOTEL` · `TRANSPORT` · `ACTIVITY` · `BUDGET` · `OTHER`

**Advanced options**

- **Secret vote** (`isSecretVote`) — hide who voted for what while open
- **Hide results until closed** (`hideResultsUntilClosed`)
- Due date
- Action note after close
- Final decision text / final option id
- Add options after creation
- Close / reopen
- Delete
- Vote bars, percentages, ranking medals in UI
- Closing can feed **timeline** + **notifications**

**Who can do what (typical)**

- Any member: create, vote, add options (per controller rules)
- Creator / admin: close, reopen, delete (as enforced by API)

---

### 6.5 Activity voting quiz (`פעילויות`)

**Important:** This is **not** the old preference questionnaire + AI destination recommender.

It is a **mobile voting wizard over `PlannerActivity` items**.

**Vote scale**

| Value | Meaning (conceptually) |
|-------|------------------------|
| `MUST` | Must do |
| `OK` | Fine |
| `IF_OTHERS` | Only if others want |
| `NOT_REALLY` | Prefer not |
| `AGAINST` | Strong no |

**UX modes**

1. **Quiz** — one unvoted activity at a time, progress bar
2. **Results** — breakdown per activity, by category tabs
3. **Inline re-vote** — change mind later

**Categories** (examples used in templates / UI grouping)

Often include groups like forest / munich / travel / food / special (demo-oriented Germany trip templates).

**API**

- `GET/POST` planner votes endpoints under `/api/planner/:tripId/votes*`

---

### 6.6 Planner / schedule (`לוח זמנים`)

**Purpose:** Day-by-day schedule + activity bank.

#### Activity bank

- Create / edit / delete activities
- Bulk create
- Fields: name, emoji, location, description, duration (minutes), cost, category, maps URL, website URL, color
- File attachments (images/PDF)
- Search + category filters
- Built-in **templates** (heavily Germany-oriented: Black Forest, Munich, day trips, food, attractions)
- “Add to map” flow (geocode → create place)

#### Calendar

- Multi-day grid from trip `startDate`–`endDate`
- Events: `title`, `date` (YYYY-MM-DD), `startMinute` (minutes from midnight), `durationMins`, `allDay`, color, notes, cost, urls
- Optional link to an activity (`activityId`)
- Drag to move / resize (15-minute snap via dnd-kit)
- Event file attachments
- Desktop-friendly dense UI; available on mobile under plan sub-nav

---

### 6.7 Map (`מפה`)

**Purpose:** Shared map of trip places with photos and day assignment.

**Capabilities**

- Google Map with custom category markers
- Search & add place (geocode)
- Place fields: name, lat/lng, notes, maps URL, date (trip day), category, order
- Photo gallery per place (upload/delete; Sharp compression)
- Reorder places
- Day coloring from trip date range
- Day picker to assign places to days
- Filters by category / search text
- List + map dual UX

**Place categories**

| id | Hebrew label |
|----|--------------|
| `restaurant` | מסעדה |
| `activity` | פעילות |
| `nature` | טבע |
| `hotel` | מלון |
| `transport` | תחבורה |
| `shopping` | קניות |
| `culture` | תרבות |
| `other` | אחר |

**Geocoding**

1. Google Places Autocomplete / details (primary)
2. **Photon** (OpenStreetMap) fallback if Google fails

Adding places can emit **timeline** events (and notifications).

---

### 6.8 Expenses / money (`כסף`)

**Purpose:** Splitwise-style shared money tracking.

#### Expense fields

| Field | Meaning |
|-------|---------|
| `description` | What was bought |
| `amount` | Original amount |
| `currency` | Original currency |
| `exchangeRate` | Units of ILS per 1 currency unit |
| `amountILS` | `amount * exchangeRate` (normalized) |
| `category` | See list below |
| `expenseDate` | When spent |
| `paidByUserId` | Who paid |
| participants | Equal split among selected members |

#### Categories

| id | Hebrew |
|----|--------|
| `food` | אוכל ושתייה |
| `accommodation` | לינה |
| `transport` | תחבורה |
| `activities` | פעילויות |
| `shopping` | קניות |
| `health` | בריאות |
| `other` | אחר |
| `repayment` | סילוק חוב (special) |

#### Currencies supported in UI

ILS, USD, EUR, GBP, CHF, JPY, THB, CZK, HUF, PLN, AUD, CAD  

FX rates fetched via **Frankfurter** (`/api/geocode/rate/:currency`).

#### Tabs / views on Expenses page

1. **Expenses list** — cards with payer, split, category, multi-currency display
2. **Settlements** — who owes whom after netting balances

#### Settlement algorithm

Greedy minimum-transaction balancing on net balances in ILS.

Settlement display is **RTL-correct**: Hebrew names + arrow direction for “from → to” without reversed name order.

#### Repayment

One-tap flow creates a `repayment` expense that reduces/settles a suggested debt.

#### Timeline

Adding expenses can record timeline events + notify members.

---

### 6.9 Centralized links (`קישורים`)

**Purpose:** One index for bookings, PDFs, insurance, payments — nothing lost in chat.

**Entry:** Trip hub → קישורים והזמנות (also under bottom-nav “טיול” context).

#### Link types

`FLIGHT` · `HOTEL` · `CAR` · `ACTIVITY` · `RESTAURANT` · `BAR` · `MAP` · `INSURANCE` · `DOCUMENT` · `PAYMENT` · `OTHER`

#### Link statuses

`SAVED` · `PENDING` · `BOOKED` · `PAID` · `MISSING` · `CANCELLED`

#### Fields & options

| Option | Meaning |
|--------|---------|
| Title | Required display name |
| URL | Optional external link |
| Description / notes | Free text |
| Provider name | e.g. Booking, El Al |
| Start / end dates | Validity / stay / flight window |
| Estimated cost + currency | Budget hint |
| Responsible user | Optional owner of the task |
| **Pinned** | Highlight at top (admin pin) |
| **Private** | Restricted visibility (creator-focused) |
| File upload | PDF / images / Office docs (~10MB) |
| Linked decision | Optional `decisionId` |
| Smart type detection | From URL host (Booking→hotel, Skyscanner→flight, Wise/PayPal→payment, etc.) |

#### Actions

- Filter by type / privacy
- Toggle pin
- Change status
- Edit / delete (creator or admin)
- Uploads count against **user storage quota**

Adding links can emit timeline (`LINK_ADDED` / documents category).

---

### 6.10 Timeline (`ציר זמן`)

**Purpose:** The trip’s story — automatic events + manual memories + AI recaps.

**Entry:** Trip hub → ציר זמן

#### Event types (`TimelineEventType`)

| Type | Typical source |
|------|----------------|
| `MEMBER_JOINED` | Someone joined |
| `DECISION_CLOSED` | Decision closed |
| `LINK_ADDED` | New link/doc |
| `PLACE_ADDED` | Place on map |
| `EXPENSE_ADDED` | Expense logged |
| `PHOTO_UPLOADED` | Place photo |
| `MEMORY` | Manual memory |
| `AI_RECAP` | AI day/multi-day recap |
| `AI_NOTE` | Other AI notes |

#### Filter buckets (UI)

הכל · הוצאות · מקומות · תמונות · החלטות · מסמכים · חברים · זיכרונות · AI  

#### Capabilities

- Infinite / load-more pagination (`before` cursor)
- Day headers: היום / אתמול / full Hebrew date
- Add **memory**: title, description, emoji picker, date
- Private memories (visible to creator)
- Delete own events; admin can delete more broadly (API rules)
- **AI multi-day recap** button (admin-friendly): generates day-by-day `AI_RECAP` events from trip activity
- Marks `aiGenerated` when AI wrote/polished text
- Non-private events can push **in-app notifications** to other members

---

### 6.11 Flights

**Models:** `TripFlight`

| Field | Meaning |
|-------|---------|
| `flightNumber` | e.g. LY315 |
| `flightDate` | Planned date |
| `direction` | outbound / return / other |
| Airline, airports, dep/arr times | Stored + live |
| `liveData` JSON | Last AviationStack payload summary |
| `liveFetchedAt` | Cache time |

**Actions**

- List trip flights
- Create flight
- Refresh live data
- Delete flight

**Live data provider:** AviationStack  

**Free-tier caveats (handled in code)**

- Often cannot filter by future `flight_date`
- May return “landed” for a past occurrence of the same flight number
- App compares API date vs planned date (`dateMatched`) and shows honest status notes in Hebrew
- Manual airport codes improve matching

Shown primarily on **Home**; not a separate bottom-nav tab.

---

### 6.12 Weather

**Provider:** Open-Meteo (free, no API key)

**Input:** lat/lng from first/best trip place; date range from trip dates (or next 7 days)

**Daily fields**

- Weather code → emoji + Hebrew label (בהיר, גשם, שלג, סופה…)
- Temp max / min
- Precipitation probability

**Surfaces**

- Home weather card (today / tomorrow + strip)
- Assistant tip when rain is likely tomorrow

---

### 6.13 Trip assistant (tips)

**Not free-form chat.** A **deterministic tip engine** that inspects trip state and returns actionable cards.

**Severity:** `info` · `warn` · `urgent`

**Example tip topics**

- Open decisions / incomplete votes
- Incomplete activity votes
- Today’s schedule / empty day while LIVE
- Rain tomorrow
- Nearby boarding time for flights
- Missing flight links / sparse map / high unsettled balances (as implemented in service)

Each tip may include `action: { label, path }` deep link into the right tab.

**API:** `GET /api/assistant/:tripId`

---

### 6.14 Notifications

**In-app notification center** (not OS push in the core path described here).

| Field | Meaning |
|-------|---------|
| `type` | system · ai · decision · expense · member · memory · flight … |
| `title` / `body` | Copy |
| `emoji` | Visual |
| `href` | Deep link into app |
| `isRead` | Read state |
| `aiGenerated` | Smart AI copy |
| `tripId` | Optional trip context |

**Sources**

1. **Automatic** — when timeline records meaningful public events (member joined, expense, decision closed, memory…)
2. **Smart generate** — `POST /api/notifications/smart/:tripId` builds AI-polished tips (quota + AI toggles apply)

**UI**

- Bell in navbar with unread count (polls ~60s + on visibility)
- Notifications page: list, mark one read, mark all read, open href, trigger smart generation for a trip

---

### 6.15 Subscriptions & self-serve plan change

See [§8](#8-subscriptions--limits) for limits table.

**Subscription page shows**

- Current plan name + expiry
- Usage bars: trips (as admin/owner), AI calls this month, storage
- Remaining quotas
- Catalog of FREE / PRO / BUSINESS
- Self-serve plan switch (`POST /api/subscription/me/plan`) — demo/admin-style assignment with optional days; **not a payment provider**
- Super-admin shortcut when applicable

---

### 6.16 Super admin plan console

See [§9](#9-super-admin).

---

## 7. Roles & permissions

### Authentication

| Area | Rule |
|------|------|
| Login / register | Public |
| All other API | JWT required |
| Trip content | Must be trip member |

### Trip membership

| Action | MEMBER | ADMIN | Notes |
|--------|--------|-------|-------|
| View trip data | ✅ | ✅ | |
| Join via invite | ✅ | ✅ | If seats remain |
| Create expenses / places / links / decisions / votes / memories | ✅ | ✅ | |
| Edit/delete own content | ✅ | ✅ | Often creator+admin |
| Pin links | | ✅ | |
| Close / reopen decisions | ✅* | ✅ | *creator/admin depending on rules |
| Edit trip name/dates/status/currency | | ✅ | |
| Toggle trip AI | | ✅ | |
| Change roles / remove members | | ✅ | Owner protections |
| Generate AI recap | ✅* | ✅ | Subject to AI + quota |
| Super-admin plan tools | — | — | Email allowlist, not trip role |

### Dual AI gates

AI features require **all** of:

1. Anthropic API key configured on server  
2. User `aiEnabled !== false`  
3. Trip `aiEnabled !== false`  
4. Plan has `aiIncluded` and monthly AI quota remaining  

---

## 8. Subscriptions & limits

### Plan tiers

| Plan | Hebrew name | Max trips (own/admin) | Max members / trip | AI calls / month | Storage | AI included |
|------|-------------|----------------------:|-------------------:|-----------------:|---------|:-----------:|
| **FREE** | חינם | 2 | 6 | 10 | 50 MB | ✅ |
| **PRO** | Pro | 15 | 20 | 150 | 2 GB | ✅ |
| **BUSINESS** | Business | 100 | 50 | 1000 | 20 GB | ✅ |

> Defaults live in `server/src/config/plans.ts`. Super admin can override live values in `PlanConfig` table (15s cache).

### What is enforced

| Limit | When checked |
|-------|----------------|
| Max trips | Creating a trip |
| Max members | Joining a trip (against owner plan) |
| Max AI calls / month | AI recap, smart notifications, polish that records usage |
| Max storage | File uploads (avatars may be lighter; link/planner/place files attribute bytes) |
| Expired paid plan | Treated as FREE after `planExpiresAt` |

### Usage tracking

- Model `UsageMonth` keyed by `userId` + period `YYYY-MM`
- Counters: `aiCalls`, `storageBytesAdded`
- User total storage: `User.storageBytesUsed`

### User plan fields

- `plan`: FREE | PRO | BUSINESS  
- `planExpiresAt`: optional expiry  
- `aiEnabled`: personal preference  

---

## 9. Super admin

### Who

- Default email: **`dorfbl@gmail.com`**
- Override / extend: env `PLAN_ADMIN_EMAILS` (comma-separated)

### Entry points in UI

- Profile → 🛡️ ניהול מנויים (hardcoded email check for menu visibility)
- Subscription page → same (via `isSuperAdmin` from API)
- Route: `/admin/plans` (API still enforces server-side)

### Admin page tabs

#### Tab A — משתמשים

- Search by name / email
- Per user: plan, expiry, AI on/off, storage used, AI calls this month, trips as admin
- Edit sheet:
  - Set FREE / PRO / BUSINESS
  - Expiry in N days **or** never expires
  - Toggle `aiEnabled`

#### Tab B — הגדרת תוכניות

Edit global quotas for FREE / PRO / BUSINESS:

- Hebrew name
- Max trips
- Max members per trip
- Max AI calls / month
- Max storage (bytes / MB)
- AI included flag

### Admin APIs

```
GET   /api/subscription/admin/users?q=
PATCH /api/subscription/admin/users/:userId
GET   /api/subscription/admin/plans
PUT   /api/subscription/admin/plans/:planId
```

Non-super-admins receive **403** Hebrew error.

**Not included:** payment provider, invoices, Stripe/PayPal.

---

## 10. AI system

### Model

- Anthropic Claude Sonnet 4.5 snapshot: `claude-sonnet-4-5-20250929`
- Override via `ANTHROPIC_MODEL`
- Key via `ANTHROPIC_API_KEY`

### What AI does today

| Feature | Description | Counts as AI call? |
|---------|-------------|--------------------|
| Timeline multi-day recap | Admin/user generates day-by-day `AI_RECAP` stories from trip activity | Yes |
| Timeline polish | Optional nicer wording for events | When used |
| Smart notifications | Generate/polish notification digests for a trip | Yes |

### What AI does **not** do (current product)

- Destination recommendation questionnaire (removed)
- Destination cards / voting (removed)
- Free-form chat assistant on Home (assistant is rule-based tips)

### Failure behavior

AI helpers are designed to **fail soft** (return null / skip polish) so primary CRUD never breaks if Anthropic is down or quota is exhausted.

---

## 11. Offline & PWA

### PWA

- Installable (manifest: name TRIPO, icons, standalone, portrait)
- Service worker auto-update (`vite-plugin-pwa`)
- Safe-area aware bottom nav

### Offline layer (`client/src/lib/offline/`)

| Piece | Role |
|-------|------|
| `db.ts` | IndexedDB `tripo-offline` with `cache` + `queue` stores |
| `cacheTrip.ts` | Prefetch trip-related payloads for offline read |
| `sync.ts` | Flush queued mutations when back online |
| `offlineStore` | Online flag, pending list, syncing state, last error |
| `OfflineChip` | Floating status chip + detail sheet; manual flush |

**Behavior**

- When offline: show chip “ללא אינטרנט”; queue mutating requests with labels
- When online with pending: “N ממתינים לסנכרון”
- Sync success clears queue; errors surface in sheet

---

## 12. Data model

### Core

| Model | Purpose |
|-------|---------|
| `User` | Account, plan, AI pref, storage used, avatar |
| `Trip` | Trip shell, status, invite, currency, AI switch |
| `TripMember` | Membership + role |

### Money

| Model | Purpose |
|-------|---------|
| `TripExpense` | Expense with multi-currency + ILS |
| `ExpenseParticipant` | Split participants |

### Places / unified items

| Model | Purpose |
|-------|---------|
| `TripItem` | Shared conceptual item |
| `TripPlace` | Map marker |
| `PlacePhoto` | Gallery images |

### Links & decisions

| Model | Purpose |
|-------|---------|
| `TripLink` | Bookings, docs, URLs |
| `Decision` | Group decision |
| `DecisionOption` | Options |
| `DecisionVote` | Votes (+ optional rank for TOP3) |

### Planner

| Model | Purpose |
|-------|---------|
| `PlannerActivity` | Activity bank item |
| `PlannerActivityVote` | MUST…AGAINST |
| `PlannerActivityFile` | Attachments |
| `PlannerEvent` | Calendar block |
| `PlannerEventFile` | Attachments |

### Live trip extras

| Model | Purpose |
|-------|---------|
| `TripFlight` | Tracked flights + live JSON |
| `TimelineEvent` | Story events |
| `Notification` | Per-user inbox |

### Billing / admin

| Model | Purpose |
|-------|---------|
| `PlanConfig` | Editable plan limits |
| `UsageMonth` | Per-user monthly counters |

### Enums (summary)

- `PlanTier`: FREE, PRO, BUSINESS  
- `TripStatus`: PLAN, LIVE, FINISHED, CANCELED  
- `MemberRole`: ADMIN, MEMBER  
- `TripLinkType` / `TripLinkStatus`  
- `DecisionStatus` / `DecisionType` / `DecisionCategory`  
- `TimelineEventType`  

---

## 13. API reference

Base: `/api/*` · Auth header: `Authorization: Bearer <token>` · Errors: `{ error: string }` in Hebrew.

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create user |
| POST | `/login` | JWT |
| GET | `/me` | Current user |
| PUT | `/profile` | Update profile / aiEnabled |
| POST | `/profile/avatar` | Upload avatar |

### Trips — `/api/trips`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create trip |
| GET | `/` | My trips |
| GET | `/:id` | Trip detail + members |
| POST | `/join/:inviteCode` | Join |
| GET | `/:id/members` | Members list |
| PUT | `/:id` | Update trip (name, dates, status, aiEnabled…) |
| PATCH | `/:id/currency` | Default currency |
| DELETE | `/:id/members/:userId` | Remove member |
| PATCH | `/:id/members/:userId/role` | Change role |

### Expenses — `/api/expenses`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tripId` | Expenses + settlements |
| POST | `/:tripId` | Add expense |
| PUT | `/:expenseId` | Update |
| DELETE | `/:expenseId` | Delete |

### Places — `/api/places`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tripId` | List places |
| POST | `/:tripId` | Add place |
| PUT | `/:tripId/reorder` | Reorder |
| PUT | `/:placeId` | Update place |
| DELETE | `/:placeId` | Delete |
| POST | `/:placeId/photos` | Upload photo |
| DELETE | `/photos/:photoId` | Delete photo |

### Geocode / FX — `/api/geocode`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search?q=` | Place search |
| GET | `/details/:placeId` | Place details |
| GET | `/rate/:currency?to=ILS` | FX rate |

### Decisions — `/api/decisions`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tripId` | List |
| POST | `/:tripId` | Create |
| PUT | `/:decisionId/close` | Close |
| PUT | `/:decisionId/reopen` | Reopen |
| DELETE | `/:decisionId` | Delete |
| POST | `/:decisionId/vote` | Cast vote |
| POST | `/:decisionId/options` | Add option |

### Links — `/api/links`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tripId` | List |
| POST | `/:tripId` | Create |
| POST | `/:tripId/upload` | Upload file |
| PUT | `/:linkId` | Update |
| DELETE | `/:linkId` | Delete |
| PATCH | `/:linkId/pin` | Toggle pin |
| PATCH | `/:linkId/status` | Status |

### Planner — `/api/planner`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tripId` | Activities + events |
| POST | `/:tripId/activities` | Create activity |
| POST | `/:tripId/activities/bulk` | Bulk create |
| PUT | `/:tripId/activities/:actId` | Update |
| DELETE | `/:tripId/activities/:actId` | Delete |
| POST | `/:tripId/activities/:actId/files` | Upload activity file |
| DELETE | `/:tripId/activities/:actId/files/:fileId` | Delete file |
| POST | `/:tripId/events` | Create event |
| PATCH | `/:tripId/events/:eventId` | Update event |
| DELETE | `/:tripId/events/:eventId` | Delete event |
| POST | `/:tripId/events/:eventId/files` | Upload event file |
| DELETE | `/:tripId/events/:eventId/files/:fileId` | Delete file |
| GET | `/:tripId/votes/mine` | My votes |
| GET | `/:tripId/votes` | All votes summary |
| POST | `/:tripId/votes` | Submit votes |

### Timeline — `/api/timeline`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tripId` | Events (`filter`, `limit`, `before`) + AI flags |
| POST | `/:tripId` | Create memory |
| POST | `/:tripId/ai-recap` | Generate AI day recaps |
| DELETE | `/:eventId` | Delete event |

### Weather — `/api/weather`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tripId` | Forecast bundle |

### Flights — `/api/flights`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tripId` | List flights |
| POST | `/:tripId` | Create + live lookup |
| POST | `/item/:flightId/refresh` | Refresh live |
| DELETE | `/item/:flightId` | Delete |

### Assistant — `/api/assistant`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:tripId` | Tip cards |

### Notifications — `/api/notifications`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List + unreadCount |
| POST | `/read-all` | Mark all read |
| POST | `/:id/read` | Mark one read |
| POST | `/smart/:tripId` | Generate smart notifications |

### Subscription — `/api/subscription`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Snapshot + catalog + `isSuperAdmin` |
| POST | `/me/plan` | Self-assign plan (demo) |
| GET | `/admin/users` | Super admin list |
| PATCH | `/admin/users/:userId` | Super admin set user plan |
| GET | `/admin/plans` | Super admin plan configs |
| PUT | `/admin/plans/:planId` | Super admin update quotas |

---

## 14. External integrations

| Service | Purpose | Key / notes |
|---------|---------|-------------|
| **Anthropic Claude** | Timeline recaps, smart notification copy | `ANTHROPIC_API_KEY` |
| **AviationStack** | Live flight status | `AVIATION` / `AVIATIONSTACK_API_KEY` (free tier date limits) |
| **Open-Meteo** | Weather forecast | No key |
| **Google Maps / Places** | Map UI, place search | Browser/server keys as configured |
| **Photon (OSM)** | Geocode fallback | Free |
| **Frankfurter** | Currency FX rates | Free |
| **Local disk uploads** | Avatars, photos, docs | Under `uploads/` |

---

## 15. Design system

| Token | Value / rule |
|-------|----------------|
| Font | Heebo |
| Direction | `rtl` on document |
| Brand primary | `#4F6EF7` (`brand-500`) |
| Brand hover | `#3D5CE0` (`brand-600`) |
| Text | `#171717` primary · `#525252` secondary |
| Background | White / `#FAFAFA` |
| Borders | `#E5E5E5` subtle |
| Radius | `xl` 16px · `2xl` 24px |
| Shadows | Minimal `shadow-sm` |
| Components | `Button`, `Card`, `Input`, `Badge`, `Avatar`, `AppShell`, `BottomNav`, `PlanSubNav`, `NotificationBell`, `OfflineChip` |
| Style rules | No loud gradients; generous padding; mobile cards |

All user-facing strings (including errors) are **Hebrew**.

---

## 16. End-to-end user journeys

### A. Create a group trip

1. Register / login  
2. Create trip (name) — counts toward trip quota  
3. Copy invite link from Trip hub  
4. Friends open `/join/{code}` and join — counts toward member quota of owner  
5. Admin sets dates, status LIVE when ready, default currency  

### B. Decide & book

1. Create decision (hotel / dates / activity)  
2. Everyone votes (secret / hidden results optional)  
3. Close decision → timeline + notifications  
4. Save Booking/flight/insurance under **Links** (pin critical ones)  
5. Upload PDFs  

### C. Shape the itinerary

1. Seed activities (templates or bulk)  
2. Everyone does **פעילויות** vote quiz  
3. Build **לוח זמנים** from favorites  
4. Push highlights to **מפה** with days + photos  

### D. During the trip (Home)

1. Check weather & today’s events  
2. Track flights / boarding windows  
3. Read assistant tips and act  
4. Log meals/taxis under **כסף**  
5. Drop memories on timeline  
6. Work offline if needed; sync later  

### E. After the trip

1. Open settlements → repay  
2. Status → FINISHED  
3. Generate AI day-by-day recaps  
4. Browse timeline filters (photos, decisions, AI)  

### F. Super admin

1. Login as `dorfbl@gmail.com`  
2. Profile → ניהול מנויים  
3. Upgrade a user to PRO with 30 days  
4. Raise FREE AI quota globally if needed  

---

## 17. What is not in the product

Compared to early design docs / future ideas:

| Idea | Status |
|------|--------|
| DB-seeded preference questionnaire (30 personality questions) | **Removed** |
| Claude destination suggestions + destination vote cards | **Removed** |
| Payment gateway for plans | **Not built** (manual/self-assign + super admin) |
| Full post-trip social photo album product | Only place photos + timeline memories |
| PostgreSQL LISTEN/NOTIFY real-time sync | Not the primary path |
| OS push notifications | In-app notifications only (current) |
| Multi-language UI | Hebrew only |

---

## 18. Ops & deploy

| Item | Detail |
|------|--------|
| Client build | `cd client && npm run build` → `client/dist` |
| Server process | pm2 `tripo-server` (`npm run dev` / ts-node-dev) |
| Server port | **3018** |
| Deploy helper | `deploy.sh` (build client + restart pm2) |
| Env file | Repo root `.env` (loaded as `../.env` from server) |
| Important env vars | `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `AVIATION`/`AVIATIONSTACK_API_KEY`, Google keys, `PLAN_ADMIN_EMAILS` |
| Demo seed | `server/scripts/seed-demo-trip.ts` (e.g. Munich / Black Forest for dorfbl) |

---

## Appendix A — Client page → primary API map

| Page | Main APIs |
|------|-----------|
| Login/Register | `/api/auth/*` |
| Dashboard | `/api/trips`, join |
| Home | planner, decisions, expenses, timeline, weather, flights, assistant |
| Trip hub | trips update/members/currency |
| Decisions | `/api/decisions/*` |
| Activities quiz | `/api/planner/.../votes*` |
| Planner | `/api/planner/*` |
| Map | `/api/places/*`, `/api/geocode/*` |
| Expenses | `/api/expenses/*`, FX rate |
| Links | `/api/links/*` |
| Timeline | `/api/timeline/*` |
| Notifications | `/api/notifications/*` |
| Subscription | `/api/subscription/me` |
| Admin plans | `/api/subscription/admin/*` |
| Profile | `/api/auth/me`, profile, avatar |

---

## Appendix B — Bottom line

**TRIPO is a Hebrew group-trip operating system** that lets friends:

1. **Decide** together (votes, secret options, close outcomes)  
2. **Store** bookings & documents (links + files)  
3. **Plan** what to do and when (activity bank, votes, calendar)  
4. **Navigate** where things are (map + photos + days)  
5. **Split** money fairly (multi-currency + settlements)  
6. **Operate live** (home dashboard, weather, flights, tips)  
7. **Remember** (timeline + AI recaps)  
8. **Work offline** (cache + queue)  
9. **Stay within plans** (FREE / PRO / BUSINESS + super-admin control)  

It is a substantial full-stack product oriented around real group travel logistics — not chat noise.

---

*Document generated from the live TRIPO codebase. Prefer this file over older summaries when they conflict (e.g. outdated 5-tab labels, removed destination AI flow).*
