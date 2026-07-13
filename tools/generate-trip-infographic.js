#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({
  path: path.join(__dirname, '..', '.env'),
});

const sharp = require(path.join(__dirname, '..', 'server', 'node_modules', 'sharp'));
const { PrismaClient } = require(path.join(__dirname, '..', 'server', 'node_modules', '@prisma/client'));

const prisma = new PrismaClient();

const W = 1400;
const H = 1900;
const PAD = 28;
const MAP_X = 28;
const MAP_Y = 155;
const MAP_W = 1344;
const MAP_H = 735;
const CARD_Y = 910;
const CARD_GAP = 14;
const CARD_W = (W - PAD * 2 - CARD_GAP * 3) / 4;
const CARD_H = 330;

const DAY_COLORS = {
  '2026-10-07': '#226f54',
  '2026-10-08': '#226f54',
  '2026-10-09': '#226f54',
  '2026-10-10': '#f08a24',
  '2026-10-11': '#f08a24',
  '2026-10-12': '#7a50a4',
  '2026-10-13': '#7a50a4',
  '2026-10-14': '#333842',
};

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_TITLES = {
  '2026-10-07': 'נחיתה + מפלי הריין',
  '2026-10-08': 'Europa Park / יער שחור',
  '2026-10-09': 'רוואנה + Hasenhorn',
  '2026-10-10': 'טריברג + Mehliskopf',
  '2026-10-11': 'מעבר ולינת ביניים',
  '2026-10-12': 'אלפים בוואריים + מינכן',
  '2026-10-13': 'מינכן - אטרקציות',
  '2026-10-14': 'חזרה ממינכן',
};

const CATEGORY_LABELS = {
  transport: 'תחבורה',
  nature: 'טבע',
  activity: 'אטרקציה',
  culture: 'תרבות',
  restaurant: 'אוכל',
  hotel: 'לינה',
  shopping: 'קניות',
  other: 'אחר',
};

const CATEGORY_COLORS = {
  transport: '#333842',
  nature: '#226f54',
  activity: '#7a50a4',
  culture: '#d97918',
  restaurant: '#bd4a35',
  hotel: '#226f8f',
  shopping: '#996515',
  other: '#58606b',
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hasHebrew(value) {
  return /[\u0590-\u05ff]/.test(String(value ?? ''));
}

function rtlText(x, y, text, size = 28, weight = 600, fill = '#1d2430', extra = '') {
  return `<text x="${x}" y="${y}" direction="rtl" text-anchor="start" font-family="Arial, 'DejaVu Sans', sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(text)}</text>`;
}

function rightText(x, y, text, size = 24, weight = 500, fill = '#1d2430', extra = '') {
  if (hasHebrew(text)) return rtlText(x, y, text, size, weight, fill, extra);
  return `<text x="${x}" y="${y}" text-anchor="end" font-family="Arial, 'DejaVu Sans', sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(text)}</text>`;
}

function centerText(x, y, text, size = 24, weight = 500, fill = '#1d2430', extra = '') {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial, 'DejaVu Sans', sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(text)}</text>`;
}

function wrapText(value, maxChars, maxLines = 2) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.]+$/, '')}...`;
    return kept;
  }
  return lines;
}

function fmtDate(date) {
  const d = new Date(`${date}T12:00:00`);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function dayName(date) {
  return DAY_NAMES[new Date(`${date}T12:00:00`).getDay()];
}

function time(minute) {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function duration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}:${String(m).padStart(2, '0')} שעות`;
  if (h) return `${h}:00 שעות`;
  return `${m} דק׳`;
}

function haversineKm(a, b) {
  const r = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

function driveEstimate(a, b) {
  const km = haversineKm(a, b) * 1.28;
  const mins = Math.round((km / 82) * 60 / 5) * 5;
  if (mins >= 60) return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
  return `0:${String(mins).padStart(2, '0')}`;
}

function projectFactory(points) {
  const minLat = Math.min(...points.map(p => p.lat)) - 0.18;
  const maxLat = Math.max(...points.map(p => p.lat)) + 0.18;
  const minLng = Math.min(...points.map(p => p.lng)) - 0.28;
  const maxLng = Math.max(...points.map(p => p.lng)) + 0.28;
  return (p) => ({
    x: MAP_X + ((p.lng - minLng) / (maxLng - minLng)) * MAP_W,
    y: MAP_Y + MAP_H - ((p.lat - minLat) / (maxLat - minLat)) * MAP_H,
  });
}

function pathFrom(points, project) {
  return points.map((p, i) => {
    const q = project(p);
    return `${i === 0 ? 'M' : 'L'} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }).join(' ');
}

function card(x, y, w, h, date, places, events, idx) {
  const color = DAY_COLORS[date] || '#226f54';
  const eventLines = events.slice(0, 4).map(e => `${time(e.startMinute)} ${e.title}`);
  const placeLines = places.slice(0, 4).map(p => p.name);
  const lines = eventLines.length ? eventLines : placeLines;
  const title = DAY_TITLES[date] || (places[0]?.name ?? 'יום טיול');
  let svg = '';
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#fffdf8" stroke="${color}" stroke-width="2"/>`;
  svg += `<rect x="${x}" y="${y}" width="${w}" height="54" rx="8" fill="${color}"/>`;
  svg += `<rect x="${x}" y="${y + 42}" width="${w}" height="16" fill="${color}"/>`;
  svg += rightText(x + w - 18, y + 36, `${dayName(date)} ${fmtDate(date)}`, 24, 800, '#fff');
  svg += centerText(x + 46, y + 36, `יום ${idx + 1}`, 22, 800, '#fff');
  svg += rightText(x + w - 18, y + 86, title, 25, 800, '#1d2430');

  let cy = y + 124;
  for (const line of lines) {
    const chunks = wrapText(line, 28, 1);
    svg += rightText(x + w - 22, cy, chunks[0], 18, 600, '#242b36');
    cy += 30;
  }

  const cats = [...new Set(places.map(p => p.category).filter(Boolean))].slice(0, 3);
  svg += `<line x1="${x + 18}" y1="${y + h - 104}" x2="${x + w - 18}" y2="${y + h - 104}" stroke="#eadfce"/>`;
  svg += rightText(x + w - 18, y + h - 74, 'קטגוריות', 17, 800, color);
  let tagX = x + w - 18;
  for (const cat of cats) {
    const label = CATEGORY_LABELS[cat] || cat;
    const tw = Math.max(58, label.length * 13 + 20);
    svg += `<rect x="${tagX - tw}" y="${y + h - 56}" width="${tw}" height="30" rx="15" fill="${CATEGORY_COLORS[cat] || '#58606b'}" opacity="0.12"/>`;
    svg += rightText(tagX - 10, y + h - 35, label, 15, 700, CATEGORY_COLORS[cat] || '#58606b');
    tagX -= tw + 8;
  }
  return svg;
}

async function main() {
  const trip = await prisma.trip.findFirst({
    where: { name: 'טיול חברים 40' },
    orderBy: { createdAt: 'desc' },
    include: {
      places: { orderBy: [{ date: 'asc' }, { order: 'asc' }] },
      plannerEvents: { orderBy: [{ date: 'asc' }, { startMinute: 'asc' }] },
    },
  });

  if (!trip) throw new Error('Trip not found: טיול חברים 40');

  const places = trip.places.filter(p => p.lat != null && p.lng != null);
  const dates = [...new Set([
    ...places.map(p => p.date).filter(Boolean),
    ...trip.plannerEvents.map(e => e.date).filter(Boolean),
  ])].sort();

  const placesByDate = new Map(dates.map(d => [d, places.filter(p => p.date === d)]));
  const eventsByDate = new Map(dates.map(d => [d, trip.plannerEvents.filter(e => e.date === d)]));

  const dayPoints = dates
    .map(date => {
      const dayPlaces = placesByDate.get(date) || [];
      if (!dayPlaces.length) return null;
      return {
        date,
        lat: dayPlaces.reduce((sum, p) => sum + p.lat, 0) / dayPlaces.length,
        lng: dayPlaces.reduce((sum, p) => sum + p.lng, 0) / dayPlaces.length,
        name: DAY_TITLES[date] || dayPlaces[0].name,
      };
    })
    .filter(Boolean);

  const project = projectFactory(places);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#f6f1e8"/>`;
  svg += `<rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="16" fill="#fffaf0" stroke="#1d2430" stroke-width="3"/>`;
  svg += rtlText(W - 40, 70, 'טיול חברים 40 - שוויץ, היער השחור ומינכן', 43, 900, '#181c22');
  svg += rtlText(W - 40, 118, '7-14 באוקטובר 2026 | 8 ימים | מבוסס על מקומות ולו״ז ממסד הנתונים', 27, 500, '#303844');

  svg += `<rect x="${MAP_X}" y="${MAP_Y}" width="${MAP_W}" height="${MAP_H}" rx="10" fill="#e7ecd9" stroke="#223047" stroke-width="2"/>`;
  svg += `<path d="M60 700 C230 560 230 330 390 260 S680 250 815 160 S1080 180 1330 70" transform="translate(${MAP_X},${MAP_Y})" fill="none" stroke="#bfcba7" stroke-width="90" stroke-linecap="round" opacity="0.55"/>`;
  svg += `<path d="M110 150 C300 95 560 120 680 260 S910 465 1270 390" transform="translate(${MAP_X},${MAP_Y})" fill="none" stroke="#cdd9bd" stroke-width="70" stroke-linecap="round" opacity="0.5"/>`;
  svg += `<path d="M20 610 C120 550 185 515 240 500 C310 482 390 505 470 575 C560 655 650 665 760 610" transform="translate(${MAP_X},${MAP_Y})" fill="none" stroke="#9fc6d8" stroke-width="42" stroke-linecap="round" opacity="0.8"/>`;
  svg += `<path d="M1000 620 C1110 580 1200 610 1310 560" transform="translate(${MAP_X},${MAP_Y})" fill="none" stroke="#9fc6d8" stroke-width="36" stroke-linecap="round" opacity="0.7"/>`;
  svg += `<text x="${MAP_X + 92}" y="${MAP_Y + 645}" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#93ad91" opacity="0.75">SWITZERLAND</text>`;
  svg += `<text x="${MAP_X + 720}" y="${MAP_Y + 370}" font-family="Arial, sans-serif" font-size="46" font-weight="800" fill="#9ca88d" opacity="0.78">GERMANY</text>`;
  svg += `<text x="${MAP_X + 205}" y="${MAP_Y + 222}" font-family="Arial, sans-serif" font-size="36" font-weight="800" fill="#9ca88d" opacity="0.72">FRANCE</text>`;

  const routeD = pathFrom(dayPoints, project);
  svg += `<path d="${routeD}" fill="none" stroke="#ffffff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>`;
  svg += `<path d="${routeD}" fill="none" stroke="#25384d" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;

  for (let i = 0; i < dayPoints.length - 1; i++) {
    const a = dayPoints[i];
    const b = dayPoints[i + 1];
    const pa = project(a);
    const pb = project(b);
    const mx = (pa.x + pb.x) / 2;
    const my = (pa.y + pb.y) / 2;
    const label = `כ-${driveEstimate(a, b)} שעות`;
    svg += `<rect x="${mx - 58}" y="${my - 36}" width="116" height="34" rx="8" fill="${DAY_COLORS[b.date] || '#333842'}" opacity="0.94"/>`;
    svg += centerText(mx, my - 13, label, 16, 800, '#fff');
  }

  for (const p of places) {
    const q = project(p);
    const color = CATEGORY_COLORS[p.category] || '#58606b';
    svg += `<circle cx="${q.x}" cy="${q.y}" r="5.5" fill="${color}" opacity="0.72" stroke="#fff" stroke-width="1.5"/>`;
  }

  for (let i = 0; i < dayPoints.length; i++) {
    const p = dayPoints[i];
    const q = project(p);
    const color = DAY_COLORS[p.date] || '#333842';
    svg += `<circle cx="${q.x}" cy="${q.y}" r="16" fill="#fff" stroke="#1d2430" stroke-width="4"/>`;
    svg += `<circle cx="${q.x}" cy="${q.y}" r="9" fill="${color}"/>`;
    const lx = Math.min(W - 105, Math.max(115, q.x + (i % 2 ? -75 : 80)));
    const ly = Math.min(MAP_Y + MAP_H - 20, Math.max(MAP_Y + 40, q.y + (i % 2 ? -24 : 22)));
    svg += `<rect x="${lx - 84}" y="${ly - 28}" width="168" height="42" rx="8" fill="#fffdf8" stroke="${color}" stroke-width="2"/>`;
    svg += centerText(lx, ly - 1, `${fmtDate(p.date)} · יום ${i + 1}`, 18, 900, color);
  }

  svg += `<rect x="${MAP_X + 20}" y="${MAP_Y + 20}" width="250" height="230" rx="10" fill="#fffdf8" stroke="#223047" stroke-width="2"/>`;
  svg += rightText(MAP_X + 250, MAP_Y + 55, 'מקרא', 25, 900, '#1d2430');
  let ly = MAP_Y + 88;
  for (const cat of ['transport', 'nature', 'activity', 'culture', 'restaurant', 'hotel']) {
    svg += `<circle cx="${MAP_X + 230}" cy="${ly - 7}" r="7" fill="${CATEGORY_COLORS[cat]}"/>`;
    svg += rightText(MAP_X + 212, ly, CATEGORY_LABELS[cat], 17, 700, '#303844');
    ly += 28;
  }
  svg += `<path d="M${MAP_X + 42} ${MAP_Y + 217} L${MAP_X + 92} ${MAP_Y + 217}" stroke="#25384d" stroke-width="6" stroke-linecap="round"/>`;
  svg += rightText(MAP_X + 230, MAP_Y + 222, 'מסלול משוער', 17, 700, '#303844');

  for (let idx = 0; idx < dates.length; idx++) {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = PAD + col * (CARD_W + CARD_GAP);
    const y = CARD_Y + row * (CARD_H + CARD_GAP);
    svg += card(x, y, CARD_W, CARD_H, dates[idx], placesByDate.get(dates[idx]) || [], eventsByDate.get(dates[idx]) || [], idx);
  }

  const tipsX = PAD;
  const tipsY = CARD_Y + 2 * (CARD_H + CARD_GAP) + 24;
  const tipsW = W - PAD * 2;
  svg += `<rect x="${tipsX}" y="${tipsY}" width="${tipsW}" height="220" rx="8" fill="#fffdf8" stroke="#9aa7b1" stroke-width="2"/>`;
  svg += rightText(tipsX + tipsW - 24, tipsY + 42, 'דגשים מהתכנון', 24, 900, '#1d2430');
  const bullets = [
    `סה״כ ${places.length} מקומות ו-${trip.plannerEvents.length} אירועי לו״ז ממסד הנתונים`,
    'ימים 1-3: נחיתה, מפלי הריין, פארק אירופה ורוואנה',
    'ימים 4-5: טריברג, Mehliskopf ולינת ביניים באזור Freudenstadt',
    'ימים 6-8: נוישוונשטיין, מינכן, BMW, סימולטור, קארטינג וטיסה חזרה',
    'זמני הנסיעה על המפה הם הערכה גיאוגרפית, לא ניווט בזמן אמת',
  ];
  let by = tipsY + 82;
  for (const bullet of bullets) {
    svg += `<circle cx="${tipsX + tipsW - 34}" cy="${by - 6}" r="4.5" fill="#226f54"/>`;
    svg += rightText(tipsX + tipsW - 50, by, bullet, 18, 600, '#303844');
    by += 30;
  }

  svg += `<text x="${W - 36}" y="${H - 28}" direction="rtl" text-anchor="start" font-family="Arial, 'DejaVu Sans', sans-serif" font-size="16" fill="#66717d">נוצר אוטומטית מתוך TripPlace + PlannerEvent</text>`;
  svg += `</svg>`;

  const outDir = path.join(__dirname, '..', 'uploads', 'generated');
  fs.mkdirSync(outDir, { recursive: true });
  const svgPath = path.join(outDir, 'trip-friends-40-infographic.svg');
  const pngPath = path.join(outDir, 'trip-friends-40-infographic.png');
  fs.writeFileSync(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  console.log(JSON.stringify({ svgPath, pngPath, places: places.length, events: trip.plannerEvents.length }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
