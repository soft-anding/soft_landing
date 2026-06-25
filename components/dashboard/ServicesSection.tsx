'use client';

import { UserProfile } from '@/lib/types';
import { serviceTypes } from '@/data/services';

interface ServicesSectionProps {
  profile: UserProfile;
}

export default function ServicesSection({ profile }: ServicesSectionProps) {
  const relevantServices = serviceTypes.filter((service) => {
    const movingAlone = profile.movingWith === 'alone';
    const isFamily = profile.movingWith === 'family';
    const hasRoommates = profile.movingWith === 'roommates';

    if (service.relevantFor.firstApartment && !profile.isFirstApartment) return false;
    if (service.relevantFor.hasCar && !profile.hasCar) return false;
    if (service.relevantFor.movingAlone && !movingAlone) return false;
    if (service.relevantFor.hasRoommates && !hasRoommates) return false;

    return true;
  });

  const servicesByCategory = relevantServices.reduce(
    (acc, service) => {
      if (!acc[service.category]) {
        acc[service.category] = [];
      }
      acc[service.category].push(service);
      return acc;
    },
    {} as Record<string, typeof relevantServices>
  );

  return (
    <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
      <div className="bg-gradient-to-l from-accent-50 to-accent-100 p-md border-b border-surface-200">
        <h2 className="text-lg font-bold text-accent-700 text-right">שירותים שכדאי לבדוק</h2>
      </div>

      <div className="p-md space-y-md">
        {Object.entries(servicesByCategory).map(([category, services]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-accent-600 mb-sm text-right">
              {category}
            </h3>
            <div className="grid grid-cols-1 gap-sm">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-accent-50 rounded p-sm border border-accent-200 hover:border-accent-400 transition-colors"
                >
                  <p className="text-sm text-text-primary font-medium text-right">{service.name}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-50 p-md border-t border-surface-200 text-center">
        <p className="text-xs text-text-secondary">
          💡 כאן תמצא רשימה של שירותים שכדאי לך לבדוק. לא מחיר ולא הוצאות, רק עזרה בעיבוד.
        </p>
      </div>
    </div>
  );
}
