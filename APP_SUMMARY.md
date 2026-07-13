# TRIPO — Full Application Summary

**TRIPO** (also referred to historically as TripTogether / Tripo) is a Hebrew, RTL-first **Progressive Web App (PWA)** for **group trip planning and coordination**.

Its core idea: instead of losing decisions, bookings, money, maps, and plans inside WhatsApp threads, the group gets **one shared place** for the whole trip lifecycle — planning, during the trip, and after.

**Live / production host:** `https://trip.kefar-sava.co.il`  
**Product name in the PWA manifest:** `TRIPO`  
**Tagline:** תכנון טיולים קבוצתיים (group trip planning)

---

## 1. What the app does (in plain language)

TRIPO lets a group of friends:

1. **Create a shared trip** and invite others with a code/link  
2. **Manage members** (admins / members)  
3. **Vote and close group decisions** (destination, hotel, activities, budget, etc.)  
4. **Keep all important links & documents** in one place (flights, hotels, PDFs, insurance…)  
5. **Split expenses** like Splitwise (multi-currency + settlement suggestions)  
6. **Build a trip map** of places with photos, categories, and day assignment  
7. **Plan a day-by-day schedule** (calendar + activity bank + drag & drop)  
8. **Vote on activities** via a quiz-style “questionnaire” flow  
9. **Use it on mobile as an installable app** (PWA, bottom navigation, safe-area support)

It is **not** a generic todo app. It is a **shared trip hub** for coordination, money, decisions, and logistics.

---

## 2. High-level product principles

| Principle | What it means in practice |
|-----------|---------------------------|
| Shared hub, not chat | One source of truth for the trip |
| Hebrew + RTL everywhere | UI copy, errors, dates, layout |
| Mobile-first | Bottom nav, full-screen sheets, touch targets |
| Lightweight group tools | Cards & votes, not enterprise project management |
| Multi-currency ready | Expenses + trip default currency |
| Trip-scoped data | Almost everything belongs to a `tripId` |
| Roles matter | Admins can manage members, pin links, close decisions, etc. |

---

## 3. Tech stack

### Frontend (`client/`)

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS v3 |
| Routing | React Router v7 |
| State | Zustand (`authStore`, `tripStore`, `activeTripStore`) |
| HTTP | Axios |
| Maps UI | Google Maps (`@react-google-maps/api`); Leaflet also present as a dependency |
| Drag & drop | `@dnd-kit` (used in planner/map-related UX) |
| PWA | `vite-plugin-pwa` (auto-update service worker, installable icons) |

### Backend (`server/`)

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + Express 5 |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 5 |
| Auth | JWT + bcrypt |
| Uploads | Multer (disk storage under `/home/dor/tripo/uploads/`) |
| Images | Sharp (resize/compress avatars & place photos) |
| FX rates | Frankfurter API (`/api/geocode/rate/:currency`) |
| Geocoding | Google Places (primary) + Photon fallback |

### Ops / deploy

- Client build → `client/dist`
- Server process → **pm2** (`tripo-server`, port **3018**)
- Deploy script: `deploy.sh` (build client + restart pm2)
- CORS allowlist includes production domain + local Vite ports

---

## 4. Architecture overview

```
┌─────────────────────────────┐
│  React PWA (client)         │
│  Hebrew RTL · bottom nav    │
│  Zustand + axios + JWT      │
└──────────────┬──────────────┘
               │ /api/*
┌──────────────▼──────────────┐
│  Express API (server)       │
│  JWT middleware             │
│  Controllers + Prisma       │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  PostgreSQL                 │
│  Users, Trips, Expenses,    │
│  Places, Decisions, Links,  │
│  Planner, TripItems…        │
└─────────────────────────────┘
         │
         ├── uploads/avatars
         ├── uploads/places
         ├── uploads/links
         └── uploads/planner
```

### Unified trip items

There is a **`TripItem`** model that acts as a shared source of truth for:

- Map places (`TripPlace`)
- Planner activities (`PlannerActivity`)
- Planner calendar events (`PlannerEvent`)

This allows the same conceptual “thing” (e.g. a restaurant or activity) to be linked across map + schedule without full duplication.

---

## 5. Main user flows

### A. Register / login

1. User registers with **name, email, password** (min 6 chars)
2. Server hashes password (bcrypt), returns **JWT** (long-lived, ~365 days)
3. Client stores token and sends `Authorization: Bearer <token>`
4. User can later edit profile + upload avatar

### B. Create or join a trip

1. Create trip: name (+ optional dates later)
2. Creator becomes **ADMIN** / owner
3. Trip gets unique **`inviteCode`**
4. Others join via:
   - Invite code on dashboard, or
   - Route `/join/:inviteCode`
5. Dashboard auto-selects:
   - Last active trip, or
   - The only trip if the user has exactly one

### C. During the trip lifecycle

Statuses:

| Status | Hebrew label | Meaning |
|--------|--------------|---------|
| `PLAN` | תכנון | Planning |
| `LIVE` | בדרך! | Trip is ongoing |
| `FINISHED` | הסתיים | Completed |
| `CANCELED` | בוטל | Canceled |

Admins can edit name, dates, status, default currency, member roles, and remove members.

### D. Coordinate, plan, spend, navigate

Typical group loop:

```
Invite friends
   → Vote on decisions
   → Save bookings/links/docs
   → Vote on activities (questionnaire)
   → Build planner schedule
   → Pin places on map
   → Log shared expenses & settle
```

---

## 6. Features in detail

### 6.1 Authentication & profile

**Pages:** `LoginPage`, `RegisterPage`, `ProfilePage`, `EditProfilePage`

**Capabilities:**

- Register / login
- JWT auth on protected routes
- `GET /api/auth/me`
- Update profile name/details
- Avatar upload (images resized with Sharp; max ~5MB)
- Auto-refresh trip data when app returns to focus (important for iOS PWA)

**API:**

```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
PUT  /api/auth/profile
POST /api/auth/profile/avatar
```

---

### 6.2 Trips & members

**Pages:** `DashboardPage`, `CreateTripPage`, `TripPage`, `JoinPage`

**Capabilities:**

- List user’s trips
- Create trip
- Join via invite code
- Trip info hub (members, invite sharing, status)
- Copy invite code / share
- Admin: edit trip name/dates/status
- Admin: set **default currency** (ILS, USD, EUR, GBP, CHF, JPY, THB, CZK, HUF, PLN, AUD, CAD…)
- Admin: promote/demote members (`ADMIN` / `MEMBER`)
- Admin: remove members (with owner protections)
- Active trip remembered in client store (`activeTripStore`) for bottom navigation

**API:**

```
POST   /api/trips
GET    /api/trips
GET    /api/trips/:id
POST   /api/trips/join/:inviteCode
GET    /api/trips/:id/members
PUT    /api/trips/:id
PATCH  /api/trips/:id/currency
DELETE /api/trips/:id/members/:userId
PATCH  /api/trips/:id/members/:userId/role
```

---

### 6.3 Decisions (החלטות)

**Purpose:** Replace “what did we actually decide?” chaos from WhatsApp.

**Pages:** `DecisionsPage`, `CreateDecisionPage`

**Decision statuses:**

- `VOTING` — open for votes
- `DECIDED` — closed with a final result

**Decision types:**

| Type | Behavior |
|------|----------|
| `YES_NO` | Simple yes/no |
| `SINGLE_CHOICE` | Pick one option |
| `MULTI_CHOICE` | Pick multiple options |
| `TOP3` | Rank top 3 preferences |

**Categories:** Destination, Dates, Hotel, Transport, Activity, Budget, Other

**Advanced options:**

- **Secret vote** (`isSecretVote`) — hide who voted for what
- **Hide results until closed** (`hideResultsUntilClosed`)
- Close / reopen decision
- Add options later
- Show vote bars, percentages, medals for ranking
- Optional link from closed decision into the Links feature (`decisionId`)

**API:**

```
GET    /api/decisions/:tripId
POST   /api/decisions/:tripId
PUT    /api/decisions/:decisionId/close
PUT    /api/decisions/:decisionId/reopen
DELETE /api/decisions/:decisionId
POST   /api/decisions/:decisionId/vote
POST   /api/decisions/:decisionId/options
```

---

### 6.4 Centralized links (קישורים)

**Purpose:** One index for all important trip URLs and files so nothing gets lost in chat.

**Pages:** `LinksPage`, `CreateLinkPage`, `EditLinkPage`

**Link types:**

`FLIGHT`, `HOTEL`, `CAR`, `ACTIVITY`, `RESTAURANT`, `BAR`, `MAP`, `INSURANCE`, `DOCUMENT`, `PAYMENT`, `OTHER`

**Link statuses:**

`SAVED`, `PENDING`, `BOOKED`, `PAID`, `MISSING`, `CANCELLED`

**Capabilities:**

- Title, URL, notes, provider, dates, estimated cost, currency
- Type + status badges
- **Pin** important links (admin)
- **Private** links (visible mainly to creator / restricted access pattern)
- File upload (images, PDF, Word, Excel; up to ~10MB)
- Smart type detection from URL (Booking → hotel, Skyscanner → flight, Wise/PayPal → payment, etc.)
- Filters by type / privacy
- Optional association with a decision
- Creator/admin can edit or delete

**API:**

```
GET    /api/links/:tripId
POST   /api/links/:tripId
POST   /api/links/:tripId/upload
PUT    /api/links/:linkId
DELETE /api/links/:linkId
PATCH  /api/links/:linkId/pin
PATCH  /api/links/:linkId/status
```

---

### 6.5 Expenses (הוצאות) — Splitwise-style

**Purpose:** Shared money tracking during/after the trip.

**Pages:** `ExpensesPage`, `ExpenseFormPage`

**Capabilities:**

- Add / edit / delete expenses
- Who paid
- Which members participated (equal split among selected participants)
- Categories:
  - food, accommodation, transport, activities, shopping, health, other
  - special: `repayment` (settling a debt)
- Expense date
- Multi-currency amounts + **exchange rate**
- Normalized amount in ILS (`amountILS = amount * exchangeRate`)
- Live FX rate fetch via Frankfurter
- Tabs:
  - **Expenses list**
  - **Settlements** (who owes whom)
- Settlement algorithm: minimum-transactions greedy balancing
- One-tap repayment flow that creates a repayment expense

**API:**

```
GET    /api/expenses/:tripId
POST   /api/expenses/:tripId
PUT    /api/expenses/:expenseId
DELETE /api/expenses/:expenseId
```

---

### 6.6 Map (מפה)

**Purpose:** Shared map of trip places, ordered and categorized, with photos.

**Page:** `MapPage` (large, feature-rich UI)

**Capabilities:**

- Google Map with markers
- Add place via search (geocode)
- Place details: name, lat/lng, notes, maps URL, date (day of trip), category, order
- Place categories: restaurant, activity, nature, hotel, transport, shopping, culture, other
- Custom category marker icons
- Day coloring based on trip date range
- Day picker to assign places to trip days
- Photo gallery per place (upload/delete; image compression via Sharp)
- Reorder places
- Search uses:
  1. Google Places Autocomplete (if key works)
  2. Photon fallback if Google fails

**API:**

```
GET    /api/places/:tripId
POST   /api/places/:tripId
PUT    /api/places/:tripId/reorder
PUT    /api/places/:placeId
DELETE /api/places/:placeId
POST   /api/places/:placeId/photos
DELETE /api/places/photos/:photoId

GET    /api/geocode/search?q=...
GET    /api/geocode/details/:placeId
GET    /api/geocode/rate/:currency?to=ILS
```

---

### 6.7 Planner (מתכנן הטיול)

**Purpose:** Day-by-day trip schedule + activity bank.

**Page:** `PlannerPage` (desktop-oriented; linked from trip page on `md+` screens)

**Capabilities:**

#### Activity bank

- Create / edit / delete activities
- Bulk create / seed
- Fields: name, emoji, location, description, duration, cost, category, maps URL, website URL, color
- File attachments (images/PDF)
- Category filters & search
- **Built-in templates** heavily oriented around a Germany trip (Black Forest + Munich + day trips + food + special attractions)
- “Add to map” flow (geocode activity → create place)

#### Calendar / schedule

- Multi-day calendar grid based on trip dates
- Events with start minute + duration (15-minute snap)
- All-day events
- Drag to move / resize events
- Link event to an activity
- Notes, cost, maps URL, website URL
- Event file attachments

#### Activity voting (shared with questionnaire page)

Vote values:

| Vote | Meaning |
|------|---------|
| `MUST` | Must do |
| `OK` | Fine to do |
| `IF_OTHERS` | Only if others want |
| `NOT_REALLY` | Not really |
| `AGAINST` | Strong no |

**API:**

```
GET    /api/planner/:tripId
POST   /api/planner/:tripId/activities
POST   /api/planner/:tripId/activities/bulk
PUT    /api/planner/:tripId/activities/:actId
DELETE /api/planner/:tripId/activities/:actId
POST   /api/planner/:tripId/activities/:actId/files
DELETE /api/planner/:tripId/activities/:actId/files/:fileId
POST   /api/planner/:tripId/events
PATCH  /api/planner/:tripId/events/:eventId
DELETE /api/planner/:tripId/events/:eventId
POST   /api/planner/:tripId/events/:eventId/files
DELETE /api/planner/:tripId/events/:eventId/files/:fileId
GET    /api/planner/:tripId/votes/mine
GET    /api/planner/:tripId/votes
POST   /api/planner/:tripId/votes
```

---

### 6.8 Trip questionnaire / activity voting quiz (שאלון הטיול)

**Important:** This is **not** the original preference questionnaire + AI destination recommender from the early design doc.

That original flow (DB-seeded preference questions + Claude destination suggestions) was **removed** in migrations. The current `QuestionnairePage` is a **mobile-friendly voting wizard over planner activities**.

**Capabilities:**

- One activity at a time (quiz mode)
- 5-level vote scale (MUST → AGAINST)
- Progress through unvoted activities
- Results view with vote breakdown per activity
- Inline re-vote later
- Grouped by activity categories (e.g. forest / munich / travel / food / special)

**Route:** `/trip/:id/questionnaire`  
**Entry:** Trip info page (“שאלון הטיול”)

---

### 6.9 Navigation & shell

**Bottom nav tabs (mobile):**

1. **מידע** — trip info  
2. **החלטות** — decisions  
3. **קישורים** — links  
4. **הוצאות** — expenses  
5. **מפה** — map  

Also available via trip page links:

- Planner (desktop)
- Questionnaire/votes
- Profile

**UX details:**

- RTL layout (`dir=rtl`, Heebo font)
- Brand color `#4F6EF7`
- Minimalist cards, soft borders, safe-area padding for iOS notch/home bar
- AppShell + Navbar + BottomNav
- Focus/visibility refresh so data stays fresh when returning to the PWA

---

## 7. Data model (Prisma) — what’s stored

### Core

- **User** — name, email, password hash, avatar
- **Trip** — name, dates, status, invite code, default currency, owner
- **TripMember** — membership + role (`ADMIN` / `MEMBER`)

### Money

- **TripExpense** — amount, currency, exchange rate, amountILS, category, date, payer
- **ExpenseParticipant** — who shares each expense

### Shared content objects

- **TripItem** — unified item (name, geo, urls, cost, category…)
- **TripPlace** + **PlacePhoto** — map points + gallery
- **TripLink** — bookings/docs/links
- **Decision** + **DecisionOption** + **DecisionVote** — group decisions

### Planner

- **PlannerActivity** + files + votes
- **PlannerEvent** + files

---

## 8. Roles & permissions (summary)

| Action | Typical access |
|--------|----------------|
| Join trip with invite | Any authenticated user |
| View trip content | Trip members |
| Create expenses / places / links / decisions / planner items | Members |
| Edit/delete own content | Creator (and often admin) |
| Pin links | Admin |
| Close/reopen decisions | Admin (and/or creator depending on endpoint rules) |
| Change member roles / remove members | Admin |
| Edit trip metadata / currency | Admin |
| Owner protections | Owner cannot be casually removed/demoted like others |

All protected routes require a valid JWT (except login/register).

---

## 9. UI language & design system

- **Language:** Hebrew end-to-end (buttons, errors, placeholders, labels)
- **Direction:** RTL
- **Font:** Heebo
- **Colors:** brand blue-purple (`brand-500 = #4F6EF7`), neutral grays, white backgrounds
- **Style:** clean, mobile-first, card-based, soft shadows (`shadow-sm`), generous spacing
- **PWA:** standalone display, portrait, auto-updating service worker

---

## 10. What is *not* in the current product

Based on the live schema/routes (vs older `CLAUDE.md` design notes):

| Older / planned idea | Current status |
|----------------------|----------------|
| Preference questionnaire seeded in DB | Removed |
| Claude AI destination generation | Not active in current server routes/src |
| Destination cards + destination voting | Removed via migration |
| Full “memories album” / post-trip photo social product | Not a dedicated module (only place photos) |
| Real-time LISTEN/NOTIFY sync | Not a current core feature path |

The app has evolved into a **practical coordination toolkit** (decisions, links, expenses, map, planner) rather than an AI destination recommender.

---

## 11. File / module map (practical)

### Client pages

| Page | Responsibility |
|------|----------------|
| `LoginPage` / `RegisterPage` | Auth |
| `DashboardPage` | Trip list / active trip selection / join |
| `CreateTripPage` | New trip |
| `JoinPage` | Join via invite URL |
| `TripPage` | Trip hub, members, admin tools |
| `DecisionsPage` / `CreateDecisionPage` | Group decisions & voting |
| `LinksPage` / `CreateLinkPage` / `EditLinkPage` | Shared links & files |
| `ExpensesPage` / `ExpenseFormPage` | Shared expenses & settlements |
| `MapPage` | Places map |
| `PlannerPage` | Schedule + activity bank |
| `QuestionnairePage` | Activity vote quiz |
| `ProfilePage` / `EditProfilePage` | User profile |

### Server domains

| Domain | Routes prefix |
|--------|---------------|
| Auth | `/api/auth` |
| Trips | `/api/trips` |
| Expenses | `/api/expenses` |
| Places | `/api/places` |
| Geocode / FX | `/api/geocode` |
| Decisions | `/api/decisions` |
| Links | `/api/links` |
| Planner | `/api/planner` |
| Health | `/health` |

---

## 12. External integrations

| Service | Used for |
|---------|----------|
| Google Maps / Places | Map display, place search, place details |
| Photon (OpenStreetMap) | Geocode fallback |
| Frankfurter | Currency exchange rates |
| Local filesystem uploads | Avatars, place photos, link files, planner files |

---

## 13. Typical end-to-end scenario

1. Dor creates **“טיול חברים — מינכן ויער שחור”**
2. Friends join with invite code
3. Group opens **Decisions** and votes on hotel / car / Europa Park day
4. Bookings get saved under **Links** (flight PDFs, Booking confirmation, insurance)
5. Everyone does the **activity questionnaire** to rank must-do vs skip
6. Admins fill the **Planner** calendar from the activity bank (and templates)
7. Nice places are pushed to the **Map**, ordered by day, with photos
8. During the trip, every shared meal/taxi is logged under **Expenses**
9. After the trip, settlements show who should pay whom, and repayments are recorded

---

## 14. Bottom line

**TRIPO is a Hebrew group-trip operating system** for friends:

- **Decide** together  
- **Store** what was booked  
- **Plan** what to do and when  
- **Navigate** where things are  
- **Split** what was spent  

It is already a substantial full-stack product (auth, multi-member trips, decisions, links, expenses, map, planner, uploads, PWA), oriented around real group travel logistics rather than chat noise.
