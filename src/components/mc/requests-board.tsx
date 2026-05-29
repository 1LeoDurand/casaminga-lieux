"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/mc/status-badge";
import { setRequestStatus } from "@/app/(admin)/dashboard/[org]/demandes/actions";
import {
  SELECTABLE_STATUSES,
  priorityMeta,
  requestTypeLabel,
} from "@/lib/requests-meta";
import type { IncomingRequest, RequestStatus } from "@/lib/types";

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PriorityBadge({ priority }: { priority: string }) {
  const meta = priorityMeta(priority);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export function RequestsBoard({
  requests,
  orgSlug,
}: {
  requests: IncomingRequest[];
  orgSlug: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  function apply(id: string, status: RequestStatus, successLabel: string) {
    startTransition(async () => {
      const { ok } = await setRequestStatus(orgSlug, id, status);
      if (ok) toast.success(successLabel);
      else toast.error("Action impossible. Réessayez.");
    });
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-peach bg-peach-pale/40 px-6 py-16 text-center text-sm text-muted-foreground">
        Aucune demande pour le moment. Les messages envoyés depuis le site public
        apparaîtront ici.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="divide-y divide-border">
          {requests.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-peach-pale/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <StatusBadge status={r.status} />
                  <PriorityBadge priority={r.priority} />
                  <span className="rounded-full bg-peach-pale px-2 py-0.5 text-[11px] font-semibold text-coral-dark">
                    {requestTypeLabel(r.type)}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {r.summary ?? r.message}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {r.email}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDate(r.received_at)}
                </span>
                <span className="text-xs font-semibold text-coral-dark">
                  Voir détail →
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setSelectedId(null)}
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto bg-cream p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <PriorityBadge priority={selected.priority} />
                </div>
                <h2 className="mt-2 font-heading text-xl font-bold">
                  {selected.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {requestTypeLabel(selected.type)} ·{" "}
                  {formatDate(selected.received_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-peach-pale"
              >
                <X className="size-5" />
              </button>
            </div>

            <dl className="grid gap-2 rounded-xl bg-white p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate font-medium">{selected.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Téléphone</dt>
                <dd className="font-medium">{selected.phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Structure</dt>
                <dd className="truncate font-medium">
                  {selected.organization_ext ?? "—"}
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Message
              </h3>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed">
                {selected.message ?? "—"}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Changer le statut
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {SELECTABLE_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    disabled={pending || selected.status === s.value}
                    onClick={() =>
                      apply(selected.id, s.value, `Statut : ${s.label}`)
                    }
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:border-coral hover:text-coral-dark disabled:opacity-40"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto flex gap-3 border-t border-border pt-4">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  apply(selected.id, "validee", "Demande marquée comme traitée")
                }
                className="flex-1 rounded-lg bg-coral px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-dark disabled:opacity-60"
              >
                Marquer traitée
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  apply(selected.id, "archivee", "Demande archivée")
                }
                className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-warmgray transition-colors hover:bg-peach-pale disabled:opacity-60"
              >
                Archiver
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
