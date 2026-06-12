import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { GrantOpportunity, OrgGrantProfile, DraftSection } from "./types";

/**
 * Assistance rédaction IA (Lot 12 P4) — génère un brouillon des parties
 * narratives d'un dossier de subvention à partir du profil du lieu et de
 * l'appel à projets. Le texte est un POINT DE DÉPART que le porteur relit
 * et personnalise — jamais envoyé tel quel.
 * (Libellés des sections : DRAFT_SECTIONS dans ./types — importable client.)
 */

const SECTION_INSTRUCTIONS: Record<DraftSection, string> = {
  presentation: `Rédige la section « Présentation de la structure » du dossier.
Structure attendue : qui est la structure (statut, mission), son ancrage territorial,
ses activités principales, ses publics, et 2-3 éléments chiffrés si disponibles.
Ton institutionnel mais vivant — un agent instructeur doit comprendre en 30 secondes
ce que fait ce lieu et pourquoi il compte sur son territoire.`,
  projet: `Rédige la section « Description du projet » du dossier.
Structure attendue : contexte et besoin identifié, objectifs (2-3, concrets),
publics visés, actions prévues, et résultats attendus.
Appuie-toi sur le résumé de projet du profil ; si des éléments manquent,
insère des [crochets à compléter] plutôt que d'inventer des faits.`,
  adequation: `Rédige la section « Adéquation au dispositif » du dossier.
Montre point par point en quoi le projet répond aux thématiques et critères
de CET appel à projets précis (cite ses thématiques). Mets en avant les
correspondances réelles entre le profil de la structure et le dispositif —
sans survendre : un instructeur repère immédiatement les dossiers copiés-collés.`,
};

export interface DraftInput {
  section: DraftSection;
  opportunity: Pick<GrantOpportunity, "title" | "funder" | "description" | "themes" | "amount_min" | "amount_max">;
  profile: OrgGrantProfile | null;
  orgName: string;
  annualRevenue: number | null;
}

export type DraftResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function draftGrantSection(input: DraftInput): Promise<DraftResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Assistant IA non configuré (clé API manquante)." };
  }

  const client = new Anthropic();

  const p = input.profile;
  const contextLines = [
    `Nom de la structure : ${input.orgName}`,
    p?.structure_type ? `Type de structure : ${p.structure_type}` : null,
    p?.region ? `Région : ${p.region}` : null,
    p?.themes?.length ? `Thématiques d'action : ${p.themes.join(", ")}` : null,
    p?.annual_budget ? `Budget annuel déclaré : ${p.annual_budget} €` : null,
    input.annualRevenue ? `Recettes 12 derniers mois (comptabilité) : ${Math.round(input.annualRevenue)} €` : null,
    p?.project_summary ? `Résumé du projet (rédigé par la structure) :\n${p.project_summary}` : null,
  ].filter(Boolean).join("\n");

  const oppLines = [
    `Intitulé : ${input.opportunity.title}`,
    input.opportunity.funder ? `Financeur : ${input.opportunity.funder}` : null,
    input.opportunity.themes.length ? `Thématiques du dispositif : ${input.opportunity.themes.join(", ")}` : null,
    input.opportunity.amount_max ? `Montant max : ${input.opportunity.amount_max} €` : null,
    input.opportunity.description ? `Description du dispositif :\n${input.opportunity.description}` : null,
  ].filter(Boolean).join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: `Tu aides des tiers-lieux et associations françaises à rédiger leurs dossiers
de subvention. Tu écris en français, à la première personne du pluriel (« notre
association », « nous »). Tu n'inventes JAMAIS de faits, de chiffres ou de
partenariats : quand une information manque, tu insères un [crochet à compléter]
explicite. Longueur cible : 250 à 400 mots. Pas de titre, pas de liste à puces
sauf si la section s'y prête — un texte rédigé, prêt à coller dans un formulaire.`,
      messages: [{
        role: "user",
        content: `## Profil de la structure
${contextLines}

## Appel à projets visé
${oppLines}

## Tâche
${SECTION_INSTRUCTIONS[input.section]}`,
      }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) return { ok: false, error: "Réponse vide — réessayez." };
    return { ok: true, text };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Assistant temporairement saturé — réessayez dans une minute." };
    }
    if (e instanceof Anthropic.APIError) {
      console.error("draftGrantSection: API error", e.status, e.message);
      return { ok: false, error: "L'assistant a rencontré une erreur. Réessayez." };
    }
    console.error("draftGrantSection:", e);
    return { ok: false, error: "Erreur réseau. Réessayez." };
  }
}
