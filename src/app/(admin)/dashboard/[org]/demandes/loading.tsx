/** État de chargement (skeleton) du module Demandes. */
export default function DemandesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mc-skeleton h-5 w-40" />
        <div className="mc-skeleton mt-3 h-8 w-64" />
        <div className="mc-skeleton mt-3 h-4 w-full max-w-2xl" />
      </div>

      <div className="mc-kpi-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mc-stat">
            <div className="mc-skeleton h-7 w-12" />
            <div className="mc-skeleton mt-3 h-3 w-20" />
            <div className="mc-skeleton mt-2 h-3 w-16" />
          </div>
        ))}
      </div>

      <div className="mc-card p-[18px]">
        <div className="mc-skeleton h-10 w-full" />
        <div className="mc-skeleton mt-3 h-6 w-3/4" />
        <div className="mc-skeleton mt-2 h-6 w-2/3" />
      </div>

      <div className="mc-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <div className="mc-skeleton h-4 w-24" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="mc-skeleton h-9 flex-1" />
            <div className="mc-skeleton h-6 w-20" />
            <div className="mc-skeleton h-6 w-20" />
            <div className="mc-skeleton h-6 w-16" />
            <div className="mc-skeleton h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
