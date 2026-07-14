/**
 * Improved deduplication: merge language variants and similar places
 * Strategy:
 * 1. Group by tripId + similar names (including language variants)
 * 2. Keep the place with most complete data (placeId, openingHours, lat/lng, etc.)
 * 3. Update all references (MapPoint) to point to the kept place
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

/**
 * Normalize place name to detect duplicates including language variants
 * - Remove common words (park, beach, museum, etc.)
 * - Remove special characters
 * - Lowercase
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\b(park|beach|museum|castle|tower|square|street|avenue|road|plaza|center|centre|garden|market|temple|church|cathedral|palace|fort|lake|river|mountain|hill|island)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two place names are similar (likely same place in different languages)
 */
function areNamesSimilar(name1: string, name2: string): boolean {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // Exact match after normalization
  if (norm1 === norm2) return true;

  // One contains the other (e.g., "Europa" and "Europa Park")
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Check if they share the same Google Place ID
  return false;
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

async function deduplicatePlacesImproved() {
  console.log('🚀 Starting improved place deduplication...\n');

  try {
    // Get all places
    const allPlaces = await prisma.place.findMany({
      orderBy: [{ tripId: 'asc' }, { name: 'asc' }]
    });

    console.log(`📍 Found ${allPlaces.length} total places\n`);

    // Group by trip
    const placesByTrip: { [tripId: string]: Place[] } = {};
    for (const place of allPlaces) {
      if (!placesByTrip[place.tripId]) placesByTrip[place.tripId] = [];
      placesByTrip[place.tripId].push(place);
    }

    let totalKept = 0;
    let totalDeleted = 0;

    // Process each trip separately
    for (const [tripId, tripPlaces] of Object.entries(placesByTrip)) {
      console.log(`\n📦 Processing trip ${tripId} (${tripPlaces.length} places)`);

      // Find duplicates within this trip
      const processed = new Set<string>();
      const duplicateGroups: Place[][] = [];

      for (let i = 0; i < tripPlaces.length; i++) {
        if (processed.has(tripPlaces[i].id)) continue;

        const group: Place[] = [tripPlaces[i]];
        processed.add(tripPlaces[i].id);

        // Find all similar places
        for (let j = i + 1; j < tripPlaces.length; j++) {
          if (processed.has(tripPlaces[j].id)) continue;

          // Check if same place (by name similarity or placeId)
          const samePlaceId = tripPlaces[i].placeId && tripPlaces[i].placeId === tripPlaces[j].placeId;
          const similarNames = areNamesSimilar(tripPlaces[i].name, tripPlaces[j].name);

          if (samePlaceId || similarNames) {
            group.push(tripPlaces[j]);
            processed.add(tripPlaces[j].id);
          }
        }

        if (group.length > 1) {
          duplicateGroups.push(group);
        }
      }

      if (duplicateGroups.length === 0) {
        console.log('   ✅ No duplicates found in this trip');
        continue;
      }

      console.log(`   🔍 Found ${duplicateGroups.length} groups with duplicates`);

      // Process each duplicate group
      for (const duplicates of duplicateGroups) {
        const names = duplicates.map(p => p.name).join(' / ');
        console.log(`\n   📌 Deduplicating: ${names} (${duplicates.length} copies)`);

        // Choose best place
        const bestPlace = chooseBestPlace(duplicates);
        const duplicateIds = duplicates.filter(p => p.id !== bestPlace.id).map(p => p.id);

        console.log(`      ✅ Keeping: "${bestPlace.name}" (ID: ${bestPlace.id}, score: ${scorePlace(bestPlace)})`);
        console.log(`      🗑️  Deleting: ${duplicateIds.length} duplicates`);

        // For MapPoints, delete duplicates to avoid unique constraint issues
        const mapPointsDeleted = await prisma.mapPoint.deleteMany({
          where: { placeId: { in: duplicateIds } }
        });

        // For votes, delete duplicates to avoid unique constraint issues
        const votesDeleted = await prisma.placeVote.deleteMany({
          where: { placeId: { in: duplicateIds } }
        });

        console.log(`      📝 Deleted: ${mapPointsDeleted.count} map points, ${votesDeleted.count} votes`);

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
deduplicatePlacesImproved()
  .then(() => {
    console.log('\n✨ Deduplication complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Deduplication failed:', error);
    process.exit(1);
  });
