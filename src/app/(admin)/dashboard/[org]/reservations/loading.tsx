/** État de chargement (skeleton) du module Réservations. */
export default function ReservationsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mc-skeleton h-5 w-32" />
        <div className="mc-skeleton mt-3 h-8 w-56" />
        <div className="mc-skeleton mt-3 h-4 w-full max-w-2xl" />
      </div>

      <div className="mc-kpi-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mc-stat">
            <div className="mc-skeleton h-7 w-12" />
            <div className="mc-skeleton mt-3 h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="mc-card p-[18px]">
        <div className="mc-skeleton h-10 w-full" />
        <div className="mc-skeleton mt-3 h-6 w-3/4" />
      </div>

      <div className="mc-kanban">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mc-kanban-col">
            <div className="mc-skeleton h-5 w-24" />
            <div className="mc-skeleton h-20 w-full" />
            <div className="mc-skeleton h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
