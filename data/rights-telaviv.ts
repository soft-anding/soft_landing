import { RightOrBenefit } from '@/lib/types';

export const rightsTelAviv: RightOrBenefit[] = [
  {
    id: 'arnona-discount-telaviv',
    title: 'הנחה בארנונה לתושבים חדשים',
    description:
      'ייתכן שתהיה זכאי/ת להנחה או תשלומים מופחתים בתחילת השנה הראשונה',
    cautionaryNote: 'אתה עלול להיות זכאי בתנאים מסוימים. בדוק עם עירייה תל אביב-יפו.',
    requiredDocuments: ['הסכם שכרות או קנייה', 'תאית זיהוי', 'הוכחת רישום'],
    municipalityLink: 'https://www.tel-aviv.gov.il',
    relevantFor: ['tel-aviv'],
  },
  {
    id: 'resident-parking-telaviv',
    title: 'היתר חניה לתושבים בתל אביב',
    description: 'היתר חניה במקומות חניה ציבוריים בעיר',
    cautionaryNote:
      'דרוש לעדכן כתובת רישום רכב וביקור במוקד הרישום של העירייה. עשוי להיות תשלום.',
    requiredDocuments: ['רישיון נהיגה', 'אישור רישום רכב', 'הוכחת מגורים בתל אביב'],
    municipalityLink: 'https://www.tel-aviv.gov.il/residents/parking',
    relevantFor: ['tel-aviv'],
  },
  {
    id: 'public-transportation-telaviv',
    title: 'כרטיס רכיבה בתחבורה ציבורית',
    description: 'מנויים והנחות לאוטובוסים בתל אביב',
    cautionaryNote: 'זמין לכל התושבים. ייתכנו הנחות תלוי בסטטוס המעסוקה או הגיל.',
    requiredDocuments: ['תאית זיהוי'],
    municipalityLink: 'https://www.dan.co.il',
    relevantFor: ['tel-aviv'],
  },
  {
    id: 'municipal-services-telaviv',
    title: 'שירותי עירייה לתושבים חדשים',
    description: 'גישה לגנים, ספריות, חוגים והפעלויות קהילתיות',
    cautionaryNote:
      'זמינים לכל התושבים החדשים. רישום ניתן בצעות העירייה או בחנויות קהילתיות.',
    requiredDocuments: ['הוכחת מגורים', 'תאית זיהוי'],
    municipalityLink: 'https://www.tel-aviv.gov.il',
    relevantFor: ['tel-aviv'],
  },
];
