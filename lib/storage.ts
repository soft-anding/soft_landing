import { UserProfile } from './types';

const PROFILE_KEY = 'soft-landing:profile';
const USER_ID_KEY = 'soft-landing:user-id';
const CHECKLIST_KEY = 'soft-landing:checklist';

export function generateUserId(): string {
  // Simple UUID v4-like generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getUserId(): string {
  if (typeof window === 'undefined') return '';

  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateUserId();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

export function saveProfile(profile: Partial<UserProfile>): void {
  if (typeof window === 'undefined') return;

  const existing = getProfile();
  const updated = { ...existing, ...profile };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
}

export function getProfile(): UserProfile {
  if (typeof window === 'undefined') {
    return getDefaultProfile();
  }

  const stored = localStorage.getItem(PROFILE_KEY);
  if (!stored) return getDefaultProfile();

  try {
    return JSON.parse(stored);
  } catch {
    return getDefaultProfile();
  }
}

export function getDefaultProfile(): UserProfile {
  return {
    originCity: null,
    destinationCity: null,
    estimatedMoveDate: null,
    hasSignedLease: null,
    rentingOrBuying: null,
    movingWith: null,
    isFirstApartment: null,
    hasCar: null,
    needsMovers: null,
    employmentStatus: null,
    morningAvailability: null,
    eligibilityConsent: false,
    eligibilities: [],
    currentStep: 0,
    completedAt: null,
  };
}

export function clearProfile(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PROFILE_KEY);
}

export function saveChecklistStatus(taskId: string, isDone: boolean): void {
  if (typeof window === 'undefined') return;

  const existing = getChecklistStatus();
  existing[taskId] = isDone;
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(existing));
}

export function getChecklistStatus(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};

  const stored = localStorage.getItem(CHECKLIST_KEY);
  if (!stored) return {};

  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

export function clearChecklistStatus(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CHECKLIST_KEY);
}
