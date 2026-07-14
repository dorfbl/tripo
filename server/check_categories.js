const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCategories() {
  const places = await prisma.place.findMany({
    select: { category: true, name: true }
  });

  const categoryMap = {};
  places.forEach(p => {
    if (!categoryMap[p.category]) {
      categoryMap[p.category] = [];
    }
    categoryMap[p.category].push(p.name);
  });

  console.log('\nCurrent categories in database:\n');
  Object.keys(categoryMap).sort().forEach(cat => {
    console.log(`${cat}: ${categoryMap[cat].length} places`);
    console.log(`  Examples: ${categoryMap[cat].slice(0, 3).join(', ')}`);
  });

  await prisma.$disconnect();
}

getCategories();
