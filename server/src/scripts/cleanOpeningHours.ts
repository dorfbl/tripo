/**
 * Clean opening hours from places that shouldn't have them:
 * 1. Remove "Open 24 hours" entries (airports, hotels, natural 24/7 places)
 * 2. Remove opening hours from natural places (gorges, waterfalls, mountains, parks)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanOpeningHours() {
  console.log('🧹 Cleaning opening hours...\n');

  try {
    // Get places with opening hours
    const placesWithHours = await prisma.place.findMany({
      where: {
        openingHours: { not: null }
      },
      select: {
        id: true,
        name: true,
        category: true,
        openingHours: true,
      },
    });

    console.log(`Found ${placesWithHours.length} places with opening hours\n`);

    const toClean: string[] = [];

    for (const place of placesWithHours) {
      const openingHours = place.openingHours as any;
      const hasWeekdayText = openingHours?.weekday_text && Array.isArray(openingHours.weekday_text);

      // Check for "Open 24 hours"
      const is24Hours = hasWeekdayText && openingHours.weekday_text.some((day: string) =>
        day.includes('Open 24 hours') ||
        day.includes('פתוח 24 שעות') ||
        day.includes('24 שעות')
      );

      // Check if it's a natural place that shouldn't have hours
      const isNaturalPlace =
        place.category === 'nature' ||
        place.category === 'scenic' ||
        place.category === 'outdoor' ||
        place.name.toLowerCase().includes('gorge') ||
        place.name.toLowerCase().includes('schlucht') || // German for gorge
        place.name.toLowerCase().includes('falls') ||
        place.name.toLowerCase().includes('waterfall') ||
        place.name.toLowerCase().includes('lake') ||
        place.name.toLowerCase().includes('see') || // German for lake
        place.name.toLowerCase().includes('mountain') ||
        place.name.toLowerCase().includes('berg') || // German for mountain
        place.name.toLowerCase().includes('forest') ||
        place.name.toLowerCase().includes('wald') || // German for forest
        place.name.toLowerCase().includes('מפלי') || // Hebrew for waterfalls
        place.name.toLowerCase().includes('חורבות') || // Hebrew for ruins
        place.name.toLowerCase().includes('גן') && place.category !== 'restaurant'; // Hebrew for garden (but not beer garden restaurants)

      // Clean if 24/7 OR natural place
      if (is24Hours || isNaturalPlace) {
        toClean.push(place.id);
        console.log(`🗑️  Removing hours from: ${place.name} (${place.category})`);
        if (is24Hours) console.log(`   Reason: 24/7`);
        if (isNaturalPlace) console.log(`   Reason: Natural place`);
      }
    }

    if (toClean.length > 0) {
      console.log(`\n📝 Cleaning ${toClean.length} places...\n`);

      await prisma.place.updateMany({
        where: { id: { in: toClean } },
        data: { openingHours: null }
      });

      console.log(`✅ Cleaned ${toClean.length} places`);
    } else {
      console.log('✅ No places to clean');
    }

    // Show remaining places with hours
    const remaining = await prisma.place.count({
      where: { openingHours: { not: null } }
    });

    console.log(`\n📊 Remaining places with opening hours: ${remaining}`);

  } catch (error) {
    console.error('❌ Clean failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanOpeningHours()
  .then(() => {
    console.log('\n✨ Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
