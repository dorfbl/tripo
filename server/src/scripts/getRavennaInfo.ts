/**
 * Get all info for Ravenna Gorge from Place table
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getRavennaInfo() {
  try {
    const ravennaPlaces = await prisma.place.findMany({
      where: {
        name: {
          contains: 'Ravenna',
          mode: 'insensitive'
        }
      },
      include: {
        photos: true,
        files: true,
        votes: true,
        mapPoints: true,
        scheduledEvents: true,
      }
    });

    console.log(`\n📍 Found ${ravennaPlaces.length} place(s) with "Ravenna" in name:\n`);

    ravennaPlaces.forEach(place => {
      console.log('='.repeat(80));
      console.log(JSON.stringify(place, null, 2));
      console.log('='.repeat(80));
    });

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

getRavennaInfo()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
