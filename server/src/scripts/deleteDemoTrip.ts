/**
 * Delete demo trip and all related data
 * Trip ID: aee5b56b-66e6-4a1a-9e18-080d9b43dee4
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_TRIP = 'aee5b56b-66e6-4a1a-9e18-080d9b43dee4';

async function deleteDemoTrip() {
  console.log('🗑️  Deleting demo trip and all related data...\n');

  try {
    // Get trip details
    const trip = await prisma.trip.findUnique({
      where: { id: DEMO_TRIP },
      include: {
        members: true,
        places: true,
        scheduledEvents: true,
        mapPoints: true,
      }
    });

    if (!trip) {
      console.log('❌ Demo trip not found');
      return;
    }

    console.log(`Trip: ${trip.name}`);
    console.log(`  Members: ${trip.members.length}`);
    console.log(`  Places: ${trip.places.length}`);
    console.log(`  Scheduled Events: ${trip.scheduledEvents.length}`);
    console.log(`  Map Points: ${trip.mapPoints.length}\n`);

    // Delete all related data manually (CASCADE not working)
    console.log('Deleting members...');
    await prisma.tripMember.deleteMany({ where: { tripId: DEMO_TRIP } });

    console.log('Deleting expenses and participants...');
    const expenses = await prisma.tripExpense.findMany({ where: { tripId: DEMO_TRIP }, select: { id: true } });
    for (const expense of expenses) {
      await prisma.expenseParticipant.deleteMany({ where: { expenseId: expense.id } });
    }
    await prisma.tripExpense.deleteMany({ where: { tripId: DEMO_TRIP } });

    console.log('Deleting links...');
    await prisma.tripLink.deleteMany({ where: { tripId: DEMO_TRIP } });

    console.log('Deleting decisions...');
    const decisions = await prisma.decision.findMany({ where: { tripId: DEMO_TRIP }, select: { id: true } });
    for (const decision of decisions) {
      await prisma.decisionVote.deleteMany({ where: { decisionId: decision.id } });
      await prisma.decisionOption.deleteMany({ where: { decisionId: decision.id } });
    }
    await prisma.decision.deleteMany({ where: { tripId: DEMO_TRIP } });

    console.log('Deleting flights...');
    await prisma.tripFlight.deleteMany({ where: { tripId: DEMO_TRIP } });

    console.log('Deleting timeline events...');
    await prisma.timelineEvent.deleteMany({ where: { tripId: DEMO_TRIP } });

    console.log('Deleting notifications...');
    await prisma.notification.deleteMany({ where: { tripId: DEMO_TRIP } });

    console.log('Deleting scheduled events...');
    await prisma.scheduledEvent.deleteMany({ where: { tripId: DEMO_TRIP } });

    console.log('Deleting map points...');
    await prisma.mapPoint.deleteMany({ where: { tripId: DEMO_TRIP } });

    console.log('Deleting places...');
    const places = await prisma.place.findMany({ where: { tripId: DEMO_TRIP }, select: { id: true } });
    for (const place of places) {
      await prisma.placePhoto.deleteMany({ where: { placeId: place.id } });
      await prisma.placeFile.deleteMany({ where: { placeId: place.id } });
      await prisma.placeVote.deleteMany({ where: { placeId: place.id } });
    }
    await prisma.place.deleteMany({ where: { tripId: DEMO_TRIP } });

    console.log('Deleting trip...');
    await prisma.trip.delete({ where: { id: DEMO_TRIP } });

    console.log(`✅ Deleted demo trip and all related data`);

  } catch (error) {
    console.error('❌ Delete failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteDemoTrip()
  .then(() => {
    console.log('\n✨ Demo trip deleted!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
