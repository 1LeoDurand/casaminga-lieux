export default function ResidencesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div><div className="mc-skeleton h-5 w-32" /><div className="mc-skeleton mt-3 h-8 w-48" /><div className="mc-skeleton mt-3 h-4 w-full max-w-2xl" /></div>
      <div className="mc-kpi-grid">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="mc-stat"><div className="mc-skeleton h-7 w-12" /><div className="mc-skeleton mt-3 h-3 w-20" /></div>))}</div>
      <div className="mc-card p-[18px]"><div className="mc-skeleton h-10 w-full" /></div>
      <div className="mc-card"><div className="mc-skeleton h-64 w-full" /></div>
    </div>
  );
}
