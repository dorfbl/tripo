import { PrismaClient, QuestionType } from '@prisma/client';

const prisma = new PrismaClient();

const questions = [
  // ===== קטגוריה 1: סגנון נסיעה =====
  {
    text: 'איך היית מגדיר את הטיול האידיאלי שלך במילה אחת?',
    category: 'סגנון נסיעה',
    type: QuestionType.SINGLE_CHOICE,
    order: 1,
    options: ['הרפתקה', 'רגיעה', 'תרבות', 'טבע', 'כיף', 'גירוי'],
  },
  {
    text: 'אתה מעדיף לתכנן הכל מראש או להישאר גמיש ולזרום?',
    category: 'סגנון נסיעה',
    type: QuestionType.SCALE,
    order: 2,
    options: ['תכנון מלא מראש', '', '', '', 'זורם לגמרי'],
  },
  {
    text: 'כמה שעות ביום אתה מוכן להיות "בתנועה" (נסיעות, הליכה, טיולים)?',
    category: 'סגנון נסיעה',
    type: QuestionType.SINGLE_CHOICE,
    order: 3,
    options: ['עד 4 שעות', '4–6 שעות', '6–8 שעות', 'כמה שצריך'],
  },
  {
    text: 'מה יותר חשוב לך — לראות הרבה מקומות, או להכיר מקום אחד לעומק?',
    category: 'סגנון נסיעה',
    type: QuestionType.SCALE,
    order: 4,
    options: ['לראות הרבה', '', '', '', 'עומק במקום אחד'],
  },
  {
    text: 'נסיעה בשבילך זה יותר — בריחה מהשגרה, או חוויה חדשה?',
    category: 'סגנון נסיעה',
    type: QuestionType.SINGLE_CHOICE,
    order: 5,
    options: ['בריחה מהשגרה', 'חוויה חדשה', 'שניהם באותה מידה'],
  },

  // ===== קטגוריה 2: פעילויות ותוכן =====
  {
    text: 'מה מדליק אותך יותר?',
    category: 'פעילויות',
    type: QuestionType.SCALE,
    order: 6,
    options: ['טבע ופעילות גופנית', '', '', '', 'עיר ותרבות'],
  },
  {
    text: 'יש לך פחד גבהים, מים, מרחבים סגורים — משהו שחשוב שנדע?',
    category: 'פעילויות',
    type: QuestionType.TEXT,
    order: 7,
    options: null,
  },
  {
    text: 'כמה חשוב לך לאכול טוב בטיול?',
    category: 'פעילויות',
    type: QuestionType.SCALE,
    order: 8,
    options: ['לא חשוב, סתם לאכול', '', '', '', 'מסעדות טובות זה עיקר הטיול'],
  },
  {
    text: 'קניות בטיול — חלק מהחוויה, או בזבוז זמן?',
    category: 'פעילויות',
    type: QuestionType.SINGLE_CHOICE,
    order: 9,
    options: ['אני חי בשביל זה', 'קצת, אם יש', 'מעדיף לדלג'],
  },
  {
    text: 'אתה נהנה מלילה חיים וברים?',
    category: 'פעילויות',
    type: QuestionType.SINGLE_CHOICE,
    order: 10,
    options: ['כן, זה חלק מהטיול', 'לפעמים', 'מעדיף לסיים את הערב בשקט'],
  },
  {
    text: 'מוזיאומים וגלריות?',
    category: 'פעילויות',
    type: QuestionType.SINGLE_CHOICE,
    order: 11,
    options: ['אוהב מאוד', 'אחד-שניים, בסדר', 'מתחמק אם אפשר'],
  },
  {
    text: 'ספורט אתגרי (צניחה, גלישה, טיפוס)?',
    category: 'פעילויות',
    type: QuestionType.SINGLE_CHOICE,
    order: 12,
    options: ['כן בבקשה!', 'אולי, תלוי מה', 'לא, תודה'],
  },
  {
    text: 'האם חשוב לך לחזור הביתה עם תמונות "אינסטגרמיות"?',
    category: 'פעילויות',
    type: QuestionType.SINGLE_CHOICE,
    order: 13,
    options: ['כן, זה חשוב לי', 'לא אגזים, אבל כיף', 'ממש לא עניין אותי'],
  },

  // ===== קטגוריה 3: תנאים ולוגיסטיקה =====
  {
    text: 'מה הרמה המינימלית שאתה מוכן לישון בה?',
    category: 'לוגיסטיקה',
    type: QuestionType.SINGLE_CHOICE,
    order: 14,
    options: ['אוהל / קמפינג', 'הוסטל שיתופי', 'מלון רגיל', 'רק מלון מפנק'],
  },
  {
    text: 'איך אתה מתמודד עם חום קיצוני (35°+)?',
    category: 'לוגיסטיקה',
    type: QuestionType.SINGLE_CHOICE,
    order: 15,
    options: ['אוהב חום, אין בעיה', 'מסתדר', 'קשה לי מאוד'],
  },
  {
    text: 'ועם קור וגשם?',
    category: 'לוגיסטיקה',
    type: QuestionType.SINGLE_CHOICE,
    order: 16,
    options: ['אני אוהב קור', 'מסתדר', 'ממש לא מתחבר לזה'],
  },
  {
    text: 'כמה כסף אתה מוכן להוציא ביום בממוצע (לא כולל טיסה)?',
    category: 'לוגיסטיקה',
    type: QuestionType.SINGLE_CHOICE,
    order: 17,
    options: ['עד 50$', '50–100$', '100–200$', 'אין מגבלה'],
  },
  {
    text: 'אתה נוסע עם הרבה מזוודות או נסיעה קלה?',
    category: 'לוגיסטיקה',
    type: QuestionType.SINGLE_CHOICE,
    order: 18,
    options: ['תיק יד בלבד', 'מזוודה קטנה', 'מזוודה גדולה', 'כמה שצריך'],
  },
  {
    text: 'יש לך מגבלות תזונה שצריך לקחת בחשבון?',
    category: 'לוגיסטיקה',
    type: QuestionType.TEXT,
    order: 19,
    options: null,
  },

  // ===== קטגוריה 4: דינמיקה קבוצתית =====
  {
    text: 'בטיול קבוצתי, אתה יותר — מי שמוביל ומחליט, או מי שהולך עם הזרם?',
    category: 'דינמיקה קבוצתית',
    type: QuestionType.SCALE,
    order: 20,
    options: ['מוביל', '', '', '', 'זורם'],
  },
  {
    text: 'כמה זמן לבד בטיול אתה צריך כדי לא להשתגע?',
    category: 'דינמיקה קבוצתית',
    type: QuestionType.SINGLE_CHOICE,
    order: 21,
    options: ['לא צריך בכלל', 'שעה-שעתיים ביום', 'חצי יום', 'יום שלם לפחות'],
  },
  {
    text: 'מה הדבר שהכי מוציא אותך מהכלים בטיול משותף?',
    category: 'דינמיקה קבוצתית',
    type: QuestionType.TEXT,
    order: 22,
    options: null,
  },
  {
    text: 'אם הרוב רוצה לעשות משהו שאתה לא מתחבר אליו — מה אתה עושה?',
    category: 'דינמיקה קבוצתית',
    type: QuestionType.SINGLE_CHOICE,
    order: 23,
    options: ['הולך איתם בכל זאת', 'עושה פעילות נפרדת', 'מנסה לשנות את הדעה', 'תלוי מה'],
  },

  // ===== קטגוריה 5: אישיות =====
  {
    text: 'אתה יותר "בוקר בקפה שקט" או "שוק מקומי עמוס בבוקר"?',
    category: 'אישיות',
    type: QuestionType.SINGLE_CHOICE,
    order: 24,
    options: ['קפה שקט', 'שוק מקומי', 'שניהם תלוי היום'],
  },
  {
    text: 'מה עדיף — מלון מרכזי ויקר, או מלון זול ורחוק עם תחבורה?',
    category: 'אישיות',
    type: QuestionType.SINGLE_CHOICE,
    order: 25,
    options: ['מרכזי ויקר', 'זול ורחוק', 'אמצע הדרך'],
  },
  {
    text: "אם הטיול היה סרט, איזה ז'אנר היה?",
    category: 'אישיות',
    type: QuestionType.SINGLE_CHOICE,
    order: 26,
    options: ['אקשן והרפתקאות', 'דרמה אירופאית איטית', 'קומדיה', 'דוקומנטרי טבע', 'רומנטי'],
  },
  {
    text: 'יעד שתמיד רצית לראות אבל מעולם לא הגעת אליו?',
    category: 'אישיות',
    type: QuestionType.TEXT,
    order: 27,
    options: null,
  },
  {
    text: 'יעד שאתה לא רוצה אליו בשום פנים ואופן?',
    category: 'אישיות',
    type: QuestionType.TEXT,
    order: 28,
    options: null,
  },
  {
    text: 'מה הזיכרון הכי טוב שיש לך מטיול עבר?',
    category: 'אישיות',
    type: QuestionType.TEXT,
    order: 29,
    options: null,
  },
  {
    text: 'אם היית יכול לעשות רק דבר אחד בטיול הזה — מה זה היה?',
    category: 'אישיות',
    type: QuestionType.TEXT,
    order: 30,
    options: null,
  },
];

async function main() {
  console.log('מכניס שאלות לשאלון...');
  for (const q of questions) {
    await prisma.question.upsert({
      where: { text: q.text },
      update: {},
      create: {
        text: q.text,
        category: q.category,
        type: q.type,
        order: q.order,
        options: q.options ?? undefined,
        isActive: true,
      },
    });
  }
  console.log(`✅ הוכנסו ${questions.length} שאלות`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
