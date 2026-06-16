import "server-only";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from "docx";
import { periodLabel, formatDateFr, formatEuros, sectionLabel } from "./meta";
import type { CoordinationNote, NoteSections } from "./types";

const ACCENT = "E8643C"; // corail Casa Minga
const GRAY = "6B6B6B";

function h1(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 120 }, children: [new TextRun({ text, color: "2C2C2C", bold: true })] });
}
function h2(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [new TextRun({ text, color: ACCENT, bold: true })] });
}
function para(text: string, opts: { italic?: boolean; color?: string; bold?: boolean } = {}) {
  return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, italics: opts.italic, color: opts.color, bold: opts.bold })] });
}
function bullet(text: string) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun(text)] });
}
/** Paragraphes multi-lignes depuis un texte libre (préserve les sauts de ligne). */
function freeText(text: string | null): Paragraph[] {
  if (!text || !text.trim()) return [];
  return text.split(/\n/).map((line) => para(line));
}

function cell(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new TableCell({
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: opts.align, children: [new TextRun({ text, bold: opts.bold })] })],
  });
}
function simpleTable(header: string[], rows: string[][]): Table {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, { bold: true, align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, { align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT })) })),
    ],
  });
}

export async function generateNoteDocx(note: CoordinationNote, orgName: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  const sections = (note.sections ?? {}) as NoteSections;
  const snap = note.snapshot ?? {};

  // ── En-tête ──
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [new TextRun({ text: orgName, color: GRAY, bold: true })] }));
  children.push(h1(note.title));
  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({
      text: `Période : ${periodLabel(note.period_type, note.period_start, note.period_end)}  ·  ${formatDateFr(note.period_start)} – ${formatDateFr(note.period_end)}`,
      color: GRAY,
    })],
  }));

  // ── Introduction ──
  if (note.intro && note.intro.trim()) {
    children.push(h2("Introduction"));
    children.push(...freeText(note.intro));
  }

  // ── Bloc Finances ──
  if (sections.finances?.enabled && snap.finances) {
    const f = snap.finances;
    children.push(h2("Synthèse financière"));
    children.push(simpleTable(
      ["Indicateur", "Montant"],
      [
        ["Recettes", formatEuros(f.recettes)],
        ["Dépenses", formatEuros(f.depenses)],
        ["Solde net", formatEuros(f.solde)],
        ["Nombre d'écritures", String(f.count)],
      ],
    ));
    if (f.byCategory.length) {
      children.push(para("Détail par catégorie :", { bold: true, color: GRAY }));
      children.push(simpleTable(
        ["Catégorie", "Recettes", "Dépenses"],
        f.byCategory.map((c) => [c.category, formatEuros(c.recettes), formatEuros(c.depenses)]),
      ));
    }
    children.push(...freeText(sections.finances.commentary));
  }

  // ── Bloc Événements & Réservations ──
  if (sections.events?.enabled && snap.events) {
    const e = snap.events;
    children.push(h2("Événements & réservations"));
    children.push(para(`${e.events.length} événement(s) · ${e.reservations.length} réservation(s) d'espace sur la période.`, { color: GRAY }));
    if (e.events.length) {
      children.push(para("Événements :", { bold: true }));
      e.events.forEach((ev) => children.push(bullet(`${formatDateFr(ev.date)} — ${ev.title} (${ev.type}, ${ev.status})`)));
    }
    if (e.reservations.length) {
      children.push(para("Réservations d'espaces :", { bold: true }));
      e.reservations.forEach((r) => children.push(bullet(`${formatDateFr(r.date)} — ${r.title} (${r.status})${r.price ? ` — ${formatEuros(r.price)}` : ""}`)));
    }
    children.push(...freeText(sections.events.commentary));
  }

  // ── Bloc Résidences & Adhésions ──
  if (sections.residences?.enabled && snap.residences) {
    const r = snap.residences;
    children.push(h2("Résidences & adhésions"));
    if (r.residences.length) {
      children.push(para("Résidences :", { bold: true }));
      r.residences.forEach((res) => children.push(bullet(`${res.title} — ${res.discipline} (${res.status})${res.start ? `, du ${formatDateFr(res.start)}` : ""}${res.end ? ` au ${formatDateFr(res.end)}` : ""}`)));
    } else {
      children.push(para("Aucune résidence active sur la période.", { italic: true, color: GRAY }));
    }
    children.push(para(`Adhésions : ${r.adhesions.count} nouvelle(s) adhésion(s) — ${formatEuros(r.adhesions.total)} encaissés.`, { bold: true }));
    r.adhesions.newMembers.slice(0, 30).forEach((m) => children.push(bullet(`${formatDateFr(m.date)} — ${m.name}`)));
    children.push(...freeText(sections.residences.commentary));
  }

  // ── Bloc Impact, Dons & Subventions ──
  if (sections.impact?.enabled && snap.impact) {
    const i = snap.impact;
    children.push(h2("Impact, dons & subventions"));
    if (i.indicators.length) {
      children.push(para("Indicateurs d'impact :", { bold: true }));
      children.push(simpleTable(
        ["Indicateur", "Valeur"],
        i.indicators.map((ind) => [`${ind.label}${ind.period ? ` (${ind.period})` : ""}`, `${ind.value.toLocaleString("fr-FR")}${ind.unit ? ` ${ind.unit}` : ""}`]),
      ));
    }
    children.push(para(`Dons & mécénat : ${i.donations.count} don(s) confirmé(s) — ${formatEuros(i.donations.total)}.`, { bold: true }));
    i.donations.list.slice(0, 30).forEach((d) => children.push(bullet(`${formatDateFr(d.date)} — ${d.donor} : ${formatEuros(d.amount)} (${d.type})`)));
    if (i.grants.length) {
      children.push(para("Subventions en cours :", { bold: true }));
      children.push(simpleTable(
        ["Subvention", "Financeur", "Montant", "Reçu"],
        i.grants.map((g) => [g.title, g.funder, formatEuros(g.amount), formatEuros(g.received)]),
      ));
    }
    children.push(...freeText(sections.impact.commentary));
  }

  // ── Conclusion ──
  if (note.conclusion && note.conclusion.trim()) {
    children.push(h2("Conclusion"));
    children.push(...freeText(note.conclusion));
  }

  // ── Pied ──
  children.push(new Paragraph({
    spacing: { before: 360 },
    children: [new TextRun({ text: `Document généré le ${formatDateFr(new Date().toISOString().slice(0, 10))} — ${orgName}`, italics: true, color: GRAY, size: 18 })],
  }));

  void sectionLabel; // disponible pour évolutions

  const doc = new Document({
    creator: orgName,
    title: note.title,
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }],
  });

  return Packer.toBuffer(doc);
}
