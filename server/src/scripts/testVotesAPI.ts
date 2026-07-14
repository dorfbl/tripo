/**
 * Test what getPlanner returns for votes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRIP_ID = 'b389876f-9a01-4dda-b3a5-6b673a789468';

async function testVotesAPI() {
  try {
    const places = await prisma.place.findMany({
      where: { tripId: TRIP_ID },
      orderBy: { createdAt: 'asc' },
      include: { files: true, votes: true },
      take: 5
    });

    console.log('\n📦 Sample of what getPlanner returns:\n');

    places.forEach(p => {
      console.log(`\n${p.name}:`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Votes count: ${p.votes.length}`);
      if (p.votes.length > 0) {
        console.log(`  Votes:`);
        p.votes.forEach(v => {
          console.log(`    - ${v.vote} (User: ${v.userId.slice(0, 8)}...)`);
        });
      }
    });

    // Check the specific structure returned
    const samplePlace = places.find(p => p.votes.length > 0);
    if (samplePlace) {
      console.log('\n📋 Full vote object structure:');
      console.log(JSON.stringify(samplePlace.votes[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testVotesAPI()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
