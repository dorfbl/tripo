const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const TRIP_ID = 'b389876f-9a01-4dda-b3a5-6b673a789468'; // Default trip ID

async function importPlacesFromCSV() {
  try {
    console.log('\n🔥 Starting import process...\n');

    // Read CSV file
    const csvContent = fs.readFileSync('places_fixed.csv', 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    // Skip header and BOM
    const dataLines = lines.slice(1);

    console.log(`📄 Found ${dataLines.length} places in CSV\n`);

    // 1. Delete old Place table data
    console.log('🗑️  Deleting old places...');
    const deleteResult = await prisma.place.deleteMany({});
    console.log(`   Deleted ${deleteResult.count} old places\n`);

    // 2. Parse CSV and insert new data
    let imported = 0;
    let errors = 0;

    for (const line of dataLines) {
      if (!line.trim()) continue;

      try {
        // Parse CSV line (handle quoted fields)
        const fields = parseCSVLine(line);

        if (fields.length < 18) {
          console.log(`⚠️  Skipping incomplete line: ${line.substring(0, 50)}...`);
          continue;
        }

        const [
          id,
          tripId,
          name,
          name_original,
          category,
          description_he,
          address,
          lat,
          lng,
          rating,
          rating_count,
          opening_hours,
          cost,
          estimated_duration,
          website,
          google_maps_link,
          placeId,
          notes
        ] = fields;

        // Parse opening hours JSON if exists
        let openingHoursJson = null;
        if (opening_hours && opening_hours.trim() && opening_hours !== 'פתוח 24/7') {
          try {
            // Try to parse as JSON first
            openingHoursJson = JSON.parse(opening_hours);
          } catch {
            // If not JSON, create simple structure
            openingHoursJson = {
              weekday_text: [opening_hours]
            };
          }
        }

        // Create place with ALL CSV fields
        await prisma.place.create({
          data: {
            id: id || undefined,
            tripId: TRIP_ID, // Use single trip ID for all
            name: name || 'Unnamed',
            nameOriginal: name_original || null,
            description: description_he || null,
            category: category || 'other',
            location: address || null,
            lat: lat ? parseFloat(lat) : null,
            lng: lng ? parseFloat(lng) : null,
            placeId: placeId || null,
            openingHours: openingHoursJson,
            rating: rating ? parseFloat(rating) : null,
            ratingCount: rating_count ? parseInt(rating_count) : null,
            mapsUrl: google_maps_link || null,
            url: website || null,
            cost: cost || null,
            estimatedDuration: estimated_duration || null,
            notes: notes || null,
          }
        });

        imported++;
        if (imported % 10 === 0) {
          console.log(`   Imported ${imported} places...`);
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error importing line: ${error.message}`);
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Successfully imported: ${imported} places`);
    console.log(`   Errors: ${errors}\n`);

  } catch (error) {
    console.error('💥 Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to parse CSV line with quoted fields
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Push last field
  fields.push(current);

  return fields;
}

importPlacesFromCSV();
