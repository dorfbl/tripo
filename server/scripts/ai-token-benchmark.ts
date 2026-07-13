/**
 * AI token / cost benchmark for TRIPO.
 *
 * Runs every Claude-backed feature with real trip data (or fixtures)
 * and prints input/output tokens + estimated USD.
 *
 * Usage (from server/):
 *   npx ts-node --transpile-only scripts/ai-token-benchmark.ts
 *   npx ts-node --transpile-only scripts/ai-token-benchmark.ts --trip=<tripId>
 *
 * Pricing defaults (Sonnet 4.x class — override via env):
 *   AI_PRICE_INPUT_PER_MTOK=3
 *   AI_PRICE_OUTPUT_PER_MTOK=15
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient } from '@prisma/client';
import {
  AI_MODEL,
  AI_PRICE_INPUT_PER_MTOK,
  AI_PRICE_OUTPUT_PER_MTOK,
  clearAiUsageLog,
  generateSmartNotifications,
  generateTimelineDayStories,
  getAiUsageLog,
  isAiConfigured,
  polishNotificationTips,
  polishTimelineLine,
  summarizeAiUsage,
} from '../src/services/ai.service';
import { buildAssistantTips } from '../src/services/assistant.service';

const prisma = new PrismaClient();

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}

function money(n: number) {
  return `$${n.toFixed(6)}`;
}

async function pickTrip(tripIdArg: string | null) {
  if (tripIdArg) {
    const t = await prisma.trip.findUnique({ where: { id: tripIdArg } });
    if (!t) throw new Error(`Trip not found: ${tripIdArg}`);
    return t;
  }
  // Prefer trip with most timeline events
  const trips = await prisma.trip.findMany({
    include: { _count: { select: { timelineEvents: true, plannerEvents: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  trips.sort(
    (a, b) =>
      b._count.timelineEvents +
      b._count.plannerEvents -
      (a._count.timelineEvents + a._count.plannerEvents),
  );
  const best = trips[0];
  if (!best) throw new Error('No trips in DB');
  return best;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log(' TRIPO AI token benchmark');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Model:  ${AI_MODEL}`);
  console.log(
    `Price:  input $${AI_PRICE_INPUT_PER_MTOK}/MTok · output $${AI_PRICE_OUTPUT_PER_MTOK}/MTok`,
  );
  console.log(`Key:    ${isAiConfigured() ? 'configured ✓' : 'MISSING ✗'}`);
  if (!isAiConfigured()) {
    console.error('Set ANTHROPIC_API_KEY in .env');
    process.exit(1);
  }

  clearAiUsageLog();
  const trip = await pickTrip(arg('trip'));
  console.log(`Trip:   ${trip.name} (${trip.id})\n`);

  // ── 1) Timeline day stories (main heavy call) ─────────────────────────────
  console.log('▶ 1/4  timeline_day_stories …');
  const events = await prisma.timelineEvent.findMany({
    where: {
      tripId: trip.id,
      type: { notIn: ['AI_RECAP', 'AI_NOTE'] },
    },
    orderBy: { occurredAt: 'asc' },
    take: 200,
  });
  const plannerEvents = await prisma.plannerEvent.findMany({
    where: { tripId: trip.id },
    orderBy: [{ date: 'asc' }, { startMinute: 'asc' }],
    take: 100,
  });
  const plannerByDay: Record<string, string[]> = {};
  for (const pe of plannerEvents) {
    if (!plannerByDay[pe.date]) plannerByDay[pe.date] = [];
    const h = Math.floor(pe.startMinute / 60);
    const m = pe.startMinute % 60;
    const time = pe.allDay
      ? 'כל היום'
      : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    plannerByDay[pe.date].push(`${time} ${pe.title}`);
  }

  const timelineInput = events.length
    ? events
    : [
        {
          emoji: '✈️',
          title: 'נחיתה',
          description: 'הגענו',
          occurredAt: new Date(),
          category: 'members',
        },
        {
          emoji: '🍺',
          title: 'Hofbräuhaus',
          description: 'בירה ראשונה',
          occurredAt: new Date(),
          category: 'places',
        },
      ];

  const stories = await generateTimelineDayStories({
    tripName: trip.name,
    events: timelineInput.map((e: any) => ({
      emoji: e.emoji,
      title: e.title,
      description: e.description,
      occurredAt: e.occurredAt,
      category: e.category,
    })),
    plannerByDay,
  });
  console.log(
    `   → ${stories?.length ?? 0} day cards from ${timelineInput.length} timeline events / ${plannerEvents.length} planner events`,
  );

  // ── 2) Timeline line polish ───────────────────────────────────────────────
  console.log('▶ 2/4  timeline_line_polish …');
  const polishLine = await polishTimelineLine({
    title: 'נוסף קישור למלון',
    description: 'Booking.com אישור הזמנה',
    type: 'LINK_ADDED',
  });
  console.log(`   → ${polishLine ? polishLine.title : 'null'}`);

  // ── 3) Notification polish (smart notifications path) ─────────────────────
  console.log('▶ 3/4  notification_polish …');
  const tips = await buildAssistantTips(trip.id);
  const tipSample = tips.slice(0, 4).map((t) => ({
    id: t.id,
    title: t.title,
    body: t.body,
    emoji: t.emoji,
  }));
  // Always have at least one tip to polish
  if (!tipSample.length) {
    tipSample.push({
      id: 'sample',
      title: 'החלטה פתוחה',
      body: 'יש חברים שעדיין לא הצביעו',
      emoji: '✅',
    });
  }
  const polished = await polishNotificationTips(trip.name, tipSample);
  console.log(`   → polished ${polished?.length ?? 0} tips (from ${tipSample.length} raw)`);

  // ── 4) Smart digest (standalone, not wired to UI currently) ───────────────
  console.log('▶ 4/4  smart_notifications_digest …');
  const digest = await generateSmartNotifications({
    tripName: trip.name,
    memberName: 'דור',
    context: [
      `טיפים: ${JSON.stringify(tipSample)}`,
      `ימי טיול בלוח: ${Object.keys(plannerByDay).length}`,
      `אירועי ציר זמן: ${timelineInput.length}`,
    ].join('\n'),
  });
  console.log(`   → digest items: ${digest?.length ?? 0}`);

  // ── Report ────────────────────────────────────────────────────────────────
  const log = getAiUsageLog();
  const summary = summarizeAiUsage(log);

  console.log('\n──────────── Per-call detail ────────────');
  console.log(
    'feature'.padEnd(28),
    'in'.padStart(8),
    'out'.padStart(8),
    'total'.padStart(8),
    'USD'.padStart(12),
    'ok',
  );
  for (const e of log) {
    console.log(
      e.feature.padEnd(28),
      String(e.inputTokens).padStart(8),
      String(e.outputTokens).padStart(8),
      String(e.totalTokens).padStart(8),
      money(e.estimatedUsd).padStart(12),
      e.ok ? '✓' : `✗ ${e.error || ''}`,
    );
  }

  console.log('\n──────────── By feature ────────────');
  for (const [feat, g] of Object.entries(summary.byFeature)) {
    console.log(
      feat.padEnd(28),
      `calls=${g.calls}`,
      `in=${g.inputTokens}`,
      `out=${g.outputTokens}`,
      money(g.estimatedUsd),
    );
  }

  console.log('\n──────────── TOTAL ────────────');
  console.log(`Calls:   ${summary.calls}`);
  console.log(`Input:   ${summary.inputTokens} tokens`);
  console.log(`Output:  ${summary.outputTokens} tokens`);
  console.log(`Total:   ${summary.totalTokens} tokens`);
  console.log(`Est. $:  ${money(summary.estimatedUsd)}`);
  console.log(
    `\nNote: USD estimate uses $${AI_PRICE_INPUT_PER_MTOK}/M in + $${AI_PRICE_OUTPUT_PER_MTOK}/M out.`,
  );
  console.log('Verify live rates at https://www.anthropic.com/pricing\n');

  // Feature map (what exists in product)
  console.log('──────────── AI features in TRIPO ────────────');
  console.log(`
LIVE (wired to UI / API):
  1. timeline_day_stories     POST /api/timeline/:tripId/ai-recap
                              → one Claude call, day-by-day JSON (max_tokens 2500)
  2. notification_polish      POST /api/notifications/smart/:tripId
                              → polishAssistant tips (max_tokens 1024)
                              (only when AI allowed + tips not in NO_AI_REWRITE)

CODE EXISTS but not primary UI path:
  3. timeline_line_polish     polishTimelineLine() — optional single-line polish
  4. smart_notifications_digest  generateSmartNotifications() — free-form digest

NOT AI (rule-based only):
  • Decisions / voting
  • Opening-hours warnings
  • Assistant tips engine (before optional polish)
  • Flights, weather, settlements
`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
