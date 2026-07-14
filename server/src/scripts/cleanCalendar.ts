/**
 * Clean calendar: Delete all scheduled events
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanCalendar() {
  console.log('🗑️  Deleting all scheduled events from calendar...\n');

  try {
    const result = await prisma.scheduledEvent.deleteMany({});

    console.log(`✅ Deleted ${result.count} scheduled events`);
    console.log('📍 Calendar is now empty - all places remain in the bank\n');

  } catch (error) {
    console.error('❌ Failed to clean calendar:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanCalendar()
  .then(() => {
    console.log('✨ Calendar cleaned successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Clean failed:', error);
    process.exit(1);
  });
