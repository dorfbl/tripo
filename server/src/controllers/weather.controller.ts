import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { fetchWeatherForecast } from '../services/weather.service';

export const getTripWeather = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };

    const member = await prisma.tripMember.findUnique({
      where: { userId_tripId: { userId: req.userId!, tripId } },
    });
    if (!member) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        places: { orderBy: { createdAt: 'asc' }, take: 20 },
      },
    });
    if (!trip) {
      res.status(404).json({ error: 'טיול לא נמצא' });
      return;
    }

    // Prefer query lat/lng, then the trip's hotel (best signal for "where we are"),
    // then the first map place, then Munich default for demo trips
    const qLat = req.query.lat != null ? Number(req.query.lat) : null;
    const qLng = req.query.lng != null ? Number(req.query.lng) : null;
    const withCoords = trip.places.filter((p) => p.lat != null && p.lng != null);
    const place =
      withCoords.find((p) => p.category === 'hotel') || withCoords[0];

    const lat = qLat ?? place?.lat ?? 48.1351;
    const lng = qLng ?? place?.lng ?? 11.582;
    const label = place?.name || 'יעד הטיול';

    const weather = await fetchWeatherForecast(
      lat,
      lng,
      trip.startDate?.toISOString().slice(0, 10),
      trip.endDate?.toISOString().slice(0, 10),
      label,
    );

    res.json({ weather });
  } catch (err) {
    console.error('[weather]', err);
    res.status(502).json({ error: 'לא ניתן לטעון מזג אוויר כרגע' });
  }
};
