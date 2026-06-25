import { UserProfile, ChecklistTask } from './types';
import { checklistRules } from '@/data/checklist-rules';

export function generateChecklist(profile: UserProfile): ChecklistTask[] {
  const tasks: ChecklistTask[] = [];
  const seenIds = new Set<string>();

  for (const rule of checklistRules) {
    if (matchesConditions(profile, rule.conditions) && !seenIds.has(rule.task.id)) {
      tasks.push(rule.task);
      seenIds.add(rule.task.id);
    }
  }

  return tasks.sort((a, b) => {
    const stageOrder = { 'before-move': 0, 'move-day': 1, 'after-move': 2 };
    return stageOrder[a.stage] - stageOrder[b.stage];
  });
}

function matchesConditions(
  profile: UserProfile,
  conditions: Array<(p: UserProfile) => boolean>
): boolean {
  return conditions.every((condition) => condition(profile));
}

export function getProgressPercentage(
  tasks: ChecklistTask[],
  completedTaskIds: Set<string>
): number {
  if (tasks.length === 0) return 0;
  return Math.round((completedTaskIds.size / tasks.length) * 100);
}

export function getTasksByStage(
  tasks: ChecklistTask[],
  stage: 'before-move' | 'move-day' | 'after-move'
): ChecklistTask[] {
  return tasks.filter((task) => task.stage === stage);
}

export function getTasksByTimeRequirement(
  tasks: ChecklistTask[],
  requiresBusinessHours: boolean
): ChecklistTask[] {
  return tasks.filter((task) => task.requiresBusinessHours === requiresBusinessHours);
}
