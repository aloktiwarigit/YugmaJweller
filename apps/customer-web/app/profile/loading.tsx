// apps/customer-web/app/profile/loading.tsx
export default function ProfileLoading(): JSX.Element {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 animate-pulse" role="status" aria-label="लोड हो रहा है">
      <div className="h-3 w-16 bg-border rounded mb-4" />
      <div className="h-8 w-40 bg-border rounded mb-8" />
      <div className="flex gap-4 border-b border-borderSubtle pb-2">
        {[80, 100, 80, 90].map((w, i) => (
          <div key={i} className="h-6 bg-border rounded" style={{ width: w }} />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-border rounded-lg" />
        ))}
      </div>
    </div>
  );
}
