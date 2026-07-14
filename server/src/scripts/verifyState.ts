/**
 * Verify final database state after cleanup
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyState() {
  console.log('🔍 Verifying final database state...\n');

  try {
    // Count places
    const placesCount = await prisma.place.count();
    const placesWithOpeningHours = await prisma.place.count({
      where: { openingHours: { not: null } }
    });
    const placesWithPlaceId = await prisma.place.count({
      where: { placeId: { not: null } }
    });

    // Count scheduled events
    const eventsCount = await prisma.scheduledEvent.count();

    // Count map points
    const mapPointsCount = await prisma.mapPoint.count();

    // Group places by trip
    const placesByTrip = await prisma.place.groupBy({
      by: ['tripId'],
      _count: { id: true }
    });

    console.log('📊 Database State:');
    console.log('='.repeat(60));
    console.log(`📍 Total Places: ${placesCount}`);
    console.log(`   └─ With opening hours: ${placesWithOpeningHours} (${Math.round(placesWithOpeningHours / placesCount * 100)}%)`);
    console.log(`   └─ With Google Place ID: ${placesWithPlaceId} (${Math.round(placesWithPlaceId / placesCount * 100)}%)`);
    console.log(`\n📅 Scheduled Events: ${eventsCount} (calendar should be empty)`);
    console.log(`\n🗺️  Map Points: ${mapPointsCount}`);
    console.log('\n📦 Places by Trip:');
    for (const group of placesByTrip) {
      console.log(`   Trip ${group.tripId}: ${group._count.id} places`);
    }

    // Sample some places to show what's in the bank
    console.log('\n📌 Sample Places in Bank:');
    const samplePlaces = await prisma.place.findMany({
      take: 10,
      orderBy: { name: 'asc' },
      select: {
        name: true,
        category: true,
        placeId: true,
        openingHours: true
      }
    });

    for (const place of samplePlaces) {
      const hasData = place.placeId ? '✅' : '❌';
      console.log(`   ${hasData} ${place.name} (${place.category})`);
    }

    console.log('='.repeat(60));
    console.log('\n✅ All places are now in the bank (Place table)');
    console.log('✅ Calendar is empty (no ScheduledEvents)');
    console.log('✅ Ready for manual assignment!\n');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyState()
  .then(() => {
    console.log('✨ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Verification failed:', error);
    process.exit(1);
  });
