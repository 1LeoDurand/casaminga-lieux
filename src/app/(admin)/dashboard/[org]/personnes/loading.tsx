/** État de chargement (skeleton) du module Personnes. */
export default function PersonnesLoading() {
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
        <div className="mc-skeleton mt-2 h-6 w-2/3" />
      </div>

      <div className="mc-cards-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mc-card p-4">
            <div className="flex items-center gap-3">
              <div className="mc-skeleton size-[42px] rounded-full" />
              <div className="flex-1">
                <div className="mc-skeleton h-4 w-3/4" />
                <div className="mc-skeleton mt-2 h-3 w-1/2" />
              </div>
            </div>
            <div className="mc-skeleton mt-4 h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
