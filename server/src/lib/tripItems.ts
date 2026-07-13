import { prisma } from './prisma';

const clean = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
};

/**
 * Normalize user/API input into a TripItem row.
 * IMPORTANT: do not apply trip-specific "known place" overrides here —
 * those leaked Munich locations into other trips (e.g. Italy).
 */
export const normalizeTripItemInput = (tripId: string, input: any, kind = 'activity') => ({
  tripId,
  kind,
  name: clean(input.name ?? input.title) || 'Untitled',
  description: clean(input.description ?? input.notes),
  category: clean(input.category) || 'other',
  mapsUrl: clean(input.mapsUrl),
  url: clean(input.url),
  location: clean(input.location),
  lat: typeof input.lat === 'number' ? input.lat : input.lat != null ? Number(input.lat) : null,
  lng: typeof input.lng === 'number' ? input.lng : input.lng != null ? Number(input.lng) : null,
  emoji: clean(input.emoji) || '📌',
  color: clean(input.color) || 'blue',
  cost: clean(input.cost),
  durationMins: input.durationMins != null ? Number(input.durationMins) : null,
});

const mergeUpdate = (existing: any, incoming: any) => {
  const data: any = {};
  for (const field of ['name', 'description', 'category', 'mapsUrl', 'url', 'location', 'lat', 'lng', 'emoji', 'color', 'cost', 'durationMins']) {
    if (incoming[field] !== undefined && incoming[field] !== null && incoming[field] !== existing[field]) {
      data[field] = incoming[field];
    }
  }
  if (incoming.kind === 'activity' && existing.kind !== 'activity') data.kind = 'activity';
  return data;
};

export const findOrCreateTripItem = async (tripId: string, input: any, kind = 'activity') => {
  const data = normalizeTripItemInput(tripId, input, kind);
  // Always scoped to this trip — never reuse items from another trip
  const existing = await prisma.tripItem.findFirst({ where: { tripId, name: data.name } });
  if (!existing) return prisma.tripItem.create({ data });

  const update = mergeUpdate(existing, data);
  return Object.keys(update).length
    ? prisma.tripItem.update({ where: { id: existing.id }, data: update })
    : existing;
};

export const updateTripItem = async (itemId: string | null | undefined, tripId: string, input: any, kind = 'activity') => {
  if (!itemId) return findOrCreateTripItem(tripId, input, kind);
  const existing = await prisma.tripItem.findUnique({ where: { id: itemId } });
  // Wrong trip or missing → create under the current trip (never cross-link)
  if (!existing || existing.tripId !== tripId) return findOrCreateTripItem(tripId, input, kind);
  const merged: any = { ...existing };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) merged[key] = value;
  }
  const data = normalizeTripItemInput(tripId, merged, kind);
  const update = mergeUpdate(existing, data);
  return Object.keys(update).length
    ? prisma.tripItem.update({ where: { id: itemId }, data: update })
    : existing;
};

const itemFields = (row: any) => row.item ? {
  itemId: row.item.id,
  name: row.item.name,
  description: row.item.description ?? row.description,
  category: row.item.category ?? row.category,
  mapsUrl: row.item.mapsUrl ?? row.mapsUrl,
  url: row.item.url ?? row.url,
  location: row.item.location ?? row.location,
  emoji: row.item.emoji ?? row.emoji,
  color: row.item.color ?? row.color,
  cost: row.item.cost ?? row.cost,
  durationMins: row.item.durationMins ?? row.durationMins,
} : {};

export const serializeActivity = (activity: any) => ({
  ...activity,
  ...itemFields(activity),
});

export const serializeEvent = (event: any) => ({
  ...event,
  ...(event.item ? {
    itemId: event.item.id,
    title: event.item.name,
    notes: event.notes,
    mapsUrl: event.item.mapsUrl ?? event.mapsUrl,
    url: event.item.url ?? event.url,
    cost: event.item.cost ?? event.cost,
    color: event.item.color ?? event.color,
  } : {}),
});

export const serializePlace = (place: any) => ({
  ...place,
  ...(place.item ? {
    itemId: place.item.id,
    name: place.item.name,
    notes: place.notes ?? place.item.description,
    category: place.category ?? place.item.category,
    mapsUrl: place.item.mapsUrl ?? place.mapsUrl,
    lat: place.item.lat ?? place.lat,
    lng: place.item.lng ?? place.lng,
  } : {}),
});
