/**
 * Check votes in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVotes() {
  try {
    const votes = await prisma.placeVote.findMany({
      include: {
        place: {
          select: { name: true, tripId: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    console.log(`\n📊 Found ${votes.length} votes in PlaceVote table:\n`);

    const votesByTrip: Record<string, any[]> = {};

    votes.forEach(v => {
      const tripId = v.place.tripId;
      if (!votesByTrip[tripId]) votesByTrip[tripId] = [];
      votesByTrip[tripId].push(v);
    });

    for (const [tripId, tripVotes] of Object.entries(votesByTrip)) {
      console.log(`\nTrip ${tripId}:`);
      console.log(`  Total votes: ${tripVotes.length}`);

      tripVotes.slice(0, 5).forEach(v => {
        console.log(`  - ${v.place.name}: ${v.vote} (User: ${v.userId})`);
      });
    }

    // Check total count
    const totalVotes = await prisma.placeVote.count();
    console.log(`\n✅ Total votes in database: ${totalVotes}\n`);

  } catch (error) {
    console.error('❌ Check failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkVotes()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
