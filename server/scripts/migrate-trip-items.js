const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const normalize = value => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const knownCorrections = new Map([
  ['f1 simulator', {
    name: 'F1 Simulator',
    location: 'Racing Unleashed | Motorworld Munich',
    mapsUrl: 'https://maps.app.goo.gl/FMSy4Hr2V8muTubF7',
    url: 'https://www.racing-unleashed.com/lounges/munich',
  }],
  ['teamsport e-karting kart palast', {
    name: 'TeamSport E-Karting Kart Palast',
    location: 'Bergkirchen-Feldgeding',
    mapsUrl: 'https://maps.app.goo.gl/AQcNJyC9ZSWKG4Qk8',
  }],
  ['teamsport e-karting kart palast funpark münchen', {
    name: 'TeamSport E-Karting Kart Palast',
    location: 'Bergkirchen-Feldgeding',
    mapsUrl: 'https://maps.app.goo.gl/AQcNJyC9ZSWKG4Qk8',
  }],
  ['קארטינג – go-kart welt', {
    name: 'TeamSport E-Karting Kart Palast',
    location: 'Bergkirchen-Feldgeding',
    mapsUrl: 'https://maps.app.goo.gl/AQcNJyC9ZSWKG4Qk8',
  }],
  ['battlekart münchen-finsing', {
    name: 'BattleKart München-Finsing',
    location: 'Finsing',
    mapsUrl: 'https://maps.app.goo.gl/zQG7zkYq69wH67ya9',
    url: 'https://www.battlekart.com/de/muenchen-finsing',
  }],
  ['zero latency virtual reality münchen neufahrn', {
    name: 'Zero Latency Virtual Reality München Neufahrn',
    location: 'Neufahrn bei Freising',
    mapsUrl: 'https://share.google/4XC1eIHWNf1tBZUqp',
  }],
]);

const applyKnownCorrections = data => {
  const correction = knownCorrections.get(normalize(data.name));
  return correction ? { ...data, ...correction } : data;
};

const clean = value => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
};

const sourceToItemData = (source, kind) => applyKnownCorrections({
  kind,
  tripId: source.tripId,
  name: clean(source.name || source.title) || 'Untitled',
  description: clean(source.description || source.notes),
  category: clean(source.category) || 'other',
  mapsUrl: clean(source.mapsUrl),
  url: clean(source.url),
  location: clean(source.location),
  lat: typeof source.lat === 'number' ? source.lat : null,
  lng: typeof source.lng === 'number' ? source.lng : null,
  emoji: clean(source.emoji) || '📌',
  color: clean(source.color) || 'blue',
  cost: clean(source.cost),
  durationMins: typeof source.durationMins === 'number' ? source.durationMins : null,
});

const mergeItem = (existing, incoming) => {
  const data = {};
  const preferIncoming = ['mapsUrl', 'url', 'lat', 'lng'];
  const fillIfMissing = ['description', 'location', 'cost', 'durationMins'];

  if (incoming.name && incoming.name !== existing.name) data.name = incoming.name;
  if (incoming.category && incoming.category !== 'other' && incoming.category !== existing.category) data.category = incoming.category;
  if (incoming.emoji && incoming.emoji !== '📌' && incoming.emoji !== existing.emoji) data.emoji = incoming.emoji;
  if (incoming.color && incoming.color !== 'blue' && incoming.color !== existing.color) data.color = incoming.color;
  if (incoming.kind === 'activity' && existing.kind !== 'activity') data.kind = 'activity';

  for (const field of preferIncoming) {
    if (incoming[field] && incoming[field] !== existing[field]) data[field] = incoming[field];
  }
  for (const field of fillIfMissing) {
    if ((existing[field] === null || existing[field] === undefined) && incoming[field]) data[field] = incoming[field];
  }

  return data;
};

const indexItems = items => {
  const byId = new Map();
  const byName = new Map();
  for (const item of items) {
    byId.set(item.id, item);
    byName.set(`${item.tripId}|${normalize(item.name)}`, item);
  }
  return { byId, byName };
};

async function upsertItem(index, incoming) {
  const nameKey = `${incoming.tripId}|${normalize(incoming.name)}`;
  let item = index.byName.get(nameKey);

  if (!item) {
    item = await prisma.tripItem.create({ data: incoming });
  } else {
    const update = mergeItem(item, incoming);
    if (Object.keys(update).length) {
      item = await prisma.tripItem.update({ where: { id: item.id }, data: update });
    }
  }

  index.byId.set(item.id, item);
  index.byName.set(`${item.tripId}|${normalize(item.name)}`, item);
  return item;
}

async function main() {
  const items = await prisma.tripItem.findMany();
  const index = indexItems(items);
  let createdOrLinkedActivities = 0;
  let linkedPlaces = 0;
  let linkedEvents = 0;

  const activities = await prisma.plannerActivity.findMany({ orderBy: { createdAt: 'asc' } });
  const activityItemIds = new Map();
  for (const activity of activities) {
    const item = activity.itemId
      ? await prisma.tripItem.findUnique({ where: { id: activity.itemId } })
      : await upsertItem(index, sourceToItemData(activity, 'activity'));
    if (!item) continue;
    activityItemIds.set(activity.id, item.id);
    const corrected = sourceToItemData(activity, 'activity');
    await prisma.plannerActivity.update({
      where: { id: activity.id },
      data: {
        itemId: item.id,
        name: corrected.name,
        location: corrected.location,
        mapsUrl: corrected.mapsUrl,
        url: corrected.url,
      },
    });
    createdOrLinkedActivities++;
  }

  const places = await prisma.tripPlace.findMany({ orderBy: { createdAt: 'asc' } });
  for (const place of places) {
    const item = place.itemId
      ? await prisma.tripItem.findUnique({ where: { id: place.itemId } })
      : await upsertItem(index, sourceToItemData(place, 'place'));
    if (!item) continue;
    await prisma.tripPlace.update({
      where: { id: place.id },
      data: {
        itemId: item.id,
        name: item.name,
        mapsUrl: item.mapsUrl,
        category: place.category || item.category,
      },
    });
    linkedPlaces++;
  }

  const events = await prisma.plannerEvent.findMany({ orderBy: { createdAt: 'asc' } });
  for (const event of events) {
    let itemId = event.activityId ? activityItemIds.get(event.activityId) : null;
    if (!itemId && event.itemId) itemId = event.itemId;
    if (!itemId) {
      const source = sourceToItemData({
        ...event,
        name: event.title,
        description: event.notes,
      }, 'event');
      const item = await upsertItem(index, source);
      itemId = item.id;
    }
    const item = await prisma.tripItem.findUnique({ where: { id: itemId } });
    if (!item) continue;
    await prisma.plannerEvent.update({
      where: { id: event.id },
      data: {
        itemId: item.id,
        title: item.name,
        mapsUrl: item.mapsUrl,
        url: item.url,
      },
    });
    linkedEvents++;
  }

  console.log(JSON.stringify({
    tripItems: await prisma.tripItem.count(),
    createdOrLinkedActivities,
    linkedPlaces,
    linkedEvents,
  }, null, 2));
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
