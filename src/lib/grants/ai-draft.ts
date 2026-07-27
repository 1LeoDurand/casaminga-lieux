import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { GrantOpportunity, OrgGrantProfile, DraftSection } from "./types";

/**
 * Assistance rédaction IA (Lot 12 P4) — génère un brouillon des parties
 * narratives d'un dossier de subvention à partir du profil du lieu et de
 * l'appel à projets. Le texte est un POINT DE DÉPART que le porteur relit
 * et personnalise — jamais envoyé tel quel.
 * (Libellés des sections : DRAFT_SECTIONS dans ./types — importable client.)
 *
 * Deux fournisseurs possibles, choisis par `AI_DRAFT_PROVIDER` :
 *   - "gemini" (défaut auto si GEMINI_API_KEY présent) : Google Gemini Flash,
 *     palier gratuit — idéal pour ce brouillon court.
 *   - "claude" : Anthropic (repli, ou si AI_DRAFT_PROVIDER=claude).
 * En "auto" (défaut), Gemini est préféré si sa clé existe, sinon Claude.
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

const SYSTEM_PROMPT = `Tu aides des tiers-lieux et associations françaises à rédiger leurs dossiers
de subvention. Tu écris en français, à la première personne du pluriel (« notre
association », « nous »). Tu n'inventes JAMAIS de faits, de chiffres ou de
partenariats : quand une information manque, tu insères un [crochet à compléter]
explicite. Longueur cible : 250 à 400 mots. Pas de titre, pas de liste à puces
sauf si la section s'y prête — un texte rédigé, prêt à coller dans un formulaire.`;

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

type Provider = "gemini" | "claude";

/** Construit le message utilisateur à partir du profil et de l'appel à projets. */
function buildUserPrompt(input: DraftInput): string {
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

  return `## Profil de la structure
${contextLines}

## Appel à projets visé
${oppLines}

## Tâche
${SECTION_INSTRUCTIONS[input.section]}`;
}

/** Décide du fournisseur selon la config et les clés disponibles. */
function pickProvider(): Provider | null {
  const forced = (process.env.AI_DRAFT_PROVIDER ?? "auto").toLowerCase();
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;

  if (forced === "gemini") return hasGemini ? "gemini" : null;
  if (forced === "claude") return hasClaude ? "claude" : null;
  // auto : Gemini d'abord (palier gratuit), sinon Claude.
  if (hasGemini) return "gemini";
  if (hasClaude) return "claude";
  return null;
}

/**
 * Google Gemini Flash via l'API REST (pas de SDK à installer). Palier gratuit.
 * `thinkingBudget: 0` désactive le raisonnement interne de Gemini 2.5 Flash —
 * sinon il consomme le budget de sortie et renvoie un texte vide.
 */
async function draftWithGemini(system: string, user: string): Promise<DraftResult> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY as string,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const status = res.status;
      console.error("draftWithGemini: HTTP", status, await res.text().catch(() => ""));
      if (status === 429) return { ok: false, error: "Assistant temporairement saturé — réessayez dans une minute." };
      return { ok: false, error: "L'assistant a rencontré une erreur. Réessayez." };
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      return { ok: false, error: "Demande bloquée par le filtre de sécurité. Reformulez le profil." };
    }

    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) return { ok: false, error: "Réponse vide — réessayez." };
    return { ok: true, text };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "L'assistant met trop de temps à répondre. Réessayez." };
    }
    console.error("draftWithGemini:", e);
    return { ok: false, error: "Erreur réseau. Réessayez." };
  } finally {
    clearTimeout(timeout);
  }
}

/** Anthropic Claude (repli). max_tokens serré : le brouillon fait 250-400 mots. */
async function draftWithClaude(system: string, user: string): Promise<DraftResult> {
  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
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
      console.error("draftWithClaude: API error", e.status, e.message);
      return { ok: false, error: "L'assistant a rencontré une erreur. Réessayez." };
    }
    console.error("draftWithClaude:", e);
    return { ok: false, error: "Erreur réseau. Réessayez." };
  }
}

export async function draftGrantSection(input: DraftInput): Promise<DraftResult> {
  const provider = pickProvider();
  if (!provider) {
    // Nommer la variable attendue : un message générique a déjà coûté un
    // aller-retour de configuration en production, la clé posée n'étant pas
    // celle que le code déployé savait lire.
    const forced = (process.env.AI_DRAFT_PROVIDER ?? "auto").toLowerCase();
    const attendu =
      forced === "gemini" ? "GEMINI_API_KEY"
      : forced === "claude" ? "ANTHROPIC_API_KEY"
      : "GEMINI_API_KEY ou ANTHROPIC_API_KEY";
    return {
      ok: false,
      error: `Assistant IA non configuré : ${attendu} absente de l'environnement du serveur.`,
    };
  }

  const user = buildUserPrompt(input);
  return provider === "gemini"
    ? draftWithGemini(SYSTEM_PROMPT, user)
    : draftWithClaude(SYSTEM_PROMPT, user);
}
