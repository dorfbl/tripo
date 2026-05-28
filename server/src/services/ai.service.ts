import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

interface MemberAnswer {
  question: string;
  answer: string;
}

interface MemberAnswers {
  answers: MemberAnswer[];
}

export interface DestinationSuggestion {
  name: string;
  country: string;
  description: string;
  whyItFits: string;
  matchScore: number;
  climate: string;
  highlights: string[];
}

// ─── רשימת איסורים קשיחה ───────────────────────────────────────────────────
const ALWAYS_BANNED_LIST = [
  'דובאי', 'dubai',
  'איחוד האמירויות', 'uae', 'emirates',
  'מרוקו', 'morocco',
  'ירדן', 'jordan',
  'מצרים', 'egypt',
  'טורקיה', 'turkey', 'türkiye',
  'תוניסיה', 'tunisia',
  'לבנון', 'lebanon',
  'בחריין', 'bahrain',
  'קטר', 'qatar',
  'כווית', 'kuwait',
  'סעודיה', 'saudi',
  'עומאן', 'oman',
  'אלג\'יריה', 'algeria',
  'לוב', 'libya',
  'סוריה', 'syria',
  'עיראק', 'iraq',
  'איראן', 'iran',
  'תימן', 'yemen',
];

function isBanned(dest: DestinationSuggestion, extraBanned: string[]): boolean {
  const haystack = `${dest.name} ${dest.country} ${dest.description} ${dest.whyItFits}`.toLowerCase();
  const allTerms = [...ALWAYS_BANNED_LIST, ...extraBanned.map(b => b.toLowerCase())];
  return allTerms.some(term => haystack.includes(term));
}

// ─── חילוץ JSON עמיד לשגיאות תחביר ─────────────────────────────────────────
// משתמש בספירת סוגריים במקום slice לפי lastIndexOf
function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape)          { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true;  continue; }
    if (ch === '"')      { inString = !inString;   continue; }
    if (inString)        { continue; }
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // JSON לא שלם
}

// ─── תאריכים בעברית ─────────────────────────────────────────────────────────
const HEBREW_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];

function formatTripDates(startDate?: Date, endDate?: Date): string {
  if (!startDate) return '';
  const s = `${startDate.getDate()} ${HEBREW_MONTHS[startDate.getMonth()]} ${startDate.getFullYear()}`;
  if (!endDate) return `תאריך הטיול: ${s}`;
  const e = `${endDate.getDate()} ${HEBREW_MONTHS[endDate.getMonth()]} ${endDate.getFullYear()}`;
  const nights = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
  return `${s} עד ${e} (${nights} לילות)`;
}

// ─── פונקציה ראשית ──────────────────────────────────────────────────────────
export async function generateDestinations(
  membersAnswers: MemberAnswers[],
  tripDates?: { startDate?: Date; endDate?: Date }
): Promise<DestinationSuggestion[]> {

  const formattedAnswers = membersAnswers
    .map((member, idx) =>
      `חבר ${idx + 1}:\n` +
      member.answers.map(a => `${a.question}: ${a.answer}`).join(' | ')
    )
    .join('\n');

  // חלץ מה שחברים אמרו במפורש
  const bannedByMembers: string[] = [];
  const wantedByMembers: string[] = [];
  for (const member of membersAnswers) {
    for (const a of member.answers) {
      if (a.question.includes('לא רוצה אליו בשום פנים')) {
        const val = a.answer.trim();
        if (val.length > 1) bannedByMembers.push(val);
      }
      if (a.question.includes('תמיד רצית לראות')) {
        const val = a.answer.trim();
        if (val.length > 1) wantedByMembers.push(val);
      }
    }
  }

  const tripDatesStr = formatTripDates(tripDates?.startDate, tripDates?.endDate);
  console.log('[AI] תאריכי טיול:', tripDatesStr || 'לא צוינו');
  console.log('[AI] אסורים מחברים:', bannedByMembers);
  console.log('[AI] רצויים מחברים:', wantedByMembers);

  const BANNED_STR =
    'דובאי, UAE, מרוקו, ירדן, מצרים, טורקיה, תוניסיה, לבנון, בחריין, קטר, כווית, סעודיה, עומאן, ' +
    'אלג\'יריה, לוב, סוריה, עיראק, איראן, תימן — וכל מדינה ערבית/מוסלמית אחרת';

  const memberBannedStr = bannedByMembers.length ? bannedByMembers.join(', ') : 'אין';
  const wantedStr       = wantedByMembers.length ? wantedByMembers.join(', ') : 'אין';
  const datesLine       = tripDatesStr
    ? `תאריכי הטיול: ${tripDatesStr} — התאם את מזג האוויר לחודש הספציפי הזה!`
    : '';

  const systemPrompt = `אתה מומחה לתכנון טיולים קבוצתיים. תפקידך להציע 3 יעדים מותאמים.

=== חוקים שאסור לעבור עליהם בשום מקרה ===
1. אסור לחלוטין להציע: ${BANNED_STR}
2. אסור להציע יעדים שחברים ציינו שהם לא רוצים: ${memberBannedStr}
3. אסור להציע אטרקציה בודדת (כמו דיסנילנד, ספארי וכד') — הצע אזור/מסלול שלם
4. ${datesLine || 'התחשב במזג אוויר מתאים לעונה'}

=== עדיפויות ===
- יעדים שחברים רוצים: ${wantedStr} → תן להם משקל גבוה מאוד
- איזון בין העדפות כל הקבוצה
- מזג אוויר מתאים לתאריכי הטיול הספציפיים

=== כללי תוכן ===
- הצע מסלולים/שילובים חכמים ולא רק עיר בודדת
  דוגמאות: "גיאורגיה: טביליסי + קאזבגי", "קרואטיה ומונטנגרו", "היער השחור + מינכן"
- name: שם המסלול המלא
- country: מדינה/ות ראשיות
- description: משפט אחד על המסלול כולו
- whyItFits: 2 משפטים למה מתאים לקבוצה הזאת
- matchScore: 0-100
- climate: מזג אוויר ${tripDatesStr ? `ב${tripDatesStr.split(' עד')[0].split(' ').slice(-2).join(' ')}` : 'בתקופה'} — 3-5 מילים
- highlights: בדיוק 3 פריטים קצרים (2-4 מילים)
- JSON בלבד, ללא טקסט נוסף`;

  const userPrompt = `תשובות ${membersAnswers.length} חברים:
${formattedAnswers}

⛔ לפני שתחזיר — עבור על כל יעד שהכנת:
- האם הוא מופיע ב: ${BANNED_STR}? אם כן — החלף!
- האם חבר ציין שהוא לא רוצה אליו: ${memberBannedStr}? אם כן — החלף!
- האם זה אטרקציה בודדת (פארק/תיאטרון/שופינג סנטר)? אם כן — הרחב לאזור שלם!
${tripDatesStr ? `- האם מזג האוויר ב${tripDatesStr} מתאים? אם לא — החלף!` : ''}

החזר JSON בלבד:
{"destinations":[{"name":"...","country":"...","description":"...","whyItFits":"...","matchScore":80,"climate":"...","highlights":["...","...","..."]}]}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('תגובה לא צפויה מ-AI');

  const raw = content.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // חילוץ JSON עמיד — ספירת סוגריים, לא lastIndexOf
  const jsonStr = extractJson(raw);
  if (!jsonStr) {
    console.error('[AI] לא נמצא JSON תקין. תגובה גולמית:\n', raw);
    throw new Error('לא ניתן לנתח את תגובת ה-AI');
  }

  let parsed: { destinations: DestinationSuggestion[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error('[AI] JSON.parse נכשל:', e);
    console.error('[AI] JSON שנחלץ:\n', jsonStr);
    throw new Error('תגובת ה-AI לא בפורמט JSON תקין');
  }

  if (!parsed.destinations?.length) throw new Error('ה-AI לא החזיר יעדים');

  // ─── סינון קשיח post-processing ─────────────────────────────────────────
  const filtered = parsed.destinations.filter(d => {
    const banned = isBanned(d, bannedByMembers);
    if (banned) console.warn(`[AI] סוּנן יעד אסור: "${d.name}" (${d.country})`);
    return !banned;
  });

  console.log(`[AI] יעדים לפני סינון: ${parsed.destinations.length}, אחרי: ${filtered.length}`);

  if (filtered.length === 0) {
    console.error('[AI] כל היעדים אסורים:', parsed.destinations.map(d => d.name));
    throw new Error('ה-AI הציע יעדים אסורים בלבד — נסה לייצר שוב');
  }

  return filtered;
}
