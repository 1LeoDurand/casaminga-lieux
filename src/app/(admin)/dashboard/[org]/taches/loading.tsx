export default function TachesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div><div className="mc-skeleton h-5 w-32" /><div className="mc-skeleton mt-3 h-8 w-48" /></div>
      <div className="mc-kpi-grid">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="mc-stat"><div className="mc-skeleton h-7 w-12" /><div className="mc-skeleton mt-3 h-3 w-20" /></div>))}</div>
      <div className="mc-kanban" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>{Array.from({ length: 3 }).map((_, i) => (<div key={i} className="mc-kanban-col"><div className="mc-skeleton h-5 w-24" /><div className="mc-skeleton h-20 w-full" /></div>))}</div>
    </div>
  );
}
