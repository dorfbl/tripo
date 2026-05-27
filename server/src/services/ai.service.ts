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

  const systemPrompt = `אתה מומחה לתכנון טיולים קבוצתיים. נתח תשובות קבוצה והצע 3 יעדים מאוזנים.

כללים:
- בדיוק 3 יעדים
- תיאור: משפט אחד קצר
- whyItFits: 2 משפטים קצרים על ההתאמה לקבוצה
- matchScore: מספר 0-100
- climate: 3-5 מילים
- highlights: בדיוק 3 פריטים קצרים (2-4 מילים כל אחד)
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
