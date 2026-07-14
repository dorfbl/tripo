# Places Table Cleanup & Enrichment — Procedure

This documents exactly what was done to `places_export.csv` → `places_fixed.csv`, written so it can be re-implemented in code (e.g. Node/Python against the Google Places API) for new places.

---

## Pipeline overview

```
load CSV
  → 1. normalize each row
  → 2. deduplicate
  → 3. resolve each place against Google Places (search)
  → 4. validate the match
  → 5. map API fields → table columns
  → 6. fill curated fields (description, cost, duration, notes)
  → 7. handle failures (remove / substitute / flag)
  → 8. write output (UTF-8 with BOM) + removed-rows log
```

---

## 1. Normalize

For each row, build a **search string** before querying:

- Strip Hebrew suffixes/decorations from the name: `"Caracalla Therme – ספא תרמי"` → `"Caracalla Therme"`. Rule: split on `–` / `-` / `+` and keep the proper-noun part; if the name is Hebrew-only (e.g. `טירת Neuschwanstein`), translate/extract the Latin entity (`Neuschwanstein Castle`).
- Append a **geographic disambiguator**, in priority order:
  1. City/region already implied by the name (`… München`, `… Baden-Baden`)
  2. Nearest known cluster from existing lat/lng (rows with coords: reverse-map to region — Munich, Black Forest, Lake Garda…)
  3. The trip's overall region as fallback (`… Schwarzwald` / `… Bavaria`)
- Common-name places MUST carry the region (e.g. `Landgasthof Hirschen` exists in dozens of towns → `Landgasthof Hirschen Schwarzwald`; `Alpine Coaster` → use existing coords to pin it to Oberammergau).

## 2. Deduplicate

Two-pass:

1. **Exact `placeId` duplicates** → keep first.
2. **Fuzzy name duplicates** (only after normalization, and *including cross-language pairs*):
   - Casefold, strip diacritics, drop stop-words (`tour`, `event`, `Halloween`, `– …`).
   - Match if normalized names are equal/substring, **or** if coords are within ~300 m, **or** if a Hebrew name is a translation of an English one (`קניון מקסים רוואנה` ≡ `Ravenna Gorge` — this required knowing that רוואנה = Ravenna; in code, resolve both rows via the API and compare the returned `place_id`s, which is the robust way).
   - Keep the row with more data (placeId/coords/hours); merge the other's category if useful.

> Duplicates found this way: Paulaner ×2, Augustiner Keller ×2, Treetop Walk ×2, Traumatica ×2, Ravenna Gorge ×2.

## 3. Resolve against Google Places

With your API key, use **Places API (New) — Text Search**:

```
POST https://places.googleapis.com/v1/places:searchText
Headers:
  X-Goog-Api-Key: <KEY>
  X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,
    places.location,places.rating,places.userRatingCount,places.types,
    places.regularOpeningHours,places.websiteUri,places.priceLevel,
    places.googleMapsUri,places.internationalPhoneNumber
Body: { "textQuery": "<search string>", "languageCode": "he" }   // he → Hebrew hours/address where available
```

- Take the **top result** (`places[0]`).
- If the row already has a `placeId`, prefer **Place Details** directly instead of searching:
  `GET https://places.googleapis.com/v1/places/{place_id}` with the same field mask — cheaper and exact.
- One request per place; batchable with async/parallel calls (respect QPS limits).

## 4. Validate the match (important!)

Accept the result only if **all** hold:

- **Distance check**: if the row had coords, result must be within ~30 km (catches wrong-city homonyms). One real fix from this run: the CSV's `Feldberg` point was the village, the summit is a different place ~5 km away — the search returned the actual peak.
- **Type sanity**: result `types` should be compatible with the row's category (a `restaurant` row shouldn't resolve to a `route`). Google sometimes returns a *street* instead of the landmark — e.g. querying `Marienplatz München` returned `types: ["route"]` with no rating. **Retry with a more descriptive query** (`Marienplaz square old town hall`) until you get an `establishment`/`plaza`/`tourist_attraction` result.
- **Name plausibility**: fuzzy-compare result name vs. query (official names may legitimately differ — `Schneider Weisse Tap House` resolves to `Weisses Bräuhaus im Tal`, that's fine — but a totally unrelated name = reject).

If validation fails → retry with alternate query phrasings (add/remove city, use native-language name, use the "official" name you know). After 2–3 failed attempts → route to step 7.

## 5. Field mapping (API → table)

| Output column      | Source                                                                    |
|--------------------|---------------------------------------------------------------------------|
| `name`             | `displayName.text` (official) — original name kept in `name_original`     |
| `address`          | `formattedAddress`                                                        |
| `lat`, `lng`       | `location.latitude/longitude` (overwrite old coords — API is authoritative)|
| `rating`           | `rating`                                                                   |
| `rating_count`     | `userRatingCount`                                                          |
| `opening_hours`    | `regularOpeningHours.weekdayDescriptions`, compacted (see below)           |
| `website`          | `websiteUri`                                                               |
| `placeId`          | `id`                                                                       |
| `google_maps_link` | `googleMapsUri`, or build: `https://www.google.com/maps/place/?q=place_id:<id>` |
| `category`         | keep the trip's own taxonomy; re-bucket the loose ones (`forest`/`munich`/`food` → `nature`/`culture`/`restaurant`) using result `types` as a hint |

**Hours compaction:** collapse identical consecutive days: `["Mon 10–18", "Tue 10–18", ...]` → `א'-ה': 10:00–18:00 | ו'-שבת: …`. Natural features (`lake`, `mountain_peak`) return no hours → write `פתוח 24/7`. Seasonal venues (Traumatica, coasters) → annotate `(תלוי עונה)`.

## 6. Curated fields (not from the API)

These were written manually per place and can't be fully automated with Places alone:

- **`description_he`** — 1–2 sentence Hebrew description: what it is, why it's worth it, one practical tip (dress code, book ahead, €1 Sundays, "not under 16"). If coding: generate with an LLM from `{official name, types, top reviews}`; the reviews field (`places.reviews` in the field mask) gives great raw material.
- **`cost`** — Places only gives coarse `priceLevel` for food. Real ticket prices came from knowledge/reviews (reviews very often state prices: "€13.50/adult", "€9 entrance"). In code: parse `€\d+` patterns out of reviews, or maintain a manual override map.
- **`estimated_duration`** — heuristic by type: church 30–60 min, museum 1.5–3 h, thermal spa 2–4 h, theme park full day, restaurant 1–2 h, hike 2–6 h. Manual override where reviews say otherwise.
- **`notes`** — anything the traveler must know that changes the row's meaning (see step 7).

## 7. Failure & special-case handling

Decision tree used when a row didn't resolve cleanly:

1. **Permanently closed** → *remove*, log reason. (Places returns `businessStatus: CLOSED_PERMANENTLY` — check this field! Case here: Schuhbeck's, closed 2022.)
2. **Place literally doesn't exist** → *substitute nearest real equivalent + note*. Case: "Casino Munich" — Munich has no casino; substituted Spielbank Garmisch-Partenkirchen and flagged it in `notes`.
3. **Generic concept, not a specific venue** ("an Alsatian winstub", "a lakeside restaurant at Titisee", "wine tasting in Alsace") → *pick a well-rated representative* (search the concept + area, take a top result with rating ≥4.3 and enough reviews), and **always** write in `notes` that it's a representative with 1–2 alternatives.
4. **Resolved but misleading** → keep + warn in `notes`. Case: "Paulaner Brewery" resolved to the industrial plant (3.6★, reviews are from delivery drivers) — kept, with a note pointing to Paulaner am Nockherberg for the actual experience.
5. **Nothing found after retries** → remove, log to `places_removed.csv` with reason.

Every removal goes to a separate log file — never silently drop rows.

## 8. Output

- `places_fixed.csv` — encoding **`utf-8-sig`** (BOM) so Hebrew renders correctly when opened in Excel. Keep `id`/`tripId` untouched for re-import into the source app.
- `places_removed.csv` — `original_name, reason`.

---

## Minimal pseudocode

```python
for row in csv:
    if is_duplicate(row, seen): log_removed(row, "duplicate"); continue
    place = details(row.placeId) if row.placeId else text_search(build_query(row))
    if not place or not valid_match(row, place):
        place = retry_variants(row)               # alt phrasings, native name, +region
    if not place:            log_removed(row, "not found"); continue
    if place.businessStatus == "CLOSED_PERMANENTLY":
                             log_removed(row, "closed"); continue
    out.append(map_fields(row, place) | curated(row, place))  # desc/cost/duration/notes
write(out, "utf-8-sig"); write(removed_log)
```

### Gotchas checklist
- [ ] `languageCode: "he"` if you want Hebrew hours/addresses
- [ ] Check `businessStatus` on every result
- [ ] Reject `types: ["route"]` / bare street matches → rephrase and retry
- [ ] Distance-validate against existing coords when present
- [ ] Common names need a region suffix in the query
- [ ] Resolve suspected cross-language duplicates by comparing returned `place_id`s
- [ ] Natural features have no hours → default "open 24/7"
- [ ] Write CSV as `utf-8-sig`, keep original `id`/`tripId`
