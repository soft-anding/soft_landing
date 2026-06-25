interface ProgressBarProps {
  progress: number;
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="bg-white rounded-lg p-md border border-surface-200">
      <div className="flex items-center justify-between mb-md">
        <span className="text-2xl font-bold text-primary-600">{Math.round(progress)}%</span>
        <h2 className="text-lg font-bold text-text-primary">התקדמות</h2>
      </div>
      <div className="w-full h-3 bg-surface-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-text-secondary mt-md text-right">
        אתה בדרך הנכונה! המשך להשלים את המשימות.
      </p>
    </div>
  );
}
