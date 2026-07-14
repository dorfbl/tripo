/**
 * Search for Ravenna Gorge in Google Places API
 */

import fetch from 'node-fetch';

const GOOGLE_API_KEY = 'AIzaSyB-EbZliVoq-Z0bOXFKVXL0I1fjU2s04zw';

async function searchRavennaGoogle() {
  try {
    console.log('🔍 Searching for Ravenna Gorge in Google Places API...\n');

    // Try Text Search (New)
    const textSearchUrl = 'https://places.googleapis.com/v1/places:searchText';

    const response = await fetch(textSearchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.regularOpeningHours,places.currentOpeningHours,places.types'
      },
      body: JSON.stringify({
        textQuery: 'Ravenna Gorge Hinterzarten Germany',
        languageCode: 'en'
      })
    });

    const data = await response.json();

    console.log('📍 Results from Google Places API (New):\n');
    console.log(JSON.stringify(data, null, 2));

  } catch (error: any) {
    console.error('❌ Search failed:', error.message);

    // Try old API as fallback
    console.log('\n🔄 Trying old Places API (Text Search)...\n');

    try {
      const oldApiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=Ravenna+Gorge+Hinterzarten+Germany&key=${GOOGLE_API_KEY}`;

      const oldResponse = await fetch(oldApiUrl);
      const oldData = await oldResponse.json();

      console.log('📍 Results from old API:\n');
      console.log(JSON.stringify(oldData, null, 2));

      if (oldData.results?.[0]) {
        const place = oldData.results[0];
        console.log('\n📌 First result:');
        console.log(`   Name: ${place.name}`);
        console.log(`   Place ID: ${place.place_id}`);
        console.log(`   Address: ${place.formatted_address}`);
        console.log(`   Location: ${place.geometry?.location.lat}, ${place.geometry?.location.lng}`);
        console.log(`   Types: ${place.types?.join(', ')}`);
        console.log(`   Opening hours: ${place.opening_hours ? 'Yes' : 'No'}`);

        // Get details if we found it
        if (place.place_id) {
          console.log('\n🔍 Getting detailed info...\n');

          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,opening_hours,current_opening_hours,business_status&key=${GOOGLE_API_KEY}`;

          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();
          console.log('📋 Details:');
          console.log(JSON.stringify(detailsData, null, 2));
        }
      }

    } catch (oldError: any) {
      console.error('❌ Old API also failed:', oldError.message);
    }
  }
}

searchRavennaGoogle()
  .then(() => {
    console.log('\n✅ Search complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
