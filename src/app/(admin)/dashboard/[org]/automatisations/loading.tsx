export default function AutomatisationsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div><div className="mc-skeleton h-5 w-32" /><div className="mc-skeleton mt-3 h-8 w-48" /></div>
      <div className="mc-kpi-grid">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="mc-stat"><div className="mc-skeleton h-7 w-12" /><div className="mc-skeleton mt-3 h-3 w-20" /></div>))}</div>
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="mc-card p-5"><div className="mc-skeleton h-5 w-2/3" /><div className="mc-skeleton mt-2 h-4 w-full" /></div>)}
    </div>
  );
}
