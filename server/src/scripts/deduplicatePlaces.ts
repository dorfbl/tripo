/**
 * Deduplicate places within each trip
 * Strategy:
 * 1. Group by tripId + normalized name
 * 2. Keep the place with most complete data (placeId, openingHours, lat/lng, etc.)
 * 3. Update all references (ScheduledEvent, MapPoint) to point to the kept place
 * 4. Delete duplicate places
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Place {
  id: string;
  tripId: string;
  name: string;
  description: string | null;
  category: string;
  emoji: string;
  color: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  openingHours: any;
  mapsUrl: string | null;
  url: string | null;
  cost: string | null;
  durationMins: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

function scorePlace(place: Place): number {
  let score = 0;

  // Opening hours data is very valuable
  if (place.openingHours) score += 100;

  // Google Place ID is important
  if (place.placeId) score += 50;

  // Location coordinates
  if (place.lat && place.lng) score += 30;

  // Additional details
  if (place.description) score += 10;
  if (place.mapsUrl) score += 10;
  if (place.url) score += 5;
  if (place.cost) score += 5;
  if (place.durationMins) score += 5;
  if (place.location) score += 5;

  return score;
}

function chooseBestPlace(places: Place[]): Place {
  // Sort by score descending, then by createdAt ascending (older first)
  return places.sort((a, b) => {
    const scoreDiff = scorePlace(b) - scorePlace(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

async function deduplicatePlaces() {
  console.log('🚀 Starting place deduplication...\n');

  try {
    // Get all places
    const allPlaces = await prisma.place.findMany({
      orderBy: [{ tripId: 'asc' }, { name: 'asc' }]
    });

    console.log(`📍 Found ${allPlaces.length} total places\n`);

    // Group by trip + normalized name
    const groups: { [key: string]: Place[] } = {};

    for (const place of allPlaces) {
      const key = `${place.tripId}|||${normalizeName(place.name)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(place);
    }

    // Find duplicates
    const duplicateGroups = Object.entries(groups).filter(([_, places]) => places.length > 1);

    console.log(`🔍 Found ${duplicateGroups.length} groups with duplicates\n`);

    let totalKept = 0;
    let totalDeleted = 0;

    for (const [key, duplicates] of duplicateGroups) {
      const [tripId, name] = key.split('|||');

      console.log(`\n📦 Deduplicating: ${duplicates[0].name} (${duplicates.length} copies)`);

      // Choose best place
      const bestPlace = chooseBestPlace(duplicates);
      const duplicateIds = duplicates.filter(p => p.id !== bestPlace.id).map(p => p.id);

      console.log(`   ✅ Keeping: ${bestPlace.id} (score: ${scorePlace(bestPlace)})`);
      console.log(`   🗑️  Deleting: ${duplicateIds.length} duplicates`);

      // Update references
      const scheduledEventsUpdated = await prisma.scheduledEvent.updateMany({
        where: { placeId: { in: duplicateIds } },
        data: { placeId: bestPlace.id }
      });

      // For MapPoints, we can't update due to unique constraint (tripId, placeId, date)
      // Instead, delete duplicates (the best place likely already has MapPoints)
      const mapPointsDeleted = await prisma.mapPoint.deleteMany({
        where: { placeId: { in: duplicateIds } }
      });

      // For votes, delete duplicates to avoid unique constraint issues
      const votesDeleted = await prisma.placeVote.deleteMany({
        where: { placeId: { in: duplicateIds } }
      });

      console.log(`   📝 Updated: ${scheduledEventsUpdated.count} events | Deleted: ${mapPointsDeleted.count} map points, ${votesDeleted.count} votes`);

      // Delete photos from duplicates
      await prisma.placePhoto.deleteMany({
        where: { placeId: { in: duplicateIds } }
      });

      // Delete files from duplicates
      await prisma.placeFile.deleteMany({
        where: { placeId: { in: duplicateIds } }
      });

      // Delete duplicate places
      await prisma.place.deleteMany({
        where: { id: { in: duplicateIds } }
      });

      totalKept += 1;
      totalDeleted += duplicateIds.length;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Kept: ${totalKept} best places`);
    console.log(`   🗑️  Deleted: ${totalDeleted} duplicates`);
    console.log(`   📍 Final count: ${allPlaces.length - totalDeleted} places`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Deduplication failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run deduplication
deduplicatePlaces()
  .then(() => {
    console.log('\n✨ Deduplication complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Deduplication failed:', error);
    process.exit(1);
  });
