import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { config } from '../config/env';

const router = Router();
const KEY = config.googleMapsKey;

// Photon fallback
async function photonSearch(q: string) {
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=he`);
  const data: any = await r.json();
  return (data.features ?? []).map((f: any) => {
    const p = f.properties ?? {};
    const city    = p.city || p.county || p.district || '';
    const country = p.country || '';
    return {
      placeId:  null,
      lat:      f.geometry.coordinates[1],
      lng:      f.geometry.coordinates[0],
      name:     p.name || q,
      subtitle: [city, country].filter(Boolean).join(', '),
    };
  });
}

// GET /api/geocode/search?q=יורו דיסני
router.get('/search', authenticateToken, async (req: Request, res: Response) => {
  const q = (req.query['q'] as string | undefined)?.trim();
  if (!q) { res.status(400).json({ error: 'חסר פרמטר q' }); return; }

  // נסה Google קודם, fallback ל-Photon
  if (KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(q)}&key=${KEY}&language=he&types=establishment|geocode`;
      const r    = await fetch(url, {
        headers: { 'Referer': 'https://trip.kefar-sava.co.il/' },
      });
      const data: any = await r.json();

      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        const results = (data.predictions ?? []).map((p: any) => ({
          placeId:  p.place_id,
          lat:      null,
          lng:      null,
          name:     p.structured_formatting?.main_text    || p.description,
          subtitle: p.structured_formatting?.secondary_text || '',
        }));
        res.json({ results, source: 'google' }); return;
      }
      // Google נכשל (billing?) — עבור ל-Photon
      console.warn('[geocode] Google status:', data.status, '— falling back to Photon');
    } catch (err) {
      console.warn('[geocode] Google fetch failed:', err);
    }
  }

  // Photon fallback
  try {
    const results = await photonSearch(q);
    res.json({ results, source: 'photon' });
  } catch (err) {
    console.error('[geocode] Photon error:', err);
    res.status(500).json({ error: 'שגיאה בחיפוש' });
  }
});

// GET /api/geocode/details/:placeId
router.get('/details/:placeId', authenticateToken, async (req: Request, res: Response) => {
  const { placeId } = req.params as { placeId: string };
  if (!KEY) { res.status(500).json({ error: 'Google Maps key לא מוגדר' }); return; }

  try {
    const fields = [
      'geometry',
      'name',
      'formatted_address',
      'rating',
      'user_ratings_total',
      'opening_hours',
      'website',
      'url',
      'price_level',
      'types',
      'international_phone_number',
      'formatted_phone_number',
    ].join(',');

    const url = `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}&key=${KEY}&fields=${fields}&language=he`;
    const r = await fetch(url, {
      headers: { 'Referer': 'https://trip.kefar-sava.co.il/' },
    });
    const data: any = await r.json();

    if (data.status !== 'OK') {
      res.status(502).json({ error: 'לא ניתן לקבל פרטי מקום' }); return;
    }

    const result = data.result;
    const loc = result.geometry?.location;

    // Parse opening hours
    let openingHours = null;
    if (result.opening_hours?.open_now === true) {
      openingHours = null; // null = 24/7
    } else if (result.opening_hours?.weekday_text) {
      openingHours = { weekday_text: result.opening_hours.weekday_text };
    }

    // Estimate duration based on place type
    let estimatedDuration = null;
    const types = result.types || [];
    if (types.includes('restaurant') || types.includes('cafe') || types.includes('bar')) {
      estimatedDuration = '1-2 שעות';
    } else if (types.includes('museum') || types.includes('art_gallery')) {
      estimatedDuration = '2-3 שעות';
    } else if (types.includes('park') || types.includes('tourist_attraction')) {
      estimatedDuration = '1-3 שעות';
    } else if (types.includes('shopping_mall') || types.includes('store')) {
      estimatedDuration = '1-2 שעות';
    }

    // Cost based on price_level
    let cost = null;
    if (result.price_level != null) {
      const priceLevels = ['זול', 'בינוני', 'יקר', 'יקר מאוד'];
      cost = priceLevels[Math.min(result.price_level - 1, 3)] || null;
    }

    res.json({
      placeId,
      lat: loc?.lat || null,
      lng: loc?.lng || null,
      name: result.name || null,
      nameOriginal: result.name || null,
      location: result.formatted_address || null,
      rating: result.rating || null,
      ratingCount: result.user_ratings_total || null,
      openingHours,
      url: result.website || null,
      mapsUrl: result.url || null,
      cost,
      estimatedDuration,
      types: result.types || [],
    });
  } catch (err) {
    console.error('[geocode] details error:', err);
    res.status(500).json({ error: 'שגיאה בקבלת פרטי מקום' });
  }
});

// GET /api/geocode/rate/:currency?to=TARGET  — שער המרה דרך Frankfurter
router.get('/rate/:currency', authenticateToken, async (req: Request, res: Response) => {
  const { currency } = req.params as { currency: string };
  const to = ((req.query as Record<string, string>)['to'] ?? 'ILS').toUpperCase();
  if (currency === to) { res.json({ rate: 1, date: new Date().toISOString().slice(0, 10) }); return; }
  try {
    const r = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=${to}`, { redirect: 'follow' });
    const data: any = await r.json();
    if (!data.rates?.[to]) { res.status(502).json({ error: 'שער לא נמצא' }); return; }
    res.json({ rate: data.rates[to], date: data.date });
  } catch (err) {
    console.error('[rate]', err);
    res.status(500).json({ error: 'שגיאה בקבלת שער' });
  }
});

export default router;
