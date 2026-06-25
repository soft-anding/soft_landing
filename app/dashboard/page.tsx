'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, getChecklistStatus, saveChecklistStatus } from '@/lib/storage';
import { UserProfile, ChecklistTask } from '@/lib/types';
import { generateChecklist, getProgressPercentage, getTasksByStage, getTasksByTimeRequirement } from '@/lib/checklist-engine';
import { rightsJerusalem } from '@/data/rights-jerusalem';
import { rightsTelAviv } from '@/data/rights-telaviv';
import ProgressBar from '@/components/dashboard/ProgressBar';
import ChecklistSection from '@/components/dashboard/ChecklistSection';
import RightsSection from '@/components/dashboard/RightsSection';
import ServicesSection from '@/components/dashboard/ServicesSection';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<ChecklistTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const savedProfile = getProfile();
    if (!savedProfile.completedAt) {
      router.push('/onboarding');
      return;
    }

    setProfile(savedProfile);
    const generatedTasks = generateChecklist(savedProfile);
    setTasks(generatedTasks);

    const checklistStatus = getChecklistStatus();
    const completed = new Set(Object.keys(checklistStatus).filter((key) => checklistStatus[key]));
    setCompletedTasks(completed);
    setProgress(getProgressPercentage(generatedTasks, completed));
  }, [router]);

  const handleTaskToggle = (taskId: string) => {
    const isCurrentlyDone = completedTasks.has(taskId);
    saveChecklistStatus(taskId, !isCurrentlyDone);

    const newCompleted = new Set(completedTasks);
    if (isCurrentlyDone) {
      newCompleted.delete(taskId);
    } else {
      newCompleted.add(taskId);
    }

    setCompletedTasks(newCompleted);
    setProgress(getProgressPercentage(tasks, newCompleted));
  };

  if (!profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-50">
        <p>טוען...</p>
      </div>
    );
  }

  const rights = profile.destinationCity === 'jerusalem' ? rightsJerusalem : rightsTelAviv;
  const beforeMoveTasks = getTasksByStage(tasks, 'before-move');
  const moveDayTasks = getTasksByStage(tasks, 'move-day');
  const afterMoveTasks = getTasksByStage(tasks, 'after-move');

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-200 p-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-primary-600 text-right">Soft Landing</h1>
          <p className="text-sm text-text-secondary text-right">
            עברה ל{profile.destinationCity === 'jerusalem' ? 'ירושלים' : 'תל אביב'}
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto p-md space-y-lg">
        {/* Progress */}
        <ProgressBar progress={progress} />

        {/* Timeline sections */}
        <div className="space-y-md">
          <ChecklistSection
            title="לפני ההנקלה"
            tasks={beforeMoveTasks}
            completedTasks={completedTasks}
            onTaskToggle={handleTaskToggle}
            isDaySection={false}
          />

          <ChecklistSection
            title="ביום ההנקלה"
            tasks={moveDayTasks}
            completedTasks={completedTasks}
            onTaskToggle={handleTaskToggle}
            isDaySection={true}
          />

          <ChecklistSection
            title="אחרי ההנקלה"
            tasks={afterMoveTasks}
            completedTasks={completedTasks}
            onTaskToggle={handleTaskToggle}
            isDaySection={false}
          />
        </div>

        {/* Rights and benefits */}
        {rights.length > 0 && <RightsSection rights={rights} />}

        {/* Services to check */}
        <ServicesSection profile={profile} />

        {/* Telegram reminders (mocked) */}
        <div className="bg-white rounded-lg p-md border border-surface-200">
          <h2 className="text-lg font-bold text-text-primary mb-md text-right">
            התזכוקות שלך בטלגרם
          </h2>
          <p className="text-text-secondary text-right text-sm mb-md">
            (כרגע מוקד ללא שליחה בפועל)
          </p>
          <div className="space-y-sm">
            <div className="p-sm bg-surface-50 rounded border-r-4 border-primary-300">
              <p className="text-sm text-text-secondary text-right">
                • תזכורת: בדוק תאום עם חברת ההובלה בעוד 3 ימים
              </p>
            </div>
            <div className="p-sm bg-surface-50 rounded border-r-4 border-primary-300">
              <p className="text-sm text-text-secondary text-right">
                • תזכורת: עדכן כתובת אצל חברות השירותים בעוד 7 ימים
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
