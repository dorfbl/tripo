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
        `חבר [אנונימי ${idx + 1}]:\n` +
        member.answers.map((a) => `- ${a.question}: ${a.answer}`).join('\n')
    )
    .join('\n\n');

  const systemPrompt = `אתה עוזר לתכנון טיולים קבוצתיים. תפקידך לנתח את תשובות כל חברי הקבוצה ולהציע 3-4 יעדי טיול שמתאימים לקבוצה כולה — תוך איזון בין העדפות שונות.

חוקים:
- הצע בדיוק 3 או 4 יעדים
- לכל יעד: שם, מדינה, תיאור כללי (2-3 משפטים), למה הוא מתאים לקבוצה הזו ספציפית, ציון התאמה (0-100), מזג אוויר, ו-3-5 דגשים כלליים
- הדגשים הם כלליים בלבד — "חופים יפים", "תרבות עשירה", "אוכל מדהים" — לא לוח זמנים
- השב בעברית
- השב בפורמט JSON בלבד, ללא טקסט נוסף`;

  const userPrompt = `להלן תשובות ${membersAnswers.length} חברי הקבוצה לשאלון:

${formattedAnswers}

הצע 3-4 יעדים מתאימים. החזר JSON במבנה הבא:
{
  "destinations": [
    {
      "name": "שם היעד",
      "country": "מדינה",
      "description": "תיאור כללי",
      "whyItFits": "למה זה מתאים לקבוצה הזו",
      "matchScore": 85,
      "climate": "תיאור מזג אוויר",
      "highlights": ["דגש 1", "דגש 2", "דגש 3"]
    }
  ]
}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('תגובה לא צפויה מ-AI');
  }

  // נסה לחלץ JSON מהתגובה
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('לא ניתן לנתח את תגובת ה-AI');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.destinations as DestinationSuggestion[];
}
