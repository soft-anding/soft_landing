export interface Question {
  id: string;
  text: string;
  type: 'text' | 'select' | 'checkbox' | 'date' | 'consent';
  options?: Array<{ label: string; value: string }>;
  profileKey: string;
  required?: boolean;
  conditionalOn?: { key: string; value: unknown }[];
}

export const profileQuestions: Question[] = [
  {
    id: 'origin-city',
    text: 'איזה עיר אתה עוזב?',
    type: 'text',
    profileKey: 'originCity',
    required: true,
  },
  {
    id: 'destination-city',
    text: 'לאיזו עיר אתה מתנקל? (כרגע תמיכה רק בירושלים ותל אביב)',
    type: 'select',
    profileKey: 'destinationCity',
    options: [
      { label: 'ירושלים', value: 'jerusalem' },
      { label: 'תל אביב', value: 'tel-aviv' },
    ],
    required: true,
  },
  {
    id: 'estimated-move-date',
    text: 'מתי משוער שתנקל?',
    type: 'date',
    profileKey: 'estimatedMoveDate',
    required: true,
  },
  {
    id: 'lease-signed',
    text: 'האם אתה כבר חתמת על חוזה או כתב הסכם?',
    type: 'select',
    profileKey: 'hasSignedLease',
    options: [
      { label: 'כן', value: 'true' },
      { label: 'לא', value: 'false' },
    ],
    required: true,
  },
  {
    id: 'renting-or-buying',
    text: 'האם אתה שוכר או קונה?',
    type: 'select',
    profileKey: 'rentingOrBuying',
    options: [
      { label: 'שוכר', value: 'renting' },
      { label: 'קונה', value: 'buying' },
    ],
    required: true,
  },
  {
    id: 'moving-with',
    text: 'עם מי אתה מתנקל?',
    type: 'select',
    profileKey: 'movingWith',
    options: [
      { label: 'לבדי', value: 'alone' },
      { label: 'עם שותפים לדירה', value: 'roommates' },
      { label: 'כזוג', value: 'couple' },
      { label: 'כמשפחה', value: 'family' },
    ],
    required: true,
  },
  {
    id: 'first-apartment',
    text: 'זו הדירה הראשונה שלך?',
    type: 'select',
    profileKey: 'isFirstApartment',
    options: [
      { label: 'כן', value: 'true' },
      { label: 'לא', value: 'false' },
    ],
    required: true,
  },
  {
    id: 'has-car',
    text: 'יש לך מכונית?',
    type: 'select',
    profileKey: 'hasCar',
    options: [
      { label: 'כן', value: 'true' },
      { label: 'לא', value: 'false' },
    ],
    required: true,
  },
  {
    id: 'needs-movers',
    text: 'האם אתה צריך משאית או חברת הובלה?',
    type: 'select',
    profileKey: 'needsMovers',
    options: [
      { label: 'כן', value: 'true' },
      { label: 'לא', value: 'false' },
    ],
    required: true,
  },
  {
    id: 'employment-status',
    text: 'מה הסטטוס התעסוקתי שלך?',
    type: 'select',
    profileKey: 'employmentStatus',
    options: [
      { label: 'עובד חברה', value: 'employee' },
      { label: 'עצמאי', value: 'self-employed' },
      { label: 'סטודנט', value: 'student' },
      { label: 'אחר', value: 'other' },
    ],
    required: true,
  },
  {
    id: 'morning-availability',
    text: 'האם אתה יכול להתאפס בבוקר לטיפול בעניינים ביורוקרטיים?',
    type: 'select',
    profileKey: 'morningAvailability',
    options: [
      { label: 'כן', value: 'true' },
      { label: 'לא', value: 'false' },
    ],
    required: true,
  },
  {
    id: 'eligibility-consent',
    text: 'האם אנחנו יכולים לבדוק את זכאותך לתגמולים וזכויות?',
    type: 'consent',
    profileKey: 'eligibilityConsent',
    required: false,
  },
  {
    id: 'eligibilities',
    text: 'בחר את כל הקטגוריות שחלות עליך:',
    type: 'checkbox',
    profileKey: 'eligibilities',
    options: [
      { label: 'סטודנט', value: 'student' },
      { label: 'שחרור מחובה צבאית', value: 'discharged-soldier' },
      { label: 'שירות לאומי', value: 'national-service' },
      { label: 'קצין ממילואים / חייל מילואים', value: 'reservist' },
      { label: 'הורה יחיד/ית', value: 'single-parent' },
      { label: 'אזרח בכיר/ית', value: 'senior-citizen' },
      { label: 'עולה/ת חדש/ה', value: 'new-immigrant' },
      {
        label: 'לקוי/ה / בעל/ת תאונת עבודה מוכר/ת',
        value: 'disability',
      },
    ],
    conditionalOn: [{ key: 'eligibilityConsent', value: true }],
  },
];
