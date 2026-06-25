'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, saveProfile, getUserId } from '@/lib/storage';
import { profileQuestions } from '@/lib/profile-questions';
import { UserProfile } from '@/lib/types';
import ConversationScreen from '@/components/onboarding/ConversationScreen';

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    getUserId();
    const savedProfile = getProfile();
    setProfile(savedProfile);
    setCurrentStep(savedProfile.currentStep);
  }, []);

  const handleAnswer = (answer: unknown) => {
    if (!profile) return;

    const question = profileQuestions[currentStep];
    const updatedProfile: UserProfile = {
      ...profile,
      [question.profileKey]: answer,
      currentStep: currentStep + 1,
    };

    if (currentStep === profileQuestions.length - 1) {
      updatedProfile.completedAt = new Date().toISOString();
    }

    saveProfile(updatedProfile);
    setProfile(updatedProfile);
    setCurrentStep(updatedProfile.currentStep);

    if (updatedProfile.completedAt) {
      router.push('/dashboard');
    }
  };

  if (!profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-50">
        <p>טוען...</p>
      </div>
    );
  }

  if (currentStep >= profileQuestions.length) {
    return null;
  }

  const question = profileQuestions[currentStep];
  const visibleQuestions = profileQuestions.filter((q) => {
    if (!q.conditionalOn) return true;
    return q.conditionalOn.every((condition) => {
      const key = condition.key as keyof UserProfile;
      return profile[key] === condition.value;
    });
  });

  const questionIndex = visibleQuestions.findIndex((q) => q.id === question.id);
  const progress = ((questionIndex + 1) / visibleQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-surface-200">
        <div
          className="h-full bg-primary-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main content */}
      <ConversationScreen question={question} onAnswer={handleAnswer} />
    </div>
  );
}
