import Link from "next/link";

type Trend = "up" | "warn" | "flat";

/**
 * Tuile KPI fidèle au prototype (.kpi-tile) : pastille colorée + valeur +
 * légende + tendance. Devient cliquable si `href` est fourni.
 */
export function KpiTile({
  icon,
  iconBg,
  iconColor,
  value,
  caption,
  trend,
  trendTone = "flat",
  alert = false,
  href,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: React.ReactNode;
  caption: React.ReactNode;
  trend?: React.ReactNode;
  trendTone?: Trend;
  alert?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <div className="mc-kpi-ic" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="mc-kpi-body">
        <div className="mc-kpi-num">{value}</div>
        <div className="mc-kpi-cap">{caption}</div>
      </div>
      {trend ? (
        <div className={`mc-kpi-trend ${trendTone === "flat" ? "" : trendTone}`}>
          {trend}
        </div>
      ) : null}
    </>
  );

  const cls = `mc-kpi-tile ${alert ? "alert" : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
