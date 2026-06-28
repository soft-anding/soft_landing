import AppHeader from "../components/AppHeader";

// Infrastructure for the "מסמכים וטפסים" tab — empty for now, fleshed out later.
export default function DocumentsForms() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="pt-32 pb-xl px-gutter max-w-container-max mx-auto">
        <section className="mb-lg text-right">
          <h1 className="font-headline-lg text-headline-lg text-primary mb-xs leading-tight">
            מסמכים וטפסים
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            בקרוב יופיעו כאן המסמכים והטפסים הרלוונטיים למעבר שלך.
          </p>
        </section>
      </main>
    </div>
  );
}
