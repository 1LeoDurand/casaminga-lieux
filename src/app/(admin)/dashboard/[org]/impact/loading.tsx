export default function ImpactLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div><div className="mc-skeleton h-5 w-32" /><div className="mc-skeleton mt-3 h-8 w-48" /></div>
      <div className="mc-kpi-row">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="mc-card p-4"><div className="mc-skeleton h-7 w-16" /><div className="mc-skeleton mt-2 h-3 w-20" /></div>))}</div>
      <div className="mc-cards-grid">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="mc-card p-5"><div className="mc-skeleton h-8 w-2/3" /><div className="mc-skeleton mt-2 h-4 w-full" /></div>))}</div>
    </div>
  );
}
