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

// רשימת מדינות/יעדים שאסור להציע בכל מקרה
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

function isBanned(text: string, extraBanned: string[]): boolean {
  const lower = text.toLowerCase();
  const allBanned = [...ALWAYS_BANNED_LIST, ...extraBanned.map(b => b.toLowerCase())];
  return allBanned.some(b => lower.includes(b));
}

export async function generateDestinations(
  membersAnswers: MemberAnswers[]
): Promise<DestinationSuggestion[]> {
  const formattedAnswers = membersAnswers
    .map(
      (member, idx) =>
        `חבר ${idx + 1}:\n` +
        member.answers.map((a) => `${a.question}: ${a.answer}`).join(' | ')
    )
    .join('\n');

  // חלץ יעדים שחברים לא רוצים
  const bannedByMembers: string[] = [];
  // חלץ יעדים שחברים רוצים (לתת להם עדיפות)
  const wantedByMembers: string[] = [];

  for (const member of membersAnswers) {
    for (const a of member.answers) {
      if (a.question.includes('לא רוצה אליו בשום פנים')) {
        const val = a.answer.trim();
        if (val && val.length > 1) bannedByMembers.push(val);
      }
      if (a.question.includes('תמיד רצית לראות')) {
        const val = a.answer.trim();
        if (val && val.length > 1) wantedByMembers.push(val);
      }
    }
  }

  console.log('[AI] יעדים אסורים מחברים:', bannedByMembers);
  console.log('[AI] יעדים רצויים מחברים:', wantedByMembers);

  const ALWAYS_BANNED_STR = [
    'דובאי, איחוד האמירויות (UAE), מרוקו, ירדן, מצרים, טורקיה',
    'תוניסיה, לבנון, בחריין, קטר, כווית, סעודיה, עומאן',
    'אלג\'יריה, לוב, סוריה, עיראק, איראן, תימן',
    'כל מדינה ערבית / מוסלמית במזרח התיכון או צפון אפריקה',
  ].join(', ');

  const bannedMembersStr = bannedByMembers.length > 0
    ? bannedByMembers.join(', ')
    : 'אין';
  const wantedStr = wantedByMembers.length > 0
    ? wantedByMembers.join(', ')
    : 'אין';

  const systemPrompt = `אתה מומחה לתכנון טיולים קבוצתיים.

!!!CRITICAL RULES - NEVER VIOLATE!!!
1. NEVER suggest these destinations under any circumstances: ${ALWAYS_BANNED_STR}
2. NEVER suggest destinations that members explicitly said they don't want: ${bannedMembersStr}
3. These bans are ABSOLUTE - no exceptions, no matter how good the match seems
4. Verify every suggestion against the banned list before including it

PRIORITIES (after applying bans):
- Destinations members explicitly want to visit: ${wantedStr} — give these very high weight
- Balance preferences across all group members

CONTENT RULES:
- Suggest smart routes/combinations, not just single cities
  Examples: "גיאורגיה: טביליסי + קאזבגי", "קרואטיה + מונטנגרו", "היער השחור + מינכן", "דרום צרפת: ניס + פרובאנס"
- name: full route name (not just one city)
- country: main country/ies
- description: one short sentence about the whole route
- whyItFits: exactly 2 short sentences explaining fit for THIS specific group
- matchScore: number 0-100
- climate: 3-5 words
- highlights: exactly 3 short items (2-4 words each)
- Return JSON only, no other text`;

  const userPrompt = `תשובות ${membersAnswers.length} חברים:

${formattedAnswers}

⚠️ תזכורת קריטית לפני שאתה מחזיר תשובה:
- יעדים אסורים תמידיים: ${ALWAYS_BANNED_STR}
- יעדים שחברים לא רוצים: ${bannedMembersStr}
- אם אחד מהיעדים שהכנת מופיע ברשימות האלו — החלף אותו ביעד אחר לפני שאתה מחזיר!

החזר JSON:
{"destinations":[{"name":"...","country":"...","description":"...","whyItFits":"...","matchScore":80,"climate":"...","highlights":["...","...","..."]}]}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('תגובה לא צפויה מ-AI');
  }

  // נקה markdown code blocks
  let raw = content.text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start === -1 || end === -1) {
    console.error('AI raw response (no JSON found):\n', raw);
    throw new Error('לא ניתן לנתח את תגובת ה-AI');
  }

  raw = raw.slice(start, end + 1);

  let parsed: { destinations: DestinationSuggestion[] };
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('JSON parse failed. stop_reason:', (message as { stop_reason?: string }).stop_reason);
    console.error('Raw JSON:\n', raw);
    throw new Error('תגובת ה-AI לא בפורמט JSON תקין');
  }

  if (!parsed.destinations || parsed.destinations.length === 0) {
    throw new Error('ה-AI לא החזיר יעדים');
  }

  // סינון post-processing — גם אם ה-AI התעלם מההנחיות
  const filtered = parsed.destinations.filter(d => {
    const textToCheck = `${d.name} ${d.country}`;
    const banned = isBanned(textToCheck, bannedByMembers);
    if (banned) {
      console.warn(`[AI] סיננתי יעד אסור שה-AI הציע: ${d.name} (${d.country})`);
    }
    return !banned;
  });

  if (filtered.length === 0) {
    console.error('[AI] כל היעדים שהוצעו היו אסורים! תשובה גולמית:', parsed.destinations);
    throw new Error('ה-AI הציע יעדים אסורים בלבד — נסה שוב');
  }

  return filtered;
}
