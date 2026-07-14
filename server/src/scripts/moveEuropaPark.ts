/**
 * Move Europa Park from demo trip to main trip
 * Demo trip: aee5b56b-66e6-4a1a-9e18-080d9b43dee4
 * Main trip: b389876f-9a01-4dda-b3a5-6b673a789468
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_TRIP = 'aee5b56b-66e6-4a1a-9e18-080d9b43dee4';
const MAIN_TRIP = 'b389876f-9a01-4dda-b3a5-6b673a789468';

async function moveEuropaPark() {
  console.log('🎢 Moving Europa Park to main trip...\n');

  try {
    // Find Europa Park in demo trip
    const europaPark = await prisma.place.findFirst({
      where: {
        tripId: DEMO_TRIP,
        name: { contains: 'Europa', mode: 'insensitive' }
      }
    });

    if (!europaPark) {
      console.log('❌ Europa Park not found in demo trip');
      return;
    }

    console.log(`Found: ${europaPark.name} (ID: ${europaPark.id})`);
    console.log(`Has opening hours: ${europaPark.openingHours ? 'yes' : 'no'}`);
    console.log(`Has placeId: ${europaPark.placeId || 'no'}`);

    // Check if Europa Park already exists in main trip
    const existingInMain = await prisma.place.findFirst({
      where: {
        tripId: MAIN_TRIP,
        name: { contains: 'Europa', mode: 'insensitive' }
      }
    });

    if (existingInMain && existingInMain.id !== europaPark.id) {
      console.log(`\n⚠️  Europa Park already exists in main trip: ${existingInMain.name}`);
      console.log('Merging data from demo trip version...');

      // Update with best data (from demo trip which has Google data)
      await prisma.place.update({
        where: { id: existingInMain.id },
        data: {
          placeId: europaPark.placeId || existingInMain.placeId,
          openingHours: europaPark.openingHours || existingInMain.openingHours,
          lat: europaPark.lat || existingInMain.lat,
          lng: europaPark.lng || existingInMain.lng,
          mapsUrl: europaPark.mapsUrl || existingInMain.mapsUrl,
          description: europaPark.description || existingInMain.description,
        }
      });

      console.log(`✅ Updated ${existingInMain.name} with data from demo trip`);

      // Delete the demo trip version (will be deleted with trip anyway)
      console.log('Demo trip version will be deleted with trip cleanup');
    } else {
      // Move Europa Park to main trip
      await prisma.place.update({
        where: { id: europaPark.id },
        data: { tripId: MAIN_TRIP }
      });

      console.log(`✅ Moved ${europaPark.name} to main trip`);
    }

  } catch (error) {
    console.error('❌ Move failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

moveEuropaPark()
  .then(() => {
    console.log('\n✨ Europa Park move complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
