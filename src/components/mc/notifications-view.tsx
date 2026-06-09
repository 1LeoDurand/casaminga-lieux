"use client";

import { useTransition } from "react";
import { Bell, CheckCheck, ExternalLink, Info, AlertCircle, FileText, Calendar, ClipboardList } from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "@/app/(admin)/dashboard/[org]/notifications/actions";

export interface AppNotification {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  nouvelle_demande: <ClipboardList className="size-4 text-coral" />,
  facture_retard:   <FileText className="size-4 text-amber-500" />,
  inscription_event:<Calendar className="size-4 text-sky-500" />,
  tache_assignee:   <CheckCheck className="size-4 text-emerald-500" />,
  system:           <Info className="size-4 text-warmgray" />,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function NotificationsView({
  notifications,
  orgSlug,
  orgId,
}: {
  notifications: AppNotification[];
  orgSlug: string;
  orgId: string;
}) {
  const [, start] = useTransition();

  const unread = notifications.filter((n) => !n.read_at);
  const read   = notifications.filter((n) => !!n.read_at);

  function handleMarkRead(id: string) {
    start(() => markNotificationRead(id, orgSlug));
  }

  function handleMarkAllRead() {
    start(() => markAllNotificationsRead(orgId, orgSlug));
  }

  if (notifications.length === 0) {
    return (
      <div className="mc-card flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Bell className="size-10 text-warmgray/40" />
        <p className="font-heading text-base font-bold text-foreground">Aucune notification</p>
        <p className="text-sm text-warmgray">Les alertes apparaîtront ici : nouvelles demandes, factures en retard, tâches assignées…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {unread.length > 0 && (
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-warmgray">
            Non lues ({unread.length})
          </h2>
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-coral hover:underline"
          >
            <CheckCheck className="size-3.5" /> Tout marquer comme lu
          </button>
        </div>
      )}

      {unread.map((n) => (
        <NotifCard key={n.id} notif={n} onRead={() => handleMarkRead(n.id)} />
      ))}

      {read.length > 0 && (
        <>
          <h2 className="mt-2 font-heading text-sm font-bold uppercase tracking-wider text-warmgray">Lues</h2>
          {read.map((n) => (
            <NotifCard key={n.id} notif={n} onRead={() => handleMarkRead(n.id)} dimmed />
          ))}
        </>
      )}
    </div>
  );
}

function NotifCard({ notif, onRead, dimmed = false }: { notif: AppNotification; onRead: () => void; dimmed?: boolean }) {
  return (
    <div className={`mc-card flex items-start gap-4 p-4 transition ${dimmed ? "opacity-60" : "border-coral/30 bg-peach-pale/40"}`}>
      <div className="mt-0.5 shrink-0">
        {TYPE_ICON[notif.type] ?? <AlertCircle className="size-4 text-warmgray" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${dimmed ? "text-warmgray" : "text-foreground"}`}>{notif.title}</p>
        {notif.body && <p className="mt-0.5 text-[13px] text-warmgray">{notif.body}</p>}
        <p className="mt-1 text-[11px] text-warmgray/70">{fmtDate(notif.created_at)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {notif.link && (
          <a href={notif.link} className="flex items-center gap-1 text-[11px] text-coral hover:underline">
            <ExternalLink className="size-3" /> Voir
          </a>
        )}
        {!notif.read_at && (
          <button onClick={onRead} className="text-[11px] text-warmgray hover:text-coral">Marquer lu</button>
        )}
      </div>
    </div>
  );
}
