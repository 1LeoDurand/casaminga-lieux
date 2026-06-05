/**
 * Moteur de rendu newsletter → HTML email-safe (tables + inline styles).
 * Les emails n'acceptent pas flexbox/grid — on utilise des <table>.
 */

import type { NewsletterBlock } from "./types";
import type { Evenement } from "@/lib/types";

// ─── Palette ────────────────────────────────────────────────────────────────────
const CORAL = "#C75A38";
const CREAM = "#FAFAF5";
const INK   = "#1C1917";
const MUTED = "#78716C";
const BORDER = "#E8E3DC";
const WHITE  = "#FFFFFF";

// ─── Primitives HTML email-safe ─────────────────────────────────────────────────

function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Newsletter</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${WHITE};border-radius:12px;overflow:hidden;">
${content}
</table>
</td></tr>
</table>
</body>
</html>`;
}

function header(orgName: string, accentColor = CORAL): string {
  return `<tr><td style="background:${accentColor};padding:24px 32px;">
<p style="margin:0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:${WHITE};">${esc(orgName)}</p>
</td></tr>`;
}

function footer(orgName: string, unsubUrl: string): string {
  return `<tr><td style="background:${CREAM};padding:24px 32px;border-top:1px solid ${BORDER};">
<p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:${MUTED};text-align:center;line-height:1.6;">
Vous recevez ce message car vous êtes membre de <strong>${esc(orgName)}</strong>.<br/>
<a href="${unsubUrl}" style="color:${MUTED};text-decoration:underline;">Se désabonner</a>
</p>
</td></tr>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cell(content: string, paddingV = 20): string {
  return `<tr><td style="padding:${paddingV}px 32px;">${content}</td></tr>`;
}

function blockTexteHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((para) => {
    const lines = para.split("\n").map(esc).join("<br/>");
    return `<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:15px;line-height:1.7;color:${INK};">${lines}</p>`;
  }).join("");
  return cell(paragraphs);
}

function blockTitreHtml(text: string, level: 1 | 2): string {
  const size = level === 1 ? "22px" : "17px";
  const weight = "700";
  return cell(`<p style="margin:0;font-family:Georgia,serif;font-size:${size};font-weight:${weight};color:${INK};">${esc(text)}</p>`, 16);
}

function blockSepHtml(): string {
  return `<tr><td style="padding:8px 32px;"><hr style="border:none;border-top:1px solid ${BORDER};margin:0;"/></td></tr>`;
}

function blockImageHtml(url: string, alt: string, link?: string): string {
  const img = `<img src="${url}" alt="${esc(alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border-radius:8px;"/>`;
  const inner = link ? `<a href="${link}" style="display:block;">${img}</a>` : img;
  return `<tr><td style="padding:12px 32px;">${inner}</td></tr>`;
}

function blockBoutonHtml(text: string, url: string, accentColor = CORAL): string {
  return `<tr><td style="padding:16px 32px;text-align:center;">
<a href="${url}" style="display:inline-block;background:${accentColor};color:${WHITE};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:100px;">${esc(text)}</a>
</td></tr>`;
}

function blockEvenementsHtml(title: string, events: Evenement[], siteBase: string): string {
  if (events.length === 0) return "";
  const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const items = events.map((e) => {
    const start = new Date(e.start_at);
    const dateStr = `${dayFmt.format(start)} · ${timeFmt.format(start)}`;
    const price = e.price === null || e.price === 0 ? "Entrée libre" : `${e.price} €`;
    return `<tr>
<td style="padding:12px 0;border-bottom:1px solid ${BORDER};">
<p style="margin:0 0 2px;font-family:Georgia,serif;font-size:14px;font-weight:700;color:${INK};">${esc(e.title)}</p>
<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;color:${MUTED};">${esc(dateStr)} · ${esc(price)}</p>
${e.description ? `<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:${MUTED};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(e.description.slice(0, 90))}${e.description.length > 90 ? "…" : ""}</p>` : ""}
</td></tr>`;
  }).join("");

  return `<tr><td style="padding:20px 32px;">
<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:17px;font-weight:700;color:${INK};">${esc(title)}</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>
</td></tr>`;
}

function blockAdhesionHtml(title: string, campaigns: { name: string; url: string; price?: string }[]): string {
  if (campaigns.length === 0) return "";
  const items = campaigns.map((c) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${BORDER};">
<p style="margin:0 0 4px;font-family:Georgia,serif;font-size:14px;font-weight:700;color:${INK};">${esc(c.name)}</p>
${c.price ? `<p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:12px;color:${MUTED};">${esc(c.price)}</p>` : ""}
<a href="${c.url}" style="display:inline-block;background:${CORAL};color:${WHITE};font-family:Arial,sans-serif;font-size:12px;font-weight:700;text-decoration:none;padding:6px 16px;border-radius:100px;">Adhérer</a>
</td></tr>`).join("");

  return `<tr><td style="padding:20px 32px;">
<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:17px;font-weight:700;color:${INK};">${esc(title)}</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>
</td></tr>`;
}

function blockEspacesHtml(title: string, spaces: { name: string; type: string; description?: string | null }[]): string {
  if (spaces.length === 0) return "";
  const items = spaces.map((s) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid ${BORDER};">
<p style="margin:0 0 2px;font-family:Georgia,serif;font-size:14px;font-weight:700;color:${INK};">${esc(s.name)}</p>
<p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:${MUTED};">${esc(s.type)}${s.description ? " · " + esc(s.description.slice(0, 80)) : ""}</p>
</td></tr>`).join("");

  return `<tr><td style="padding:20px 32px;">
<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:17px;font-weight:700;color:${INK};">${esc(title)}</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>
</td></tr>`;
}

// ─── Interface du renderer ──────────────────────────────────────────────────────

export interface RenderContext {
  orgName: string;
  orgSlug: string;
  accentColor?: string;
  siteBase: string;        // ex. "https://admin.casaminga.com"
  unsubscribeUrl: string;  // URL complète de désinscription
  events: Evenement[];
  campaigns: { id: string; title: string; slug: string; tiers: { amount: number }[] }[];
  spaces: { id: string; name: string; type: string; description: string | null }[];
}

export function renderNewsletterHtml(
  blocks: NewsletterBlock[],
  ctx: RenderContext
): string {
  const accent = ctx.accentColor || CORAL;
  const siteUrl = `${ctx.siteBase}/site/${ctx.orgSlug}`;

  const rows = blocks.map((block): string => {
    switch (block.type) {
      case "texte":
        return blockTexteHtml(block.content);

      case "titre":
        return blockTitreHtml(block.text, block.level);

      case "separateur":
        return blockSepHtml();

      case "image":
        return blockImageHtml(block.url, block.alt, block.link);

      case "bouton":
        return blockBoutonHtml(block.text, block.url, accent);

      case "evenements": {
        const evts = ctx.events.slice(0, block.count);
        return blockEvenementsHtml(block.title, evts, siteUrl);
      }

      case "adhesion": {
        const camps = block.campaign_id
          ? ctx.campaigns.filter((c) => c.id === block.campaign_id)
          : ctx.campaigns;
        const mapped = camps.map((c) => {
          const amounts = c.tiers.map((t) => Number(t.amount));
          const min = amounts.length ? Math.min(...amounts) : null;
          const max = amounts.length ? Math.max(...amounts) : null;
          const price = amounts.length === 0 ? undefined
            : min === max ? `${min} €`
            : `de ${min} € à ${max} €`;
          return {
            name: c.title,
            url: `${siteUrl}/adhesion/${c.slug}`,
            price,
          };
        });
        return blockAdhesionHtml(block.title, mapped);
      }

      case "espaces": {
        const sps = ctx.spaces.slice(0, block.count);
        return blockEspacesHtml(block.title, sps);
      }

      default:
        return "";
    }
  }).join("\n");

  const body = header(ctx.orgName, accent) + rows + footer(ctx.orgName, ctx.unsubscribeUrl);
  return wrap(body);
}
