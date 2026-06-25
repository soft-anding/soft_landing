'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile } from '@/lib/storage';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const profile = getProfile();
    if (profile.completedAt) {
      router.push('/dashboard');
    } else {
      router.push('/onboarding');
    }
  }, [router]);

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary-600 mb-2">
            Soft Landing
          </h1>
          <p className="text-text-secondary">טוען...</p>
        </div>
      </div>
    );
  }

  return null;
}
