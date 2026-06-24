# פיצ׳ר: קישורים מרוכזים לטיול

## מטרת הפיצ׳ר

פיצ׳ר **קישורים מרוכזים** נועד לפתור בעיה פשוטה ומעצבנת בטיול קבוצתי: כל הלינקים החשובים נשלחים בוואטסאפ, נעלמים אחורה בשיחה, ואז מישהו צריך להתחיל לחפש "איפה הקישור למלון?", "מי שלח את הכרטיסים?", "איפה ההזמנה של הרכב?".

המטרה היא ליצור עמוד אחד באפליקציה שבו נמצאים כל הקישורים, ההזמנות והמסמכים החשובים של הטיול — בצורה מסודרת, ברורה, לפי קטגוריות ועם סטטוס.

זה לא אמור להיות פיצ׳ר מסובך. להפך: הוא צריך להיות אחד המסכים הכי פשוטים ושימושיים באפליקציה.

---

## שם בתפריט

השם המומלץ בתפריט:

## **קישורים**

פשוט, ברור, קצר.

אפשרויות נוספות:

| שם | דעתי |
|---|---|
| **קישורים** | הכי טוב |
| **הזמנות וקישורים** | מדויק אבל קצת ארוך |
| **מסמכים** | צר מדי |
| **מידע חשוב** | כללי מדי |
| **לינקים** | סבבה, פחות רשמי |
| **הכול במקום אחד** | חמוד, לא מתאים לתפריט |

בתפריט הייתי שם:

```text
קישורים
```

בתוך העמוד הכותרת יכולה להיות:

```text
קישורים והזמנות
כל מה שצריך למצוא מהר במקום אחד
```

---

## הערך המרכזי של הפיצ׳ר

הפיצ׳ר הזה לא בא להחליף את Booking, Gmail, WhatsApp או Google Drive.

הוא בא להיות **אינדקס חכם** לכל מה שקשור לטיול.

כלומר:

- לא חייבים להעלות לשם את כל הקבצים.
- לא חייבים לשמור שם את כל פרטי ההזמנה.
- כן צריך שיהיה שם קישור ברור, שם, קטגוריה, סטטוס, ומי אחראי.

הערך האמיתי:

```text
אני נכנס לאפליקציה ותוך 10 שניות מוצא את מה שחיפשתי.
```

---

## מה צריך להיות בעמוד

העמוד צריך להציג את כל הקישורים החשובים של הטיול, מחולקים לפי קטגוריות.

קטגוריות מומלצות:

| קטגוריה | דוגמאות |
|---|---|
| טיסות | הזמנה, צ׳ק-אין, כבודה |
| מלונות | Booking, אישור הזמנה |
| רכב | השכרה, ביטוח, תנאים |
| אטרקציות | פארק אירופה, משחק כדורגל |
| מסעדות וברים | מקומות ששמרתם |
| מפות וניווט | Google Maps, Waze |
| ביטוח | פוליסה, מוקד חירום |
| מסמכים | דרכונים, כרטיסים, PDF |
| כסף | קופה, הוצאות, תשלומים |
| אחר | כל דבר שלא נכנס לשאר |

---

## מבנה המסך

### Header עליון

```text
קישורים והזמנות
כל הדברים החשובים של הטיול במקום אחד
```

מתחת לכותרת כדאי להציג סיכום קטן:

```text
18 קישורים · 5 הזמנות · 3 דורשים פעולה
```

או:

```text
5 טיסות/מלונות · 4 אטרקציות · 2 חסרים
```

---

## פילטרים בראש העמוד

צריך פילטרים פשוטים, לא יותר מדי.

```text
[הכול] [הזמנות] [אטרקציות] [מסמכים] [חסר טיפול]
```

או לפי סטטוס:

```text
[הכול] [שמור] [צריך להזמין] [צריך לשלם] [בוצע]
```

המלצה שלי: לשלב שני דברים:

1. חיפוש חופשי.
2. פילטר קטגוריות.

דוגמה:

```text
[חיפוש קישור...]

[הכול] [טיסות] [מלונות] [רכב] [אטרקציות] [ביטוח] [מסמכים]
```

---

## כפתור פעולה ראשי

בצד העליון:

```text
+ הוסף קישור
```

במובייל עדיף Floating Action Button:

```text
+
```

בלחיצה נפתח Dialog או Bottom Sheet להוספת קישור.

---

# תצוגת הקישורים

## לא טבלה

לא הייתי מציג את הקישורים כטבלה.

בטיול חברים, ובעיקר במובייל, טבלה תהיה פחות נוחה.

עדיף כרטיסיות.

---

## כרטיס קישור בסיסי

דוגמה:

```text
┌──────────────────────────────┐
│ 🏨 מלון במינכן               │
│ מלון · הוזמן                 │
│                              │
│ Booking.com                  │
│ 7-9.10 · 2 לילות             │
│                              │
│ אחראי: דור                   │
│                              │
│ [פתח קישור] [פרטים]          │
└──────────────────────────────┘
```

---

## כרטיס קישור לאטרקציה

```text
┌──────────────────────────────┐
│ 🎢 פארק אירופה               │
│ אטרקציה · צריך להזמין        │
│                              │
│ תאריך מתוכנן: 11.10          │
│ מחיר משוער: €70              │
│                              │
│ עדיין אין כרטיסים            │
│                              │
│ [פתח אתר] [סמן כהוזמן]       │
└──────────────────────────────┘
```

---

## כרטיס קישור למשחק כדורגל

```text
┌──────────────────────────────┐
│ ⚽ משחק כדורגל               │
│ אטרקציה · בבדיקה             │
│                              │
│ מחפשים משחק מתאים באזור      │
│ מינכן / שטוטגרט / פרייבורג   │
│                              │
│ טווח מחיר: €60-€150          │
│                              │
│ [פתח אתר כרטיסים] [פרטים]    │
└──────────────────────────────┘
```

---

## כרטיס קישור למסמך

```text
┌──────────────────────────────┐
│ 🛡️ ביטוח נסיעות              │
│ מסמך · חסר                   │
│                              │
│ צריך להעלות פוליסה           │
│ או קישור לאישור הביטוח       │
│                              │
│ אחראי: כל אחד לעצמו          │
│                              │
│ [הוסף קישור] [העלה קובץ]     │
└──────────────────────────────┘
```

---

# סטטוסים

לכל קישור צריך להיות סטטוס.

הסטטוס הוא מה שהופך את הפיצ׳ר משמירת לינקים פשוטה לכלי ניהול אמיתי.

סטטוסים מומלצים:

| סטטוס | משמעות |
|---|---|
| שמור | יש קישור בלבד |
| בבדיקה | שוקלים את זה |
| צריך להזמין | עוד לא הוזמן |
| הוזמן | הוזמן בפועל |
| צריך לשלם | יש תשלום פתוח |
| שולם | התשלום בוצע |
| חסר | עדיין אין קישור/מסמך |
| בוטל | לא רלוונטי יותר |

לא חייבים להשתמש בכל הסטטוסים מהיום הראשון.

ל-MVP מספיק:

```ts
'saved' | 'pending' | 'booked' | 'paid' | 'missing' | 'cancelled'
```

תרגום UI:

| ערך | תצוגה |
|---|---|
| saved | שמור |
| pending | דורש טיפול |
| booked | הוזמן |
| paid | שולם |
| missing | חסר |
| cancelled | בוטל |

---

# סוגי קישורים

צריך להגדיר סוג קישור, כי לא כל קישור מתנהג אותו דבר.

```ts
LinkType =
  | 'flight'
  | 'hotel'
  | 'car'
  | 'activity'
  | 'restaurant'
  | 'bar'
  | 'map'
  | 'insurance'
  | 'document'
  | 'payment'
  | 'other';
```

ב-UI:

| סוג | אייקון | שם |
|---|---|---|
| flight | ✈️ | טיסה |
| hotel | 🏨 | מלון |
| car | 🚗 | רכב |
| activity | 🎢 | אטרקציה |
| restaurant | 🍽️ | מסעדה |
| bar | 🍺 | בר |
| map | 🗺️ | מפה |
| insurance | 🛡️ | ביטוח |
| document | 📄 | מסמך |
| payment | 💳 | תשלום |
| other | 🔗 | אחר |

---

# שדות של קישור

## שדות חובה

```ts
TripLink {
  id: string;
  tripId: string;
  title: string;
  url: string;
  type: LinkType;
  status: LinkStatus;
  createdBy: string;
  createdAt: Date;
}
```

---

## שדות מומלצים

```ts
TripLink {
  id: string;
  tripId: string;

  title: string;
  description?: string;
  url?: string;

  type: LinkType;
  status: LinkStatus;

  providerName?: string;
  // Booking, Expedia, Lufthansa, UEFA, Rentalcars וכו׳

  relatedDate?: Date;
  // תאריך רלוונטי: טיסה, לילה במלון, אטרקציה

  startDate?: Date;
  endDate?: Date;

  estimatedCost?: number;
  actualCost?: number;
  currency?: 'ILS' | 'EUR' | 'USD' | 'GBP' | 'GEL';

  responsibleUserId?: string;

  notes?: string;

  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}
```

---

## שדות מתקדמים, לא חובה ל-MVP

```ts
TripLink {
  confirmationNumber?: string;
  bookingReference?: string;

  address?: string;
  latitude?: number;
  longitude?: number;

  fileId?: string;
  attachmentUrl?: string;

  decisionId?: string;
  itineraryItemId?: string;
  expenseId?: string;

  isPinned?: boolean;
  isPrivate?: boolean;

  tags?: string[];
}
```

---

# יצירת קישור חדש

## Dialog מומלץ

לא לעשות טופס ענק.

בהתחלה להציג רק שדות בסיסיים:

```text
הוסף קישור

שם:
[ למשל: מלון במינכן ]

סוג:
[ טיסה ] [ מלון ] [ רכב ] [ אטרקציה ] [ מסמך ] [ אחר ]

קישור:
[ https://... ]

סטטוס:
[ שמור ] [ דורש טיפול ] [ הוזמן ] [ שולם ]

[אפשרויות נוספות]

[שמור]
```

---

## אפשרויות נוספות

בלחיצה על "אפשרויות נוספות":

```text
תאריך:
[ 11.10.2026 ]

עלות משוערת:
[ 70 ] [ EUR ]

אחראי:
[ דור ]

הערות:
[ טקסט חופשי ]
```

---

## UX חשוב

אחרי שהמשתמש מדביק URL, המערכת יכולה לנסות לזהות אוטומטית:

| URL מכיל | הצעה אוטומטית |
|---|---|
| booking.com | סוג: מלון |
| airbnb.com | סוג: מלון |
| rentalcars.com | סוג: רכב |
| europapark.de | סוג: אטרקציה |
| maps.google.com | סוג: מפה |
| waze.com | סוג: מפה |
| lufthansa.com | סוג: טיסה |
| ryanair.com | סוג: טיסה |
| ticketmaster | סוג: אטרקציה |

דוגמה:

```text
זיהינו שזה קישור של Booking.
להגדיר כסוג "מלון"?

[כן] [לא]
```

---

# מצב חסר: Placeholder Link

זה פיצ׳ר קטן אבל חשוב.

לפעמים עדיין אין קישור, אבל יודעים שצריך אחד.

לדוגמה:

- צריך לקנות כרטיסים למשחק.
- צריך למצוא מלון ביער השחור.
- צריך להוסיף ביטוח.
- צריך לשמור קישור לרכב.

לכן צריך לאפשר יצירת קישור גם בלי URL.

דוגמה:

```text
┌──────────────────────────────┐
│ 🚗 רכב שכור                  │
│ חסר · צריך לטפל              │
│                              │
│ עוד לא בחרנו חברת השכרה      │
│                              │
│ אחראי: דור                   │
│                              │
│ [הוסף קישור] [סמן כלא צריך]  │
└──────────────────────────────┘
```

במודל:

```ts
url?: string;
status: 'missing';
```

---

# קישור מקושר להחלטה

זה החיבור החשוב לפיצ׳ר ההחלטות.

כאשר החלטה נסגרת, אפשר ליצור ממנה קישור.

דוגמה:

החלטה:

```text
החלטנו: הולכים לפארק אירופה
```

אחרי סגירה:

```text
רוצה ליצור קישור להזמנה?

[כן, צור קישור] [לא עכשיו]
```

המערכת יוצרת:

```text
כותרת: פארק אירופה
סוג: אטרקציה
סטטוס: צריך להזמין
מקושר להחלטה: פארק אירופה
```

---

# קישור מקושר למסלול

כאשר בונים מסלול יומי, אפשר לחבר קישור לפריט במסלול.

דוגמה:

```text
יום 4 · פארק אירופה
קישורים:
- כרטיסים
- מיקום ב-Google Maps
- חניה
```

במודל:

```ts
itineraryItemId?: string;
```

---

# קישור מקושר להוצאה

אם קישור כולל תשלום, אפשר לקשר אותו להוצאה.

דוגמה:

```text
כרטיסים לפארק אירופה
עלות: €420
שולם על ידי: דור
מתחלק בין: כולם
```

אחרי שמסמנים "שולם", אפשר לשאול:

```text
להוסיף את זה להוצאות?

[כן] [לא]
```

אם כן, נוצרת הוצאה בעמוד ההוצאות.

במודל:

```ts
expenseId?: string;
```

---

# קישורים מוצמדים

כדאי לאפשר הצמדה של קישורים חשובים לראש העמוד.

דוגמאות לקישורים מוצמדים:

- טיסות.
- מלון ראשון.
- רכב.
- ביטוח.
- מסלול יומי.
- מפה ראשית.

UI:

```text
נעוצים
[טיסות] [מלון] [רכב] [ביטוח]
```

במודל:

```ts
isPinned: boolean;
```

---

# חיפוש

חיפוש צריך לעבוד על:

- כותרת.
- תיאור.
- סוג.
- ספק.
- הערות.
- תגיות.

דוגמה:

```text
חיפוש: פארק
```

מחזיר:

```text
פארק אירופה
כרטיסים לפארק
חניה בפארק
```

---

# תגיות

לא חובה, אבל שימושי.

דוגמאות:

```text
#מינכן
#יער-שחור
#פארק
#כדורגל
#חובה
#אופציונלי
```

ב-UI אפשר להציג תגיות קטנות בכרטיס:

```text
#יער-שחור #אטרקציה #צריך-להזמין
```

---

# הרשאות

לא צריך מערכת הרשאות כבדה.

המודל הכי פשוט:

| פעולה | מי יכול |
|---|---|
| לראות קישורים | כל משתתפי הטיול |
| להוסיף קישור | כל משתתף |
| לערוך קישור | יוצר הקישור / מנהל טיול |
| למחוק קישור | יוצר הקישור / מנהל טיול |
| לסמן כהוזמן/שולם | כל משתתף או אחראי |

אפשר להתחיל פשוט:

```text
כולם יכולים להוסיף ולערוך.
```

אם הקבוצה קטנה, זה מספיק.

---

# פרטיות

יש קישורים שיכולים להכיל מידע אישי.

לדוגמה:

- ביטוח נסיעות.
- צילום דרכון.
- אישור הזמנה עם פרטים אישיים.
- כרטיס טיסה עם PNR.

לכן כדאי להוסיף שדה:

```ts
visibility: 'group' | 'private' | 'admins_only';
```

ל-MVP אפשר לוותר, אבל אם מעלים מסמכים אמיתיים, לא הייתי מתעלם מזה.

המלצה מעשית:

- קישורים רגילים: גלויים לכולם.
- מסמכים אישיים: פרטיים כברירת מחדל.
- הזמנות קבוצתיות: גלוי לכולם.

---

# העלאת קבצים

לא חובה בהתחלה, אבל שווה לשקול.

יש שני סוגים:

1. קישור חיצוני.
2. קובץ שהועלה לאפליקציה.

דוגמאות לקבצים:

- PDF של הזמנת מלון.
- PDF של ביטוח.
- כרטיסים לפארק.
- כרטיסי טיסה.

מודל בסיסי:

```ts
TripFile {
  id: string;
  tripId: string;
  linkId?: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: Date;
}
```

בכרטיס:

```text
📎 2 קבצים מצורפים
[פתח] [הורד]
```

---

# מסך פרטי קישור

בלחיצה על כרטיס, נפתח מסך פרטים.

מבנה:

```text
מלון במינכן
מלון · הוזמן

קישור:
Booking.com
[פתח קישור]

תאריכים:
7-9.10.2026

עלות:
€620 לכל החדרים

אחראי:
דור

הערות:
כולל ארוחת בוקר. ביטול חינם עד 1.10.

מקושר אל:
- החלטה: מלון במינכן
- מסלול: יום 1-2
- הוצאה: מקדמה למלון

פעולות:
[ערוך] [סמן כשולם] [הוסף להוצאות] [מחק]
```

---

# תצוגה לפי ימים

מעבר לתצוגה לפי קטגוריות, אפשר להוסיף תצוגה לפי ימים.

```text
7.10
- טיסה למינכן
- מלון במינכן
- מפת הגעה למלון

8.10
- משחק כדורגל
- בר בערב

11.10
- פארק אירופה
- חניה
- כרטיסים
```

זה מאוד שימושי במהלך הטיול.

לא חייב להיות בעמוד הראשי. אפשר כטאב:

```text
[לפי קטגוריה] [לפי ימים]
```

---

# תצוגה לפי סטטוס

עוד טאב אפשרי:

```text
[הכול] [צריך טיפול]
```

במסך "צריך טיפול" רואים רק דברים כמו:

```text
- חסר ביטוח
- צריך להזמין פארק אירופה
- צריך לשלם לרכב
- צריך להעלות כרטיסים למשחק
```

זה פיצ׳ר חזק כי הוא עוזר להבין מה באמת פתוח.

---

# התראות

לא צריך מערכת התראות כבדה, אבל כדאי להוסיף תזכורות בסיסיות.

דוגמאות:

```text
צריך לבצע צ׳ק-אין לטיסה בעוד 24 שעות
```

```text
ביטול חינם למלון מסתיים מחר
```

```text
עדיין לא הועלה קישור לכרטיסים של פארק אירופה
```

שדות רלוונטיים:

```ts
reminderDate?: Date;
reminderText?: string;
```

ל-MVP אפשר רק להציג "תאריך יעד" בלי Push Notifications.

---

# אינדיקציה של “חסר”

כדאי להציג בראש העמוד דברים שחסרים.

דוגמה:

```text
דורש טיפול
- חסר קישור לרכב
- חסר ביטוח נסיעות
- כרטיסים למשחק עדיין לא הוזמנו
```

זה עוזר יותר מרשימה ארוכה של לינקים.

---

# אינטגרציה עם AI

אפשר להוסיף AI בצורה פרקטית, לא מוגזמת.

## שימושים טובים ל-AI

1. לסכם קישורים.
2. לזהות סוג קישור לפי URL.
3. להציע מה חסר.
4. לבנות רשימת "צריך לסגור" לפי היעד.
5. להפוך לינק לאובייקט מסודר.

---

## דוגמה: AI מזהה מה חסר

אם יש טיול למינכן + היער השחור, ויש כבר:

- טיסה.
- מלון במינכן.
- פארק אירופה.

אבל אין:

- רכב.
- מלון ביער השחור.
- ביטוח.

ה-AI יכול להציג:

```text
נראה שחסרים לכם:
1. קישור להזמנת רכב.
2. מלון באזור היער השחור.
3. ביטוח נסיעות.
4. כרטיסים למשחק אם החלטתם ללכת.
```

---

## דוגמה: AI ממיר לינק לפרטים

המשתמש מדביק קישור.

ה-AI מחזיר:

```json
{
  "title": "Europa-Park Tickets",
  "type": "activity",
  "providerName": "Europa-Park",
  "status": "pending",
  "suggestedTags": ["פארק", "יער שחור", "אטרקציה"]
}
```

---

# מיון ברירת מחדל

הייתי ממיין כך:

1. נעוצים.
2. דורש טיפול.
3. לפי תאריך קרוב.
4. לפי קטגוריה.
5. קישורים ישנים/בוטלו בסוף.

כלומר:

```text
נעוצים
דורש טיפול
השבוע בטיול
שאר הקישורים
בוטלו / לא רלוונטיים
```

---

# עיצוב מומלץ

## כרטיסים קלים

כל כרטיס צריך לכלול:

- אייקון.
- כותרת.
- קטגוריה.
- סטטוס.
- תאריך אם יש.
- מחיר אם יש.
- כפתור פתיחה.

לא לדחוס יותר מדי.

דוגמה:

```text
🏨 מלון במינכן
מלון · הוזמן · 7-9.10
€620 · אחראי: דור
[פתח]
```

---

## צבעים לפי סטטוס

| סטטוס | צבע מומלץ |
|---|---|
| שמור | אפור/כחול |
| דורש טיפול | כתום |
| הוזמן | ירוק |
| שולם | ירוק חזק |
| חסר | אדום |
| בוטל | אפור חלש |

לא להעמיס צבעים. מספיק Badge קטן.

---

# דוגמת DB Entity ב-NestJS / TypeORM

```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TripLinkType =
  | 'flight'
  | 'hotel'
  | 'car'
  | 'activity'
  | 'restaurant'
  | 'bar'
  | 'map'
  | 'insurance'
  | 'document'
  | 'payment'
  | 'other';

export type TripLinkStatus =
  | 'saved'
  | 'pending'
  | 'booked'
  | 'paid'
  | 'missing'
  | 'cancelled';

@Entity('trip_links')
export class TripLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id' })
  tripId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  url?: string;

  @Column({ type: 'varchar' })
  type: TripLinkType;

  @Column({ type: 'varchar', default: 'saved' })
  status: TripLinkStatus;

  @Column({ name: 'provider_name', nullable: true })
  providerName?: string;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedCost?: number;

  @Column({ name: 'actual_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualCost?: number;

  @Column({ nullable: true })
  currency?: string;

  @Column({ name: 'responsible_user_id', nullable: true })
  responsibleUserId?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'decision_id', nullable: true })
  decisionId?: string;

  @Column({ name: 'itinerary_item_id', nullable: true })
  itineraryItemId?: string;

  @Column({ name: 'expense_id', nullable: true })
  expenseId?: string;

  @Column({ name: 'is_pinned', default: false })
  isPinned: boolean;

  @Column({ name: 'is_private', default: false })
  isPrivate: boolean;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

# DTO ליצירת קישור

```ts
export class CreateTripLinkDto {
  tripId: string;
  title: string;
  description?: string;
  url?: string;
  type: TripLinkType;
  status?: TripLinkStatus;
  providerName?: string;
  startDate?: Date;
  endDate?: Date;
  estimatedCost?: number;
  actualCost?: number;
  currency?: string;
  responsibleUserId?: string;
  notes?: string;
  decisionId?: string;
  itineraryItemId?: string;
  expenseId?: string;
  isPinned?: boolean;
  isPrivate?: boolean;
  tags?: string[];
}
```

---

# API Endpoints מומלצים

```text
GET    /trips/:tripId/links
POST   /trips/:tripId/links
GET    /trips/:tripId/links/:linkId
PATCH  /trips/:tripId/links/:linkId
DELETE /trips/:tripId/links/:linkId
```

פעולות מיוחדות:

```text
PATCH /trips/:tripId/links/:linkId/pin
PATCH /trips/:tripId/links/:linkId/status
POST  /trips/:tripId/links/:linkId/create-expense
POST  /trips/:tripId/links/from-decision/:decisionId
```

---

# Service Logic בסיסי

## יצירת קישור

1. לבדוק שהמשתמש חבר בטיול.
2. לבדוק שיש title.
3. אם אין url, status צריך להיות `missing` או `pending`.
4. אם יש url, לנסות לזהות type/provider.
5. לשמור.
6. להחזיר את הקישור.

---

## שינוי סטטוס

דוגמה:

```text
pending -> booked
booked -> paid
missing -> saved
saved -> cancelled
```

לא חייבים לאכוף יותר מדי.

אבל כן כדאי למנוע מצב לא הגיוני:

```text
status = paid
actualCost = null
```

לא חובה, אבל אפשר להציג אזהרה.

---

# Angular Component Structure

מבנה מומלץ:

```text
trip-links/
  trip-links-page.component.ts
  trip-links-page.component.html
  trip-links-page.component.scss

  components/
    trip-link-card/
    trip-link-form-dialog/
    trip-link-details-dialog/
    trip-link-filters/
    trip-link-status-badge/

  services/
    trip-links.service.ts

  models/
    trip-link.model.ts
```

---

# Angular Model

```ts
export type TripLinkType =
  | 'flight'
  | 'hotel'
  | 'car'
  | 'activity'
  | 'restaurant'
  | 'bar'
  | 'map'
  | 'insurance'
  | 'document'
  | 'payment'
  | 'other';

export type TripLinkStatus =
  | 'saved'
  | 'pending'
  | 'booked'
  | 'paid'
  | 'missing'
  | 'cancelled';

export interface TripLink {
  id: string;
  tripId: string;
  title: string;
  description?: string;
  url?: string;
  type: TripLinkType;
  status: TripLinkStatus;
  providerName?: string;
  startDate?: string;
  endDate?: string;
  estimatedCost?: number;
  actualCost?: number;
  currency?: string;
  responsibleUserId?: string;
  notes?: string;
  decisionId?: string;
  itineraryItemId?: string;
  expenseId?: string;
  isPinned: boolean;
  isPrivate: boolean;
  tags?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

---

# UI — דוגמת Layout

```html
<section class="trip-links-page">
  <header class="page-header">
    <div>
      <h1>קישורים והזמנות</h1>
      <p>כל הדברים החשובים של הטיול במקום אחד</p>
    </div>

    <button mat-raised-button color="primary">
      + הוסף קישור
    </button>
  </header>

  <section class="summary-row">
    <div class="summary-card">18 קישורים</div>
    <div class="summary-card warning">3 דורשים טיפול</div>
    <div class="summary-card success">5 הוזמנו</div>
  </section>

  <section class="filters">
    <mat-form-field appearance="outline">
      <mat-label>חיפוש</mat-label>
      <input matInput placeholder="חפש מלון, טיסה, פארק...">
    </mat-form-field>

    <div class="chips">
      <button mat-stroked-button>הכול</button>
      <button mat-stroked-button>טיסות</button>
      <button mat-stroked-button>מלונות</button>
      <button mat-stroked-button>אטרקציות</button>
      <button mat-stroked-button>דורש טיפול</button>
    </div>
  </section>

  <section class="links-list">
    <app-trip-link-card
      *ngFor="let link of filteredLinks"
      [link]="link">
    </app-trip-link-card>
  </section>
</section>
```

---

# כרטיס Angular לדוגמה

```html
<article class="link-card" [class.pinned]="link.isPinned">
  <div class="card-top">
    <div class="icon">{{ getTypeIcon(link.type) }}</div>

    <div class="main-info">
      <h3>{{ link.title }}</h3>
      <p>{{ getTypeLabel(link.type) }} · {{ getStatusLabel(link.status) }}</p>
    </div>

    <app-trip-link-status-badge [status]="link.status" />
  </div>

  <p *ngIf="link.description" class="description">
    {{ link.description }}
  </p>

  <div class="meta">
    <span *ngIf="link.startDate">{{ link.startDate | date:'dd.MM' }}</span>
    <span *ngIf="link.estimatedCost">{{ link.estimatedCost }} {{ link.currency }}</span>
    <span *ngIf="link.providerName">{{ link.providerName }}</span>
  </div>

  <div class="actions">
    <a *ngIf="link.url" mat-button [href]="link.url" target="_blank">
      פתח קישור
    </a>

    <button mat-button>
      פרטים
    </button>
  </div>
</article>
```

---

# מצב ריק

כשאין קישורים:

```text
אין עדיין קישורים

פה שומרים את כל הדברים שלא כדאי שייעלמו בוואטסאפ:
טיסות, מלונות, רכב, אטרקציות, ביטוח, מסמכים וכל לינק חשוב.

[+ הוסף קישור ראשון]
```

---

# מצב “דורש טיפול”

אם יש דברים חסרים:

```text
דורש טיפול

3 דברים עדיין פתוחים:

- חסר קישור לרכב שכור
- צריך להזמין כרטיסים לפארק אירופה
- חסר ביטוח נסיעות
```

זה צריך להופיע בראש העמוד, לפני כל הקישורים.

---

# פיצ׳ר “שלח מהוואטסאפ”

לא בהכרח MVP, אבל מגניב מאוד.

אפשר לאפשר:

1. המשתמש מעתיק לינק מוואטסאפ.
2. נכנס לאפליקציה.
3. לוחץ “הוסף קישור”.
4. האפליקציה מזהה שהועתק URL ומציעה להדביק.

במובייל PWA אפשר להשתמש ב-Clipboard API במגבלות הדפדפן.

דוגמה UI:

```text
מצאנו קישור שהעתקת:
booking.com/...

להוסיף אותו?

[כן] [לא]
```

---

# פיצ׳ר “שיתוף לתוך האפליקציה”

אם האפליקציה היא PWA, אפשר בעתיד להוסיף Web Share Target.

זה יאפשר למשתמש לשתף לינק מהדפדפן ישירות לאפליקציה.

לדוגמה:

- המשתמש בדפדפן באתר Booking.
- לוחץ Share.
- בוחר את אפליקציית הטיול.
- נפתח מסך הוספת קישור עם ה-URL כבר בפנים.

זה פיצ׳ר חזק, אבל לא להתחיל ממנו.

---

# מה לא לעשות

לא הייתי עושה:

- מערכת תיקיות כבדה.
- הרשאות מורכבות מדי.
- צ׳אט על כל קישור.
- תגובות כמו רשת חברתית.
- יותר מדי שדות חובה.
- ניסיון להחליף את Gmail או Google Drive.

הפיצ׳ר צריך להיות מהיר.

אם לוקח יותר מ-20 שניות להוסיף קישור, המשתמשים יחזרו לוואטסאפ.

---

# MVP מדויק

הגרסה הראשונה צריכה לכלול:

1. עמוד **קישורים**.
2. רשימת כרטיסיות.
3. הוספת קישור.
4. קטגוריה.
5. סטטוס.
6. חיפוש.
7. פילטר לפי קטגוריה.
8. נעיצה.
9. קישור חסר בלי URL.
10. חיבור בסיסי להחלטה או למסלול, אם כבר קיימים.

---

# גרסה שנייה

אחרי שה-MVP עובד:

1. העלאת קבצים.
2. תזכורות.
3. קישור להוצאות.
4. AI שמזהה סוג קישור.
5. תצוגה לפי ימים.
6. Web Share Target.
7. רשימת "חסר לכם" חכמה.

---

# דוגמת User Flow מלא

## תרחיש 1: הוספת מלון

1. דור מוצא מלון ב-Booking.
2. מעתיק קישור.
3. נכנס לאפליקציה.
4. לוחץ “+ הוסף קישור”.
5. מדביק URL.
6. האפליקציה מזהה Booking.
7. מציעה סוג: מלון.
8. דור מוסיף תאריכים ועלות.
9. שומר.
10. הקישור מופיע תחת “מלונות”.

---

## תרחיש 2: חסר רכב

1. מישהו יוצר קישור בלי URL.
2. כותרת: רכב שכור.
3. סוג: רכב.
4. סטטוס: חסר.
5. אחראי: דור.
6. העמוד מציג אותו תחת “דורש טיפול”.
7. אחרי שנמצא רכב, מוסיפים URL ומשנים לסטטוס “הוזמן”.

---

## תרחיש 3: כרטיסים לפארק אירופה

1. החלטה נסגרת: הולכים לפארק אירופה.
2. האפליקציה מציעה ליצור קישור.
3. נוצר קישור בסטטוס “צריך להזמין”.
4. אחרי רכישה מעלים PDF או URL.
5. מסמנים “שולם”.
6. האפליקציה מציעה להוסיף להוצאות.

---

# סיכום חד

פיצ׳ר **קישורים מרוכזים** צריך להיות המסך שבו כל הדברים החשובים של הטיול נמצאים במקום אחד.

הוא לא אמור להיות מערכת ניהול מסמכים כבדה.

הוא צריך לענות על ארבע שאלות:

1. איפה הקישור?
2. האם זה כבר הוזמן?
3. מי אחראי לזה?
4. מה עדיין חסר?

אם הפיצ׳ר עונה על ארבע השאלות האלה בצורה מהירה וברורה — הוא מוצלח.
