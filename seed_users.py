#!/usr/bin/env python3
"""
Creates a demo trip with 7 fictional users (1 admin + 6 members),
all with filled questionnaires, ready for AI destination generation.
"""
import json
import requests

BASE = "http://localhost:3018"

# ─── Question IDs (from DB) ─────────────────────────────────────────────────
Q = {
    1:  "40a3d490-fe58-4049-96dc-0c56abf61c4a",  # סגנון במילה אחת (SINGLE)
    2:  "764bf002-3e50-4932-a8a5-e1fc57c79801",  # תכנון vs זרימה (SCALE)
    3:  "78ffaed7-5ea6-4c3d-98b6-d6304ab222de",  # שעות בתנועה (SINGLE)
    4:  "c4c18eac-038d-4fa4-ad66-c4d7db606166",  # הרבה מקומות vs עומק (SCALE)
    5:  "55685139-5fc6-43ad-b524-a00f5b6ffbe8",  # בריחה vs חוויה (SINGLE)
    6:  "c032b546-1f18-4368-84aa-884e9a6654b5",  # טבע vs עיר (SCALE)
    7:  "e7d2456e-5b3e-4130-8511-dabb0ce6a81f",  # פחדים (TEXT)
    8:  "8bcec28a-c020-4d73-812b-e940a69c4dc2",  # אוכל (SCALE)
    9:  "d04f8272-238e-4910-a0b3-b8156d1ad1b8",  # קניות (SINGLE)
    10: "b7992b3b-dfef-4d90-b369-9685f0eb3359",  # לילה חיים (SINGLE)
    11: "b7bd9a82-1ea7-4e25-bf43-4dd023d82de5",  # מוזיאומים (SINGLE)
    12: "93221e06-d390-4c69-86fe-7f3db4ea6888",  # ספורט אתגרי (SINGLE)
    13: "6722e8b9-500a-4969-bb15-df53b6c914fb",  # אינסטגרם (SINGLE)
    14: "d34fed58-dc04-480e-b7d3-4991b2964869",  # רמת שינה (SINGLE)
    15: "b44fff75-9330-4dad-94af-faf0648401d7",  # חום (SINGLE)
    16: "0eea8d7c-fd61-4e71-a9a3-253c9fbfc396",  # קור (SINGLE)
    17: "f0116a18-0fd1-42da-8944-92922222d329",  # תקציב (SINGLE)
    18: "ba610521-456f-4a39-84ee-ac7d151d6bfe",  # מזוודות (SINGLE)
    19: "04251c61-3ac7-4c14-b8ee-19fbbdb93e30",  # מגבלות תזונה (TEXT)
    20: "aa244af7-c3e5-42d8-aea7-de471e6f86ef",  # מוביל vs זורם (SCALE)
    21: "21e83fe5-f16d-4690-b49c-dfe4a5dddefd",  # זמן לבד (SINGLE)
    22: "68a61c5a-7812-4ddd-8c55-707192d78cef",  # מה מוציא מהכלים (TEXT)
    23: "116335a6-d1f5-41db-911f-e6134de0a47f",  # רוב רוצה משהו אחר (SINGLE)
    24: "331e5c36-e2f6-4b26-841e-38fc0673e2a9",  # קפה שקט vs שוק (SINGLE)
    25: "1ca33b5d-fd56-4246-8483-908c96febad9",  # מלון מרכזי vs זול (SINGLE)
    26: "d6d262b7-57bd-4aa1-856f-594c3fe98392",  # סרט איזה ז'אנר (SINGLE)
    27: "e0e2542b-a494-4d33-8398-36fc11214419",  # יעד חלום (TEXT)
    28: "01e10bef-2976-46d9-9302-b8e1506e02a0",  # יעד לא רוצה (TEXT)
    29: "241881d8-0ad3-43ba-9856-39e9a18500b1",  # זיכרון טוב (TEXT)
    30: "4f342af6-5eea-4515-82d8-fcebaa72842e",  # דבר אחד (TEXT)
}

# ─── 6 Fictional users + their answers ──────────────────────────────────────
USERS = [
    {
        "name": "אורי כהן", "email": "uri@demo.com", "password": "demo123",
        "desc": "הרפתקן, ספורט אתגרי, תקציב בינוני",
        "answers": {
            1: "הרפתקה",        2: 4,                    3: "6–8 שעות",
            4: 2,               5: "חוויה חדשה",          6: 2,
            7: "אין פחדים",     8: 3,                    9: "קצת, אם יש",
            10: "כן, זה חלק מהטיול", 11: "אחד-שניים, בסדר", 12: "כן בבקשה!",
            13: "לא אגזים, אבל כיף", 14: "הוסטל שיתופי",  15: "מסתדר",
            16: "מסתדר",         17: "50–100$",           18: "מזוודה קטנה",
            19: "ללא",           20: 2,                   21: "שעה-שעתיים ביום",
            22: "אנשים שלא מחליטים ומבזבזים זמן",
            23: "עושה פעילות נפרדת", 24: "שוק מקומי",       25: "אמצע הדרך",
            26: "אקשן והרפתקאות",   27: "פטגוניה",         28: "דובאי",
            29: "גלישת גלים בפורטוגל לפני שנתיים",
            30: "לטפס על הר גבוה ולראות זריחה מלמעלה",
        }
    },
    {
        "name": "מיכל לוי", "email": "michal@demo.com", "password": "demo123",
        "desc": "אוהבת תרבות, מוזיאומים, אוכל טוב",
        "answers": {
            1: "תרבות",          2: 2,                    3: "4–6 שעות",
            4: 4,               5: "חוויה חדשה",          6: 4,
            7: "פחד קצת ממקומות סגורים", 8: 5,           9: "קצת, אם יש",
            10: "לפעמים",        11: "אוהב מאוד",          12: "לא, תודה",
            13: "לא אגזים, אבל כיף", 14: "מלון רגיל",    15: "קשה לי מאוד",
            16: "מסתדר",         17: "100–200$",          18: "מזוודה קטנה",
            19: "צמחונית",       20: 3,                   21: "שעה-שעתיים ביום",
            22: "לחץ ועומס ללא הפסקה",
            23: "הולך איתם בכל זאת", 24: "קפה שקט",        25: "מרכזי ויקר",
            26: "דרמה אירופאית איטית", 27: "קיוטו, יפן",  28: "לאס וגאס",
            29: "שבוע בפירנצה עם חברות, מוזיאונים ואוכל מדהים",
            30: "לשבת בקפה מקומי ולצפות בחיים עוברים",
        }
    },
    {
        "name": "נועם ברק", "email": "noam@demo.com", "password": "demo123",
        "desc": "צעיר ואנרגטי, חיי לילה, אינסטגרם",
        "answers": {
            1: "כיף",            2: 5,                    3: "כמה שצריך",
            4: 1,               5: "בריחה מהשגרה",        6: 3,
            7: "אין",            8: 3,                    9: "אני חי בשביל זה",
            10: "כן, זה חלק מהטיול", 11: "מתחמק אם אפשר", 12: "אולי, תלוי מה",
            13: "כן, זה חשוב לי", 14: "הוסטל שיתופי",   15: "אוהב חום, אין בעיה",
            16: "ממש לא מתחבר לזה", 17: "50–100$",       18: "מזוודה קטנה",
            19: "ללא",           20: 4,                   21: "לא צריך בכלל",
            22: "לוח זמנים נוקשה מדי",
            23: "מנסה לשנות את הדעה", 24: "שוק מקומי",    25: "זול ורחוק",
            26: "קומדיה",        27: "איביזה",            28: "מוזיאון של יום שלם",
            29: "NYE בברצלונה, ריקוד עד הבוקר",
            30: "מסיבת חוף עם אנשים חדשים מכל העולם",
        }
    },
    {
        "name": "רחל שמיר", "email": "rachel@demo.com", "password": "demo123",
        "desc": "מחפשת מנוחה, מלון מפנק, קצב איטי",
        "answers": {
            1: "רגיעה",          2: 1,                    3: "עד 4 שעות",
            4: 5,               5: "בריחה מהשגרה",        6: 4,
            7: "פחד גבהים",      8: 5,                    9: "קצת, אם יש",
            10: "מעדיף לסיים את הערב בשקט", 11: "אחד-שניים, בסדר", 12: "לא, תודה",
            13: "ממש לא עניין אותי", 14: "רק מלון מפנק",  15: "קשה לי מאוד",
            16: "ממש לא מתחבר לזה", 17: "100–200$",      18: "מזוודה גדולה",
            19: "ללא גלוטן",     20: 5,                   21: "חצי יום",
            22: "רעש, עומס ואנשים שלא מכבדים זמן אישי",
            23: "עושה פעילות נפרדת", 24: "קפה שקט",        25: "מרכזי ויקר",
            26: "דרמה אירופאית איטית", 27: "סנטוריני",    28: "בנקוק בעונת הגשמים",
            29: "שבוע ספא בתאילנד, שקט מוחלט",
            30: "לשבת על חוף ים שקט עם ספר ובלי לדאוג לכלום",
        }
    },
    {
        "name": "יונתן גל", "email": "yonatan@demo.com", "password": "demo123",
        "desc": "אוהב טבע, הליכות, קמפינג",
        "answers": {
            1: "טבע",            2: 3,                    3: "6–8 שעות",
            4: 4,               5: "חוויה חדשה",          6: 1,
            7: "אין פחדים",      8: 2,                    9: "מעדיף לדלג",
            10: "מעדיף לסיים את הערב בשקט", 11: "מתחמק אם אפשר", 12: "כן בבקשה!",
            13: "ממש לא עניין אותי", 14: "אוהל / קמפינג",  15: "מסתדר",
            16: "אני אוהב קור",   17: "עד 50$",            18: "תיק יד בלבד",
            19: "ללא",           20: 2,                   21: "שעה-שעתיים ביום",
            22: "ערים צפופות בלי ירוק",
            23: "עושה פעילות נפרדת", 24: "שוק מקומי",    25: "זול ורחוק",
            26: "דוקומנטרי טבע", 27: "פיורדים בנורווגיה", 28: "דובאי",
            29: "טרק של שבוע בהרי הקרפטים, שינה תחת כיפת השמים",
            30: "לצעוד 20 ק\"מ ביום בטבע פסטורלי",
        }
    },
    {
        "name": "שיר אברהם", "email": "shir@demo.com", "password": "demo123",
        "desc": "מאוזנת, תרבות + כיף, ערים",
        "answers": {
            1: "תרבות",          2: 3,                    3: "4–6 שעות",
            4: 3,               5: "שניהם באותה מידה",   6: 4,
            7: "אין",            8: 4,                    9: "קצת, אם יש",
            10: "לפעמים",        11: "אוהב מאוד",          12: "אולי, תלוי מה",
            13: "לא אגזים, אבל כיף", 14: "מלון רגיל",    15: "מסתדר",
            16: "מסתדר",         17: "50–100$",           18: "מזוודה קטנה",
            19: "ללא",           20: 3,                   21: "שעה-שעתיים ביום",
            22: "חוסר גמישות ותכנון יתר",
            23: "תלוי מה",       24: "שניהם תלוי היום",   25: "אמצע הדרך",
            26: "קומדיה",        27: "מרוקו",             28: "מדבר חם ויבש",
            29: "סוף שבוע בפריז, ארוחת שף ותערוכת אמנות",
            30: "לאבד את עצמי במדינה חדשה ולגלות אותה בלי מפה",
        }
    },
]

def post(path, data, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.post(f"{BASE}{path}", json=data, headers=headers)
    return r.json()

def get(path, token):
    r = requests.get(f"{BASE}{path}", headers={"Authorization": f"Bearer {token}"})
    return r.json()

def build_answers(user_answers):
    return [{"questionId": Q[k], "answer": v} for k, v in user_answers.items()]

# ─── Step 1: Admin login ─────────────────────────────────────────────────────
print("🔑 Admin login...")
admin = post("/api/auth/login", {"email": "test@test.com", "password": "test123"})
admin_token = admin["token"]
admin_id = admin["user"]["id"]
print(f"   ✓ {admin['user']['name']} ({admin_id[:8]}...)")

# ─── Step 2: Create trip ─────────────────────────────────────────────────────
print("\n✈️  Creating trip...")
trip_data = post("/api/trips", {"name": "חופשת קיץ 2025 — בחירת יעד", "startDate": "2025-07-15", "endDate": "2025-07-25"}, admin_token)
trip = trip_data["trip"]
trip_id = trip["id"]
invite_code = trip["inviteCode"]
print(f"   ✓ Trip ID: {trip_id[:8]}...")
print(f"   ✓ Invite code: {invite_code}")

# ─── Step 3: Admin fills questionnaire ───────────────────────────────────────
admin_answers = {
    1: "הרפתקה", 2: 3, 3: "4–6 שעות", 4: 3, 5: "שניהם באותה מידה", 6: 3,
    7: "אין פחדים", 8: 4, 9: "קצת, אם יש", 10: "לפעמים", 11: "אחד-שניים, בסדר",
    12: "אולי, תלוי מה", 13: "לא אגזים, אבל כיף", 14: "מלון רגיל", 15: "מסתדר",
    16: "מסתדר", 17: "100–200$", 18: "מזוודה קטנה", 19: "ללא", 20: 2,
    21: "שעה-שעתיים ביום", 22: "חוסר גמישות", 23: "תלוי מה", 24: "שניהם תלוי היום",
    25: "אמצע הדרך", 26: "אקשן והרפתקאות", 27: "איסלנד", 28: "שום מקום שבא אליי",
    29: "טרק בנפאל", 30: "לגלות מקום חדש לגמרי",
}
result = post(f"/api/questionnaire/{trip_id}/answers", {"answers": build_answers(admin_answers)}, admin_token)
print(f"\n📋 Admin answered: {result.get('message', result)}")

# ─── Step 4: Create + join + answer for each fictional user ──────────────────
for i, u in enumerate(USERS, 1):
    print(f"\n👤 [{i}/6] {u['name']} ({u['desc']})")

    # Register
    reg = post("/api/auth/register", {"name": u["name"], "email": u["email"], "password": u["password"]})
    if "error" in reg:
        # Already exists — login instead
        reg = post("/api/auth/login", {"email": u["email"], "password": u["password"]})
    token = reg["token"]
    print(f"   ✓ Registered/logged in")

    # Join trip
    join = post(f"/api/trips/join/{invite_code}", {}, token)
    if "error" in join:
        print(f"   ⚠ Join: {join['error']}")
    else:
        print(f"   ✓ Joined trip")

    # Answer questionnaire
    answers_payload = build_answers(u["answers"])
    ans_result = post(f"/api/questionnaire/{trip_id}/answers", {"answers": answers_payload}, token)
    print(f"   ✓ Questionnaire: {ans_result.get('message', ans_result)}")

# ─── Step 5: Verify status ───────────────────────────────────────────────────
print("\n📊 Status check...")
status = get(f"/api/questionnaire/{trip_id}/status", admin_token)
print(f"   {status['completed']}/{status['total']} members completed questionnaire")
for m in status["members"]:
    icon = "✅" if m["completed"] else "⏳"
    print(f"   {icon} {m['name']}")

print(f"\n🎯 Ready! Trip ID: {trip_id}")
print(f"   URL: https://trip.kefar-sava.co.il/trip/{trip_id}")
print(f"\n   Now click 'קבל המלצות מ-AI' in the app (admin only)")
