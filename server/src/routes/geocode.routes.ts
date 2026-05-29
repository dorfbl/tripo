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
    const url = `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}&key=${KEY}&fields=geometry,name&language=he`;
    const r = await fetch(url, {
      headers: { 'Referer': 'https://trip.kefar-sava.co.il/' },
    });
    const data: any = await r.json();

    if (data.status !== 'OK') {
      res.status(502).json({ error: 'לא ניתן לקבל פרטי מקום' }); return;
    }

    const loc = data.result.geometry.location;
    res.json({ lat: loc.lat, lng: loc.lng, name: data.result.name });
  } catch (err) {
    console.error('[geocode] details error:', err);
    res.status(500).json({ error: 'שגיאה בקבלת פרטי מקום' });
  }
});

export default router;
