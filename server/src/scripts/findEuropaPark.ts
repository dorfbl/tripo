/**
 * Find Europa Park places
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findEuropaPark() {
  console.log('🔍 Searching for Europa Park places...\n');

  try {
    // Search for Europa in name
    const europaPlaces = await prisma.place.findMany({
      where: {
        name: {
          contains: 'Europa',
          mode: 'insensitive'
        }
      }
    });

    console.log(`Found ${europaPlaces.length} places with "Europa" in name:\n`);
    for (const place of europaPlaces) {
      console.log(`  📍 ${place.name}`);
      console.log(`     ID: ${place.id}`);
      console.log(`     Trip: ${place.tripId}`);
      console.log(`     Category: ${place.category}`);
      console.log(`     PlaceId: ${place.placeId || 'none'}`);
      console.log(`     Opening hours: ${place.openingHours ? 'yes' : 'no'}`);
      console.log('');
    }

    // Also search for "Traumatica" (Halloween event)
    const traumatica = await prisma.place.findMany({
      where: {
        name: {
          contains: 'Traumatica',
          mode: 'insensitive'
        }
      }
    });

    if (traumatica.length > 0) {
      console.log(`\nFound ${traumatica.length} places with "Traumatica":\n`);
      for (const place of traumatica) {
        console.log(`  📍 ${place.name}`);
        console.log(`     ID: ${place.id}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Search failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

findEuropaPark()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
