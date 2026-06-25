import { UserProfile, ChecklistTask } from '@/lib/types';

export interface ChecklistRule {
  conditions: Array<(p: UserProfile) => boolean>;
  task: ChecklistTask;
}

export const checklistRules: ChecklistRule[] = [
  // Universal tasks - everyone needs these
  {
    conditions: [(p) => p.destinationCity !== null],
    task: {
      id: 'register-with-municipality',
      title: 'התחיל בהליכי הרישום בעירייה',
      description: 'ליצור קשר עם הרשות המקומית בעיר החדשה שלך',
      category: 'bureaucracy',
      stage: 'before-move',
      requiresBusinessHours: true,
      isDone: false,
    },
  },
  {
    conditions: [(p) => p.rentingOrBuying === 'renting'],
    task: {
      id: 'contact-landlord',
      title: 'ליצור קשר עם הבעלים / חברת ניהול הנכסים',
      description: 'לוודא תנאי כניסה, הוצאה וטופס מעבר',
      category: 'bureaucracy',
      stage: 'before-move',
      requiresBusinessHours: false,
      isDone: false,
    },
  },
  {
    conditions: [(p) => p.rentingOrBuying === 'buying'],
    task: {
      id: 'finalize-purchase',
      title: 'סגור עסקה עם רו"ח ובנק',
      description: 'ודא שכל המסמכים מובנים ועתידים לחתימה',
      category: 'bureaucracy',
      stage: 'before-move',
      requiresBusinessHours: true,
      isDone: false,
    },
  },
  {
    conditions: [(p) => p.hasCar === true && p.destinationCity === 'jerusalem'],
    task: {
      id: 'resident-parking-permit-jm',
      title: 'דרישת היתר חניה תושבים בירושלים',
      description: 'עדכון כתובת רכב וקבלת היתר חניה עירוני',
      category: 'rights',
      stage: 'before-move',
      requiresBusinessHours: true,
      isDone: false,
    },
  },
  {
    conditions: [(p) => p.hasCar === true && p.destinationCity === 'tel-aviv'],
    task: {
      id: 'resident-parking-permit-ta',
      title: 'דרישת היתר חניה תושבים בתל אביב',
      description: 'עדכון כתובת רכב וקבלת היתר חניה עירוני',
      category: 'rights',
      stage: 'before-move',
      requiresBusinessHours: true,
      isDone: false,
    },
  },
  {
    conditions: [(p) => p.needsMovers === true],
    task: {
      id: 'schedule-movers',
      title: 'לתאם עם חברת הובלה',
      description: 'להזמין משאית, לספר מידות דירה וזמנים',
      category: 'services',
      stage: 'before-move',
      requiresBusinessHours: false,
      isDone: false,
    },
  },
  {
    conditions: [(p) => true],
    task: {
      id: 'update-address-utilities',
      title: 'עדכון כתובת אצל חברות השירותים',
      description: 'חשמל, מים, גז, טלפון, אינטרנט',
      category: 'services',
      stage: 'before-move',
      requiresBusinessHours: true,
      isDone: false,
    },
  },
  {
    conditions: [(p) => true],
    task: {
      id: 'notify-bank',
      title: 'עדכון כתובת בבנק ובחברות ביטוח',
      description: 'כרטיס אשראי, חשבון בנק, ביטוח',
      category: 'bureaucracy',
      stage: 'before-move',
      requiresBusinessHours: true,
      isDone: false,
    },
  },
  {
    conditions: [(p) => p.isFirstApartment === true],
    task: {
      id: 'furniture-planning',
      title: 'תכנון רהיטים וציוד למטבח',
      description: 'רשימה של מה שצריך, תקציב וקניה',
      category: 'services',
      stage: 'before-move',
      requiresBusinessHours: false,
      isDone: false,
    },
  },
  {
    conditions: [(p) => p.movingWith === 'alone' || p.movingWith === 'couple'],
    task: {
      id: 'cleaning-supplies',
      title: 'קנות חומרי ניקיון וכלים',
      description: 'ציוד לניקיון הדירה החדשה',
      category: 'services',
      stage: 'before-move',
      requiresBusinessHours: false,
      isDone: false,
    },
  },
  {
    conditions: [(p) => true],
    task: {
      id: 'pack-items',
      title: 'אריזת פריטים',
      description: 'תכנון וארגון אריזה של כל החפצים',
      category: 'services',
      stage: 'before-move',
      requiresBusinessHours: false,
      isDone: false,
    },
  },
  {
    conditions: [(p) => true],
    task: {
      id: 'confirm-movers-appointment',
      title: 'אישור פרטי ביום ההנקלה',
      description: 'יצירת קשר סופית עם הובילים ופתיחת בניין',
      category: 'services',
      stage: 'move-day',
      requiresBusinessHours: false,
      isDone: false,
    },
  },
  {
    conditions: [(p) => true],
    task: {
      id: 'transfer-utilities',
      title: 'הפעלת שירותים בדירה החדשה',
      description: 'וידוא שחשמל, מים וגז עובדים',
      category: 'services',
      stage: 'move-day',
      requiresBusinessHours: false,
      isDone: false,
    },
  },
  {
    conditions: [(p) => true],
    task: {
      id: 'register-address',
      title: 'ליצור קשר עם הרשות המקומית לרישום כתובת',
      description: 'חדשות כתובת בתאית לתיקיית אזרח',
      category: 'bureaucracy',
      stage: 'after-move',
      requiresBusinessHours: true,
      isDone: false,
    },
  },
  {
    conditions: [(p) => true],
    task: {
      id: 'update-id-documents',
      title: 'עדכון תאית וזיהוי',
      description: 'עדכון כתובת בתאית הזהות בדואר',
      category: 'bureaucracy',
      stage: 'after-move',
      requiresBusinessHours: false,
      isDone: false,
    },
  },
  {
    conditions: [(p) => p.hasCar === true],
    task: {
      id: 'update-car-registration',
      title: 'עדכון רישום רכב',
      description: 'יצירת קשר עם משרד התחבורה לעדכון רישום',
      category: 'bureaucracy',
      stage: 'after-move',
      requiresBusinessHours: true,
      isDone: false,
    },
  },
  {
    conditions: [(p) => p.employmentStatus === 'self-employed'],
    task: {
      id: 'notify-tax-authority',
      title: 'עדכון כתובת במס הכנסה',
      description: 'אם אתה עצמאי, עדכן את כתובתך במס',
      category: 'bureaucracy',
      stage: 'after-move',
      requiresBusinessHours: true,
      isDone: false,
    },
  },
  {
    conditions: [(p) => p.isFirstApartment === true],
    task: {
      id: 'first-apartment-survey',
      title: 'עשה סיור בדירה וזה מהו חדש',
      description: 'בדוק מצב דירה, מיקום פאנלים, מעגלים חשמליים',
      category: 'services',
      stage: 'after-move',
      requiresBusinessHours: false,
      isDone: false,
    },
  },
];
