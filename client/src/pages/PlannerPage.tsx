import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import apiClient from '../api/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const START_HOUR = 0;
const END_HOUR   = 24;
const PX_PER_HR  = 64;   // pixels per hour
const PX_PER_MIN = PX_PER_HR / 60;
const START_MIN  = START_HOUR * 60;
const END_MIN    = END_HOUR   * 60;
const GRID_H     = (END_HOUR - START_HOUR) * PX_PER_HR; // 1024
const HOURS      = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DAY_HDR_H  = 48; // sticky day header height
const TIME_COL_W = 52; // time labels column width

const snap15 = (m: number) => Math.round(m / 15) * 15;
const minToY  = (m: number) => (m - START_MIN) * PX_PER_MIN;
const yToMin  = (y: number) => snap15(START_MIN + y / PX_PER_MIN);
const clamp   = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const fmtMin = (m: number) => {
  const wrapped = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60), mm = wrapped % 60;
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
};
const fmtDur = (mins: number) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h && m ? `${h}ש' ${m}ד'` : h ? `${h}ש'` : `${m}ד'`;
};
const fmtDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });

// ─── Categories & Colors ──────────────────────────────────────────────────────

const CATS = [
  { id: 'forest',  label: '🌲 יער',   color: 'green'  },
  { id: 'munich',  label: '🏙️ מינכן', color: 'blue'   },
  { id: 'travel',  label: '🚐 נסיעה', color: 'yellow' },
  { id: 'food',    label: '🍽️ אוכל',  color: 'orange' },
  { id: 'special', label: '⭐ מיוחד', color: 'red'    },
  { id: 'other',   label: '📌 כללי',  color: 'gray'   },
];

const COLORS: Record<string, { pill: string; event: string; border: string; text: string }> = {
  green:  { pill:'bg-green-100 text-green-800',  event:'bg-green-200 border-green-400',  border:'border-green-400', text:'text-green-900' },
  blue:   { pill:'bg-blue-100 text-blue-800',    event:'bg-blue-200 border-blue-400',    border:'border-blue-400',  text:'text-blue-900'  },
  yellow: { pill:'bg-yellow-100 text-yellow-800',event:'bg-yellow-200 border-yellow-400',border:'border-yellow-400',text:'text-yellow-900'},
  orange: { pill:'bg-orange-100 text-orange-800',event:'bg-orange-200 border-orange-400',border:'border-orange-400',text:'text-orange-900'},
  red:    { pill:'bg-red-100 text-red-800',      event:'bg-red-200 border-red-400',      border:'border-red-400',   text:'text-red-900'   },
  purple: { pill:'bg-purple-100 text-purple-800',event:'bg-purple-200 border-purple-400',border:'border-purple-400',text:'text-purple-900'},
  gray:   { pill:'bg-neutral-100 text-neutral-600',event:'bg-neutral-200 border-neutral-300',border:'border-neutral-300',text:'text-neutral-700'},
};

const catColor = (cat: string) => CATS.find(c => c.id === cat)?.color ?? 'gray';
const col = (color: string) => COLORS[color] ?? COLORS.gray;
const mapPlaceCategory = (cat?: string) => {
  switch (cat) {
    case 'forest': return 'nature';
    case 'food': return 'restaurant';
    case 'travel': return 'transport';
    case 'munich': return 'culture';
    case 'special': return 'activity';
    default: return 'other';
  }
};

// ─── Template Activities (from trip planning HTML) ─────────────────────────────

const TEMPLATES = [
  // ══ 🌲 יער שחור ══
  { emoji:'🏞️', name:'Ravenna Gorge', location:'Hinterzarten', description:'הגיא הדרמטי של יין שחור — מסלול הליכה ~8.8 ק"מ לאורך נחל Ravenna עם גשרי עץ תלויים בגובה 68 מ\' מעל הגיא. לאורך הדרך: מפלים מרהיבים, צמחיה עשירה וצפיות ביער. מסלול קל-בינוני המתאים לכולם. הגיעו לפני 9:00 בבוקר — אחר כך הוא מתמלא.', durationMins:210, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Ravenna+Gorge+Hinterzarten+Germany' },
  { emoji:'🏔️', name:'Feldberg – פסגה + גונדולה', location:'20 דק\' מ-Hinterzarten', description:'הנקודה הגבוהה ביותר ביער (1,493מ\') | נוף לאלפים', durationMins:150, cost:'~€15', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Feldberg+Black+Forest+Germany' },
  { emoji:'⛰️', name:'Belchen – פנורמה 360°', location:'35 דק\' מ-Hinterzarten', description:'גונדולה + הליכה קצרה | נוף הכי יפה ביער', durationMins:150, cost:'~€14', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Belchen+Black+Forest+Germany' },
  { emoji:'🌊', name:'אגם Schluchsee', location:'15 דק\' מ-Hinterzarten', description:'האגם הגדול ביותר ביער | שלווה, סירות, הליכה', durationMins:120, cost:'חינם / €12', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Schluchsee+Germany' },
  { emoji:'⛵', name:'אגם Titisee', location:'10 דק\' מ-Hinterzarten', description:'הגלציאלי הציורי ביותר | טיול 90 דק\' + סירות', durationMins:150, cost:'חינם / €12', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Titisee+Germany' },
  { emoji:'🛷', name:'מגלשת Hasenhorn', location:'Todtnau', description:'2,900 מ\' מגלשת קיץ + כיסא מעופף | נוף מרהיב', durationMins:120, cost:'~€12', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Hasenhorn+Coaster+Todtnau+Germany' },
  { emoji:'💧', name:'מפלי Triberg + שעון קוקייה', location:'35 דק\' מ-Hinterzarten', description:'163 מ\' / 7 מפלים | הגדולים בגרמניה', durationMins:150, cost:'€5', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Triberg+Waterfalls+Germany' },
  { emoji:'♨️', name:'Caracalla Therme Baden-Baden', location:'45 דק\'', description:'מרחצאות תרמיים רומאיים | ספא מושלם', durationMins:180, cost:'€25–30', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Caracalla+Therme+Baden-Baden+Germany' },
  { emoji:'🏙️', name:'Freiburg im Breisgau', location:'35 דק\'', description:'קתדרלה + שוק + תעלות רחוב | עיר יפה', durationMins:240, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Freiburg+im+Breisgau+Germany' },
  { emoji:'⛪', name:'Sankt Blasien – כיפה ענקית', location:'30 דק\'', description:'קתדרלה בסגנון פנתיאון רומאי', durationMins:90, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Sankt+Blasien+Cathedral+Germany' },
  { emoji:'🎿', name:'Mehliskopf Alpine Coaster', location:'50 דק\'', description:'מגלשת אלפינה קצרה ומהנה', durationMins:90, cost:'€4/רידה', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Mehliskopf+Alpine+Coaster+Germany' },
  { emoji:'🏝️', name:'Lindau – אי על הבודנזה', location:'~1.5 שעות נסיעה', description:'אי קסום | נמל ציורי | נוף לאלפים', durationMins:180, cost:'חינם', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Lindau+Bodensee+Germany' },
  { emoji:'🏰', name:'טירת Neuschwanstein', location:'~2 שעות נסיעה', description:'טירת דיסני המקורית | הזמינו כרטיסים מראש!', durationMins:240, cost:'€13', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Neuschwanstein+Castle+Germany' },
  { emoji:'🏛️', name:'Augsburg – Fuggerei', location:'~2 שעות נסיעה', description:'שכונת עניים מ-1516 שעדיין פעילה', durationMins:180, cost:'€4', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Fuggerei+Augsburg+Germany' },
  { emoji:'🌊', name:'אגם Starnberg', location:'30 דק\' מ-מינכן', description:'ציורי | מקום מותו של לודוויג ה-II', durationMins:120, cost:'חינם', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Starnberger+See+Germany' },
  { emoji:'🔔', name:'Marienplatz + Glockenspiel', location:'מרכז מינכן', description:'לב מינכן | Glockenspiel ב-11:00', durationMins:90, cost:'חינם', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Marienplatz+Munich+Germany' },
  { emoji:'🚗', name:'BMW Welt + Museum', location:'U3 Olympiazentrum', description:'מוזיאון מרשים בחינם | ליד האצטדיון האולימפי', durationMins:150, cost:'חינם', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=BMW+Welt+Munich+Germany' },
  { emoji:'🏛️', name:'Deutsches Museum', location:'ליד נהר Isar', description:'הגדול בעולם למדע וטכנולוגיה | מטוסים, רכבות, חלל', durationMins:180, cost:'€14', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Deutsches+Museum+Munich+Germany' },
  { emoji:'🌳', name:'English Garden + Eisbachwelle', location:'מינכן', description:'פארק ענק + גלישת גלים בלב העיר', durationMins:120, cost:'חינם', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=English+Garden+Munich+Germany' },
  { emoji:'🏎️', name:'F1 Simulator', location:'Race Experience Munich', description:'סימולטור מקצועי | הזמינו מראש!', durationMins:90, cost:'~€60', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Race+Experience+Munich+Germany' },
  { emoji:'🏁', name:'קארטינג – Go-Kart Welt', location:'Aschheim', description:'קארטינג מהיר | ~20 דק\' מהמרכז', durationMins:90, cost:'~€30', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Go+Kart+Welt+Aschheim+Germany' },
  { emoji:'🔐', name:'חדר בריחה – Exit the Room', location:'מרכז מינכן', description:'60 דק\' לשחק + 15 דק\' הכנה | ל-5–6 שחקנים', durationMins:75, cost:'~€25', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Exit+the+Room+Munich+Germany' },
  { emoji:'🏭', name:'Paulaner Brewery Tour', location:'מינכן', description:'סיור מבשלה + טעימות בירה | הזמינו מראש', durationMins:120, cost:'~€25', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Paulaner+Brauerei+Munich+Germany' },
  { emoji:'🏟️', name:'Olympiapark Munich', location:'מינכן צפון', description:'אצטדיון 1972 + מגדל תצפית | ליד BMW Welt', durationMins:90, cost:'חינם / €9', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Olympiapark+Munich+Germany' },
  { emoji:'⚽', name:'משחק באיירן מינכן', location:'Allianz Arena', description:'בדקו לוח 26/27 | fcbayern.com', durationMins:180, cost:'€40–100', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Allianz+Arena+Munich+Germany' },
  { emoji:'🛒', name:'Viktualienmarkt – שוק', location:'מרכז מינכן', description:'שוק איכרים | ארוחת בוקר / צהריים מעולה', durationMins:60, cost:'חינם', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Viktualienmarkt+Munich+Germany' },
  { emoji:'🍺', name:'Hofbräuhaus', location:'מרכז מינכן', description:'האייקון של מינכן | חובה לפחות פעם אחת', durationMins:90, cost:'€25–35', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Hofbrauhaus+Munich+Germany' },
  { emoji:'🌾', name:'Augustiner Bräustuben', location:'מינכן', description:'הבירה הטובה ביותר לפי מקומיים', durationMins:90, cost:'€30–40', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Augustiner+Braustuben+Munich+Germany' },
  { emoji:'🥩', name:'Zum Franziskaner', location:'מינכן', description:'מסעדה בוורסטית מ-1363! | שניצל + כנפליים', durationMins:90, cost:'€35–45', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Zum+Franziskaner+Munich+Germany' },
  { emoji:'⭐', name:'Tantris – פינה-דיינינג', location:'מינכן', description:'ארוחת פרידה מושקעת | הזמינו 2+ חודשים מראש!', durationMins:150, cost:'€80–120', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Tantris+Munich+Germany' },
  { emoji:'🦌', name:'Landgasthof Hirschen', location:'Hinterzarten', description:'ארוחת ערב מסורתית ביער | ציד, פטריות, שחור-יער', durationMins:90, cost:'€30–40', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Landgasthof+Hirschen+Hinterzarten' },
  { emoji:'🌅', name:'מסעדה על שפת Titisee', location:'Titisee', description:'ארוחה עם נוף לאגם ולהרים', durationMins:75, cost:'€30–40', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Restaurant+Titisee+Germany' },
  { emoji:'🎢', name:'Europa Park', location:'Rust, 30 דק\'', description:'פארק שעשועים מהגדולים באירופה | 100+ אטרקציות', durationMins:540, cost:'€76', category:'special', color:'red', mapsUrl:'https://maps.google.com/?q=Europa+Park+Rust+Germany' },
  { emoji:'👻', name:'Traumatica Halloween Event', location:'Europa Park', description:'אירוע האלווין | בתי רדופים + מופעים | 19:00–23:30', durationMins:270, cost:'€40', category:'special', color:'red', mapsUrl:'https://maps.google.com/?q=Europa+Park+Rust+Germany' },
  { emoji:'🌊', name:'Rulantica Waterpark', location:'Rust, 30 דק\'', description:'פארק המים הגדול ביותר בגרמניה שנפתח ב-2019, בבעלות Europa-Park. 17 מגלשות מי מרהיבות, מתחם גלים ענק, מגלשת רוקט-מי בגובה 4 קומות ואזור ילדים. מומלץ לרכוש כרטיסים משולבים עם Europa-Park ולהגיע מיד עם הפתיחה ב-9:00 — הפארק מתמלא מהר בקיץ!', durationMins:360, cost:'€40–50', category:'special', color:'red', mapsUrl:'https://maps.google.com/?q=Rulantica+Waterpark+Rust+Germany' },

  // ── יער שחור — עוד ──
  { emoji:'🚠', name:'Schauinsland Gondola', location:'Oberried, 25 דק\'', description:'גונדולה עם נוף מרהיב ליער + נתיב הליכה בפסגה | 1,284 מ\'', durationMins:120, cost:'~€15', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Schauinsland+Seilbahn+Freiburg+Germany' },
  { emoji:'🏔️', name:'Mummelsee – האגם הסגנדרי', location:'Seebach, 50 דק\'', description:'אגם הרים מסתורי בגובה 1,036 מ\' | פסל אגדות + הליכות', durationMins:90, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Mummelsee+Black+Forest+Germany' },
  { emoji:'🌊', name:'Wutach Gorge', location:'55 דק\' מ-Hinterzarten', description:'גיא פרא ומלהיב | 13 ק"מ הליכה | שמורת טבע נדירה', durationMins:240, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Wutachschlucht+Germany' },
  { emoji:'🍷', name:'Staufen im Breisgau', location:'30 דק\'', description:'עיירת יין קסומה | שמורת יין בדן | כיכר ימי-ביניימית', durationMins:120, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Staufen+im+Breisgau+Germany' },
  { emoji:'🎑', name:'Sasbachwalden – כפר יין', location:'50 דק\' מ-Hinterzarten', description:'כפר בבוורי ציורי ביותר | שבילי יין + נוף הרים', durationMins:150, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Sasbachwalden+Germany' },
  { emoji:'🌿', name:'Höllental Valley Drive', location:'10 דק\' מ-Hinterzarten', description:'נסיעה בוואדי הדרמטי ביין שחור | "עמק הגיהינום" | גשר מרהיב', durationMins:60, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Hollental+Valley+Black+Forest' },
  { emoji:'⛷️', name:'Todtnau Ski Area', location:'Todtnau, 20 דק\'', description:'אזור גלישה חורפי | קיץ: אופני הרים + הליכות | נוף נהדר', durationMins:180, cost:'~€20', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Todtnau+Ski+Resort+Germany' },
  { emoji:'⌚', name:'Furtwangen Clock Museum', location:'Furtwangen, 45 דק\'', description:'מוזיאון שעוני קוקייה | ההיסטוריה של שעוני יער שחור', durationMins:120, cost:'€8', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Deutsches+Uhrenmuseum+Furtwangen+Germany' },
  { emoji:'🌄', name:'Kandel Mountain – 1,241 מ\'', location:'50 דק\' מ-Hinterzarten', description:'הליכה קצרה לפסגה | מגדל תצפית | נוף 360° ליין שחור', durationMins:150, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Kandel+Black+Forest+Germany' },
  { emoji:'🏞️', name:'Windgfällweiher Lake', location:'5 דק\' מ-Hinterzarten', description:'אגם בלב היער | שחייה טבעית | שלווה מוחלטת', durationMins:90, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Windgfallweiher+Hinterzarten+Germany' },
  { emoji:'🧖', name:'Aqua Titisee Spa', location:'Titisee, 10 דק\'', description:'ספא ואקווה-פארק | מגלשות + סאונה + בריכות חוץ | אטרקציה משפחתית', durationMins:180, cost:'~€20', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Aqua+Titisee+Germany' },
  { emoji:'🚴', name:'E-Bike Tour ביין שחור', location:'Hinterzarten', description:'השכרת אופניים חשמליים | מסלול יערי | ~20-30 ק"מ', durationMins:180, cost:'~€30', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=E-Bike+Rental+Hinterzarten+Germany' },
  { emoji:'🌲', name:'Bärenschlucht Hiking', location:'Bühlertal, 40 דק\'', description:'גיא דובים | גשרי עץ + מפלים קטנים | ~4 ק"מ הלוך-חזור', durationMins:150, cost:'חינם', category:'forest', color:'green', mapsUrl:'https://maps.google.com/?q=Barenschlucht+Germany' },

  // ── מינכן — עוד ──
  { emoji:'🏰', name:'Nymphenburg Palace', location:'מינכן מערב', description:'ארמון הקיץ הבוורי המפואר | גנים ענקיים + מוזיאון כרכרות', durationMins:180, cost:'€8', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Nymphenburg+Palace+Munich+Germany' },
  { emoji:'🎨', name:'Pinakothek der Moderne', location:'מינכן מרכז', description:'ארבעה מוזיאונים באחד | אמנות מודרנית + דיזיין + גרפיקה', durationMins:150, cost:'€10', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Pinakothek+der+Moderne+Munich+Germany' },
  { emoji:'🏛️', name:'Residenz Munich', location:'מרכז מינכן', description:'הארמון המלכותי הגדול ביותר בגרמניה | 130 חדרים | אוצרות מינכן', durationMins:150, cost:'€9', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Munich+Residenz+Germany' },
  { emoji:'⚽', name:'FC Bayern Museum', location:'Allianz Arena', description:'מוזיאון ה-FC Bayern | גביעים + הלבשה + היסטוריה של הקלוב', durationMins:90, cost:'€12', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=FC+Bayern+Museum+Munich+Germany' },
  { emoji:'🐘', name:'Hellabrunn Zoo Munich', location:'מינכן דרום', description:'גן חיות גיאוגרפי ראשון בעולם | 750 מינים | כולל קיווי', durationMins:240, cost:'€18', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Tierpark+Hellabrunn+Munich+Germany' },
  { emoji:'🌊', name:'Sea Life Munich', location:'מינכן', description:'אקווריום | מנהרת כרישים + פינגווינים | טוב למשפחות', durationMins:120, cost:'~€20', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Sea+Life+Munich+Germany' },
  { emoji:'🗼', name:'Olympia Tower – Observation Deck', location:'Olympiapark', description:'תצפית בגובה 190 מ\' + מסעדה מסתובבת | ליד BMW Welt', durationMins:90, cost:'€9', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Olympiaturm+Munich+Germany' },
  { emoji:'🌿', name:'Hofgarten + Residenzstrasse', description:'גן ארמוני קלאסי במרכז | קפה + ריצה + שבתות שוחדות', durationMins:60, cost:'חינם', location:'מרכז מינכן', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Hofgarten+Munich+Germany' },
  { emoji:'🚲', name:'Isar River Cycling Path', location:'מינכן', description:'אחת הציפות הטובות | נהר Isar + פארקים ירוקים | ~20 ק"מ', durationMins:150, cost:'~€15 השכרה', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Isar+River+Cycling+Munich+Germany' },
  { emoji:'🎪', name:'Munich Night Guided Tour', location:'מרכז מינכן', description:'סיור לילי עם מדריך עברי/אנגלי | מרינן-פלאץ + ביירגרטן', durationMins:150, cost:'~€25', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Munich+Old+Town+Night+Tour' },
  { emoji:'🏘️', name:'Schwabing Neighborhood Walk', location:'מינכן צפון', description:'רובע בוהמי | גלריות + קפה + חנויות ויינטג\' + חיי לילה', durationMins:120, cost:'חינם', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Schwabing+Munich+Germany' },
  { emoji:'⛪', name:'Asam Church', location:'מינכן מרכז', description:'ברוק בוורי מטורף | בניין פרטי שהפך לכנסיה | חינמי', durationMins:30, cost:'חינם', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Asamkirche+Munich+Germany' },
  { emoji:'🚣', name:'Paddle Boats – Olympiasee', location:'Olympiapark', description:'סירות פדלים על האגם ליד האצטדיון | רגוע ומהנה', durationMins:60, cost:'~€10', category:'munich', color:'blue', mapsUrl:'https://maps.google.com/?q=Olympiasee+Munich+Germany' },

  // ── טיולים — עוד ──
  { emoji:'🏔️', name:'Zugspitze – גג גרמניה', location:'~1.5 שעות מ-מינכן', description:'הנקודה הגבוהה ביותר בגרמניה (2,962 מ\') | רכבל + שלג כל השנה', durationMins:360, cost:'€65', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Zugspitze+Germany' },
  { emoji:'🎿', name:'Garmisch-Partenkirchen', location:'~1.5 שעות מ-מינכן', description:'עיירת אלפים ציורית | קניית גלידה + הליכות + קבלת פנים אלפינית', durationMins:240, cost:'חינם', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Garmisch-Partenkirchen+Germany' },
  { emoji:'⛵', name:'Konstanz – Bodensee', location:'~1.5 שעות מ-Hinterzarten', description:'עיר מדינה ימי-ביניימית על הבודנזה | טיול אגם + טירה + שוק', durationMins:270, cost:'חינם', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Konstanz+Bodensee+Germany' },
  { emoji:'🇨🇭', name:'Basel Switzerland', location:'~1 שעה מ-Hinterzarten', description:'מרכז אמנות עולמי | מוזיאון Fondation Beyeler + עיר עתיקה ציורית', durationMins:300, cost:'חינם (מוזיאון ~€25)', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Basel+Switzerland' },
  { emoji:'🏰', name:'Rothenburg ob der Tauber', location:'~2 שעות מ-מינכן', description:'עיר ימי-ביניים מגודרת החמישה הכי יפות בעולם | כמו מתוך אגדה', durationMins:300, cost:'חינם', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Rothenburg+ob+der+Tauber+Germany' },
  { emoji:'🕍', name:'Ulm Cathedral + Fischerturm', location:'~1.5 שעות מ-מינכן', description:'הקתדרלה הגבוהה בעולם (161 מ\') + שכונת הדייגים הציורית | עיר איינשטיין', durationMins:210, cost:'€5 עלייה', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Ulm+Cathedral+Germany' },
  { emoji:'💧', name:'Rhine Falls – Schaffhausen', location:'~1.5 שעות', description:'המפל הגדול ביותר באירופה | ספינות לגלעין הסלע | מדהים!', durationMins:180, cost:'~€10', category:'travel', color:'yellow', mapsUrl:'https://maps.google.com/?q=Rhine+Falls+Schaffhausen+Switzerland' },

  // ── אוכל — עוד ──
  { emoji:'🥨', name:'Weisses Bräuhaus – ארוחת בוקר', location:'מינכן מרכז', description:'ארוחת בוקר בוורית קלאסית | Weisswurst + בייגל + ביר | לפני 12:00 בצהריים!', durationMins:75, cost:'€20–25', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Weisses+Brauhaus+Munich+Germany' },
  { emoji:'🍖', name:'Wirtshaus in der Au', location:'מינכן', description:'הכנדל הכי טוב במינכן | Käsespätzle + בייר + אווירה מקומית אמיתית', durationMins:90, cost:'€25–35', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Wirtshaus+in+der+Au+Munich+Germany' },
  { emoji:'🍺', name:'Augustiner Keller Beer Garden', location:'מינכן', description:'ביירגרטן ענקי של Augustiner | 5,000 מקומות | הכי אותנטי במינכן', durationMins:120, cost:'€15–25', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Augustiner+Keller+Munich+Germany' },
  { emoji:'🥩', name:'Brenner Grill Munich', location:'מינכן מרכז', description:'מסעדת סטייק איטלקית איכותית | ברחוב Maximilianstrasse האלגנטי', durationMins:105, cost:'€45–60', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Brenner+Grill+Munich+Germany' },
  { emoji:'🌿', name:'Zum Wirt, Hinterzarten', location:'Hinterzarten', description:'מסעדה מקומית קלאסית | Maultaschen + פטריות + בשר ציד', durationMins:90, cost:'€25–35', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Gasthaus+Hinterzarten+Germany' },
  { emoji:'🍕', name:'Schneider Weisse G14', location:'מינכן', description:'פאב הביר הכי טוב ליד Marienplatz | Weizenbier מברל | מנות עם ביר', durationMins:90, cost:'€20–30', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Schneider+Weisse+Munich+Germany' },
  { emoji:'🧇', name:'Café Rischart', location:'Marienplatz, מינכן', description:'קפה-בייקרי בוורי קלאסי | עוגות + לחמים + ארוחות בוקר | מול Frauenkirche', durationMins:60, cost:'€10–18', category:'food', color:'orange', mapsUrl:'https://maps.google.com/?q=Cafe+Rischart+Munich+Germany' },

  // ── מיוחד — עוד ──
  { emoji:'🍺', name:'אוקטוברפסט / ביירגרטן גדול', location:'Theresienwiese / Munich', description:'חוויית הביר הגדולה בעולם | לפי תאריכי הטיול: Oktoberfest / ביירגרטן ענק', durationMins:300, cost:'€30–60', category:'special', color:'red', mapsUrl:'https://maps.google.com/?q=Oktoberfest+Munich+Theresienwiese' },
  { emoji:'🎯', name:'Laser Tag Munich', location:'מינכן', description:'לייזר טאג מתקדם | קבוצה שלמה | ~30 דק\' פעילות', durationMins:90, cost:'~€15', category:'special', color:'red', mapsUrl:'https://maps.google.com/?q=Laser+Tag+Munich+Germany' },
  { emoji:'🍳', name:'Bavarian Cooking Class', location:'מינכן', description:'שיעור בישול בוורי | Pretzel + Weisswurst + Schnitzel | חוויה קולינרית', durationMins:180, cost:'~€65', category:'special', color:'red', mapsUrl:'https://maps.google.com/?q=Cooking+Class+Munich+Germany' },
  { emoji:'🎪', name:'Night at Tollwood Festival', location:'מינכן', description:'פסטיבל אמנות + מוזיקה + אוכל עולמי | קיים בקיץ/חורף | אווירה קסומה', durationMins:240, cost:'חינם (כניסה)', category:'special', color:'red', mapsUrl:'https://maps.google.com/?q=Tollwood+Festival+Munich+Germany' },
  { emoji:'🛶', name:'Rafting on Isar River', location:'מינכן', description:'רפטינג על הנהר Isar | סירות עץ מסורתיות | חוויה בוורית אמיתית', durationMins:210, cost:'~€30', category:'special', color:'red', mapsUrl:'https://maps.google.com/?q=Isar+Rafting+Munich+Germany' },
  { emoji:'🎳', name:'Bowling + Bar Night', location:'מינכן', description:'ערב בולינג קבוצתי | Bar + bowling | מושלם לכוליב', durationMins:180, cost:'~€20', category:'special', color:'red', mapsUrl:'https://maps.google.com/?q=Bowling+Munich+Germany' },
  { emoji:'🌅', name:'Sunset at Frauenkirche Tower', location:'מינכן מרכז', description:'תצפית שקיעה מהמגדל הכי אייקוני של מינכן | חובה!', durationMins:60, cost:'€7.5', category:'special', color:'red', mapsUrl:'https://maps.google.com/?q=Frauenkirche+Munich+Germany' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityFile {
  id: string; activityId: string; filename: string; originalName: string; mimeType: string; size: number;
}
interface EventFile {
  id: string; eventId: string; filename: string; originalName: string; mimeType: string; size: number;
}
interface Activity {
  id: string; name: string; emoji: string; location?: string; description?: string;
  durationMins: number; cost?: string; category: string; mapsUrl?: string; url?: string; color: string;
  files: ActivityFile[];
}
interface CalEvent {
  id: string; activityId?: string; title: string; date: string;
  startMinute: number; durationMins: number; color: string; notes?: string;
  allDay?: boolean; url?: string; mapsUrl?: string; cost?: string; files?: EventFile[];
}

type ModalState =
  | { type: 'none' }
  | { type: 'addActivity'; data?: Partial<Activity> }
  | { type: 'editActivity'; activity: Activity }
  | { type: 'addEvent'; date: string; startMinute: number; activityId?: string; title?: string; color?: string; durationMins?: number; url?: string; mapsUrl?: string; cost?: string }
  | { type: 'editEvent'; event: CalEvent };

// ─── Main Page ────────────────────────────────────────────────────────────────

export const PlannerPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTrip, loadTrip } = useTripStore();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents]         = useState<CalEvent[]>([]);
  const [modal, setModal]           = useState<ModalState>({ type: 'none' });
  const [filter, setFilter]         = useState('all');
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [seeding, setSeeding]       = useState(false);

  type AddToMapState =
    | { status: 'geocoding'; name: string }
    | { status: 'confirm'; name: string; displayName: string; lat: number; lng: number; mapsUrl?: string; category?: string }
    | { status: 'saving' }
    | { status: 'done'; name: string }
    | { status: 'error' }
    | null;
  const [addToMap, setAddToMap] = useState<AddToMapState>(null);

  // Drag state (refs to avoid stale closures in mouse handlers)
  const dragActId    = useRef<string | null>(null);
  const eventsRef    = useRef<CalEvent[]>([]);
  const dragEvtState = useRef<{ eventId: string; type: 'move'|'resize'; startY: number; origMin: number; origDur: number; origDate: string } | null>(null);
  const wasDragging  = useRef(false);
  const dayColRefs   = useRef<Map<string, HTMLDivElement>>(new Map());
  eventsRef.current  = events;

  const calRef = useRef<HTMLDivElement>(null);

  // ── Load ──
  useEffect(() => {
    if (!tripId) return;
    if (!currentTrip) loadTrip(tripId);
    apiClient.get(`/api/planner/${tripId}`).then(r => {
      setActivities(r.data.activities);
      setEvents(r.data.events);
    }).finally(() => setLoading(false));
  }, [tripId]);

  // ── Global mouse handlers for drag-move / drag-resize within calendar ──
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragEvtState.current;
      if (!ds) return;
      const dy = e.clientY - ds.startY;
      const dMin = Math.round(dy / PX_PER_MIN);
      let targetDate = ds.origDate;
      if (ds.type === 'move') {
        for (const [date, el] of dayColRefs.current) {
          const r = el.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX < r.right) { targetDate = date; break; }
        }
      }
      setEvents(prev => prev.map(ev => {
        if (ev.id !== ds.eventId) return ev;
        if (ds.type === 'move') {
          const newStart = clamp(snap15(ds.origMin + dMin), START_MIN, END_MIN - 15);
          return { ...ev, startMinute: newStart, date: targetDate };
        } else {
          const newDur = Math.max(15, snap15(ds.origDur + dMin));
          return { ...ev, durationMins: newDur };
        }
      }));
    };
    const onUp = () => {
      const ds = dragEvtState.current;
      if (!ds) return;
      dragEvtState.current = null;
      wasDragging.current = true;
      const ev = eventsRef.current.find(e => e.id === ds.eventId);
      if (ev) apiClient.patch(`/api/planner/${tripId}/events/${ev.id}`, { date: ev.date, startMinute: ev.startMinute, durationMins: ev.durationMins }).catch(console.error);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [tripId]);

  // ── Days from trip dates ──
  const days = React.useMemo(() => {
    if (!currentTrip?.startDate || !currentTrip?.endDate) {
      const today = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      });
    }
    const result: string[] = [];
    const d = new Date(currentTrip.startDate);
    const end = new Date(currentTrip.endDate);
    while (d <= end) { result.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
    return result;
  }, [currentTrip?.startDate, currentTrip?.endDate]);

  // ── Actions ──
  const saveActivity = async (data: Partial<Activity> & { name: string }) => {
    if ('id' in data && data.id) {
      const r = await apiClient.put(`/api/planner/${tripId}/activities/${data.id}`, data);
      setActivities(prev => prev.map(a => a.id === data.id ? r.data.activity : a));
    } else {
      const r = await apiClient.post(`/api/planner/${tripId}/activities`, data);
      setActivities(prev => [...prev, r.data.activity]);
    }
    setModal({ type: 'none' });
  };

  const deleteActivity = async (actId: string) => {
    await apiClient.delete(`/api/planner/${tripId}/activities/${actId}`);
    setActivities(prev => prev.filter(a => a.id !== actId));
    setEvents(prev => prev.map(ev => ev.activityId === actId ? { ...ev, activityId: undefined } : ev));
    setModal({ type: 'none' });
  };

  const saveEvent = async (data: Omit<CalEvent, 'id'> & { id?: string }) => {
    if (data.id) {
      const r = await apiClient.patch(`/api/planner/${tripId}/events/${data.id}`, data);
      setEvents(prev => prev.map(ev => ev.id === data.id ? r.data.event : ev));
    } else {
      const r = await apiClient.post(`/api/planner/${tripId}/events`, data);
      setEvents(prev => [...prev, r.data.event]);
    }
    setModal({ type: 'none' });
  };

  const deleteEvent = async (eventId: string) => {
    await apiClient.delete(`/api/planner/${tripId}/events/${eventId}`);
    setEvents(prev => prev.filter(ev => ev.id !== eventId));
    setModal({ type: 'none' });
  };

  const deleteEventFull = async (ev: CalEvent) => {
    await apiClient.delete(`/api/planner/${tripId}/events/${ev.id}`);
    setEvents(prev => prev.filter(e => e.id !== ev.id));
    if (ev.activityId) {
      await apiClient.delete(`/api/planner/${tripId}/activities/${ev.activityId}`).catch(() => {});
      setActivities(prev => prev.filter(a => a.id !== ev.activityId));
    }
  };

  const seedActivities = async () => {
    setSeeding(true);
    try {
      const r = await apiClient.post(`/api/planner/${tripId}/activities/bulk`, { activities: TEMPLATES });
      setActivities(r.data.activities);
    } finally { setSeeding(false); }
  };

  // ── Add to Map ──
  const handleAddToMap = async (name: string, location?: string, mapsUrl?: string, category?: string) => {
    setAddToMap({ status: 'geocoding', name });
    try {
      // Build search query: prefer mapsUrl q-param, else name + location
      let q = `${name}${location ? ' ' + location : ''}`;
      if (mapsUrl) {
        try {
          const u = new URL(mapsUrl);
          const qParam = u.searchParams.get('q');
          if (qParam) q = qParam;
        } catch { /* ignore bad url */ }
      }
      const res = await apiClient.get(`/api/geocode/search?q=${encodeURIComponent(q)}`);
      const results = res.data.results ?? [];
      if (!results.length) { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); return; }
      const top = results[0];
      // If result has no coords, resolve via details
      if (top.lat == null && top.placeId) {
        const det = await apiClient.get(`/api/geocode/details/${top.placeId}`);
        if (!det.data?.lat) { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); return; }
        setAddToMap({ status: 'confirm', name, displayName: det.data.name || name, lat: det.data.lat, lng: det.data.lng, mapsUrl, category: mapPlaceCategory(category) });
      } else if (top.lat != null) {
        setAddToMap({ status: 'confirm', name, displayName: top.name || name, lat: top.lat, lng: top.lng, mapsUrl, category: mapPlaceCategory(category) });
      } else {
        setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000);
      }
    } catch { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); }
  };

  const confirmAddToMap = async () => {
    if (!addToMap || addToMap.status !== 'confirm') return;
    const { name, displayName, lat, lng, mapsUrl, category } = addToMap;
    setAddToMap({ status: 'saving' });
    try {
      await apiClient.post(`/api/places/${tripId}`, { name: displayName || name, lat, lng, notes: '', mapsUrl: mapsUrl || undefined, category: category || 'other' });
      setAddToMap({ status: 'done', name: displayName || name });
      setTimeout(() => setAddToMap(null), 2500);
    } catch { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); }
  };

  // ── Drop activity onto calendar ──
  const getMinuteFromEvent = useCallback((e: React.DragEvent | React.MouseEvent): number => {
    const cal = calRef.current!;
    const rect = cal.getBoundingClientRect();
    const yInContent = (e.clientY - rect.top) + cal.scrollTop - DAY_HDR_H;
    return clamp(yToMin(Math.max(0, yInContent)), START_MIN, END_MIN - 15);
  }, []);

  const handleCalDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };

  const handleColDrop = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    const actId = dragActId.current;
    if (!actId) return;
    const act = activities.find(a => a.id === actId);
    if (!act) return;
    const startMinute = getMinuteFromEvent(e);
    setModal({ type: 'addEvent', date, startMinute, activityId: act.id, title: act.name, color: act.color, durationMins: act.durationMins, url: act.url, mapsUrl: act.mapsUrl, cost: act.cost });
  };

  const handleColClick = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    if ((e.target as HTMLElement).closest('.cal-event')) return;
    const startMinute = getMinuteFromEvent(e);
    setModal({ type: 'addEvent', date, startMinute });
  };

  // ── Visible activities (exclude already-scheduled ones) ──
  const scheduledActIds = new Set(events.filter(ev => ev.activityId).map(ev => ev.activityId!));
  const searchLower = search.trim().toLowerCase();
  const visibleActs = (filter === 'all' ? activities : activities.filter(a => a.category === filter))
    .filter(a => !scheduledActIds.has(a.id))
    .filter(a => !searchLower || a.name.toLowerCase().includes(searchLower) || a.location?.toLowerCase().includes(searchLower) || a.description?.toLowerCase().includes(searchLower));

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile gate */}
      <div className="md:hidden flex flex-col items-center justify-center h-screen bg-neutral-50 p-8 text-center">
        <div className="text-6xl mb-4">🖥️</div>
        <h2 className="text-xl font-bold text-neutral-800 mb-2">מתכנן הטיול זמין רק בדסקטופ</h2>
        <p className="text-neutral-500 text-sm mb-6">פתח את האפליקציה במחשב כדי להשתמש במתכנן</p>
        <button onClick={() => navigate(`/trip/${tripId}`)} className="text-brand-500 font-medium text-sm">← חזרה לטיול</button>
      </div>

      {/* Desktop view */}
      <div className="hidden md:flex flex-col h-screen overflow-hidden bg-neutral-50">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-neutral-200 flex-shrink-0">
          <button onClick={() => navigate(`/trip/${tripId}`)} className="text-sm text-neutral-500 hover:text-neutral-800 font-medium">← חזרה</button>
          <div className="w-px h-5 bg-neutral-200" />
          <h1 className="font-bold text-neutral-900">📅 מתכנן טיול — {currentTrip?.name}</h1>
          <span className="text-xs text-neutral-400 mr-auto">גרור פעילות לתוך יום | לחץ על תא לאירוע ידני | גרור אירוע להזזה/שינוי זמן</span>
        </div>

        <div className="flex flex-1 min-h-0">

          {/* ── Left Panel: Activities ── */}
          <div className="w-72 flex-shrink-0 flex flex-col border-l border-neutral-200 bg-white relative">

            {/* Panel header */}
            <div className="px-4 py-3 border-b border-neutral-200">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-sm text-neutral-800">📦 פעילויות</h2>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/trip/${tripId}/questionnaire`)} className="text-xs text-purple-600 font-medium hover:text-purple-800">🗳️ שאלון</button>
                  <button onClick={() => setModal({ type: 'addActivity' })} className="text-xs text-brand-500 font-medium hover:text-brand-700">+ הוסף</button>
                </div>
              </div>
              <p className="text-xs text-neutral-400">גרור לתוך יום בלוח</p>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-neutral-100">
              <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5">
                <span className="text-neutral-400 text-xs">🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="חיפוש פעילות..."
                  className="flex-1 text-xs bg-transparent focus:outline-none text-neutral-700 placeholder-neutral-400"
                />
                {search && <button onClick={() => setSearch('')} className="text-neutral-400 hover:text-neutral-600 text-xs leading-none">✕</button>}
              </div>
            </div>
            {/* Filters */}
            <div className="flex gap-1 flex-wrap px-3 py-2 border-b border-neutral-100">
              <button onClick={() => setFilter('all')} className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${filter === 'all' ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>הכל</button>
              {CATS.map(c => (
                <button key={c.id} onClick={() => setFilter(c.id)} className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${filter === c.id ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>{c.label}</button>
              ))}
            </div>

            {/* Activity list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
              {loading ? (
                <p className="text-xs text-neutral-400 text-center py-8">טוען...</p>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <p className="text-sm text-neutral-500 mb-3">אין פעילויות עדיין</p>
                  <button onClick={seedActivities} disabled={seeding} className="text-xs bg-brand-500 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-brand-600">
                    {seeding ? '⏳ טוען...' : '✨ ייבא פעילויות לדוגמה'}
                  </button>
                  <p className="text-xs text-neutral-400 mt-2">35 פעילויות מיער שחור + מינכן</p>
                </div>
              ) : visibleActs.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">אין פעילויות בקטגוריה זו</p>
              ) : (
                visibleActs.map(act => (
                  <ActivityCard
                    key={act.id}
                    activity={act}
                    onDragStart={() => { dragActId.current = act.id; }}
                    onDragEnd={() => { dragActId.current = null; }}
                    onEdit={() => setModal({ type: 'editActivity', activity: act })}
                    onAddToMap={() => handleAddToMap(act.name, act.location, act.mapsUrl, act.category)}
                  />
                ))
              )}

              {activities.length > 0 && (
                <button onClick={() => setModal({ type: 'addActivity' })} className="text-xs text-brand-500 hover:text-brand-700 font-medium py-2 text-center">+ הוסף פעילות</button>
              )}
            </div>

          {/* Add-to-map banner */}
          {addToMap && (
            <div className="absolute bottom-2 left-2 right-2 z-50 bg-white border border-neutral-200 rounded-2xl shadow-xl px-4 py-3" dir="rtl">
              {addToMap.status === 'geocoding' && (
                <p className="text-xs text-neutral-600 flex items-center gap-2">⏳ מחפש מיקום...</p>
              )}
              {addToMap.status === 'confirm' && (
                <div>
                  <p className="text-xs font-semibold text-neutral-800 mb-0.5 truncate">📍 {addToMap.displayName}</p>
                  <p className="text-[11px] text-neutral-500 mb-2">הוסף למפת הטיול?</p>
                  <div className="flex gap-2">
                    <button onClick={confirmAddToMap}
                      className="flex-1 py-1.5 text-xs font-bold bg-brand-500 text-white rounded-xl hover:bg-brand-600">כן ✓</button>
                    <button onClick={() => setAddToMap(null)}
                      className="flex-1 py-1.5 text-xs text-neutral-500 border border-neutral-200 rounded-xl hover:bg-neutral-50">לא</button>
                  </div>
                </div>
              )}
              {addToMap.status === 'saving' && (
                <p className="text-xs text-neutral-600 flex items-center gap-2">⏳ שומר...</p>
              )}
              {addToMap.status === 'done' && (
                <p className="text-xs text-green-600 font-medium">✅ {addToMap.name} נוסף למפה!</p>
              )}
              {addToMap.status === 'error' && (
                <p className="text-xs text-red-500">❌ לא נמצא מיקום</p>
              )}
            </div>
          )}
          </div>{/* end left panel */}

          {/* ── Calendar Grid ── */}
          <div ref={calRef} className="flex-1 overflow-auto" style={{ direction: 'ltr' }}>
            <div style={{ minWidth: `${TIME_COL_W + days.length * 160}px` }}>

              {/* Sticky day headers */}
              <div className="sticky top-0 z-20 bg-white border-b border-neutral-200">
                {/* Day names row */}
                <div className="flex" style={{ height: DAY_HDR_H }}>
                  <div style={{ width: TIME_COL_W, flexShrink: 0 }} />
                  {days.map(date => (
                    <div key={date} className="flex-1 border-r border-neutral-200 flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-neutral-700">{fmtDate(date)}</span>
                      <span className="text-xs text-neutral-400">{events.filter(ev => ev.date === date && !ev.allDay).length} אירועים</span>
                    </div>
                  ))}
                </div>
                {/* All-day events row */}
                {events.some(ev => ev.allDay) && (
                  <div className="flex border-t border-neutral-100" style={{ minHeight: 28 }}>
                    <div style={{ width: TIME_COL_W, flexShrink: 0 }} className="flex items-center justify-end pr-2 pb-1">
                      <span className="text-[10px] text-neutral-400 font-medium">כל היום</span>
                    </div>
                    {days.map(date => {
                      const allDayEvts = events.filter(ev => ev.date === date && ev.allDay);
                      return (
                        <div key={date} className="flex-1 border-r border-neutral-200 px-1 py-1 flex flex-col gap-0.5">
                          {allDayEvts.map(ev => (
                            <AllDayEvent
                              key={ev.id}
                              event={ev}
                              onEdit={() => setModal({ type: 'editEvent', event: ev })}
                              onReturnToBank={ev.activityId ? () => deleteEvent(ev.id) : undefined}
                              onDelete={() => deleteEventFull(ev)}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Time grid */}
              <div className="flex relative" style={{ height: GRID_H }}>

                {/* Time labels */}
                <div className="flex-shrink-0 relative" style={{ width: TIME_COL_W }}>
                  {HOURS.map(h => (
                    <div key={h} className="absolute w-full flex items-start justify-end pr-2 text-xs text-neutral-400 font-medium" style={{ top: (h - START_HOUR) * PX_PER_HR - 8, height: PX_PER_HR }}>
                      {String(h).padStart(2,'0')}:00
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {days.map(date => (
                  <DayColumn
                    key={date}
                    date={date}
                    events={events.filter(ev => ev.date === date && !ev.allDay)}
                    onDragOver={handleCalDragOver}
                    onDrop={e => handleColDrop(e, date)}
                    onClick={e => handleColClick(e, date)}
                    colRef={el => { if (el) dayColRefs.current.set(date, el); else dayColRefs.current.delete(date); }}
                    onEventClick={ev => {
                      if (wasDragging.current) { wasDragging.current = false; return; }
                      setModal({ type: 'editEvent', event: ev });
                    }}
                    onEventMouseDown={(e, ev, type) => {
                      dragEvtState.current = { eventId: ev.id, type, startY: e.clientY, origMin: ev.startMinute, origDur: ev.durationMins, origDate: ev.date };
                    }}
                    onEventEdit={ev => setModal({ type: 'editEvent', event: ev })}
                    onEventReturnToBank={ev => deleteEvent(ev.id)}
                    onEventDeleteFull={ev => deleteEventFull(ev)}
                    onEventAddToMap={ev => handleAddToMap(ev.title, undefined, ev.mapsUrl)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {modal.type === 'addActivity' && (
        <ActivityModal tripId={tripId!} onSave={saveActivity} onClose={() => setModal({ type: 'none' })} />
      )}
      {modal.type === 'editActivity' && (
        <ActivityModal tripId={tripId!} activity={modal.activity} onSave={saveActivity} onDelete={deleteActivity} onClose={() => setModal({ type: 'none' })} />
      )}
      {(modal.type === 'addEvent' || modal.type === 'editEvent') && (
        <EventModal
          tripId={tripId!}
          event={modal.type === 'editEvent' ? modal.event : undefined}
          defaultDate={modal.type === 'addEvent' ? modal.date : undefined}
          defaultStartMinute={modal.type === 'addEvent' ? modal.startMinute : undefined}
          defaultTitle={modal.type === 'addEvent' ? modal.title : undefined}
          defaultColor={modal.type === 'addEvent' ? modal.color : undefined}
          defaultDuration={modal.type === 'addEvent' ? modal.durationMins : undefined}
          defaultActivityId={modal.type === 'addEvent' ? modal.activityId : undefined}
          defaultUrl={modal.type === 'addEvent' ? modal.url : undefined}
          defaultMapsUrl={modal.type === 'addEvent' ? modal.mapsUrl : undefined}
          defaultCost={modal.type === 'addEvent' ? modal.cost : undefined}
          days={days}
          onSave={saveEvent}
          onDelete={modal.type === 'editEvent' ? deleteEvent : undefined}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </>
  );
};

// ─── Activity Card ─────────────────────────────────────────────────────────────

const ActivityCard: React.FC<{
  activity: Activity;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onAddToMap: () => void;
}> = ({ activity: act, onDragStart, onDragEnd, onEdit, onAddToMap }) => {
  const c = col(act.color);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="rounded-xl border border-neutral-200 bg-white px-2.5 py-2 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow select-none group"
    >
      {/* Row 1: emoji + name + edit + map */}
      <div className="flex items-center gap-1.5">
        <span className="text-base flex-shrink-0">{act.emoji}</span>
        <span className="text-xs font-bold text-neutral-800 leading-snug flex-1 truncate">{act.name}</span>
        <button onClick={e => { e.stopPropagation(); onAddToMap(); }} title="הוסף למפה" className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-green-600 text-xs flex-shrink-0 px-0.5">📍</button>
        <button onClick={e => { e.stopPropagation(); onEdit(); }} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-600 text-xs flex-shrink-0 px-0.5">✏️</button>
      </div>
      {/* Row 2: icons */}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${c.pill}`}>{CATS.find(c => c.id === act.category)?.label ?? act.category}</span>
        {act.cost && <span className="text-xs font-medium text-neutral-600">💰 {act.cost}</span>}
        <span className="text-xs text-neutral-400">⏱ {fmtDur(act.durationMins)}</span>
        {act.url && <a href={act.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:text-blue-700">🔗</a>}
        {act.mapsUrl && <a href={act.mapsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-500 hover:text-blue-700">🗺️</a>}
        {act.files?.length > 0 && <span className="text-xs text-neutral-400">📎 {act.files.length}</span>}
      </div>
    </div>
  );
};

// ─── All-Day Event chip ───────────────────────────────────────────────────────

const AllDayEvent: React.FC<{
  event: CalEvent;
  onEdit: () => void;
  onReturnToBank?: () => void;
  onDelete: () => void;
}> = ({ event: ev, onEdit, onReturnToBank, onDelete }) => {
  const c = col(ev.color);
  const btn = 'hover:bg-black/10 rounded px-0.5 leading-none';
  return (
    <div
      className={`group flex items-center justify-between rounded px-1.5 py-0.5 text-xs font-medium cursor-pointer ${c.event} ${c.text}`}
      onClick={onEdit}
    >
      <span className="truncate flex-1">{ev.title}</span>
      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 flex-shrink-0 ml-1">
        {ev.url && (
          <a href={ev.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={btn}>🔗</a>
        )}
        <button onClick={e => { e.stopPropagation(); onEdit(); }} className={btn}>✏️</button>
        {onReturnToBank && (
          <button onClick={e => { e.stopPropagation(); onReturnToBank(); }} title="החזר לבנק" className={btn}>↩️</button>
        )}
        <button onClick={e => { e.stopPropagation(); if (confirm(ev.activityId ? 'למחוק אירוע ופעילות לצמיתות?' : 'למחוק אירוע?')) onDelete(); }} className={btn}>🗑️</button>
      </div>
    </div>
  );
};

// ─── Day Column ────────────────────────────────────────────────────────────────

const DayColumn: React.FC<{
  date: string;
  events: CalEvent[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onEventClick: (ev: CalEvent) => void;
  onEventMouseDown: (e: React.MouseEvent, ev: CalEvent, type: 'move' | 'resize') => void;
  onEventEdit: (ev: CalEvent) => void;
  onEventReturnToBank: (ev: CalEvent) => void;
  onEventDeleteFull: (ev: CalEvent) => void;
  onEventAddToMap: (ev: CalEvent) => void;
  colRef: (el: HTMLDivElement | null) => void;
}> = ({ date: _date, events, onDragOver, onDrop, onClick, onEventClick, onEventMouseDown, onEventEdit, onEventReturnToBank, onEventDeleteFull, onEventAddToMap, colRef }) => (
  <div
    ref={colRef}
    className="flex-1 border-r border-neutral-200 relative cursor-crosshair overflow-hidden"
    style={{ height: GRID_H }}
    onDragOver={onDragOver}
    onDrop={onDrop}
    onClick={onClick}
  >
    {/* Hour lines */}
    {HOURS.map(h => (
      <div key={h} className="absolute w-full border-t border-neutral-200" style={{ top: (h - START_HOUR) * PX_PER_HR }} />
    ))}
    {/* Half-hour lines */}
    {HOURS.map(h => (
      <div key={`${h}h`} className="absolute w-full border-t border-neutral-100" style={{ top: (h - START_HOUR) * PX_PER_HR + PX_PER_HR / 2 }} />
    ))}

    {/* Events */}
    {events.map(ev => (
      <CalendarEvent
        key={ev.id}
        event={ev}
        onClick={() => onEventClick(ev)}
        onMouseDown={(e, type) => { e.stopPropagation(); onEventMouseDown(e, ev, type); }}
        onEdit={() => onEventEdit(ev)}
        onReturnToBank={ev.activityId ? () => onEventReturnToBank(ev) : undefined}
        onDelete={() => onEventDeleteFull(ev)}
        onAddToMap={() => onEventAddToMap(ev)}
      />
    ))}
  </div>
);

// ─── Calendar Event ───────────────────────────────────────────────────────────

const FilesPopup: React.FC<{ files: EventFile[]; onClose: () => void }> = ({ files, onClose }) => (
  <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" onClick={e => { e.stopPropagation(); onClose(); }} onMouseDown={e => e.stopPropagation()}>
    <div className="absolute inset-0 bg-black/30" />
    <div className="relative bg-white rounded-2xl shadow-2xl p-4 w-72" dir="rtl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-neutral-800">📎 קבצים מצורפים</h3>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-lg leading-none px-1">✕</button>
      </div>
      <div className="flex flex-col gap-2">
        {files.map(f => {
          const isImage = f.mimeType.startsWith('image/');
          const href = `/uploads/planner/${f.filename}`;
          return (
            <a key={f.id} href={href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-50 hover:bg-brand-50 border border-neutral-100 hover:border-brand-200 transition-colors group">
              <span className="text-xl flex-shrink-0">{isImage ? '🖼️' : '📄'}</span>
              <span className="text-xs text-neutral-700 group-hover:text-brand-700 truncate flex-1">{f.originalName}</span>
              <span className="text-[10px] text-neutral-400 flex-shrink-0">↗</span>
            </a>
          );
        })}
      </div>
    </div>
  </div>
);

const CalendarEvent: React.FC<{
  event: CalEvent;
  onClick: () => void;
  onMouseDown: (e: React.MouseEvent, type: 'move' | 'resize') => void;
  onEdit: () => void;
  onReturnToBank?: () => void;
  onDelete: () => void;
  onAddToMap: () => void;
}> = ({ event: ev, onClick, onMouseDown, onEdit, onReturnToBank, onDelete, onAddToMap }) => {
  const [showFiles, setShowFiles] = useState(false);
  const top    = minToY(ev.startMinute);
  const height = Math.max(20, Math.min(ev.durationMins * PX_PER_MIN, GRID_H - top));
  const c      = col(ev.color);
  const short  = height < 44;  // title only
  const tall   = height >= 76; // title + icons + time + notes
  const btnCls = 'text-sm leading-none hover:bg-black/10 rounded px-1 py-0.5 flex-shrink-0';

  return (
    <div
      className={`cal-event absolute inset-x-0.5 rounded-lg border ${c.event} ${c.border} ${c.text} overflow-hidden cursor-grab active:cursor-grabbing transition-all select-none`}
      style={{ top, height }}
      onClick={onClick}
      onMouseDown={e => onMouseDown(e, 'move')}
    >
      <div className="px-1.5 pt-0.5 pb-3 leading-tight flex flex-col gap-0.5">
        {/* Title + cost */}
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-semibold truncate flex-1">{ev.title}</p>
          {ev.cost && !short && <span className="text-[10px] font-medium opacity-75 flex-shrink-0">💰{ev.cost}</span>}
        </div>
        {/* Time row */}
        {tall && <p className="text-xs opacity-60">{fmtMin(ev.startMinute)} – {fmtMin(ev.startMinute + ev.durationMins)}</p>}
        {/* Icons row — always visible when not short */}
        {!short && (
          <div className="flex items-center gap-0.5 flex-wrap mt-0.5" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            {ev.url?.trim() && (
              <a href={ev.url} target="_blank" rel="noopener noreferrer" className={btnCls}>🔗</a>
            )}
            {ev.mapsUrl?.trim() && (
              <a href={ev.mapsUrl} target="_blank" rel="noopener noreferrer" className={btnCls}>🗺️</a>
            )}
            {ev.files && ev.files.length === 1 && (
              <a href={`/uploads/planner/${ev.files[0].filename}`} target="_blank" rel="noopener noreferrer" className={btnCls} title={ev.files[0].originalName}>📎</a>
            )}
            {ev.files && ev.files.length > 1 && (
              <button onClick={e => { e.stopPropagation(); setShowFiles(true); }} onMouseDown={e => e.stopPropagation()} title="קבצים מצורפים" className={btnCls}>📎{ev.files.length}</button>
            )}
            <button onClick={e => { e.stopPropagation(); onAddToMap(); }} onMouseDown={e => e.stopPropagation()} title="הוסף למפה" className={btnCls}>📍</button>
            <button onClick={e => { e.stopPropagation(); onEdit(); }} onMouseDown={e => e.stopPropagation()} className={btnCls}>✏️</button>
            {onReturnToBank && (
              <button onClick={e => { e.stopPropagation(); onReturnToBank(); }} onMouseDown={e => e.stopPropagation()} title="החזר לבנק" className={btnCls}>↩️</button>
            )}
            <button onClick={e => { e.stopPropagation(); if (confirm(ev.activityId ? 'למחוק אירוע ופעילות לצמיתות?' : 'למחוק אירוע?')) onDelete(); }} onMouseDown={e => e.stopPropagation()} className={btnCls}>🗑️</button>
          </div>
        )}
        {/* Notes */}
        {tall && ev.notes?.trim() && <p className="text-xs opacity-60 line-clamp-2">{ev.notes}</p>}
      </div>
      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex items-center justify-center"
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, 'resize'); }}
      >
        <div className="w-6 h-0.5 rounded bg-current opacity-40" />
      </div>
      {showFiles && ev.files && <FilesPopup files={ev.files} onClose={() => setShowFiles(false)} />}
    </div>
  );
};

// ─── Activity Modal ───────────────────────────────────────────────────────────

const ActivityModal: React.FC<{
  activity?: Activity;
  tripId: string;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}> = ({ activity, tripId, onSave, onDelete, onClose }) => {
  const [name, setName]         = useState(activity?.name ?? '');
  const [emoji, setEmoji]       = useState(activity?.emoji ?? '📌');
  const [location, setLocation] = useState(activity?.location ?? '');
  const [desc, setDesc]         = useState(activity?.description ?? '');
  const [dur, setDur]           = useState(String(activity?.durationMins ?? 60));
  const [cost, setCost]         = useState(activity?.cost ?? '');
  const [category, setCategory] = useState(activity?.category ?? 'other');
  const [mapsUrl, setMapsUrl]   = useState(activity?.mapsUrl ?? '');
  const [url, setUrl]           = useState(activity?.url ?? '');
  const [saving, setSaving]     = useState(false);
  const [files, setFiles]       = useState<ActivityFile[]>(activity?.files ?? []);
  const [uploading, setUploading] = useState(false);

  const color = catColor(category);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: activity?.id, name, emoji, location: location || undefined, description: desc || undefined, durationMins: parseInt(dur) || 60, cost: cost || undefined, category, mapsUrl: mapsUrl || undefined, url: url || undefined, color });
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activity) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await apiClient.post(`/api/planner/${tripId}/activities/${activity.id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFiles(prev => [...prev, r.data.file]);
    } catch { /* silent */ }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!activity) return;
    await apiClient.delete(`/api/planner/${tripId}/activities/${activity.id}/files/${fileId}`).catch(() => {});
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const inp = 'border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500';

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold text-neutral-900 mb-4">{activity ? 'עריכת פעילות' : 'פעילות חדשה'}</h2>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input value={emoji} onChange={e => setEmoji(e.target.value)} className="w-16 text-center text-2xl border border-neutral-200 rounded-xl p-2" maxLength={2} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="שם הפעילות *" className={`flex-1 ${inp}`} />
        </div>
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="מיקום (אופציונלי)" className={inp} />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="תיאור קצר (אופציונלי)" rows={2} className={`${inp} resize-none`} />
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-neutral-500 mb-1 block">משך (דקות)</label>
            <input type="number" value={dur} onChange={e => setDur(e.target.value)} min={15} step={15} className={`w-full ${inp}`} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-neutral-500 mb-1 block">מחיר</label>
            <input value={cost} onChange={e => setCost(e.target.value)} placeholder="חינם / €15" className={`w-full ${inp}`} />
          </div>
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">קטגוריה</label>
          <div className="flex flex-wrap gap-1.5">
            {CATS.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)} className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${category === c.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-600'}`}>{c.label}</button>
            ))}
          </div>
        </div>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="🔗 קישור כללי (אופציונלי)" className={inp} />
        <input value={mapsUrl} onChange={e => setMapsUrl(e.target.value)} placeholder="🗺️ קישור Google Maps (אופציונלי)" className={inp} />

        {/* Files — only when editing */}
        {activity ? (
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">קבצים מצורפים</label>
            {files.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {files.map(f => {
                  const isImage = f.mimeType.startsWith('image/');
                  const href = `/uploads/planner/${f.filename}`;
                  return (
                    <div key={f.id} className="flex items-center gap-2 bg-neutral-50 rounded-lg px-2 py-1.5">
                      {isImage && <img src={href} alt={f.originalName} className="w-8 h-8 object-cover rounded" />}
                      {!isImage && <span className="text-base">📄</span>}
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate flex-1">{f.originalName}</a>
                      <button onClick={() => handleDeleteFile(f.id)} className="text-neutral-400 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-brand-500 font-medium hover:text-brand-700">
              <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*,.pdf" disabled={uploading} />
              {uploading ? '⏳ מעלה...' : '+ הוסף קובץ (תמונה / PDF)'}
            </label>
          </div>
        ) : (
          <p className="text-xs text-neutral-400">ניתן לצרף קבצים לאחר שמירה</p>
        )}
      </div>

      <div className="flex gap-2 mt-5">
        {onDelete && activity && (
          <button onClick={() => { if (confirm('למחוק פעילות?')) onDelete(activity.id); }} className="text-sm text-red-400 px-3 py-2 rounded-xl hover:bg-red-50">מחק</button>
        )}
        <button onClick={onClose} className="flex-1 text-sm text-neutral-600 border border-neutral-200 rounded-xl py-2.5">ביטול</button>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 text-sm font-bold bg-brand-500 text-white rounded-xl py-2.5 disabled:opacity-50 hover:bg-brand-600">
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </ModalOverlay>
  );
};

// ─── Event Modal ──────────────────────────────────────────────────────────────

const EventModal: React.FC<{
  tripId: string;
  event?: CalEvent;
  defaultDate?: string;
  defaultStartMinute?: number;
  defaultTitle?: string;
  defaultColor?: string;
  defaultDuration?: number;
  defaultActivityId?: string;
  defaultUrl?: string;
  defaultMapsUrl?: string;
  defaultCost?: string;
  days: string[];
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}> = ({ tripId, event, defaultDate, defaultStartMinute, defaultTitle, defaultColor, defaultDuration, defaultActivityId, defaultUrl, defaultMapsUrl, defaultCost, days, onSave, onDelete, onClose }) => {
  const initStart  = event?.startMinute ?? defaultStartMinute ?? 540;
  const initDur    = event?.durationMins ?? defaultDuration ?? 60;
  const initEnd    = initStart + initDur;

  const [title,   setTitle]   = useState(event?.title   ?? defaultTitle   ?? '');
  const [date,    setDate]    = useState(event?.date    ?? defaultDate    ?? days[0] ?? '');
  const [allDay,  setAllDay]  = useState(event?.allDay  ?? false);
  const [startH,  setStartH]  = useState(String(Math.floor(initStart / 60)).padStart(2,'0'));
  const [startM,  setStartM]  = useState(String(initStart % 60).padStart(2,'0'));
  const [endH,    setEndH]    = useState(String(Math.floor(Math.min(initEnd, 1439) / 60)).padStart(2,'0'));
  const [endM,    setEndM]    = useState(String(Math.min(initEnd, 1439) % 60).padStart(2,'0'));
  const [color,   setColor]   = useState(event?.color   ?? defaultColor   ?? 'blue');
  const [notes,   setNotes]   = useState(event?.notes   ?? '');
  const [url,     setUrl]     = useState(event?.url     ?? defaultUrl     ?? '');
  const [mapsUrl, setMapsUrl] = useState(event?.mapsUrl ?? defaultMapsUrl ?? '');
  const [cost,    setCost]    = useState(event?.cost    ?? defaultCost    ?? '');
  const [files,   setFiles]   = useState<EventFile[]>(event?.files ?? []);
  const [saving,  setSaving]  = useState(false);
  const [uploading, setUploading] = useState(false);

  const startMinute = parseInt(startH) * 60 + parseInt(startM);
  const endMinute   = parseInt(endH)   * 60 + parseInt(endM);
  const durationMins = Math.max(15, endMinute > startMinute ? endMinute - startMinute : 60);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: event?.id, activityId: event?.activityId ?? defaultActivityId,
        title, date, allDay,
        startMinute: allDay ? 0 : startMinute,
        durationMins: allDay ? 1440 : durationMins,
        color, notes: notes.trim() || null, url: url.trim() || null,
        mapsUrl: mapsUrl.trim() || null, cost: cost.trim() || null,
      });
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !event) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await apiClient.post(`/api/planner/${tripId}/events/${event.id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFiles(prev => [...prev, r.data.file]);
    } catch { /* silent */ }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!event) return;
    await apiClient.delete(`/api/planner/${tripId}/events/${event.id}/files/${fileId}`).catch(() => {});
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const COLOR_OPTS = Object.keys(COLORS);
  const timeInput = 'flex items-center gap-1 border border-neutral-200 rounded-xl px-3 py-2' as const;
  const inp = 'border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500' as const;

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold text-neutral-900 mb-4">{event ? 'עריכת אירוע' : 'אירוע חדש'}</h2>
      <div className="flex flex-col gap-3">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="כותרת *" className={inp} />

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">יום</label>
          <select value={date} onChange={e => setDate(e.target.value)} className={`w-full ${inp}`}>
            {days.map(d => <option key={d} value={d}>{fmtDate(d)} ({d})</option>)}
          </select>
        </div>

        {/* All-day toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="w-4 h-4 accent-brand-500" />
          <span className="text-sm text-neutral-700">אירוע יום שלם (מלון, טיסה, ...)</span>
        </label>

        {/* Time pickers — hidden when allDay */}
        {!allDay && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-neutral-500 mb-1 block">שעת התחלה</label>
              <div className={timeInput} dir="ltr">
                <input type="number" value={startH} onChange={e => setStartH(String(Math.min(23, Math.max(0, parseInt(e.target.value) || 0))).padStart(2,'0'))} min={0} max={23} className="w-8 text-center text-sm focus:outline-none" />
                <span className="text-neutral-400">:</span>
                <select value={startM} onChange={e => setStartM(e.target.value)} className="text-sm focus:outline-none bg-transparent">
                  {['00','15','30','45'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-neutral-500 mb-1 block">שעת סיום</label>
              <div className={timeInput} dir="ltr">
                <input type="number" value={endH} onChange={e => setEndH(String(Math.min(23, Math.max(0, parseInt(e.target.value) || 0))).padStart(2,'0'))} min={0} max={23} className="w-8 text-center text-sm focus:outline-none" />
                <span className="text-neutral-400">:</span>
                <select value={endM} onChange={e => setEndM(e.target.value)} className="text-sm focus:outline-none bg-transparent">
                  {['00','15','30','45'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="🔗 קישור כללי (אופציונלי)" className={inp} />
        <input value={mapsUrl} onChange={e => setMapsUrl(e.target.value)} placeholder="🗺️ קישור Google Maps (אופציונלי)" className={inp} />
        <input value={cost} onChange={e => setCost(e.target.value)} placeholder="💰 מחיר (למשל €15, חינם)" className={inp} />

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="תיאור (אופציונלי)" rows={2} className={`${inp} resize-none`} />

        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">צבע</label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? 'border-neutral-800 scale-110' : 'border-transparent'} ${COLORS[c].event}`} />
            ))}
          </div>
        </div>

        {/* Files — only when editing */}
        {event ? (
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">קבצים מצורפים</label>
            {files.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {files.map(f => {
                  const isImage = f.mimeType.startsWith('image/');
                  const href = `/uploads/planner/${f.filename}`;
                  return (
                    <div key={f.id} className="flex items-center gap-2 bg-neutral-50 rounded-lg px-2 py-1.5">
                      {isImage && <img src={href} alt={f.originalName} className="w-8 h-8 object-cover rounded" />}
                      {!isImage && <span className="text-base">📄</span>}
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate flex-1">{f.originalName}</a>
                      <button onClick={() => handleDeleteFile(f.id)} className="text-neutral-400 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-brand-500 font-medium hover:text-brand-700">
              <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*,.pdf" disabled={uploading} />
              {uploading ? '⏳ מעלה...' : '+ הוסף קובץ (תמונה / PDF)'}
            </label>
          </div>
        ) : (
          <p className="text-xs text-neutral-400">ניתן לצרף קבצים לאחר שמירה</p>
        )}
      </div>

      <div className="flex gap-2 mt-5">
        {onDelete && event && (
          <button onClick={() => { if (confirm('למחוק אירוע?')) onDelete(event.id); }} className="text-sm text-red-400 px-3 py-2 rounded-xl hover:bg-red-50">מחק</button>
        )}
        <button onClick={onClose} className="flex-1 text-sm text-neutral-600 border border-neutral-200 rounded-xl py-2.5">ביטול</button>
        <button onClick={handleSave} disabled={saving || !title.trim()} className="flex-1 text-sm font-bold bg-brand-500 text-white rounded-xl py-2.5 disabled:opacity-50 hover:bg-brand-600">
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </ModalOverlay>
  );
};

// ─── Modal Overlay ─────────────────────────────────────────────────────────────

const ModalOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
      {children}
    </div>
  </div>
);
