# TRIPO --- Future Features (High Priority)

## 1. Automatic Trip Timeline

### Vision

Instead of being just a planner, TRIPO should automatically create a
living timeline of the trip.

Every meaningful action performed inside the app becomes part of the
story.

### Automatic events

- ✈️ Member joined the trip
- 📊 Decision closed
- 🔗 Booking/document added
- 📍 Place added to the map
- 💶 Expense added
- 📷 Photos uploaded
- 🏨 Hotel added
- 🚗 Car rental added

Example:

```text
October 5

09:20 ✈️ Dor joined the trip
09:45 📊 Hotel decision closed
11:10 🔗 Booking confirmation added
13:50 📍 Hofbräuhaus added
18:30 💶 Expense €85
19:10 📷 4 photos uploaded
```

### Manual timeline entries

Allow users to manually add memorable events: - "First snow!" - "Lost
the luggage." - "Met friends unexpectedly."

### Filters

- All
- Expenses
- Places
- Photos
- Decisions
- Documents

### Benefits

- Creates a complete trip history.
- Makes it easy to remember when things happened.
- Provides a beautiful recap after the trip.

---

# 2. Offline Mode

## Goal

The application should remain fully usable without internet.

### Download automatically

When opening a trip, cache:

- Planner
- Map
- Places
- Documents
- Links
- Expenses
- Decisions
- Thumbnail images

### Offline editing

Allow users to:

- Add expenses
- Upload photos (queued)
- Add places
- Write notes

Everything is stored locally until internet returns.

Example:

🟡 Pending Sync

↓

✔ Synced

### Sync dashboard

Display:

- Last synchronization
- Pending changes
- Manual Sync button

### Conflict resolution

If two users edited the same object:

- Keep Mine
- Keep Remote
- Compare Changes

---

# 3. Trip Dashboard

## Goal

One screen that summarizes the entire trip.

Instead of opening multiple modules, users should immediately understand
the current status.

### Suggested widgets

## Today's schedule

- Upcoming activities
- Current day of trip

## Weather

- Temperature
- Rain chance
- Weather icon

## Expenses

- Today's spending
- Trip total

## Balance

- Who owes whom

## Flights

- Time until boarding
- Flight status

## Recent activity

- New photos
- New places
- New expenses
- Closed decisions

### Customization

Allow users to reorder widgets.

---

# 4. Live Flight Integration

## Goal

Provide real-time flight information.

The user only enters:

- LY347
- LH1223
- BA405

The application displays:

- Status
- Gate
- Terminal
- Delay
- Boarding
- Aircraft
- Departure
- Arrival

### Dashboard integration

Example:

✈️ Boarding in 48 minutes.

### Suggested APIs

- AviationStack
- AeroDataBox

### Future improvement

Automatically detect flights from uploaded PDF tickets.

---

# 5. Weather Integration

Weather should be integrated naturally into existing screens.

### Planner

Each day displays:

- Weather icon
- Temperature
- Rain probability

### Dashboard

Today

☀️ 24°C

Tomorrow

🌧️ 18°C

### Map

Display weather for specific places and expected conditions during
planned arrival time.

### Suggested API

OpenWeather One Call API

---

# 6. Smart Trip Assistant

## Vision

A lightweight assistant---not a chatbot---that continuously analyzes
trip data.

Sources:

- Planner
- Flights
- Weather
- Expenses
- Timeline
- User location
- Places

### Example suggestions

- Rain expected tomorrow. Consider moving the forest hike.
- Boarding begins in 45 minutes.
- The next restaurant is a 6-minute walk.
- Today's fuel expense has not been recorded.
- Everyone has voted except one member.
- You haven't uploaded photos from today's activities.

## Goal

Transform TRIPO from a collection of tools into an intelligent travel
companion that proactively helps the group throughout the trip.
