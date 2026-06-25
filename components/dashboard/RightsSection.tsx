import { RightOrBenefit } from '@/lib/types';

interface RightsSectionProps {
  rights: RightOrBenefit[];
}

export default function RightsSection({ rights }: RightsSectionProps) {
  return (
    <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
      <div className="bg-gradient-to-l from-secondary-50 to-secondary-100 p-md border-b border-surface-200">
        <h2 className="text-lg font-bold text-secondary-700 text-right">זכויות וגמלאות</h2>
      </div>

      <div className="p-md space-y-md">
        {rights.map((right) => (
          <div
            key={right.id}
            className="border-r-4 border-secondary-300 pl-md pr-md py-sm bg-secondary-50 rounded"
          >
            <h3 className="font-bold text-text-primary text-right mb-sm">{right.title}</h3>
            <p className="text-sm text-text-secondary mb-md text-right leading-relaxed">
              {right.description}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-sm mb-md">
              <p className="text-xs text-yellow-900 text-right font-medium">⚠️ {right.cautionaryNote}</p>
            </div>
            <div className="mb-md">
              <p className="text-xs font-semibold text-text-secondary text-right mb-xs">
                מסמכים נדרשים:
              </p>
              <ul className="text-xs text-text-secondary text-right space-y-xs">
                {right.requiredDocuments.map((doc, idx) => (
                  <li key={idx}>• {doc}</li>
                ))}
              </ul>
            </div>
            <a
              href={right.municipalityLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-secondary-600 font-bold hover:text-secondary-700 underline"
            >
              עבור לאתר המוניציפליטה →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
