// Mock data + in-memory API used only in demo mode (see demo.js).
// Shapes mirror the FastAPI responses so pages render identically.
import { STATUSES } from "./statusConfig";

const CATEGORY_LABELS = {
  government_registry: "ממשל וכתובת רשמית",
  municipal: "עיריית תל אביב-יפו",
  utilities: "חשבונות וספקי שירות",
  rights_general: "זכויות כלליות",
  arnona_general: "ארנונה",
  parking_permit: "תו חניה אזורי",
};

// Mutable in-session catalog so status/notes changes "persist" while previewing.
let ITEMS = [
  {
    item_type: "moving_task",
    item_id: 1,
    title_he: "שינוי כתובת במשרד הפנים",
    summary:
      "לאחר המעבר יש לעדכן את הכתובת ברשות האוכלוסין ולהדפיס ספח חדש לתעודת הזהות. ניתן לבצע אונליין או בלשכה.",
    category: "government_registry",
    category_label: CATEGORY_LABELS.government_registry,
    source_url: "https://www.gov.il/he/service/change-address",
    links: ["https://www.gov.il/he/service/change-address"],
    action_steps: [
      "להיכנס לאתר רשות האוכלוסין וההגירה",
      "למלא טופס שינוי כתובת",
      "להדפיס ספח מעודכן ולצרף לתעודת הזהות",
    ],
    eligibility_conditions: [],
    required_documents: ["תעודת זהות", "אישור על כתובת חדשה"],
    discount_amount: null,
    deadlines: "תוך 14 יום מהמעבר",
    status: "הושלם",
    notes: "בוצע אונליין",
    next_action: null,
  },
  {
    item_type: "moving_task",
    item_id: 2,
    title_he: "עדכון כתובת מול גופים ממשלתיים",
    summary: "עדכון הכתובת מול ביטוח לאומי, מס הכנסה וקופת חולים לפי הצורך.",
    category: "government_registry",
    category_label: CATEGORY_LABELS.government_registry,
    source_url: "https://www.gov.il/",
    links: ["https://www.gov.il/"],
    action_steps: ["לרשום רשימת גופים", "לעדכן כתובת בכל אחד"],
    eligibility_conditions: [],
    required_documents: [],
    discount_amount: null,
    deadlines: null,
    status: "בטיפול",
    notes: "",
    next_action: "להתקשר לקופת חולים",
  },
  {
    item_type: "moving_task",
    item_id: 3,
    title_he: "חילופי מחזיקים בארנונה",
    summary: "רישום השוכרת כמחזיקה בנכס מול עיריית תל אביב-יפו והעברת החיוב על שמה.",
    category: "municipal",
    category_label: CATEGORY_LABELS.municipal,
    source_url: "https://www.tel-aviv.gov.il/",
    links: ["https://www.tel-aviv.gov.il/"],
    action_steps: ["למלא טופס חילופי מחזיקים", "לצרף חוזה שכירות", "לצלם קריאת מונה ביום הכניסה"],
    eligibility_conditions: [],
    required_documents: ["חוזה שכירות", "צילום תעודת זהות"],
    discount_amount: null,
    deadlines: null,
    status: "בבדיקה",
    notes: "",
    next_action: null,
  },
  {
    item_type: "moving_task",
    item_id: 4,
    title_he: "פתיחת חשבון מים — מי אביבים",
    summary: "דיווח על מעבר ופתיחת חשבון מים על שם השוכרת, כולל קריאת מונה.",
    category: "utilities",
    category_label: CATEGORY_LABELS.utilities,
    source_url: "https://www.mei-avivim.co.il/",
    links: ["https://www.mei-avivim.co.il/"],
    action_steps: ["לצלם קריאת מונה מים", "לפתוח חשבון אונליין"],
    eligibility_conditions: [],
    required_documents: ["צילום מונה מים"],
    discount_amount: null,
    deadlines: null,
    status: "לא התחיל",
    notes: "",
    next_action: null,
  },
  {
    item_type: "moving_task",
    item_id: 5,
    title_he: "החלפת מחזיקים בחברת החשמל",
    summary: "פתיחת חשבון חשמל על שם השוכרת והעברת החיוב, כולל קריאת מונה ביום הכניסה.",
    category: "utilities",
    category_label: CATEGORY_LABELS.utilities,
    source_url: "https://www.iec.co.il/",
    links: ["https://www.iec.co.il/"],
    action_steps: ["לצלם מונה חשמל", "להתקשר/לפתוח חשבון אונליין"],
    eligibility_conditions: [],
    required_documents: [],
    discount_amount: null,
    deadlines: null,
    status: "ממתין לגורם חיצוני",
    notes: "מחכה לאישור בעל הדירה",
    next_action: null,
  },
  {
    item_type: "moving_task",
    item_id: 6,
    title_he: "בדיקת ספק גז ופתיחת חשבון",
    summary: "בדיקה שספק הגז מורשה, פתיחת חשבון וסגירת חשבון קודם אם צריך.",
    category: "utilities",
    category_label: CATEGORY_LABELS.utilities,
    source_url: "https://www.gov.il/",
    links: ["https://www.gov.il/"],
    action_steps: ["לבדוק רישיון ספק גז", "לפתוח חשבון"],
    eligibility_conditions: [],
    required_documents: [],
    discount_amount: null,
    deadlines: null,
    status: "דורש בדיקה",
    notes: "",
    next_action: null,
  },
  {
    item_type: "rights_item",
    item_id: 101,
    title_he: "הנחה בארנונה לסטודנטים",
    summary: "סטודנטים העומדים בתנאים עשויים להיות זכאים להנחה בארנונה. יש לבדוק זכאות מול העירייה.",
    category: "arnona_general",
    category_label: CATEGORY_LABELS.arnona_general,
    source_url: "https://www.tel-aviv.gov.il/arnona",
    links: ["https://www.tel-aviv.gov.il/arnona"],
    action_steps: [],
    eligibility_conditions: ["סטטוס סטודנט פעיל", "מגורים בנכס בתל אביב"],
    required_documents: ["אישור לימודים", "חוזה שכירות"],
    discount_amount: "עד 25% הנחה",
    deadlines: "להגיש עד סוף השנה הקלנדרית",
    status: "בבדיקה",
    notes: "",
    next_action: "להוציא אישור לימודים",
  },
  {
    item_type: "rights_item",
    item_id: 102,
    title_he: "הרשמה לדיגיתל",
    summary: "כרטיס תושב המקנה הטבות, הנחות ושירותים לתושבי תל אביב-יפו.",
    category: "rights_general",
    category_label: CATEGORY_LABELS.rights_general,
    source_url: "https://www.tel-aviv.gov.il/digitel",
    links: ["https://www.tel-aviv.gov.il/digitel"],
    action_steps: ["להירשם עם תעודת זהות וכתובת בעיר"],
    eligibility_conditions: ["תושב/ת רשום/ה בתל אביב-יפו"],
    required_documents: ["תעודת זהות עם ספח כתובת"],
    discount_amount: null,
    deadlines: null,
    status: "לא התחיל",
    notes: "",
    next_action: null,
  },
  {
    item_type: "rights_item",
    item_id: 103,
    title_he: "זכויות שוכרת — חוק השכירות",
    summary: "מידע על זכויות וחובות במסגרת חוזה שכירות: ערבויות, תיקונים ותשלומים מותרים.",
    category: "rights_general",
    category_label: CATEGORY_LABELS.rights_general,
    source_url: "https://www.kolzchut.org.il/",
    links: ["https://www.kolzchut.org.il/"],
    action_steps: [],
    eligibility_conditions: [],
    required_documents: [],
    discount_amount: null,
    deadlines: null,
    status: "לא רלוונטי",
    notes: "",
    next_action: null,
  },
  {
    item_type: "rights_item",
    item_id: 104,
    title_he: "תו חניה אזורי לתושבים",
    summary: "בקשה לתו חניה אזורי המאפשר חניה באזור המגורים. נדרש רישום כתושב/ת והצגת רכב על שמך.",
    category: "parking_permit",
    category_label: CATEGORY_LABELS.parking_permit,
    source_url: "https://www.tel-aviv.gov.il/parking",
    links: ["https://www.tel-aviv.gov.il/parking"],
    action_steps: ["לעדכן כתובת בספח", "להגיש בקשה לתו חניה אונליין"],
    eligibility_conditions: ["מגורים באזור", "רישיון רכב על שם המבקש/ת"],
    required_documents: ["רישיון רכב", "ספח תעודת זהות"],
    discount_amount: null,
    deadlines: null,
    status: "לא התחיל",
    notes: "",
    next_action: null,
  },
];

function computeCategories() {
  const counts = {};
  for (const it of ITEMS) counts[it.category] = (counts[it.category] || 0) + 1;
  return Object.entries(counts)
    .map(([slug, count]) => ({ slug, label_he: CATEGORY_LABELS[slug] || slug, count }))
    .sort((a, b) => b.count - a.count);
}

function computeProgress() {
  const by_status = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const it of ITEMS) by_status[it.status] = (by_status[it.status] || 0) + 1;
  const total = ITEMS.length;
  const completed = by_status["הושלם"] || 0;
  const tracked = ITEMS.filter((it) => it.status !== "לא התחיל").length;
  return {
    total,
    tracked,
    completed,
    completed_pct: total ? Math.round((completed / total) * 100) : 0,
    by_status,
  };
}

const delay = (v) => new Promise((r) => setTimeout(() => r(v), 150));

export const demoApi = {
  me: () => delay({ id: "demo-user", email: "demo@example.com" }),
  statuses: () => delay(STATUSES),
  categories: () => delay(computeCategories()),
  items: ({ category, type } = {}) =>
    delay(
      ITEMS.filter(
        (it) => (!category || it.category === category) && (!type || it.item_type === type)
      ).map((it) => ({ ...it }))
    ),
  progress: () => delay(computeProgress()),
  setStatus: (itemType, itemId, payload) => {
    const it = ITEMS.find(
      (x) => x.item_type === itemType && String(x.item_id) === String(itemId)
    );
    if (it) {
      it.status = payload.status;
      it.notes = payload.notes ?? null;
      it.next_action = payload.next_action ?? null;
    }
    return delay({ ...it });
  },

  setDeadline: (itemType, itemId, payload) => {
    const it = ITEMS.find(
      (x) => x.item_type === itemType && String(x.item_id) === String(itemId)
    );
    if (it) {
      it.deadline_type = payload.deadline_type ?? null;
      it.deadline_date = payload.deadline_date ?? null;
    }
    return delay({ ...it });
  },

  taskAgentChat: () =>
    delay({ reply: "זה מצב הדגמה — הסוכן עדיין לא מחובר כאן." }),
};
