export default function MediathequeLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div><div className="mc-skeleton h-5 w-32" /><div className="mc-skeleton mt-3 h-8 w-48" /></div>
      <div className="mc-cards-grid">{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="mc-card overflow-hidden"><div className="mc-skeleton aspect-video w-full" /><div className="p-4"><div className="mc-skeleton h-4 w-3/4" /></div></div>))}</div>
    </div>
  );
}
