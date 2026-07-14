/**
 * Check places with opening hours that shouldn't have them
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOpeningHours() {
  console.log('🔍 Checking places with opening hours...\n');

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
        placeId: true,
      },
      orderBy: { name: 'asc' }
    });

    console.log(`Found ${placesWithHours.length} places with opening hours\n`);

    // Categories that shouldn't have opening hours (natural places, parks, etc.)
    const naturalCategories = ['nature', 'scenic', 'outdoor', 'park', 'gorge', 'waterfall', 'mountain', 'lake', 'river', 'forest', 'beach'];

    for (const place of placesWithHours) {
      const openingHours = place.openingHours as any;
      const hasWeekdayText = openingHours?.weekday_text && Array.isArray(openingHours.weekday_text);

      // Check if it's a natural place
      const isNaturalPlace = naturalCategories.some(cat =>
        place.category?.toLowerCase().includes(cat) ||
        place.name.toLowerCase().includes('gorge') ||
        place.name.toLowerCase().includes('falls') ||
        place.name.toLowerCase().includes('lake') ||
        place.name.toLowerCase().includes('mountain') ||
        place.name.toLowerCase().includes('forest')
      );

      // Check for "Open 24 hours" or similar
      const is24Hours = hasWeekdayText && openingHours.weekday_text.some((day: string) =>
        day.includes('Open 24 hours') || day.includes('24 שעות')
      );

      if (isNaturalPlace || is24Hours) {
        console.log(`⚠️  ${place.name} (${place.category})`);
        if (is24Hours) {
          console.log(`   📅 24/7: ${openingHours.weekday_text[0]}`);
        }
        if (isNaturalPlace) {
          console.log(`   🌲 Natural place - shouldn't have opening hours`);
        }
        console.log(`   ID: ${place.id}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkOpeningHours()
  .then(() => {
    console.log('✨ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
