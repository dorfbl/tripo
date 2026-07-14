/**
 * Migration script: Migrate data from old tables to new unified schema
 * Old: TripItem, TripPlace, PlannerActivity, PlannerEvent
 * New: Place, ScheduledEvent, MapPoint
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PlaceMap {
  [key: string]: string; // oldId -> newPlaceId
}

async function migrateToUnifiedSchema() {
  console.log('🚀 Starting migration to unified schema...\n');

  try {
    // Get all trips
    const trips = await prisma.trip.findMany({
      select: { id: true, name: true }
    });

    console.log(`Found ${trips.length} trips to migrate\n`);

    for (const trip of trips) {
      console.log(`\n📦 Migrating trip: ${trip.name} (${trip.id})`);
      const placeMap: PlaceMap = {};

      // ===== STEP 1: Migrate TripPlace -> Place + MapPoint =====
      console.log('  1️⃣  Migrating TripPlace...');
      const oldPlaces = await (prisma as any).tripPlace.findMany({
        where: { tripId: trip.id }
      });

      for (const oldPlace of oldPlaces) {
        // Create new Place
        const newPlace = await prisma.place.create({
          data: {
            tripId: trip.id,
            name: oldPlace.name,
            category: oldPlace.category,
            location: null, // TripPlace didn't have location text
            lat: oldPlace.lat,
            lng: oldPlace.lng,
            placeId: oldPlace.placeId,
            openingHours: oldPlace.openingHours,
            mapsUrl: oldPlace.mapsUrl,
            url: null,
            cost: null,
            durationMins: null,
            emoji: '📍',
            color: 'blue',
          }
        });

        placeMap[oldPlace.id] = newPlace.id;

        // Create MapPoint if it has date/order
        if (oldPlace.date || oldPlace.order > 0) {
          await prisma.mapPoint.create({
            data: {
              tripId: trip.id,
              placeId: newPlace.id,
              date: oldPlace.date,
              order: oldPlace.order,
              notes: oldPlace.notes,
            }
          });
        }
      }
      console.log(`     ✅ Migrated ${oldPlaces.length} places`);

      // ===== STEP 2: Migrate TripItem -> Place =====
      console.log('  2️⃣  Migrating TripItem...');
      const oldItems = await prisma.tripItem.findMany({
        where: { tripId: trip.id }
      });

      for (const oldItem of oldItems) {
        const newPlace = await prisma.place.create({
          data: {
            tripId: trip.id,
            name: oldItem.name,
            description: oldItem.description,
            category: oldItem.category,
            location: oldItem.location,
            lat: oldItem.lat,
            lng: oldItem.lng,
            mapsUrl: oldItem.mapsUrl,
            url: oldItem.url,
            cost: oldItem.cost,
            durationMins: oldItem.durationMins,
            emoji: oldItem.emoji,
            color: oldItem.color,
          }
        });

        placeMap[oldItem.id] = newPlace.id;
      }
      console.log(`     ✅ Migrated ${oldItems.length} items`);

      // ===== STEP 3: Migrate PlannerActivity -> Place =====
      console.log('  3️⃣  Migrating PlannerActivity...');
      const oldActivities = await prisma.plannerActivity.findMany({
        where: { tripId: trip.id },
        include: { files: true, votes: true }
      });

      for (const oldActivity of oldActivities) {
        // Check if already created via itemId
        let newPlaceId = oldActivity.itemId ? placeMap[oldActivity.itemId] : null;

        if (!newPlaceId) {
          const newPlace = await prisma.place.create({
            data: {
              tripId: trip.id,
              name: oldActivity.name,
              description: oldActivity.description,
              category: oldActivity.category,
              location: oldActivity.location,
              mapsUrl: oldActivity.mapsUrl,
              url: oldActivity.url,
              cost: oldActivity.cost,
              durationMins: oldActivity.durationMins,
              emoji: oldActivity.emoji,
              color: oldActivity.color,
            }
          });
          newPlaceId = newPlace.id;
        }

        placeMap[oldActivity.id] = newPlaceId;

        // Migrate files
        for (const file of oldActivity.files) {
          await prisma.placeFile.create({
            data: {
              placeId: newPlaceId,
              filename: file.filename,
              originalName: file.originalName,
              mimeType: file.mimeType,
              size: file.size,
              createdAt: file.createdAt,
            }
          });
        }

        // Migrate votes
        for (const vote of oldActivity.votes) {
          await prisma.placeVote.create({
            data: {
              placeId: newPlaceId,
              userId: vote.userId,
              tripId: trip.id,
              vote: vote.vote,
              createdAt: vote.createdAt,
              updatedAt: vote.updatedAt,
            }
          });
        }
      }
      console.log(`     ✅ Migrated ${oldActivities.length} activities`);

      // ===== STEP 4: Migrate PlannerEvent -> ScheduledEvent =====
      console.log('  4️⃣  Migrating PlannerEvent...');
      const oldEvents = await prisma.plannerEvent.findMany({
        where: { tripId: trip.id },
        include: { files: true }
      });

      for (const oldEvent of oldEvents) {
        // Determine placeId: from activity, item, or create new
        let newPlaceId: string | null = null;

        if (oldEvent.activityId && placeMap[oldEvent.activityId]) {
          newPlaceId = placeMap[oldEvent.activityId];
        } else if (oldEvent.itemId && placeMap[oldEvent.itemId]) {
          newPlaceId = placeMap[oldEvent.itemId];
        }

        const scheduledEvent = await prisma.scheduledEvent.create({
          data: {
            tripId: trip.id,
            placeId: newPlaceId,
            date: oldEvent.date,
            startMinute: oldEvent.startMinute,
            durationMins: oldEvent.durationMins,
            allDay: oldEvent.allDay,
            title: oldEvent.title,
            notes: oldEvent.notes,
            color: oldEvent.color,
            createdAt: oldEvent.createdAt,
            updatedAt: oldEvent.updatedAt,
          }
        });

        // Migrate files
        for (const file of oldEvent.files) {
          await prisma.scheduledEventFile.create({
            data: {
              eventId: scheduledEvent.id,
              filename: file.filename,
              originalName: file.originalName,
              mimeType: file.mimeType,
              size: file.size,
              createdAt: file.createdAt,
            }
          });
        }
      }
      console.log(`     ✅ Migrated ${oldEvents.length} events`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Migration completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateToUnifiedSchema()
  .then(() => {
    console.log('\n✅ Data migration complete. You can now drop old tables.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
