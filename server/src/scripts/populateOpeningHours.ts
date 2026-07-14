/**
 * Script to populate opening hours for existing TripPlace records
 * Usage: npx ts-node src/scripts/populateOpeningHours.ts
 */

import { PrismaClient } from '@prisma/client';
import { fetchPlaceDetails, extractOpeningHours } from '../services/googlePlaces.service';

const prisma = new PrismaClient();

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function populateOpeningHours() {
  try {
    console.log('🚀 Starting opening hours population...\n');

    // Get all places
    const places = await prisma.tripPlace.findMany({
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        category: true,
        placeId: true,
        openingHours: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📍 Found ${places.length} places to process\n`);

    if (places.length === 0) {
      console.log('✅ All places already have opening hours data!');
      return;
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      console.log(`[${i + 1}/${places.length}] Processing: ${place.name}`);

      try {
        // Fetch place details from Google Places API
        const placeDetails = await fetchPlaceDetails(place.name, place.lat, place.lng);

        if (!placeDetails) {
          console.log(`  ⚠️  No data found for: ${place.name}`);
          skipped++;

          // Wait a bit between API calls to avoid rate limiting
          await sleep(200);
          continue;
        }

        // Extract opening hours
        const openingHours = extractOpeningHours(placeDetails);

        // Update the place with Google Place ID and opening hours
        await prisma.tripPlace.update({
          where: { id: place.id },
          data: {
            placeId: placeDetails.place_id || place.placeId,
            openingHours: openingHours || undefined,
          },
        });

        if (openingHours) {
          console.log(`  ✅ Updated with opening hours`);
          if (openingHours.weekday_text && openingHours.weekday_text.length > 0) {
            console.log(`     Hours: ${openingHours.weekday_text[0]}`);
          }
          updated++;
        } else {
          console.log(`  ℹ️  Updated Place ID but no opening hours available`);
          skipped++;
        }

        // Wait between API calls to respect rate limits
        // Google Places API allows 10 requests per second
        await sleep(150);

      } catch (error: any) {
        console.error(`  ❌ Error processing ${place.name}:`, error.message);
        errors++;

        // Wait longer after an error
        await sleep(500);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📍 Total: ${places.length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
populateOpeningHours()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
