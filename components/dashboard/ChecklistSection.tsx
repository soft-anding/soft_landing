import { ChecklistTask } from '@/lib/types';

interface ChecklistSectionProps {
  title: string;
  tasks: ChecklistTask[];
  completedTasks: Set<string>;
  onTaskToggle: (taskId: string) => void;
  isDaySection: boolean;
}

export default function ChecklistSection({
  title,
  tasks,
  completedTasks,
  onTaskToggle,
  isDaySection,
}: ChecklistSectionProps) {
  if (tasks.length === 0) return null;

  const businessHoursTasks = tasks.filter((t) => t.requiresBusinessHours);
  const otherTasks = tasks.filter((t) => !t.requiresBusinessHours);

  return (
    <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
      <div className="bg-gradient-to-l from-primary-50 to-primary-100 p-md border-b border-surface-200">
        <h2 className="text-lg font-bold text-primary-700 text-right">{title}</h2>
      </div>

      <div className="p-md space-y-md">
        {/* Business hours section */}
        {businessHoursTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-text-secondary mb-sm text-right text-accent-600">
              🏢 בשעות עסקים
            </h3>
            <div className="space-y-xs">
              {businessHoursTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isCompleted={completedTasks.has(task.id)}
                  onToggle={() => onTaskToggle(task.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Other tasks section */}
        {otherTasks.length > 0 && (
          <div>
            {businessHoursTasks.length > 0 && (
              <h3 className="text-sm font-semibold text-text-secondary mb-sm text-right text-accent-600">
                🌙 בכל זמן
              </h3>
            )}
            <div className="space-y-xs">
              {otherTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isCompleted={completedTasks.has(task.id)}
                  onToggle={() => onTaskToggle(task.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskItem({
  task,
  isCompleted,
  onToggle,
}: {
  task: ChecklistTask;
  isCompleted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-start gap-md p-sm rounded-md transition-all text-right ${
        isCompleted
          ? 'bg-primary-50 opacity-60'
          : 'hover:bg-surface-50 bg-white'
      }`}
    >
      <div className="flex-1">
        <h4 className={`font-medium ${isCompleted ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
          {task.title}
        </h4>
        <p className="text-sm text-text-secondary">{task.description}</p>
      </div>
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
          isCompleted
            ? 'bg-primary-500 border-primary-500'
            : 'border-surface-300 hover:border-primary-400'
        }`}
      >
        {isCompleted && <span className="text-white text-sm">✓</span>}
      </div>
    </button>
  );
}
