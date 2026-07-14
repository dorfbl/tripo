const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function exportPlacesToCSV() {
  try {
    const places = await prisma.place.findMany({
      orderBy: { createdAt: 'asc' }
    });

    const headers = [
      'id',
      'tripId',
      'name',
      'description',
      'category',
      'lat',
      'lng',
      'placeId',
      'openingHours',
      'createdAt',
      'updatedAt'
    ];

    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = places.map(place =>
      headers.map(header => escapeCSV(place[header])).join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    console.log(csv);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportPlacesToCSV();
