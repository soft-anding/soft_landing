import { RightOrBenefit } from '@/lib/types';

export const rightsJerusalem: RightOrBenefit[] = [
  {
    id: 'arnona-discount-jerusalem',
    title: 'הנחה בארנונה לתושבים חדשים',
    description:
      'ייתכן שתהיה זכאי/ת להנחה על תשלום ארנונה בשנה הראשונה למגורים בירושלים',
    cautionaryNote:
      'אתה עלול להיות זכאי. בדוק עם עירייה הדרום. ההנחה תוגבלת לתנאים מסוימים.',
    requiredDocuments: ['תעודת הסכם השכרה או קנייה', 'תאית זיהוי', 'הוכחת רישום בירושלים'],
    municipalityLink: 'https://www.jerusalem.muni.il',
    relevantFor: ['jerusalem'],
  },
  {
    id: 'resident-parking-jerusalem',
    title: 'היתר חניה לתושבים',
    description: 'היתר חניה במקומות חניה ציבוריים מסומנים בירושלים',
    cautionaryNote:
      'אתה עלול להיות זכאי אם יש לך רכב. דרוש עדכון כתובת רישום רכב וביקור בנציגות.',
    requiredDocuments: [
      'רישיון נהיגה',
      'אישור רישום רכב',
      'הוכחת מגורים בירושלים',
      'תאית זיהוי',
    ],
    municipalityLink: 'https://www.jerusalem.muni.il/he/Residents/Residents-Parking',
    relevantFor: ['jerusalem'],
  },
  {
    id: 'municipal-services-jerusalem',
    title: 'שירותים בסיסיים למגורים חדשים',
    description: 'רישום לשירותי עירייה כגון גן ילדים, ספריות וחוגים',
    cautionaryNote:
      'שירותים אלו זמינים לכל התושבים החדשים. בידוק לרישום בספריות ומוקדים קהילתיים.',
    requiredDocuments: ['הוכחת מגורים בירושלים', 'תאית זיהוי'],
    municipalityLink: 'https://www.jerusalem.muni.il',
    relevantFor: ['jerusalem'],
  },
  {
    id: 'public-transportation-card-jerusalem',
    title: 'כרטיס תחבורה ציבורית',
    description: 'הנחות או מנויים לתחבורה ציבורית',
    cautionaryNote: 'אתה עלול להיות זכאי להנחה תלוי בסטטוס המעסוקה או הגיל שלך.',
    requiredDocuments: ['תאית זיהוי', 'אישור סטטוס (סטודנט וכו\')'],
    municipalityLink: 'https://www.egged.co.il',
    relevantFor: ['jerusalem'],
  },
];
