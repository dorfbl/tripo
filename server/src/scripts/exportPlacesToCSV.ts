/**
 * Export all places to CSV file
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function exportPlacesToCSV() {
  try {
    const places = await prisma.place.findMany({
      orderBy: { createdAt: 'asc' }
    });

    console.log(`\n📊 Exporting ${places.length} places to CSV...\n`);

    // CSV header
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

    // Helper to escape CSV values
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';

      // Handle objects (like openingHours JSON)
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }

      const str = String(value);

      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }

      return str;
    };

    // Build CSV rows
    const rows = places.map(place =>
      headers.map(header => escapeCSV((place as any)[header])).join(',')
    );

    // Combine header + rows
    const csv = [headers.join(','), ...rows].join('\n');

    // Output CSV to console
    console.log(csv);

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportPlacesToCSV()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
