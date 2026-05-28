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

  // חלץ יעדים אסורים מתשובות החברים
  const bannedByMembers: string[] = [];
  for (const member of membersAnswers) {
    for (const a of member.answers) {
      if (a.question.includes('לא רוצה אליו בשום פנים')) {
        const val = a.answer.trim();
        if (val && val.length > 1) bannedByMembers.push(val);
      }
    }
  }

  const ALWAYS_BANNED = [
    'דובאי', 'איחוד האמירויות', 'UAE', 'Dubai',
    'מרוקו', 'Morocco',
    'ירדן', 'Jordan',
    'מצרים', 'Egypt',
    'טורקיה', 'Turkey', 'Türkiye',
    'תוניסיה', 'Tunisia',
    'לבנון', 'Lebanon',
    'בחריין', 'Bahrain',
    'קטר', 'Qatar',
    'כווית', 'Kuwait',
    'סעודיה', 'Saudi Arabia',
    'עומאן', 'Oman',
  ].join(', ');

  const bannedSection = bannedByMembers.length > 0
    ? `\nיעדים שנאסרו על ידי חברי הקבוצה (אסור להציע בשום אופן): ${bannedByMembers.join(', ')}`
    : '';

  const systemPrompt = `אתה מומחה לתכנון טיולים קבוצתיים. תפקידך להציע 3 יעדי טיול חכמים ומותאמים לקבוצה.

כללי חובה — אסור לעבור עליהם:
1. אל תציע לעולם: ${ALWAYS_BANNED}${bannedSection}
2. אם חבר ענה על "יעד שאתה לא רוצה" — אסור להציע אותו ואסור להציע יעדים דומים/סמוכים לו
3. אם חבר ענה על "יעד שתמיד רצית לראות" — תן לכך משקל גבוה מאוד בהחלטה

כללי תוכן:
- אל תציע רק עיר — הצע מסלולים חכמים: "גיאורגיה: טביליסי + קאזבגי", "קרואטיה + מונטנגרו", "היער השחור + מינכן", "דרום צרפת: ניס + פרובאנס" וכד'
- שלב אזורים/ערים שמשלימות זו את זו לאותה מדינה/אזור
- name: שם המסלול (לא רק עיר אחת)
- country: המדינה/ות הראשיות
- תיאור: משפט אחד קצר על המסלול כולו
- whyItFits: 2 משפטים — למה המסלול מתאים לקבוצה הספציפית הזו
- matchScore: מספר 0-100
- climate: 3-5 מילים
- highlights: בדיוק 3 פריטים קצרים (2-4 מילים כל אחד) שמייצגים את המסלול
- JSON בלבד, ללא טקסט נוסף`;

  const userPrompt = `תשובות ${membersAnswers.length} חברים:

${formattedAnswers}

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

  return parsed.destinations;
}
