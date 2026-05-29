import type { RequestStatus } from "@/lib/types";

const STATUS_META: Record<RequestStatus, { label: string; className: string }> = {
  nouvelle: { label: "Nouvelle", className: "bg-turquoise/20 text-[#0369a1]" },
  etudier: { label: "À étudier", className: "bg-golden/25 text-[#92400e]" },
  attente: { label: "En attente", className: "bg-peach/30 text-coral-dark" },
  validee: { label: "Validée", className: "bg-mint/25 text-[#15803d]" },
  refusee: { label: "Refusée", className: "bg-coral/20 text-coral-dark" },
  archivee: { label: "Archivée", className: "bg-muted text-warmgray" },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.nouvelle;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
