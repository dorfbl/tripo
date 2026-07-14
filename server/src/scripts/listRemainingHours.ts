/**
 * List remaining places with opening hours
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listRemainingHours() {
  try {
    const places = await prisma.place.findMany({
      where: { openingHours: { not: null } },
      select: { name: true, category: true },
      orderBy: { name: 'asc' }
    });

    console.log(`\n✅ ${places.length} places with opening hours (legitimate):\n`);
    places.forEach(p => console.log(`  - ${p.name} (${p.category})`));
    console.log('');

  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

listRemainingHours()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
