# נחיתה רכה — Soft Landing Moving Assistant

אפליקציית ווב בעברית שמלווה משתמשים במעבר דירה בין תל אביב לירושלים ולהפך.
המשתמשים מתחברים באמצעות Google, מנהלים רשימת משימות מעבר מסודרת, עוקבים אחר זכויות והטבות רלוונטיות, משלימים טפסים נדרשים, מקבלים תזכורות יומיות מבוססות AI, ויכולים לשוחח עם סוכני AI דרך צ'אט באתר או דרך בוט Telegram.

## Stack

| שכבה        | טכנולוגיה                                                                          |
| ----------- | ---------------------------------------------------------------------------------- |
| Frontend    | React + Vite + Tailwind (`/frontend`)                                              |
| Backend     | FastAPI / Python (`/backend`)                                                      |
| Data / Auth | Supabase (Postgres + Google OAuth)                                                 |
| AI Agents   | OpenAI GPT-4o-mini (Task Agent + Documents Agent)                                  |
| Messaging   | Telegram Bot API (webhook-based)                                                   |
| Scheduler   | APScheduler — משימה יומית ב-08:00 שעון ישראל                                      |
| Deploy      | Railway (staging + production, כל סביבה עם שירות frontend ושירות backend נפרדים)  |

זרימת הנתונים: **React → FastAPI → Supabase**. ה-frontend משתמש ב-Supabase רק לצורך התחברות עם Google
וניהול ה-session token; כל בקשת נתונים עוברת דרך FastAPI שמאמת את ה-Supabase JWT.

## מבנה הפרויקט

```
frontend/                     אפליקציית React (RTL, עברית, עיצוב "נחיתה רכה")
backend/                      FastAPI API + הגשת ה-frontend ב-production
backend/app/routers/          מטפלי ה-API (קטלוג, מעקב, סוכנים, טלגרם…)
backend/app/notification_service.py   לוגיקת ההתראות היומיות
backend/app/telegram_service.py       webhook הבוט + טיפול בהודעות
backend/prompts/              פרומפטי מערכת לסוכני ה-AI
supabase/migrations/          migrations של סכמת ה-SQL
nixpacks.toml                 הגדרות build של Railway
```

## פיצ'רים

- **Dashboard** — כרטיסי קטגוריות עם תרשימי עוגה המציגים את ההתקדמות, ציר זמן כללי ולוח יומי מותאם אישית הכולל משימות שנבחרו להיום.
- **לוח יומי** — אפשרות להוסיף משימות ספציפיות לרשימת "היום"; מציג יום ותאריך נוכחיים.
- **קטלוג משימות** — משימות למעבר דירה מקובצות לפי קטגוריה ושלב (לפני / יום המעבר / אחרי), עם מעקב אחר סטטוס הביצוע, הגדרת מועד, הערות ושלבי ביצוע.
- **זכויות והטבות** — קטלוג עם אפשרות חיפוש, מסונן לפי פרופיל המשתמש והתחומים שמעניינים אותו.
- **מסמכים וטפסים** — טפסים ספציפיים לעיר עם מעקב אחר סטטוס המילוי וקישורים ישירים לטפסים הרשמיים.
- **משימות אישיות** — המשתמש יכול ליצור משימות משלו עם קטגוריות, מועדים ושלבי ביצוע.
- **סוכן AI למשימות** — סוכן שיכול לקרוא משימות, להוסיף, לשנות סטטוסים ומועדים, ולהציע מה להוסיף ללוח היומי.
- **סוכן AI למסמכים** — סוכן שעונה על שאלות על טפסים ובירוקרטיה; תומך בהעלאת תמונות לזיהוי מסמכים.
- **בוט Telegram** — לכל משתמש יש id ייעודי; הבוט משמש כערוץ נוסף לקבלת התראות יומיות ומאפשר שיחה עם סוכן המשימות דרך אפליקציית Telegram בנייד.
- **התראות יומיות** — המשתמש מקבל התראות אוטומטיות כל יום ב-08:00 בבוקר, שעון ישראל. ההתראות כוללות ברכת הצלחה ביום המעבר, מועדים קרובים (3 ימים לפני), 5 המשימות הדחופות מהשלב הנוכחי, והתראות על איחורים במועדים. ההתראות מופיעות גם באתר וגם נשלחות ב-Telegram אם מקושר.
- **שאלון פתיחה והתאמה אישית** — תהליך בן 3 שלבים לאיסוף תאריך המעבר, עיר היעד ופרטי פרופיל רלוונטיים (עיסוק, מצב משפחתי, הכנסה, מאפייני זכאות ועוד). המשתמש יכול לעדכן ולערוך את הפרופיל ולקשר/לנתק Telegram בכל עת.

## מסד הנתונים (טבלאות Supabase)

| טבלה                            | תיאור                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `user_profiles`                 | שורה אחת לכל משתמש: תאריך מעבר, עיר יעד, מאפיינים אישיים, Telegram chat_id             |
| `moving_tasks`                  | קטלוג משותף של משימות מעבר עם שלב בציר הזמן וכללי רלוונטיות                            |
| `rights_items`                  | קטלוג זכויות והטבות, מסונן לפי עיר                                                     |
| `forms`                         | רשימת טפסים ומסמכים עם שיוך עיר, הערות וקישורים רשמיים                                 |
| `cities`                        | טבלת ייחוס לערים (reference table)                                                      |
| `profiles`                      | טבלת זהות בסיסית שנוצרת אוטומטית ע"י Supabase Auth עם Google sign-in: שם תצוגה, אימייל |
| `scrape_log`                    | לוג פנימי של סקריפטי ה-scraping לאיסוף זכויות והטבות; מתעד URL, סטטוס ושגיאות          |
| `user_item_status`              | סטטוס, הערות, next-action ו-deadline overrides לכל משימה עבור כל משתמש                 |
| `user_custom_tasks`             | משימות שנוצרו על-ידי המשתמש עם כותרת, קטגוריה, מועד, שלבי ביצוע וקישורים              |
| `user_form_status`              | מעקב מילוי טפסים לכל משתמש                                                              |
| `user_daily_board`              | משימות שנוספו ללוח היומי של המשתמש                                                      |
| `notifications`                 | התראות יומיות עם רמת הדחיפות וסטטוס קריאה                                               |
| `tasks_agent_conversations`     | שמירת היסטוריית שיחות עם סוכן ה-AI של המשימות                                           |
| `documents_agent_conversations` | שמירת היסטוריית שיחות עם סוכן ה-AI של המסמכים                                           |
| `telegram_agent_conversations`  | שמירת היסטוריית שיחה דרך הבוט ב-Telegram עם סוכן המשימות (מוגבל ל-30 הודעות לכל משתמש) |

## סוכני AI

### סוכן משימות (`/api/task-agent`)

מבוסס GPT-4o-mini (גיבוי: GPT-4o). קורא את כל משימות המעבר והמשימות האישיות, יחד עם הסטטוסים ונתוני הפרופיל שלו.

הסוכן משתמש ב-**OpenAI tool-calling** עם הכלים הרשומים הבאים:

| כלי                     | תפקיד                                                       |
| ----------------------- | ----------------------------------------------------------- |
| `add_custom_task`       | יוצר משימה אישית חדשה                                      |
| `set_task_category`     | משנה קטגוריה של משימה אישית                                |
| `set_task_action_steps` | מוסיף או מחליף שלבי ביצוע במשימה אישית                     |
| `set_task_status`       | מעדכן סטטוס של כל משימה (moving או custom)                 |
| `set_task_deadline`     | קובע מועד (תאריך ספציפי או שלב יחסי)                      |
| `get_daily_board`       | שולף את הלוח היומי הנוכחי של המשתמש                       |

התגובות מועברות ב-streaming לדפדפן. הסוכן יכול גם להציע הוספת משימות ללוח היומי באמצעות
מרקר `[SUGGEST_DAILY:{…}]` שה-frontend ממיר לכפתור ויזואלי.
זמין גם דרך Telegram (אותה לוגיקה, ללא streaming).

### סוכן מסמכים (`/api/documents-agent`)

מבוסס על אותו מודל. עונה על שאלות בנוגע לטפסים והפרוצדורות הבירוקרטיות הנדרשות למעבר. תומך בהעלאת תמונות לזיהוי מסמכים. שולף טפסים ספציפיים לעיר ופרופיל המשתמש כהקשר.

הסוכן משתמש ב-**Supabase skills** (מוגדרים דרך אינטגרציית Supabase agent-skills) לשאילתת
טפסים ונתוני משתמש ישירות:

| Skill                     | תפקיד                                                          |
| ------------------------- | -------------------------------------------------------------- |
| `get_form_instructions`   | שולף הוראות מפורטות והערות לטופס ספציפי                      |
| `get_required_documents`  | מחזיר רשימת מסמכים נדרשים לטופס                               |
| `get_form_links`          | מחזיר קישורים רשמיים מה-DB עבור טופס                         |
| `get_user_profile`        | קורא את פרופיל המשתמש הנוכחי (עיר, עיסוק, זכאות)            |
| `update_user_form_status` | מסמן טופס כהושלם / בטיפול עבור המשתמש                        |

## בוט Telegram

- **Webhook-based** — רושם את ה-webhook באופן אוטומטי בעת העלייה כש-`TELEGRAM_BOT_TOKEN` ו-`RAILWAY_PUBLIC_DOMAIN` מוגדרים.
- **קישור חשבון** — המשתמש לוחץ "חבר Telegram" באפליקציה, מקבל קוד בן 6 ספרות, פותח את deep link של הבוט; הבוט מפענח `/start <code>` ושומר את ה-`chat_id` ב-`user_profiles`.
- **התראות יומיות** — בכל פעם שמשימת ה-08:00 יוצרת התראות חדשות, הן מועברות לשיחת ה-Telegram המקושרת.
- **שיחה עם סוכן המשימות** — כל הודעה שאינה פקודה ממשתמש מקושר מנותבת לסוכן המשימות. משתמשים לא מקושרים מקבלים הנחיה לקשר דרך האפליקציה.

## שירות ההתראות

APScheduler מפעיל את `generate_daily_notifications()` מדי יום ב-**08:00 שעון ישראל (Asia/Jerusalem)**.

עבור כל משתמש שהשלים onboarding, המשימה מייצרת עד ארבעה סוגי התראות לפי סדר עדיפות:

1. **התראות על איחורים** ← **עדיפות גבוהה ביותר** — משימות משלבים קודמים שטרם הושלמו. אלו מודגשות כדחופות ומוצגות ראשונות כדי למנוע מהמשתמש לפספס דברים חיוניים.
2. **הודעת הצלחה ביום המעבר** — ביום המעבר עצמו נשלחת ברכת מזל טוב וחיזוק; ההודעה מותאמת לשם המשתמש ועיר היעד.
3. **תזכורות לתאריך ספציפי** — 3 ימים לפני ובתאריך המועד עצמו.
4. **תזכורות שלב נוכחי** — 5 המשימות הדחופות ביותר מהשלב הנוכחי של המשתמש.

ניסוח ההתראות מותאם לסטטוס המשימה ומקבל טון דחוף יותר לאחר שלושה ימים ללא שינוי.

ניתן גם להפעיל ידנית:

```
POST /api/internal/notifications/run
Header: x-internal-secret: <INTERNAL_JOB_SECRET>
```

## סביבות ו-Deploy

הפרויקט רץ על **שתי סביבות Railway**, כל אחת עם **שני שירותים נפרדים**:

| סביבה          | שירותים                                                 |
| -------------- | ------------------------------------------------------- |
| **Staging**    | `frontend` (Vite dev/preview) + `backend` (FastAPI)     |
| **Production** | `frontend` (built React) + `backend` (FastAPI)          |

שתי הסביבות משתמשות באותו פרויקט Supabase, אך מופרדות לחלוטין ברמת משתני הסביבה והאינטגרציות.

### Build & start (מה ש-Railway מריץ)

```bash
cd frontend && npm ci && npm run build
python -m pip install -r backend/requirements.txt
cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

יש להגדיר את כל משתני `backend/.env` כ-**service variables** ב-Railway, להוסיף את הדומיין של Railway
ל-`FRONTEND_ORIGIN` וכן ל-Supabase Auth redirect URLs, ולוודא ש-`RAILWAY_PUBLIC_DOMAIN` מוגדר
כדי שה-webhook של Telegram יירשם אוטומטית בעלייה.

## משתני סביבה

**`backend/.env`**:

| משתנה                            | תיאור                                                                  |
| -------------------------------- | ---------------------------------------------------------------------- |
| `SUPABASE_URL`                   | כתובת פרויקט ה-Supabase                                               |
| `SUPABASE_SERVICE_KEY`           | מפתח `service_role` של Supabase (צד שרת בלבד, לעולם לא נחשף)         |
| `SUPABASE_ANON_KEY`              | מפתח anon/public של Supabase (לאימות JWT)                             |
| `FRONTEND_ORIGIN`                | כתובות CORS מורשות, מופרדות בפסיקים                                   |
| `TASKS_AGENT_OPENAI_API_KEY`     | מפתח OpenAI לסוכן המשימות                                             |
| `DOCUMENTS_AGENT_OPENAI_API_KEY` | מפתח OpenAI לסוכן המסמכים                                             |
| `OPEN_AI_MODEL`                  | מודל ראשי (ברירת מחדל: `gpt-4o-mini`)                                 |
| `OPEN_AI_MODEL_BACKUP`           | מודל גיבוי (ברירת מחדל: `gpt-4o`)                                     |
| `TELEGRAM_BOT_TOKEN`             | טוקן בוט Telegram; ה-webhook נרשם אוטומטית בעלייה ב-Railway          |
| `INTERNAL_JOB_SECRET`            | סוד משותף להפעלה ידנית של endpoint ההתראות                            |
| `SHOW_UNVERIFIED`                | `true` להצגת פריטי קטלוג לא מאומתים (ברירת מחדל: `true`)             |

**`frontend/.env`**:

| משתנה                    | ערך                                                      |
| ------------------------ | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | זהה ל-`SUPABASE_URL`                                    |
| `VITE_SUPABASE_ANON_KEY` | מפתח anon/public של Supabase                            |
| `VITE_API_URL`           | ריק בסביבת פיתוח (Vite מבצע proxy מ-`/api` ל-`:8000`) |

## פיתוח מקומי (שני טרמינלים)

**Backend:**

```bash
cd backend
py -m venv .venv                                              # Windows
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev          # http://localhost:5174  (proxies /api -> :8000)
```

פותחים את http://localhost:5174, מתחברים עם Google, משלימים onboarding ומגיעים ל-dashboard.

## סיכום ה-API

כל ה-routes דורשים `Authorization: Bearer <supabase access token>` למעט `/api/health`,
`/api/statuses` ו-`/api/telegram/webhook`.

### קטלוג ומעקב

| Method | Path                                        | תיאור                                       |
| ------ | ------------------------------------------- | ------------------------------------------- |
| GET    | `/api/health`                               | בדיקת זמינות השירות                         |
| GET    | `/api/statuses`                             | 6 הסטטוסים הקבועים                         |
| GET    | `/api/me`                                   | מזהה ואימייל המשתמש הנוכחי                 |
| GET    | `/api/categories`                           | קטגוריות משימות עם ספירות                  |
| GET    | `/api/items`                                | משימות + זכויות + custom, עם סטטוסי המשתמש |
| GET    | `/api/forms`                                | טפסים ספציפיים לעיר עם סטטוס מילוי         |
| GET    | `/api/progress`                             | סיכום התקדמות ל-dashboard                  |
| PUT    | `/api/items/{item_type}/{item_id}/status`   | עדכון סטטוס / הערות / next_action          |
| PUT    | `/api/items/{item_type}/{item_id}/deadline` | קביעה או שינוי מועד                        |
| POST   | `/api/custom-tasks`                         | יצירת משימה אישית חדשה                     |
| PUT    | `/api/custom-tasks/{id}/content`            | עריכת שלבי ביצוע וקישורים של משימה אישית   |
| PUT    | `/api/forms/{form_id}/checked`              | החלפת סטטוס מילוי טופס                     |

### לוח יומי

| Method | Path                                           | תיאור                        |
| ------ | ---------------------------------------------- | ---------------------------- |
| GET    | `/api/daily-board`                             | רשימת משימות צמודות לפי סדר |
| POST   | `/api/daily-board/items`                       | צימוד משימות ללוח היומי      |
| DELETE | `/api/daily-board/items/{item_type}/{item_id}` | הסרת משימה מהלוח             |

### סוכני AI

| Method | Path                                      | תיאור                                       |
| ------ | ----------------------------------------- | ------------------------------------------- |
| POST   | `/api/task-agent/chat`                    | שיחת streaming עם סוכן המשימות             |
| POST   | `/api/task-agent/save-conversation`       | שמירת שיחה                                 |
| GET    | `/api/task-agent/conversations`           | רשימת שיחות שמורות                         |
| GET    | `/api/task-agent/conversations/{id}`      | שליפת שיחה ספציפית                         |
| PATCH  | `/api/task-agent/conversations/{id}`      | עדכון הודעות שיחה                          |
| POST   | `/api/documents-agent/chat`               | שיחת streaming עם סוכן המסמכים (+ תמונות) |
| POST   | `/api/documents-agent/save-conversation`  | שמירת שיחה                                 |
| GET    | `/api/documents-agent/conversations`      | רשימת שיחות שמורות                         |
| GET    | `/api/documents-agent/conversations/{id}` | שליפת שיחה ספציפית                         |
| PATCH  | `/api/documents-agent/conversations/{id}` | עדכון הודעות שיחה                          |

### Telegram והתראות

| Method | Path                              | תיאור                                        |
| ------ | --------------------------------- | -------------------------------------------- |
| POST   | `/api/telegram/link-code`         | יצירת קוד קישור חשבון בן 6 ספרות            |
| POST   | `/api/telegram/webhook`           | webhook של הבוט (הודעות נכנסות)             |
| POST   | `/api/internal/notifications/run` | הפעלה ידנית של משימת ההתראות היומית         |
