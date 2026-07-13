import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  airportLabel,
  fetchLiveFlight,
  isLiveFlightEnabled,
  minutesUntil,
  normalizeFlightNumber,
} from '../services/flights.service';

async function assertMember(tripId: string, userId: string) {
  return prisma.tripMember.findUnique({
    where: { userId_tripId: { userId, tripId } },
  });
}

function serialize(f: any) {
  const live = f.liveData as any;
  const dep =
    f.departureAirport ||
    airportLabel(live?.departure?.iata, live?.departure?.airport) ||
    live?.departureLabel ||
    null;
  const arr =
    f.arrivalAirport ||
    airportLabel(live?.arrival?.iata, live?.arrival?.airport) ||
    live?.arrivalLabel ||
    null;

  // Prefer user's planned departure; only use live schedule times when date matches
  const liveDepIso =
    live?.dateMatched === false
      ? null
      : live?.departure?.estimated || live?.departure?.scheduled || null;

  const depIso =
    (f.departureAt instanceof Date
      ? f.departureAt.toISOString()
      : f.departureAt) || liveDepIso;

  const statusLabel =
    live?.statusLabel ||
    (live?.status ? String(live.status) : null);

  return {
    id: f.id,
    tripId: f.tripId,
    flightNumber: f.flightNumber,
    flightDate: f.flightDate,
    direction: f.direction,
    airline: f.airline || live?.airline || null,
    departureAirport: dep,
    arrivalAirport: arr,
    departureAt: f.departureAt,
    arrivalAt: f.arrivalAt,
    notes: f.notes,
    liveData: f.liveData,
    liveFetchedAt: f.liveFetchedAt,
    statusLabel,
    statusNote: live?.statusNote || null,
    dateMatched: live?.dateMatched !== false,
    minutesUntilDeparture: minutesUntil(depIso),
    createdByUserId: f.createdByUserId,
    createdBy: f.createdBy
      ? { id: f.createdBy.id, name: f.createdBy.name, avatarUrl: f.createdBy.avatarUrl }
      : null,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

function pickFromLive(live: any) {
  if (!live) {
    return {
      airline: null as string | null,
      departureAirport: null as string | null,
      arrivalAirport: null as string | null,
      departureAt: null as Date | null,
      arrivalAt: null as Date | null,
    };
  }
  return {
    airline: live.airline || null,
    departureAirport: live.departureLabel || airportLabel(live.departure?.iata, live.departure?.airport),
    arrivalAirport: live.arrivalLabel || airportLabel(live.arrival?.iata, live.arrival?.airport),
    departureAt: live.departure?.scheduled ? new Date(live.departure.scheduled) : null,
    arrivalAt: live.arrival?.scheduled ? new Date(live.arrival.scheduled) : null,
  };
}

export const listFlights = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    if (!(await assertMember(tripId, req.userId!))) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const flights = await prisma.tripFlight.findMany({
      where: { tripId },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: [{ departureAt: 'asc' }, { createdAt: 'asc' }],
    });

    res.json({
      flights: flights.map(serialize),
      liveEnabled: isLiveFlightEnabled(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת טיסות' });
  }
};

export const createFlight = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params as { tripId: string };
    const userId = req.userId!;
    if (!(await assertMember(tripId, userId))) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    const {
      flightNumber,
      flightDate,
      direction,
      airline,
      departureAirport,
      arrivalAirport,
      departureAt,
      arrivalAt,
      notes,
      refreshLive,
    } = req.body;

    if (!flightNumber?.trim()) {
      res.status(400).json({ error: 'מספר טיסה חובה' });
      return;
    }

    const num = normalizeFlightNumber(flightNumber);
    let liveData: any = null;
    let liveFetchedAt: Date | null = null;

    if (refreshLive !== false) {
      liveData = await fetchLiveFlight(num, flightDate);
      if (liveData) liveFetchedAt = new Date();
      else console.warn('[flights] no live data for', num, flightDate || '(no date)');
    }

    const fromLive = pickFromLive(liveData);

    const flight = await prisma.tripFlight.create({
      data: {
        tripId,
        flightNumber: num,
        flightDate: flightDate ? new Date(flightDate) : null,
        direction: direction || 'outbound',
        airline: airline?.trim() || fromLive.airline || null,
        departureAirport: departureAirport?.trim() || fromLive.departureAirport || null,
        arrivalAirport: arrivalAirport?.trim() || fromLive.arrivalAirport || null,
        departureAt: departureAt
          ? new Date(departureAt)
          : fromLive.departureAt,
        arrivalAt: arrivalAt
          ? new Date(arrivalAt)
          : fromLive.arrivalAt,
        notes: notes?.trim() || null,
        liveData: liveData || undefined,
        liveFetchedAt,
        createdByUserId: userId,
      },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.status(201).json({
      flight: serialize(flight),
      liveFound: Boolean(liveData),
      warning: liveData
        ? null
        : 'לא נמצאו נתונים חיים לטיסה — בדקו מספר/תאריך או מלאו מוצא ויעד ידנית',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהוספת טיסה' });
  }
};

export const refreshFlight = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { flightId } = req.params as { flightId: string };
    const flight = await prisma.tripFlight.findUnique({ where: { id: flightId } });
    if (!flight) {
      res.status(404).json({ error: 'טיסה לא נמצאה' });
      return;
    }
    if (!(await assertMember(flight.tripId, req.userId!))) {
      res.status(403).json({ error: 'אינך חבר בטיול זה' });
      return;
    }

    if (!isLiveFlightEnabled()) {
      res.status(503).json({
        error: 'חיפוש חי דורש מפתח AviationStack בשרת',
        flight: serialize(flight),
      });
      return;
    }

    const live = await fetchLiveFlight(
      flight.flightNumber,
      flight.flightDate?.toISOString().slice(0, 10),
    );

    if (!live) {
      res.status(502).json({
        error: 'לא נמצאו נתונים חיים לטיסה זו (בדקו מספר/תאריך)',
        flight: serialize(flight),
      });
      return;
    }

    const fromLive = pickFromLive(live);

    const updated = await prisma.tripFlight.update({
      where: { id: flightId },
      data: {
        liveData: live as any,
        liveFetchedAt: new Date(),
        airline: flight.airline || fromLive.airline || null,
        // fill missing airports; also upgrade if still empty
        departureAirport: flight.departureAirport || fromLive.departureAirport || null,
        arrivalAirport: flight.arrivalAirport || fromLive.arrivalAirport || null,
        departureAt: flight.departureAt || fromLive.departureAt,
        arrivalAt: flight.arrivalAt || fromLive.arrivalAt,
      },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.json({ flight: serialize(updated), live: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון טיסה' });
  }
};

export const deleteFlight = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { flightId } = req.params as { flightId: string };
    const flight = await prisma.tripFlight.findUnique({
      where: { id: flightId },
      include: { trip: { include: { members: true } } },
    });
    if (!flight) {
      res.status(404).json({ error: 'טיסה לא נמצאה' });
      return;
    }
    const member = flight.trip.members.find((m) => m.userId === req.userId);
    if (!member) {
      res.status(403).json({ error: 'אין גישה' });
      return;
    }
    if (flight.createdByUserId !== req.userId && member.role !== 'ADMIN') {
      res.status(403).json({ error: 'רק היוצר או מנהל יכולים למחוק' });
      return;
    }

    await prisma.tripFlight.delete({ where: { id: flightId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה במחיקת טיסה' });
  }
};
