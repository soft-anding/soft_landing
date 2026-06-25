import { ServiceType } from '@/lib/types';

export const serviceTypes: ServiceType[] = [
  {
    id: 'movers',
    name: 'חברות הובלה',
    category: 'Transport',
    relevantFor: {
      hasCar: false,
    },
  },
  {
    id: 'internet',
    name: 'אינטרנט וטלפון',
    category: 'Utilities',
    relevantFor: {},
  },
  {
    id: 'electricity',
    name: 'חשמל',
    category: 'Utilities',
    relevantFor: {},
  },
  {
    id: 'water',
    name: 'מים וביוב',
    category: 'Utilities',
    relevantFor: {},
  },
  {
    id: 'gas',
    name: 'גז',
    category: 'Utilities',
    relevantFor: {},
  },
  {
    id: 'cleaning',
    name: 'שירותי ניקיון',
    category: 'Home Services',
    relevantFor: {
      firstApartment: true,
    },
  },
  {
    id: 'furniture',
    name: 'חנויות רהיטים',
    category: 'Home Goods',
    relevantFor: {
      firstApartment: true,
    },
  },
  {
    id: 'insurance',
    name: 'ביטוח דירה',
    category: 'Insurance',
    relevantFor: {},
  },
  {
    id: 'banking',
    name: 'עדכון כתובת בבנק',
    category: 'Finance',
    relevantFor: {},
  },
  {
    id: 'parking',
    name: 'חניה תושבים',
    category: 'Permits',
    relevantFor: {
      hasCar: true,
    },
  },
  {
    id: 'trash-collection',
    name: 'איסוף אשפה',
    category: 'Utilities',
    relevantFor: {},
  },
];

export function filterServicesForProfile(
  movingAlone: boolean,
  firstApartment: boolean,
  hasCar: boolean,
  hasRoommates: boolean,
  isFamily: boolean
): ServiceType[] {
  return serviceTypes.filter((service) => {
    if (service.relevantFor.movingAlone && !movingAlone) return false;
    if (service.relevantFor.firstApartment && !firstApartment) return false;
    if (service.relevantFor.hasCar && !hasCar) return false;
    if (service.relevantFor.hasRoommates && !hasRoommates) return false;
    if (
      typeof service.relevantFor.hasCar === 'undefined' &&
      typeof service.relevantFor.firstApartment === 'undefined' &&
      typeof service.relevantFor.movingAlone === 'undefined' &&
      typeof service.relevantFor.hasRoommates === 'undefined'
    ) {
      return true;
    }
    return true;
  });
}
