export default function CommunicationLoading() {
  return <div className="flex flex-col gap-6"><div><div className="mc-skeleton h-5 w-32" /><div className="mc-skeleton mt-3 h-8 w-48" /></div>{Array.from({ length: 3 }).map((_, i) => <div key={i} className="mc-card p-5"><div className="mc-skeleton h-5 w-3/4" /><div className="mc-skeleton mt-2 h-10 w-full" /></div>)}</div>;
}
