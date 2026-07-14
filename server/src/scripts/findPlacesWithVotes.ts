/**
 * Find places that have votes and compare placeIds
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRIP_ID = 'b389876f-9a01-4dda-b3a5-6b673a789468';

async function findPlacesWithVotes() {
  try {
    // Get all votes
    const allVotes = await prisma.placeVote.findMany({
      where: { tripId: TRIP_ID },
      select: { placeId: true, vote: true }
    });

    console.log(`\n📊 Total votes for trip: ${allVotes.length}\n`);

    // Group by placeId
    const votesByPlace: Record<string, string[]> = {};
    allVotes.forEach(v => {
      if (!votesByPlace[v.placeId]) votesByPlace[v.placeId] = [];
      votesByPlace[v.placeId].push(v.vote);
    });

    console.log(`Votes spread across ${Object.keys(votesByPlace).length} different place IDs\n`);

    // Check if these placeIds exist in Place table
    const placeIds = Object.keys(votesByPlace);
    const existingPlaces = await prisma.place.findMany({
      where: {
        id: { in: placeIds },
        tripId: TRIP_ID
      },
      select: { id: true, name: true }
    });

    console.log(`Found ${existingPlaces.length} places in Place table\n`);

    // Show sample
    existingPlaces.slice(0, 10).forEach(p => {
      const votes = votesByPlace[p.id] || [];
      console.log(`  ${p.name}: ${votes.length} votes`);
    });

    // Check for orphaned votes
    const existingPlaceIds = new Set(existingPlaces.map(p => p.id));
    const orphanedVoteIds = placeIds.filter(id => !existingPlaceIds.has(id));

    if (orphanedVoteIds.length > 0) {
      console.log(`\n⚠️  Found ${orphanedVoteIds.length} place IDs with votes but no Place record!`);
      console.log(`   These votes are orphaned - places were probably deleted during cleanup\n`);
    }

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

findPlacesWithVotes()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
