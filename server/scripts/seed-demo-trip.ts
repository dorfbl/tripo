/**
 * Seed a full demo trip for testing TRIPO.
 * Admin: dorfbl@gmail.com
 *
 * Run: cd server && npx ts-node --transpile-only scripts/seed-demo-trip.ts
 */
import { prisma } from '../src/lib/prisma';

const ADMIN_EMAIL = 'dorfbl@gmail.com';

function daysFromNow(n: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error(`User ${ADMIN_EMAIL} not found — register first`);
  }

  const others = await prisma.user.findMany({
    where: { email: { not: ADMIN_EMAIL } },
    take: 5,
  });

  // Clean previous demo with same name if re-run
  const existing = await prisma.trip.findMany({
    where: { name: { contains: 'דמו' } },
    select: { id: true },
  });
  for (const t of existing) {
    await prisma.trip.delete({ where: { id: t.id } });
    console.log('deleted old demo', t.id);
  }

  const start = daysFromNow(14);
  const end = daysFromNow(21);

  const trip = await prisma.trip.create({
    data: {
      name: '🇩🇪 דמו — מינכן ויער שחור',
      startDate: start,
      endDate: end,
      status: 'PLAN',
      defaultCurrency: 'EUR',
      ownerId: admin.id,
      aiEnabled: true,
      members: {
        create: [
          { userId: admin.id, role: 'ADMIN' },
          ...others.map((u) => ({ userId: u.id, role: 'MEMBER' as const })),
        ],
      },
    },
    include: { members: { include: { user: true } } },
  });

  const byEmail = Object.fromEntries(
    trip.members.map((m) => [m.user.email, m.user]),
  );
  const dor = byEmail[ADMIN_EMAIL]!;
  const aviram = byEmail['aviram274@gmail.com'] || others[0];
  const idan = byEmail['idansabov@gmail.com'] || others[1] || dor;
  const guy = byEmail['guyshahar3@walla.co.il'] || others[2] || dor;
  const yoav = byEmail['yoav.faigen@gmail.com'] || others[3] || dor;
  const allIds = trip.members.map((m) => m.userId);

  console.log('trip', trip.id, trip.name);
  console.log('members', trip.members.map((m) => `${m.user.name}(${m.role})`).join(', '));

  // ── Decisions ─────────────────────────────────────────────────────────────
  const hotelDecision = await prisma.decision.create({
    data: {
      tripId: trip.id,
      title: 'איפה ללון במינכן?',
      description: 'בוחרים מלון מרכזי לקבוצה',
      category: 'HOTEL',
      type: 'SINGLE_CHOICE',
      status: 'DECIDED',
      finalDecision: 'Motel One Sendlinger Tor',
      decidedAt: new Date(),
      createdByUserId: dor.id,
      options: {
        create: [
          { text: 'Motel One Sendlinger Tor' },
          { text: 'Wombats City Hostel' },
          { text: 'Airbnb ב-Schwabing' },
        ],
      },
    },
    include: { options: true },
  });

  const carDecision = await prisma.decision.create({
    data: {
      tripId: trip.id,
      title: 'שוכרים רכב ליער שחור?',
      category: 'TRANSPORT',
      type: 'YES_NO',
      status: 'VOTING',
      createdByUserId: dor.id,
      options: {
        create: [{ text: 'כן' }, { text: 'לא' }],
      },
    },
    include: { options: true },
  });

  // votes
  for (const u of [dor, aviram, idan, guy]) {
    if (!u) continue;
    const opt = hotelDecision.options[0];
    await prisma.decisionVote.upsert({
      where: {
        decisionId_optionId_userId: {
          decisionId: hotelDecision.id,
          optionId: opt.id,
          userId: u.id,
        },
      },
      create: { decisionId: hotelDecision.id, optionId: opt.id, userId: u.id },
      update: {},
    });
  }
  if (carDecision.options[0] && aviram) {
    await prisma.decisionVote.create({
      data: {
        decisionId: carDecision.id,
        optionId: carDecision.options[0].id,
        userId: aviram.id,
      },
    });
  }
  if (carDecision.options[1] && idan) {
    await prisma.decisionVote.create({
      data: {
        decisionId: carDecision.id,
        optionId: carDecision.options[1].id,
        userId: idan.id,
      },
    });
  }

  // ── Links ─────────────────────────────────────────────────────────────────
  await prisma.tripLink.createMany({
    data: [
      {
        tripId: trip.id,
        title: 'טיסה הלוך TLV→MUC · LY353',
        url: 'https://www.elal.com',
        type: 'FLIGHT',
        status: 'BOOKED',
        providerName: 'El Al',
        isPinned: true,
        createdByUserId: dor.id,
        estimatedCost: 420,
        currency: 'EUR',
        notes: 'יציאה בבוקר',
      },
      {
        tripId: trip.id,
        title: 'טיסה חזור MUC→TLV · LY354',
        url: 'https://www.elal.com',
        type: 'FLIGHT',
        status: 'BOOKED',
        providerName: 'El Al',
        isPinned: true,
        createdByUserId: dor.id,
        estimatedCost: 390,
        currency: 'EUR',
      },
      {
        tripId: trip.id,
        title: 'Motel One — אישור הזמנה',
        url: 'https://www.motel-one.com',
        type: 'HOTEL',
        status: 'BOOKED',
        providerName: 'Motel One',
        isPinned: true,
        createdByUserId: dor.id,
        estimatedCost: 110,
        currency: 'EUR',
        decisionId: hotelDecision.id,
      },
      {
        tripId: trip.id,
        title: 'Sixt — השכרת רכב',
        url: 'https://www.sixt.com',
        type: 'CAR',
        status: 'PENDING',
        providerName: 'Sixt',
        createdByUserId: aviram?.id || dor.id,
        estimatedCost: 280,
        currency: 'EUR',
      },
      {
        tripId: trip.id,
        title: 'Europa-Park כרטיסים',
        url: 'https://www.europapark.de',
        type: 'ACTIVITY',
        status: 'SAVED',
        createdByUserId: guy?.id || dor.id,
        estimatedCost: 76,
        currency: 'EUR',
      },
      {
        tripId: trip.id,
        title: 'ביטוח נסיעות הקבוצה',
        type: 'INSURANCE',
        status: 'PAID',
        createdByUserId: dor.id,
        notes: 'פוליסה משותפת',
      },
      {
        tripId: trip.id,
        title: 'מפת מינכן — Google Maps',
        url: 'https://maps.google.com/?q=Munich',
        type: 'MAP',
        status: 'SAVED',
        createdByUserId: idan?.id || dor.id,
      },
    ],
  });

  // ── Flights ───────────────────────────────────────────────────────────────
  await prisma.tripFlight.createMany({
    data: [
      {
        tripId: trip.id,
        flightNumber: 'LY353',
        flightDate: start,
        direction: 'outbound',
        airline: 'El Al',
        departureAirport: 'TLV',
        arrivalAirport: 'MUC',
        departureAt: new Date(start.getTime() + 6 * 3600 * 1000),
        arrivalAt: new Date(start.getTime() + 10 * 3600 * 1000),
        createdByUserId: dor.id,
        notes: 'הלוך',
      },
      {
        tripId: trip.id,
        flightNumber: 'LY354',
        flightDate: end,
        direction: 'return',
        airline: 'El Al',
        departureAirport: 'MUC',
        arrivalAirport: 'TLV',
        departureAt: new Date(end.getTime() + 14 * 3600 * 1000),
        arrivalAt: new Date(end.getTime() + 18 * 3600 * 1000),
        createdByUserId: dor.id,
        notes: 'חזור',
      },
    ],
  });

  // ── Places ────────────────────────────────────────────────────────────────
  const placesData = [
    {
      name: 'Marienplatz',
      lat: 48.137154,
      lng: 11.576124,
      category: 'culture',
      notes: 'לב מינכן — Glockenspiel ב-11:00',
      mapsUrl: 'https://maps.google.com/?q=Marienplatz+Munich',
      date: isoDay(daysFromNow(15)),
      order: 0,
    },
    {
      name: 'English Garden',
      lat: 48.1642,
      lng: 11.6056,
      category: 'nature',
      notes: 'פארק ענק + Eisbachwelle',
      mapsUrl: 'https://maps.google.com/?q=English+Garden+Munich',
      date: isoDay(daysFromNow(15)),
      order: 1,
    },
    {
      name: 'Hofbräuhaus',
      lat: 48.1375,
      lng: 11.5798,
      category: 'restaurant',
      notes: 'בירה ואווירה — חובה פעם אחת',
      mapsUrl: 'https://maps.google.com/?q=Hofbrauhaus+Munich',
      date: isoDay(daysFromNow(15)),
      order: 2,
    },
    {
      name: 'BMW Welt',
      lat: 48.1767,
      lng: 11.559,
      category: 'activity',
      notes: 'מוזיאון + תצוגה',
      mapsUrl: 'https://maps.google.com/?q=BMW+Welt+Munich',
      date: isoDay(daysFromNow(16)),
      order: 3,
    },
    {
      name: 'Titisee',
      lat: 47.908,
      lng: 8.161,
      category: 'nature',
      notes: 'אגם ביער שחור',
      mapsUrl: 'https://maps.google.com/?q=Titisee+Germany',
      date: isoDay(daysFromNow(18)),
      order: 4,
    },
    {
      name: 'Europa-Park',
      lat: 48.266,
      lng: 7.722,
      category: 'activity',
      notes: 'יום שלם בפארק',
      mapsUrl: 'https://maps.google.com/?q=Europa+Park+Rust',
      date: isoDay(daysFromNow(19)),
      order: 5,
    },
  ];

  for (const p of placesData) {
    const item = await prisma.tripItem.create({
      data: {
        tripId: trip.id,
        kind: 'place',
        name: p.name,
        description: p.notes,
        category: p.category,
        mapsUrl: p.mapsUrl,
        lat: p.lat,
        lng: p.lng,
        emoji: '📍',
      },
    });
    await prisma.tripPlace.create({
      data: {
        tripId: trip.id,
        itemId: item.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        notes: p.notes,
        mapsUrl: p.mapsUrl,
        date: p.date,
        order: p.order,
        category: p.category,
      },
    });
  }

  // ── Expenses ──────────────────────────────────────────────────────────────
  const expDefs: {
    paidBy: string;
    amount: number;
    description: string;
    category: string;
    participants: string[];
    daysAgo: number;
  }[] = [
    {
      paidBy: dor.id,
      amount: 240,
      description: 'ארוחת ערב פתיחה — Hofbräuhaus',
      category: 'food',
      participants: allIds,
      daysAgo: 2,
    },
    {
      paidBy: aviram.id,
      amount: 85,
      description: 'מונית משדה התעופה (סימולציה)',
      category: 'transport',
      participants: [dor.id, aviram.id, idan.id],
      daysAgo: 1,
    },
    {
      paidBy: guy.id,
      amount: 120,
      description: 'סופרמרקט לקבוצה',
      category: 'food',
      participants: allIds,
      daysAgo: 1,
    },
    {
      paidBy: idan.id,
      amount: 64,
      description: 'כרטיסי מוזיאון BMW',
      category: 'activities',
      participants: [dor.id, idan.id, guy.id, yoav.id],
      daysAgo: 0,
    },
    {
      paidBy: dor.id,
      amount: 45,
      description: 'קפה ומאפים — Viktualienmarkt',
      category: 'food',
      participants: [dor.id, aviram.id],
      daysAgo: 0,
    },
  ];

  for (const e of expDefs) {
    const rate = 4.0; // EUR→ILS approx for demo
    const expenseDate = daysFromNow(-e.daysAgo);
    await prisma.tripExpense.create({
      data: {
        tripId: trip.id,
        paidByUserId: e.paidBy,
        amount: e.amount,
        currency: 'EUR',
        exchangeRate: rate,
        amountILS: Math.round(e.amount * rate * 100) / 100,
        description: e.description,
        category: e.category,
        expenseDate,
        participants: {
          create: e.participants.map((userId) => ({ userId })),
        },
      },
    });
  }

  // ── Planner activities + events ───────────────────────────────────────────
  const acts = [
    {
      name: 'Marienplatz + Glockenspiel',
      emoji: '🔔',
      category: 'munich',
      color: 'blue',
      durationMins: 90,
      location: 'מרכז מינכן',
      cost: 'חינם',
    },
    {
      name: 'English Garden + Eisbach',
      emoji: '🌳',
      category: 'munich',
      color: 'green',
      durationMins: 120,
      location: 'מינכן',
      cost: 'חינם',
    },
    {
      name: 'Hofbräuhaus',
      emoji: '🍺',
      category: 'food',
      color: 'orange',
      durationMins: 90,
      location: 'מרכז מינכן',
      cost: '€25–35',
    },
    {
      name: 'BMW Welt + Museum',
      emoji: '🚗',
      category: 'munich',
      color: 'blue',
      durationMins: 150,
      location: 'Olympiazentrum',
      cost: 'חינם / €10',
    },
    {
      name: 'אגם Titisee',
      emoji: '⛵',
      category: 'forest',
      color: 'green',
      durationMins: 150,
      location: 'יער שחור',
      cost: 'חינם / €12',
    },
    {
      name: 'Europa-Park',
      emoji: '🎢',
      category: 'special',
      color: 'red',
      durationMins: 540,
      location: 'Rust',
      cost: '€76',
    },
  ];

  const createdActs = [];
  for (const a of acts) {
    const item = await prisma.tripItem.create({
      data: {
        tripId: trip.id,
        kind: 'activity',
        name: a.name,
        category: a.category,
        emoji: a.emoji,
        color: a.color,
        durationMins: a.durationMins,
        location: a.location,
        cost: a.cost,
      },
    });
    const act = await prisma.plannerActivity.create({
      data: {
        tripId: trip.id,
        itemId: item.id,
        name: a.name,
        emoji: a.emoji,
        category: a.category,
        color: a.color,
        durationMins: a.durationMins,
        location: a.location,
        cost: a.cost,
      },
    });
    createdActs.push(act);

    // some votes
    for (const [u, vote] of [
      [dor, 'MUST'],
      [aviram, 'OK'],
      [idan, 'MUST'],
      [guy, 'IF_OTHERS'],
    ] as const) {
      if (!u) continue;
      await prisma.plannerActivityVote.create({
        data: {
          activityId: act.id,
          tripId: trip.id,
          userId: u.id,
          vote,
        },
      });
    }
  }

  // calendar events for first days of trip
  const day0 = isoDay(start);
  const day1 = isoDay(daysFromNow(15));
  const day2 = isoDay(daysFromNow(16));

  const schedule = [
    { title: 'נחיתה + צ׳ק אין', date: day0, startMinute: 12 * 60, durationMins: 120, color: 'blue' },
    { title: 'Marienplatz', date: day1, startMinute: 10 * 60, durationMins: 90, color: 'blue', activityId: createdActs[0]?.id },
    { title: 'English Garden', date: day1, startMinute: 13 * 60, durationMins: 120, color: 'green', activityId: createdActs[1]?.id },
    { title: 'Hofbräuhaus', date: day1, startMinute: 19 * 60, durationMins: 90, color: 'orange', activityId: createdActs[2]?.id },
    { title: 'BMW Welt', date: day2, startMinute: 11 * 60, durationMins: 150, color: 'blue', activityId: createdActs[3]?.id },
  ];

  for (const ev of schedule) {
    await prisma.plannerEvent.create({
      data: {
        tripId: trip.id,
        title: ev.title,
        date: ev.date,
        startMinute: ev.startMinute,
        durationMins: ev.durationMins,
        color: ev.color,
        activityId: ev.activityId,
      },
    });
  }

  // ── Timeline ──────────────────────────────────────────────────────────────
  const tl = [
    {
      type: 'MEMBER_JOINED' as const,
      category: 'members',
      title: `${dor.name} יצר/ה את הטיול`,
      emoji: '✈️',
      userId: dor.id,
      hoursAgo: 72,
    },
    {
      type: 'MEMBER_JOINED' as const,
      category: 'members',
      title: `${aviram.name} הצטרף/ה לטיול`,
      emoji: '✈️',
      userId: aviram.id,
      hoursAgo: 70,
    },
    {
      type: 'MEMBER_JOINED' as const,
      category: 'members',
      title: `${idan.name} הצטרף/ה לטיול`,
      emoji: '✈️',
      userId: idan.id,
      hoursAgo: 68,
    },
    {
      type: 'DECISION_CLOSED' as const,
      category: 'decisions',
      title: 'החלטה נסגרה: איפה ללון במינכן?',
      description: 'החלטה סופית: Motel One Sendlinger Tor',
      emoji: '📊',
      userId: dor.id,
      hoursAgo: 48,
    },
    {
      type: 'LINK_ADDED' as const,
      category: 'documents',
      title: 'מלון נוסף: Motel One — אישור הזמנה',
      emoji: '🏨',
      userId: dor.id,
      hoursAgo: 47,
    },
    {
      type: 'LINK_ADDED' as const,
      category: 'documents',
      title: 'טיסה נוספה: TLV→MUC · LY353',
      emoji: '✈️',
      userId: dor.id,
      hoursAgo: 46,
    },
    {
      type: 'PLACE_ADDED' as const,
      category: 'places',
      title: 'מקום נוסף: Marienplatz',
      emoji: '📍',
      userId: idan.id,
      hoursAgo: 30,
    },
    {
      type: 'PLACE_ADDED' as const,
      category: 'places',
      title: 'מקום נוסף: Hofbräuhaus',
      emoji: '📍',
      userId: guy.id,
      hoursAgo: 28,
    },
    {
      type: 'EXPENSE_ADDED' as const,
      category: 'expenses',
      title: 'הוצאה: ארוחת ערב פתיחה — Hofbräuhaus · €240',
      emoji: '💶',
      userId: dor.id,
      hoursAgo: 24,
    },
    {
      type: 'EXPENSE_ADDED' as const,
      category: 'expenses',
      title: 'הוצאה: סופרמרקט לקבוצה · €120',
      emoji: '💶',
      userId: guy.id,
      hoursAgo: 12,
    },
    {
      type: 'MEMORY' as const,
      category: 'memory',
      title: 'מתרגשים כבר!',
      description: 'הקבוצה סוגרת מלון וטיסות — מינכן בדרך 🇩🇪',
      emoji: '🎉',
      userId: dor.id,
      hoursAgo: 6,
    },
  ];

  for (const e of tl) {
    await prisma.timelineEvent.create({
      data: {
        tripId: trip.id,
        type: e.type,
        category: e.category,
        title: e.title,
        description: e.description || null,
        emoji: e.emoji,
        createdByUserId: e.userId,
        occurredAt: new Date(Date.now() - e.hoursAgo * 3600 * 1000),
      },
    });
  }

  // ── Notifications for admin ───────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: dor.id,
        tripId: trip.id,
        type: 'system',
        title: 'טיול דמו מוכן לבדיקה',
        body: 'מלא בהחלטות, הוצאות, מפה, קישורים, טיסות וציר זמן',
        emoji: '🧪',
        href: `/trip/${trip.id}/home`,
        isRead: false,
      },
      {
        userId: dor.id,
        tripId: trip.id,
        type: 'decision',
        title: 'החלטה עדיין פתוחה: רכב ליער שחור',
        body: 'כדאי לסגור לפני היציאה',
        emoji: '✅',
        href: `/trip/${trip.id}/plan/decisions`,
        isRead: false,
      },
      {
        userId: dor.id,
        tripId: trip.id,
        type: 'ai',
        title: 'טיפ: בדקו כרטיסי Europa-Park',
        body: 'יש קישור שמור — שווה לסגור הזמנה מוקדם',
        emoji: '🎢',
        href: `/trip/${trip.id}/links`,
        isRead: false,
        aiGenerated: true,
      },
    ],
  });

  console.log('\n✅ Demo trip ready');
  console.log('   id:     ', trip.id);
  console.log('   name:   ', trip.name);
  console.log('   admin:  ', ADMIN_EMAIL);
  console.log('   invite: ', trip.inviteCode);
  console.log('   open:   ', `https://trip.kefar-sava.co.il/trip/${trip.id}/home`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
