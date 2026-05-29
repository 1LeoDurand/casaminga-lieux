"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarDays,
  Inbox,
  AlertTriangle,
  PenLine,
  Zap,
} from "lucide-react";

export interface TodayItem {
  key: string;
  icon: "resa" | "event" | "demande" | "alert" | "sign" | "task";
  iconBg: string;
  iconColor: string;
  num: React.ReactNode;
  extra?: string;
  label: string;
  warn?: boolean;
  /** segment réel à ouvrir, ou undefined → module à venir (toast). */
  segment?: string;
}

const ICONS = {
  resa: CalendarCheck,
  event: CalendarDays,
  demande: Inbox,
  alert: AlertTriangle,
  sign: PenLine,
  task: Zap,
} as const;

/**
 * Grille « Aujourd'hui » du tableau de bord (fidèle .today-grid).
 * Chaque tuile ouvre son module s'il existe, sinon annonce son arrivée.
 */
export function DashboardToday({
  orgSlug,
  items,
}: {
  orgSlug: string;
  items: TodayItem[];
}) {
  const router = useRouter();

  return (
    <div className="mc-today-grid">
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        const onClick = () => {
          if (it.segment) {
            router.push(`/dashboard/${orgSlug}/${it.segment}`);
          } else {
            toast.info(`« ${it.label} » — bientôt disponible`);
          }
        };
        return (
          <button
            key={it.key}
            type="button"
            className={`mc-today-it ${it.warn ? "warn" : ""}`}
            onClick={onClick}
          >
            <span
              className="mc-today-ic"
              style={{ background: it.iconBg, color: it.iconColor }}
            >
              <Icon className="size-[18px]" strokeWidth={1.8} />
            </span>
            <span className="mc-today-body block">
              <span className="mc-today-num block">
                {it.num}
                {it.extra ? <span className="mc-today-extra"> · {it.extra}</span> : null}
              </span>
              <span className="mc-today-lbl block">{it.label}</span>
            </span>
            <span className="mc-today-arrow">→</span>
          </button>
        );
      })}
    </div>
  );
}
