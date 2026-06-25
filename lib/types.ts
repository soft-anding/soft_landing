export type City = 'jerusalem' | 'tel-aviv';
export type MovingWith = 'alone' | 'roommates' | 'couple' | 'family';
export type EmploymentStatus = 'employee' | 'self-employed' | 'student' | 'other';
export type Eligibility =
  | 'student'
  | 'discharged-soldier'
  | 'national-service'
  | 'reservist'
  | 'single-parent'
  | 'senior-citizen'
  | 'new-immigrant'
  | 'disability';

export interface UserProfile {
  originCity: string | null;
  destinationCity: City | null;
  estimatedMoveDate: string | null; // ISO date string
  hasSignedLease: boolean | null;
  rentingOrBuying: 'renting' | 'buying' | null;
  movingWith: MovingWith | null;
  isFirstApartment: boolean | null;
  hasCar: boolean | null;
  needsMovers: boolean | null;
  employmentStatus: EmploymentStatus | null;
  morningAvailability: boolean | null;
  eligibilityConsent: boolean;
  eligibilities: Eligibility[];
  currentStep: number;
  completedAt: string | null; // ISO date string
}

export interface ChecklistTask {
  id: string;
  title: string;
  description: string;
  category: 'bureaucracy' | 'rights' | 'services';
  stage: 'before-move' | 'move-day' | 'after-move';
  requiresBusinessHours: boolean;
  isDone: boolean;
}

export interface RightOrBenefit {
  id: string;
  title: string;
  description: string;
  cautionaryNote: string;
  requiredDocuments: string[];
  municipalityLink: string;
  relevantFor: City[];
}

export interface ServiceType {
  id: string;
  name: string;
  category: string;
  relevantFor: {
    firstApartment?: boolean;
    movingAlone?: boolean;
    hasCar?: boolean;
    hasRoommates?: boolean;
    isFamily?: boolean;
  };
}
