# CLAUDE.md — TripTogether App

## סקירה כללית

אפליקציית PWA לתכנון טיולים קבוצתיים. במקום שהמידע יאבד בוואטסאפ, האפליקציה מרכזת החלטות, כסף וזיכרונות — לפני הטיול, במהלכו, ואחריו.

**הרעיון המרכזי:** לא אפליקציית משימות. ציר זמן של חוויה משותפת — מהחלטה ועד זיכרון.

---

## Stack טכני

| שכבה        | טכנולוגיה                                  |
| ----------- | ------------------------------------------ |
| Frontend    | React + Vite + TypeScript                  |
| Styling     | Tailwind CSS v3                            |
| Backend     | Express.js + TypeScript                    |
| Database    | PostgreSQL (local, מחובר החוצה)            |
| ORM         | Prisma                                     |
| Auth        | JWT + bcrypt (שם משתמש + סיסמה)            |
| AI          | Anthropic API — `claude-sonnet-4-20250514` |
| PWA         | vite-plugin-pwa                            |
| Real-time   | PostgreSQL LISTEN/NOTIFY דרך pg            |
| HTTP Client | axios                                      |
| State       | Zustand                                    |
| Routing     | React Router v6                            |

---

## מבנה תיקיות

```
triptogether/
├── client/                        # React PWA
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css              # Tailwind directives + גופנים
│   │   ├── components/
│   │   │   ├── ui/                # רכיבי UI גנריים
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Progress.tsx
│   │   │   │   └── Avatar.tsx
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx   # Shell עם navbar
│   │   │   │   └── Navbar.tsx
│   │   │   ├── questionnaire/
│   │   │   │   ├── QuestionCard.tsx
│   │   │   │   ├── QuestionnaireFlow.tsx
│   │   │   │   └── ProgressBar.tsx
│   │   │   └── destinations/
│   │   │       ├── DestinationCard.tsx
│   │   │       └── DestinationList.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── CreateTripPage.tsx
│   │   │   ├── TripPage.tsx
│   │   │   ├── QuestionnairePage.tsx
│   │   │   └── DestinationsPage.tsx
│   │   ├── store/
│   │   │   ├── authStore.ts
│   │   │   └── tripStore.ts
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useTrip.ts
│   │   ├── api/
│   │   │   └── client.ts          # axios instance
│   │   └── types/
│   │       └── index.ts
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── server/                        # Express API
│   ├── src/
│   │   ├── index.ts               # Entry point
│   │   ├── app.ts                 # Express setup
│   │   ├── config/
│   │   │   └── env.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT middleware
│   │   │   └── errorHandler.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── trips.routes.ts
│   │   │   ├── questionnaire.routes.ts
│   │   │   └── destinations.routes.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── trips.controller.ts
│   │   │   ├── questionnaire.controller.ts
│   │   │   └── destinations.controller.ts
│   │   ├── services/
│   │   │   ├── ai.service.ts      # כל הלוגיקה של Claude API
│   │   │   └── trip.service.ts
│   │   └── lib/
│   │       └── prisma.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts                # seed של שאלות השאלון
│   └── package.json
│
└── .env                           # משותף (או .env בכל תיקייה)
```

---

## משתני סביבה

```env
# Server
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/triptogether"
JWT_SECRET="your-secret-key-here"
PORT=3001
ANTHROPIC_API_KEY="sk-ant-..."

# Client (Vite)
VITE_API_URL="http://localhost:3001"
```

---

## סכמת מסד הנתונים (Prisma)

```prisma
// server/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())

  trips        TripMember[]
  answers      QuestionAnswer[]
}

model Trip {
  id          String     @id @default(uuid())
  name        String
  startDate   DateTime?
  endDate     DateTime?
  status      TripStatus @default(PLANNING)
  inviteCode  String     @unique @default(uuid())
  createdAt   DateTime   @default(now())

  members     TripMember[]
  destinations SuggestedDestination[]
}

enum TripStatus {
  PLANNING      // שלב 1א — שאלון
  VOTING        // שלב 1ב — הצבעות על יעדים
  BOOKED        // שלב 2 — הטיול נקבע
  ONGOING       // שלב 2 — במהלך הטיול
  COMPLETED     // שלב 3 — אחרי הטיול
}

model TripMember {
  id          String   @id @default(uuid())
  userId      String
  tripId      String
  role        MemberRole @default(MEMBER)
  joinedAt    DateTime @default(now())
  completedQuestionnaire Boolean @default(false)

  user        User     @relation(fields: [userId], references: [id])
  trip        Trip     @relation(fields: [tripId], references: [id])

  @@unique([userId, tripId])
}

enum MemberRole {
  ADMIN   // יוצר הטיול
  MEMBER
}

// ===== שאלון =====

model Question {
  id          String         @id @default(uuid())
  text        String         // טקסט השאלה בעברית
  category    String         // קטגוריה לתצוגה
  type        QuestionType
  order       Int            // סדר הצגה
  options     Json?          // לשאלות בחירה — מערך של strings
  isActive    Boolean        @default(true)

  answers     QuestionAnswer[]
}

enum QuestionType {
  SINGLE_CHOICE   // בחירה אחת מתוך אפשרויות
  MULTI_CHOICE    // בחירה מרובה
  SCALE           // סקאלה 1–5
  TEXT            // טקסט חופשי
}

model QuestionAnswer {
  id         String   @id @default(uuid())
  userId     String
  tripId     String
  questionId String
  answer     Json     // גמיש — מחרוזת / מספר / מערך
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id])
  question   Question @relation(fields: [questionId], references: [id])

  @@unique([userId, tripId, questionId])
}

// ===== יעדים מוצעים (פלט AI) =====

model SuggestedDestination {
  id          String   @id @default(uuid())
  tripId      String
  name        String                   // שם היעד
  country     String
  description String                   // תיאור כללי של היעד
  whyItFits   String                   // למה הוא מתאים לקבוצה הזו
  matchScore  Float                    // 0–100, חושב על ידי AI
  climate     String?                  // מזג אוויר משוער
  highlights  Json                     // מערך של 3-5 דגשים כלליים
  createdAt   DateTime @default(now())

  trip        Trip     @relation(fields: [tripId], references: [id])
  votes       DestinationVote[]
}

model DestinationVote {
  id            String   @id @default(uuid())
  destinationId String
  userId        String
  score         Int      // 1–5
  createdAt     DateTime @default(now())

  destination   SuggestedDestination @relation(fields: [destinationId], references: [id])

  @@unique([destinationId, userId])
}
```

---

## Seed — שאלות השאלון

הקובץ `server/prisma/seed.ts` יכניס את כל השאלות ל-DB. כך אפשר לערוך/להוסיף שאלות בעתיד ישירות ב-DB מבלי לגעת בקוד.

```typescript
// server/prisma/seed.ts
import { PrismaClient, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();

const questions = [
  // ===== קטגוריה 1: סגנון נסיעה =====
  {
    text: "איך היית מגדיר את הטיול האידיאלי שלך במילה אחת?",
    category: "סגנון נסיעה",
    type: QuestionType.SINGLE_CHOICE,
    order: 1,
    options: ["הרפתקה", "רגיעה", "תרבות", "טבע", "כיף", "גירוי"],
  },
  {
    text: "אתה מעדיף לתכנן הכל מראש או להישאר גמיש ולזרום?",
    category: "סגנון נסיעה",
    type: QuestionType.SCALE,
    order: 2,
    options: ["תכנון מלא מראש", "", "", "", "זורם לגמרי"],
  },
  {
    text: 'כמה שעות ביום אתה מוכן להיות "בתנועה" (נסיעות, הליכה, טיולים)?',
    category: "סגנון נסיעה",
    type: QuestionType.SINGLE_CHOICE,
    order: 3,
    options: ["עד 4 שעות", "4–6 שעות", "6–8 שעות", "כמה שצריך"],
  },
  {
    text: "מה יותר חשוב לך — לראות הרבה מקומות, או להכיר מקום אחד לעומק?",
    category: "סגנון נסיעה",
    type: QuestionType.SCALE,
    order: 4,
    options: ["לראות הרבה", "", "", "", "עומק במקום אחד"],
  },
  {
    text: "נסיעה בשבילך זה יותר — בריחה מהשגרה, או חוויה חדשה?",
    category: "סגנון נסיעה",
    type: QuestionType.SINGLE_CHOICE,
    order: 5,
    options: ["בריחה מהשגרה", "חוויה חדשה", "שניהם באותה מידה"],
  },

  // ===== קטגוריה 2: פעילויות ותוכן =====
  {
    text: "מה מדליק אותך יותר?",
    category: "פעילויות",
    type: QuestionType.SCALE,
    order: 6,
    options: ["טבע ופעילות גופנית", "", "", "", "עיר ותרבות"],
  },
  {
    text: "יש לך פחד גבהים, מים, מרחבים סגורים — משהו שחשוב שנדע?",
    category: "פעילויות",
    type: QuestionType.TEXT,
    order: 7,
    options: null,
  },
  {
    text: "כמה חשוב לך לאכול טוב בטיול?",
    category: "פעילויות",
    type: QuestionType.SCALE,
    order: 8,
    options: ["לא חשוב, סתם לאכול", "", "", "", "מסעדות טובות זה עיקר הטיול"],
  },
  {
    text: "קניות בטיול — חלק מהחוויה, או בזבוז זמן?",
    category: "פעילויות",
    type: QuestionType.SINGLE_CHOICE,
    order: 9,
    options: ["אני חי בשביל זה", "קצת, אם יש", "מעדיף לדלג"],
  },
  {
    text: "אתה נהנה מלילה חיים וברים?",
    category: "פעילויות",
    type: QuestionType.SINGLE_CHOICE,
    order: 10,
    options: ["כן, זה חלק מהטיול", "לפעמים", "מעדיף לסיים את הערב בשקט"],
  },
  {
    text: "מוזיאומים וגלריות?",
    category: "פעילויות",
    type: QuestionType.SINGLE_CHOICE,
    order: 11,
    options: ["אוהב מאוד", "אחד-שניים, בסדר", "מתחמק אם אפשר"],
  },
  {
    text: "ספורט אתגרי (צניחה, גלישה, טיפוס)?",
    category: "פעילויות",
    type: QuestionType.SINGLE_CHOICE,
    order: 12,
    options: ["כן בבקשה!", "אולי, תלוי מה", "לא, תודה"],
  },
  {
    text: 'האם חשוב לך לחזור הביתה עם תמונות "אינסטגרמיות"?',
    category: "פעילויות",
    type: QuestionType.SINGLE_CHOICE,
    order: 13,
    options: ["כן, זה חשוב לי", "לא אגזים, אבל כיף", "ממש לא עניין אותי"],
  },

  // ===== קטגוריה 3: תנאים ולוגיסטיקה =====
  {
    text: "מה הרמה המינימלית שאתה מוכן לישון בה?",
    category: "לוגיסטיקה",
    type: QuestionType.SINGLE_CHOICE,
    order: 14,
    options: ["אוהל / קמפינג", "הוסטל שיתופי", "מלון רגיל", "רק מלון מפנק"],
  },
  {
    text: "איך אתה מתמודד עם חום קיצוני (35°+)?",
    category: "לוגיסטיקה",
    type: QuestionType.SINGLE_CHOICE,
    order: 15,
    options: ["אוהב חום, אין בעיה", "מסתדר", "קשה לי מאוד"],
  },
  {
    text: "ועם קור וגשם?",
    category: "לוגיסטיקה",
    type: QuestionType.SINGLE_CHOICE,
    order: 16,
    options: ["אני אוהב קור", "מסתדר", "ממש לא מתחבר לזה"],
  },
  {
    text: "כמה כסף אתה מוכן להוציא ביום בממוצע (לא כולל טיסה)?",
    category: "לוגיסטיקה",
    type: QuestionType.SINGLE_CHOICE,
    order: 17,
    options: ["עד 50$", "50–100$", "100–200$", "אין מגבלה"],
  },
  {
    text: "אתה נוסע עם הרבה מזוודות או נסיעה קלה?",
    category: "לוגיסטיקה",
    type: QuestionType.SINGLE_CHOICE,
    order: 18,
    options: ["תיק יד בלבד", "מזוודה קטנה", "מזוודה גדולה", "כמה שצריך"],
  },
  {
    text: "יש לך מגבלות תזונה שצריך לקחת בחשבון?",
    category: "לוגיסטיקה",
    type: QuestionType.TEXT,
    order: 19,
    options: null,
  },

  // ===== קטגוריה 4: דינמיקה קבוצתית =====
  {
    text: "בטיול קבוצתי, אתה יותר — מי שמוביל ומחליט, או מי שהולך עם הזרם?",
    category: "דינמיקה קבוצתית",
    type: QuestionType.SCALE,
    order: 20,
    options: ["מוביל", "", "", "", "זורם"],
  },
  {
    text: "כמה זמן לבד בטיול אתה צריך כדי לא להשתגע?",
    category: "דינמיקה קבוצתית",
    type: QuestionType.SINGLE_CHOICE,
    order: 21,
    options: ["לא צריך בכלל", "שעה-שעתיים ביום", "חצי יום", "יום שלם לפחות"],
  },
  {
    text: "מה הדבר שהכי מוציא אותך מהכלים בטיול משותף?",
    category: "דינמיקה קבוצתית",
    type: QuestionType.TEXT,
    order: 22,
    options: null,
  },
  {
    text: "אם הרוב רוצה לעשות משהו שאתה לא מתחבר אליו — מה אתה עושה?",
    category: "דינמיקה קבוצתית",
    type: QuestionType.SINGLE_CHOICE,
    order: 23,
    options: ["הולך איתם בכל זאת", "עושה פעילות נפרדת", "מנסה לשנות את הדעה", "תלוי מה"],
  },

  // ===== קטגוריה 5: שאלות "מוזרות" שעוזרות לאבחן =====
  {
    text: 'אתה יותר "בוקר בקפה שקט" או "שוק מקומי עמוס בבוקר"?',
    category: "אישיות",
    type: QuestionType.SINGLE_CHOICE,
    order: 24,
    options: ["קפה שקט", "שוק מקומי", "שניהם תלוי היום"],
  },
  {
    text: "מה עדיף — מלון מרכזי ויקר, או מלון זול ורחוק עם תחבורה?",
    category: "אישיות",
    type: QuestionType.SINGLE_CHOICE,
    order: 25,
    options: ["מרכזי ויקר", "זול ורחוק", "אמצע הדרך"],
  },
  {
    text: "אם הטיול היה סרט, איזה ז'אנר היה?",
    category: "אישיות",
    type: QuestionType.SINGLE_CHOICE,
    order: 26,
    options: ["אקשן והרפתקאות", "דרמה אירופאית איטית", "קומדיה", "דוקומנטרי טבע", "רומנטי"],
  },
  {
    text: "יעד שתמיד רצית לראות אבל מעולם לא הגעת אליו?",
    category: "אישיות",
    type: QuestionType.TEXT,
    order: 27,
    options: null,
  },
  {
    text: "יעד שאתה לא רוצה אליו בשום פנים ואופן?",
    category: "אישיות",
    type: QuestionType.TEXT,
    order: 28,
    options: null,
  },
  {
    text: "מה הזיכרון הכי טוב שיש לך מטיול עבר?",
    category: "אישיות",
    type: QuestionType.TEXT,
    order: 29,
    options: null,
  },
  {
    text: "אם היית יכול לעשות רק דבר אחד בטיול הזה — מה זה היה?",
    category: "אישיות",
    type: QuestionType.TEXT,
    order: 30,
    options: null,
  },
];

async function main() {
  console.log("מכניס שאלות לשאלון...");
  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.text }, // upsert לפי טקסט (לא אידיאלי, אבל מספיק לseed)
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
```

---

## API Routes

### Auth

```
POST /api/auth/register    — שם, אימייל, סיסמה
POST /api/auth/login       — אימייל + סיסמה → JWT
GET  /api/auth/me          — פרטי המשתמש המחובר (מ-token)
```

### Trips

```
POST /api/trips                      — יצירת טיול חדש
GET  /api/trips                      — כל הטיולים של המשתמש
GET  /api/trips/:id                  — פרטי טיול
POST /api/trips/join/:inviteCode     — הצטרפות לטיול דרך קוד הזמנה
GET  /api/trips/:id/members          — חברי הטיול + מי מילא שאלון
```

### Questionnaire

```
GET  /api/questionnaire/questions          — כל השאלות הפעילות (מה-DB)
POST /api/questionnaire/:tripId/answers   — שמירת תשובות המשתמש
GET  /api/questionnaire/:tripId/status    — כמה חברים מילאו מתוך הכלל
```

### Destinations (AI)

```
POST /api/destinations/:tripId/generate   — מפעיל את Claude, מחזיר 3-4 יעדים
GET  /api/destinations/:tripId            — יעדים שכבר נוצרו לטיול
POST /api/destinations/:destinationId/vote — הצבעה (1-5) על יעד
GET  /api/destinations/:tripId/results    — ציוני הצבעות מסוכמים
```

---

## לוגיקת ה-AI — ai.service.ts

### כניסה לפונקציה

מקבל את כל התשובות של כל חברי הקבוצה לטיול הנתון.

### Prompt Structure

```typescript
const systemPrompt = `
אתה עוזר לתכנן טיולים קבוצתיים. תפקידך לנתח את תשובות כל חברי הקבוצה
ולהציע 3-4 יעדי טיול שמתאימים לקבוצה כולה — תוך איזון בין העדפות שונות.

חוקים:
- הצע בדיוק 3 או 4 יעדים
- לכל יעד: שם, מדינה, תיאור כללי (2-3 משפטים), למה הוא מתאים לקבוצה הזו ספציפית, ציון התאמה (0-100), מזג אוויר, ו-3-5 דגשים כלליים (לא תוכנית מפורטת!)
- הדגשים הם כלליים בלבד — "חופים יפים", "תרבות עשירה", "אוכל מדהים" — לא לוח זמנים
- השב בעברית
- השב בפורמט JSON בלבד, ללא טקסט נוסף
`;

const userPrompt = `
להלן תשובות ${members.length} חברי הקבוצה לשאלון:

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
}
`;
```

### פורמט `formattedAnswers`

עבור כל חבר, פורמט פשוט:

```
חבר [אנונימי 1]:
- [שאלה]: [תשובה]
- [שאלה]: [תשובה]
...

חבר [אנונימי 2]:
...
```

שמות לא נשלחים ל-Claude — רק תשובות.

---

## עיצוב ו-UI

### גופנים

```css
/* index.css */
@import url("https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap");

body {
  font-family: "Heebo", sans-serif;
  direction: rtl;
}
```

`Heebo` — גופן עברי נקי ומודרני, מושלם לעיצוב מינימליסטי.

### Tailwind Config — צבעים

```typescript
// tailwind.config.ts
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Heebo", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0eaff",
          500: "#4F6EF7", // ראשי — כחול-סגול עדין
          600: "#3D5CE0",
          700: "#2D47C4",
        },
        neutral: {
          50: "#FAFAFA",
          100: "#F5F5F5",
          200: "#E5E5E5",
          400: "#A3A3A3",
          600: "#525252",
          900: "#171717",
        },
      },
      borderRadius: {
        xl: "16px",
        "2xl": "24px",
      },
    },
  },
};
```

### עקרונות עיצוב

- **רקע:** לבן (#FFFFFF) או אפור בהיר מאוד (#FAFAFA)
- **טקסט ראשי:** #171717
- **טקסט משני:** #525252
- **מפריד:** #E5E5E5 (1px, לא בולט)
- **כפתורים ראשיים:** brand-500 עם hover ל-brand-600
- **צללים:** מינימליים — `shadow-sm` בלבד
- **ריווח:** נדיב — padding של 24px בכרטיסים, 16px בין אלמנטים
- **RTL:** direction: rtl על כל ה-body
- **אין גרדיאנטים, אין border-radius קיצוני, אין צבעים צועקים**

### רכיב QuestionCard

כל שאלה מוצגת בכרטיס מרוכז, אחת בכל פעם (wizard flow).

- Progress bar בראש הדף — מציג כמה שאלות נשארו
- אנימציה עדינה של slide בין שאלות (CSS transition)
- כפתורי "הבא" / "חזור"
- שאלות סקאלה — slider חזותי
- שאלות בחירה — כפתורים גדולים שנבחרים בלחיצה
- שאלות טקסט — textarea עם placeholder

### רכיב DestinationCard

לאחר עיבוד ה-AI, מוצגים 3-4 כרטיסים:

- שם יעד גדול + מדינה
- ציון התאמה בולט (badge צבעוני)
- "למה זה מתאים לכם" — טקסט קצר, בולט
- רשימת highlights (bullets פשוטים)
- כפתור הצבעה (1-5 כוכבים)

---

## זרימת משתמש מלאה — שלב 1

```
1. רישום / כניסה
   ↓
2. יצירת טיול (שם + תאריכים)
   → קבלת invite link לשיתוף
   ↓
3. כל חבר נכנס דרך הלינק → מצטרף לטיול
   ↓
4. כל חבר ממלא את השאלון (wizard, שאלה אחת בכל פעם)
   → התשובות נשמרות ל-DB
   → Dashboard מציג כמה חברים מילאו מתוך הכלל
   ↓
5. כשכולם מילאו (או ה-admin מחליט להמשיך):
   → לחיצה על "קבל המלצות"
   → Server שולח את כל התשובות ל-Claude
   → Claude מחזיר 3-4 יעדים (JSON)
   → נשמר ב-DB
   ↓
6. כל חברי הקבוצה רואים את הכרטיסים
   → כל אחד מצביע (1-5 כוכבים) על כל יעד
   ↓
7. עמוד תוצאות — ציוני הצבעות מסוכמים, יעד מנצח מודגש
```

---

## הוראות הרצה

### 1. התקנה

```bash
# Clone / init
mkdir triptogether && cd triptogether

# Server
mkdir server && cd server
npm init -y
npm install express prisma @prisma/client bcryptjs jsonwebtoken @anthropic-ai/sdk cors dotenv
npm install -D typescript @types/express @types/bcryptjs @types/jsonwebtoken @types/node ts-node-dev
npx tsc --init
npx prisma init

cd ..

# Client
npm create vite@latest client -- --template react-ts
cd client
npm install axios zustand react-router-dom
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa
npx tailwindcss init -p
```

### 2. DB

```bash
# ב-server/
# ערוך את DATABASE_URL ב-.env
npx prisma migrate dev --name init
npx prisma db seed
```

### 3. הרצה

```bash
# Terminal 1 — server
cd server && npm run dev

# Terminal 2 — client
cd client && npm run dev
```

---

## סדר בנייה מומלץ לקלוד קוד

בצע בדיוק בסדר הזה:

1. **Server — base setup**
   - `server/src/index.ts` + `app.ts` (Express + CORS + JSON)
   - `server/src/config/env.ts`
   - `server/src/lib/prisma.ts`

2. **DB Schema + Seed**
   - `server/prisma/schema.prisma` (העתק מלמעלה)
   - `server/prisma/seed.ts` (העתק מלמעלה)
   - הרץ migrate + seed

3. **Auth**
   - `server/src/routes/auth.routes.ts`
   - `server/src/controllers/auth.controller.ts`
   - `server/src/middleware/auth.ts` (JWT verify)

4. **Trips**
   - `server/src/routes/trips.routes.ts`
   - `server/src/controllers/trips.controller.ts`

5. **Questionnaire**
   - `server/src/routes/questionnaire.routes.ts`
   - `server/src/controllers/questionnaire.controller.ts`

6. **AI Service + Destinations**
   - `server/src/services/ai.service.ts`
   - `server/src/routes/destinations.routes.ts`
   - `server/src/controllers/destinations.controller.ts`

7. **Client — base**
   - Tailwind config + `index.css` (גופן Heebo + RTL)
   - `App.tsx` + routing
   - `src/api/client.ts` (axios instance)
   - `src/store/authStore.ts`

8. **Client — Auth pages**
   - `LoginPage.tsx`
   - `RegisterPage.tsx`

9. **Client — Trip**
   - `DashboardPage.tsx`
   - `CreateTripPage.tsx`
   - `TripPage.tsx` (dashboard הטיול + מי מילא)

10. **Client — Questionnaire**
    - `QuestionCard.tsx`
    - `QuestionnaireFlow.tsx`
    - `QuestionnairePage.tsx`

11. **Client — Destinations**
    - `DestinationCard.tsx`
    - `DestinationsPage.tsx`

---

## דגשים חשובים לקלוד קוד

- **כל הטקסט באפליקציה בעברית.** שגיאות, placeholder, כפתורים, הכל.
- **RTL בכל מקום.** `dir="rtl"` על ה-html, `text-right` כ-default.
- **שאלות השאלון מגיעות מה-DB בלבד** — לא hardcoded בקוד.
- **ה-AI prompt שולח תשובות אנונימיות** — ללא שמות משתמשים.
- **JWT נשמר ב-localStorage** ונשלח כ-`Authorization: Bearer <token>`.
- **כל route מוגן** (חוץ מ-login/register) דורש JWT תקני.
- **error handling** — כל API endpoint מחזיר `{ error: string }` בעברית במקרה של שגיאה.
- **הטיול עובר status** — `PLANNING` → `VOTING` → בעתיד `BOOKED` וכו'.
- **generate destinations** עובד רק אם status הוא `PLANNING` וכבר יש לפחות תשובה אחת.
- **אל תבנה את שלב 2 ו-3** (הוצאות, מפה, אלבום) — רק שלב 1 כרגע.
