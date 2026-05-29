export function PageHeader({
  tag,
  title,
  sub,
  actions,
}: {
  tag?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="min-w-[240px] flex-1">
        {tag ? <div className="mc-page-tag">{tag}</div> : null}
        <h1 className="mc-page-title">{title}</h1>
        {sub ? <p className="mc-page-sub mt-1">{sub}</p> : null}
      </div>
      {actions ? <div className="mc-quickbar">{actions}</div> : null}
    </div>
  );
}
