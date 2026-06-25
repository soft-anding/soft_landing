export default function Spinner({ full = false }) {
  const spinner = (
    <div className="flex items-center gap-sm text-primary">
      <span className="material-symbols-outlined animate-spin">progress_activity</span>
      <span className="font-label-md">טוען…</span>
    </div>
  );
  if (!full) return spinner;
  return <div className="min-h-screen flex items-center justify-center">{spinner}</div>;
}
