export default function Loading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Header skeleton */}
      <div className="px-8 py-6 border-b bg-background">
        <div className="h-6 w-40 rounded-md bg-muted" />
        <div className="h-4 w-56 rounded-md bg-muted mt-2" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 px-8 py-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-background p-5 h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-background h-64" />
          <div className="rounded-xl border bg-background h-64" />
        </div>
      </div>
    </div>
  );
}
