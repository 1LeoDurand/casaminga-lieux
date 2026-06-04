import Link from "next/link";
import Image from "next/image";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const DEMO_SLUG = "bernard-kohn";

/** Récupère le slug du premier org de l'utilisateur connecté, ou null. */
async function getUserDashboardSlug(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("organization_members")
      .select("organizations(slug)")
      .eq("user_id", user.id)
      .eq("status", "actif")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const org = data?.organizations as unknown as { slug: string } | null;
    return org?.slug ?? null;
  } catch {
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────
function Eyebrow({ children, variant = "coral" }: { children: React.ReactNode; variant?: "coral" | "mint" | "blue" | "gold" | "white" }) {
  const cls = {
    coral: "bg-[#FFF0EB] text-[#E8714D] border-[#FFB4A2]",
    mint:  "bg-[#E8F3E9] text-[#2f8a4c] border-[#bfe0c5]",
    blue:  "bg-[#E6F4F7] text-[#0e6e7a] border-[#B3D4DE]",
    gold:  "bg-[#FFF8E0] text-[#a06800] border-[#FFE4A8]",
    white: "bg-white/10 text-white border-white/20",
  }[variant];
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest mb-4 ${cls}`}>
      {children}
    </div>
  );
}

export default async function LandingPage() {
  // Vérifie si l'utilisateur est déjà connecté pour adapter la nav
  const userOrgSlug = await getUserDashboardSlug();

  return (
    <main style={{ fontFamily: "'Poppins', sans-serif", background: "#FFFBF0", color: "#2C2C2C" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ══ NAV ══ */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,251,240,0.92)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,180,162,0.28)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", gap: 32 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, fontWeight: 800, fontSize: 17, color: "#2C2C2C", textDecoration: "none" }}>
            <img src="/logo.png" alt="Casa Minga Lieux" style={{ width: 36, height: 36, objectFit: "contain" }} />
            Casa Minga Lieux
          </Link>
          <div className="lp-nav-cta">
            {userOrgSlug ? (
              /* Utilisateur connecté → bouton retour dashboard */
              <Link href={`/dashboard/${userOrgSlug}`} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#fff", textDecoration: "none", borderRadius: 100, background: "#FF8A65" }}>
                Mon dashboard →
              </Link>
            ) : (
              /* Non connecté → liens classiques */
              <>
                <Link href="/login" style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#2C2C2C", textDecoration: "none", borderRadius: 100, border: "1.5px solid #E5DDD6", background: "#fff" }}>Connexion</Link>
                <Link href={`/dashboard/${DEMO_SLUG}`} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#fff", textDecoration: "none", borderRadius: 100, background: "#FF8A65" }}>Voir le dashboard démo →</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ══ 1. HERO ══ */}
      <header style={{ padding: "clamp(40px,7vw,80px) 0 clamp(60px,8vw,96px)", position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
          <div className="lp-hero-grid">
            <div>
              <Eyebrow>★ Le système de pilotage des tiers-lieux &amp; lieux collectifs</Eyebrow>
              <h1 style={{ fontSize: "clamp(36px,5.4vw,60px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: -1, marginBottom: 20 }}>
                Le <span style={{ background: "linear-gradient(180deg, transparent 62%, rgba(255,138,101,0.28) 62%, rgba(255,138,101,0.28) 92%, transparent 92%)", padding: "0 4px" }}>système de pilotage</span><br />des tiers-lieux et lieux collectifs.
              </h1>
              <p style={{ fontSize: "clamp(15px,1.7vw,18.5px)", color: "#6B6460", lineHeight: 1.65, marginBottom: 30, maxWidth: "58ch" }}>
                Casa Minga Lieux relie votre site public, vos demandes, vos espaces, vos événements, vos documents, vos finances et votre gouvernance dans un seul outil simple et vivant.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href={`/dashboard/${DEMO_SLUG}`} style={{ padding: "16px 30px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 600, fontSize: 15.5, textDecoration: "none", boxShadow: "0 8px 20px rgba(255,138,101,0.22)" }}>Voir le dashboard démo →</Link>
                <Link href={`/site/${DEMO_SLUG}`} style={{ padding: "16px 30px", borderRadius: 100, background: "#fff", color: "#2C2C2C", fontWeight: 600, fontSize: 15.5, textDecoration: "none", border: "1.5px solid #E5DDD6" }}>Voir un site généré</Link>
              </div>
              <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #E5DDD6", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: "#6B6460" }}>
                {["Pensé depuis le terrain", "Adapté aux associations loi 1901", "Sobriété numérique"].map((t) => (
                  <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#81C784", display: "inline-block" }} />{t}
                  </span>
                ))}
              </div>
            </div>
            {/* Photo hero */}
            <div className="lp-photo-hero">
              <Image
                src="/images/hero-lieu.webp"
                alt="Vie du lieu — espace collectif Casa Minga"
                width={900}
                height={1350}
                priority
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ══ 2. PROBLÈME ══ */}
      <section style={{ background: "#fff", padding: "clamp(64px,9vw,108px) 0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(36px,5vw,56px)", maxWidth: 780, marginLeft: "auto", marginRight: "auto" }}>
            <Eyebrow>Le constat</Eyebrow>
            <h2 style={{ fontSize: "clamp(28px,3.8vw,42px)", fontWeight: 700, lineHeight: 1.15 }}>Un tiers-lieu ne se gère pas comme une entreprise classique.</h2>
            <p style={{ color: "#6B6460", lineHeight: 1.7, marginTop: 14, fontSize: "clamp(15px,1.6vw,18px)" }}>Pas de ressources humaines dédiées, beaucoup de bénévoles, peu de continuité, de la mémoire collective qui se perd, et trop d'outils éparpillés qui ne se parlent pas.</p>
          </div>
          <div className="lp-prob-grid">
            {[
              { ic: "📁", t: "Trop de fichiers, partout", d: "Drive, mails, ordinateurs personnels : impossible de retrouver la dernière version d'un document." },
              { ic: "✉", t: "Trop de mails à trier", d: "Demandes de résidences, devis, partenariats, presse — tout arrive dans la même boîte." },
              { ic: "📝", t: "Trop de formulaires", d: "Un Google Form par usage, jamais reliés, qui finissent en exports CSV sans suite." },
              { ic: "📅", t: "Réservations à l'aveugle", d: "Calendrier partagé, post-it, tableau Excel : qui occupe quel espace, à quel moment ?" },
              { ic: "💾", t: "Mémoire fragile", d: "Un·e bénévole part avec son ordinateur, et toute une partie du lieu disparaît avec elle." },
              { ic: "🎭", t: "Événements & résidences en parallèle", d: "Programmation, conventions, communication, bilans : à chaque fois, tout est à reconstruire." },
              { ic: "💶", t: "Suivi financier flottant", d: "Factures en retard oubliées, dons non tracés, subventions à justifier sans données." },
              { ic: "📊", t: "Impact difficile à mesurer", d: "Rendre compte aux financeurs prend des semaines parce que rien n'est centralisé." },
            ].map((c) => (
              <div key={c.t} style={{ background: "#fff", border: "1px solid #E5DDD6", borderRadius: 18, padding: "22px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "#FFF0EB", border: "1px solid #FFB4A2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{c.ic}</div>
                <h4 style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>{c.t}</h4>
                <p style={{ fontSize: 13, color: "#6B6460", lineHeight: 1.55 }}>{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 3. HISTOIRE ══ */}
      <section style={{ background: "linear-gradient(180deg, #FFFBF0, #FFF0EB)", padding: "clamp(64px,9vw,108px) 0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
          <div className="lp-story-grid">
            <div>
              <Eyebrow variant="mint">Depuis le terrain</Eyebrow>
              <h2 style={{ fontSize: "clamp(28px,3.8vw,42px)", fontWeight: 700, marginBottom: 18 }}>Un outil né depuis un lieu réel.</h2>
              <p style={{ fontSize: 16, color: "#3A3A3A", lineHeight: 1.75, marginBottom: 14 }}>Casa Minga Lieux est né dans le cadre de la structuration du <strong>tiers-lieu Bernard Kohn</strong>, à Saint-Mandé, dans l'ancienne maison et atelier de l'architecte Bernard Kohn. Un lieu à la fois <strong>patrimonial, collectif, vivant et expérimental</strong>.</p>
              <p style={{ fontSize: 16, color: "#3A3A3A", lineHeight: 1.75, marginBottom: 14 }}>Un lieu où l'on croise, dans la même journée, une résidence d'artiste, une réunion de CA, un atelier ouvert au quartier, une visite presse, un partenaire institutionnel, et une demande de location de salle.</p>
              <p style={{ fontSize: 16, color: "#3A3A3A", lineHeight: 1.75, marginBottom: 0 }}>Très vite, le constat est devenu évident : <strong>aucun outil existant ne pouvait coordonner cette diversité.</strong></p>
              <blockquote style={{ background: "linear-gradient(135deg, #FFF0EB, #FFFBF0)", borderLeft: "4px solid #FF8A65", padding: "18px 22px", borderRadius: "0 18px 18px 0", marginTop: 22, fontStyle: "italic", fontSize: 15, lineHeight: 1.65, color: "#2C2C2C" }}>
                <span style={{ color: "#FF8A65", fontWeight: 700, fontStyle: "normal" }}>« </span>
                Le lieu nous parlait, mais nous n'avions pas d'outil pour l'écouter. Casa Minga Lieux, c'est notre façon de lui répondre.
                <span style={{ color: "#FF8A65", fontWeight: 700, fontStyle: "normal" }}> »</span>
              </blockquote>
            </div>
            {/* Photo grid 2×2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10, height: "clamp(340px,50vw,460px)" }}>
              {/* Façade — image réelle, span 2 lignes */}
              <div style={{ borderRadius: 18, overflow: "hidden", gridRow: "1 / span 2", position: "relative" }}>
                <span style={{ position: "absolute", top: 10, right: 10, zIndex: 2, background: "rgba(255,255,255,0.92)", border: "1px solid #FFB4A2", color: "#E8714D", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 100 }}>Bernard Kohn</span>
                <Image
                  src="/images/facade.webp"
                  alt="Façade extérieure — Bernard Kohn"
                  width={800}
                  height={1067}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
              {/* Détail architectural */}
              <div style={{ borderRadius: 18, overflow: "hidden", position: "relative" }}>
                <span style={{ position: "absolute", top: 10, right: 10, zIndex: 2, background: "rgba(255,255,255,0.92)", border: "1px solid #FFB4A2", color: "#E8714D", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 100 }}>Détail</span>
                <Image
                  src="/images/detail-architectural.webp"
                  alt="Détail architectural — Bernard Kohn"
                  width={800}
                  height={1067}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
              {/* Jardin / lumière */}
              <div style={{ borderRadius: 18, overflow: "hidden", position: "relative" }}>
                <span style={{ position: "absolute", top: 10, right: 10, zIndex: 2, background: "rgba(255,255,255,0.92)", border: "1px solid #FFB4A2", color: "#E8714D", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 100 }}>Ambiance</span>
                <Image
                  src="/images/jardin.webp"
                  alt="Jardin et lumière — Bernard Kohn"
                  width={800}
                  height={600}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 4. PROMESSE — 4 piliers ══ */}
      <section style={{ padding: "clamp(64px,9vw,108px) 0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(36px,5vw,56px)", maxWidth: 780, marginLeft: "auto", marginRight: "auto" }}>
            <Eyebrow>La promesse</Eyebrow>
            <h2 style={{ fontSize: "clamp(28px,3.8vw,42px)", fontWeight: 700 }}>Tout relier, sans tout complexifier.</h2>
            <p style={{ color: "#6B6460", marginTop: 14, lineHeight: 1.7 }}>Quatre piliers qui couvrent la vie réelle d'un tiers-lieu. Pas plus, pas moins.</p>
          </div>
          <div className="lp-pillars-grid">
            {[
              { ic: "🤝", h: "Accueillir", p: "Demandes entrantes, personnes, résidences, événements : tous les flux d'arrivée passent par un même point d'entrée.", ex: "Une demande arrive depuis le site → fiche créée → assignée → réponse en 36h chrono.", color: "#FF8A65" },
              { ic: "⚙", h: "Organiser", p: "Espaces, réservations, documents, tâches : le quotidien opérationnel sans réinventer Excel à chaque fois.", ex: "L'atelier sérigraphie réservé pour vendredi → le contrat se génère seul → PDF envoyé en 1 clic.", color: "#6E7A93" },
              { ic: "📊", h: "Piloter", p: "Finances, impact, partenaires, gouvernance : la vue stratégique du lieu, pour l'équipe et les financeurs.", ex: "À la fin du trimestre, le rapport d'impact se construit tout seul à partir des données déjà saisies.", color: "#2f8a4c" },
              { ic: "📣", h: "Publier", p: "Site public, formulaires, communication, médiathèque : ce que le lieu produit sort à l'extérieur sans double saisie.", ex: "Un événement créé en interne → automatiquement visible sur le site et l'agenda public.", color: "#c2410c" },
            ].map((p) => (
              <div key={p.h} style={{ background: "#fff", border: "1px solid #E5DDD6", borderTop: `5px solid ${p.color}`, borderRadius: 18, padding: "28px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${p.color}22`, border: `1px solid ${p.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{p.ic}</div>
                <h3 style={{ fontSize: 19, fontWeight: 700 }}>{p.h}</h3>
                <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.6 }}>{p.p}</p>
                <div style={{ fontSize: 12.5, color: "#E8714D", background: "#FFF0EB", border: "1px dashed #FFB4A2", padding: "9px 12px", borderRadius: 11, lineHeight: 1.55 }}><strong>Exemple : </strong>{p.ex}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. PRODUIT (mockup) ══ */}
      <section style={{ background: "#fff", padding: "clamp(64px,9vw,108px) 0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
          <div className="lp-product-grid">
            <div>
              <Eyebrow>Le produit</Eyebrow>
              <h2 style={{ fontSize: "clamp(28px,3.8vw,42px)", fontWeight: 700, marginBottom: 14 }}>Une plateforme pensée pour les lieux collectifs.</h2>
              <p style={{ color: "#6B6460", lineHeight: 1.7, marginBottom: 18 }}>17 modules métier articulés autour des usages réels d'un tiers-lieu.</p>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {["Demandes — boîte de réception unifiée, statuts, assignation", "Espaces & réservations — fiches, calendriers, conflits évités", "Résidences — conventions, suivi, bilans pour vos résident·e·s", "Événements — programmation, billetterie simple, publication", "Documents — versions, signatures, expirations suivies", "Finances — factures, paiements, dons, prévisionnel", "Impact — indicateurs, rapports trimestriels pour financeurs", "Site public connecté — votre vitrine, mise à jour automatiquement"].map((li) => (
                  <li key={li} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, lineHeight: 1.55 }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "#FFF0EB", border: "1px solid #FFB4A2", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path fill='none' stroke='%23FF6D4D' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M2.5 6.5l2.5 2.5 4.5-5'/></svg>\")", backgroundRepeat: "no-repeat", backgroundPosition: "center", marginTop: 1 }} />
                    <span dangerouslySetInnerHTML={{ __html: li.replace(/^([^—]+)/, "<strong>$1</strong>") }} />
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href={`/dashboard/${DEMO_SLUG}`} style={{ padding: "12px 22px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Explorer le dashboard démo →</Link>
                <Link href={`/site/${DEMO_SLUG}`} style={{ padding: "12px 22px", borderRadius: 100, border: "1.5px solid #E5DDD6", color: "#2C2C2C", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Voir le site public généré</Link>
              </div>
            </div>
            {/* Mockup */}
            <div style={{ background: "#fff", border: "1px solid #E5DDD6", borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 56px rgba(28,28,28,0.10), 0 6px 16px rgba(255,138,101,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "#fafaf7", borderBottom: "1px solid #E5DDD6" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ff5f57", display: "inline-block" }} />
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#febc2e", display: "inline-block" }} />
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#28c840", display: "inline-block" }} />
                <span style={{ marginLeft: 14, fontSize: 11, color: "#6B6460", background: "#fff", padding: "3px 12px", borderRadius: 100, border: "1px solid #E5DDD6" }}>admin.casaminga.com/dashboard/bernard-kohn</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", minHeight: 280 }}>
                <div style={{ background: "#2C2C2C", color: "rgba(255,255,255,0.85)", padding: "12px 8px", fontSize: 11, display: "flex", flexDirection: "column", gap: 3 }}>
                  {[["Pilotage", null], [null, "⬚ Dashboard"], [null, "📥 Demandes"], [null, "✓ Tâches"], ["Lieu", null], [null, "🛋 Espaces"], [null, "🎭 Événements"], [null, "🏡 Résidences"], ["Structure", null], [null, "💶 Finances"], [null, "🏛 Gouvernance"], [null, "📊 Impact"]].map(([label, item], i) =>
                    label
                      ? <div key={i} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", padding: "8px 6px 4px" }}>{label}</div>
                      : <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", borderRadius: 6, fontSize: 11, background: item?.startsWith("✓") ? "#FF8A65" : "transparent", color: item?.startsWith("✓") ? "#fff" : "rgba(255,255,255,0.85)" }}>{item}</div>
                  )}
                </div>
                <div style={{ padding: "20px 22px", background: "#FFFBF0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>Tâches &amp; alertes</span>
                    <span style={{ background: "#FF8A65", color: "#fff", fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 100 }}>+ Nouvelle tâche</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                    {[["12", "Ouvertes"], ["3", "Urgentes"], ["5", "Alertes auto"]].map(([v, l]) => (
                      <div key={l} style={{ background: "#fff", border: "1px solid #E5DDD6", borderRadius: 9, padding: "9px 11px" }}>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
                        <div style={{ fontSize: 9.5, color: "#6B6460", textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  {[
                    { tag: "URGENTE", t: "Relancer Studio Petite Lune · facture 290 €", cat: "Finances", tc: "#E8714D", bg: "#FFF0EB" },
                    { tag: "EN COURS", t: "Préparer dossier subvention Région", cat: "Gouvernance", tc: "#2f8a4c", bg: "#E8F3E9" },
                    { tag: "À FAIRE", t: "Commander affiches portes ouvertes", cat: "Communication", tc: "#6B6460", bg: "#f1f5f9" },
                  ].map((r) => (
                    <div key={r.t} style={{ background: "#fff", border: "1px solid #E5DDD6", borderRadius: 9, padding: "9px 11px", display: "flex", alignItems: "center", gap: 10, marginBottom: 5, fontSize: 11.5 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 7px", borderRadius: 100, background: r.bg, color: r.tc, whiteSpace: "nowrap" }}>{r.tag}</span>
                      <span style={{ flex: 1 }}>{r.t}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 7px", borderRadius: 100, background: "#f1f5f9", color: "#64748b", whiteSpace: "nowrap" }}>{r.cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 5b. IMPACT ══ */}
      <section style={{ background: "#fff", padding: "clamp(64px,9vw,108px) 0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
          <div className="lp-impact-grid">
            {/* Colonne gauche */}
            <div>
              <Eyebrow variant="mint">L'impact</Eyebrow>
              <h2 style={{ fontSize: "clamp(28px,3.8vw,42px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>
                Rendre visible ce que le lieu produit vraiment.
              </h2>
              <p style={{ fontSize: "clamp(15px,1.6vw,18px)", color: "#6B6460", lineHeight: 1.7, marginBottom: 28 }}>
                Pour les financeurs, pour vos partenaires, pour vos adhérent·e·s, et pour vous. Tous les indicateurs renseignés au fil de l'eau, exportables en un clic.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px", marginBottom: 32 }}>
                {[
                  "Fréquentation", "Événements organisés",
                  "Heures d'occupation", "Heures de bénévolat",
                  "Résidences accueillies", "Partenaires actifs",
                  "Revenus propres", "Rapports financeurs",
                  "Mixité du public", "Narratif d'impact",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1.5px solid #E5DDD6", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 500, color: "#2C2C2C" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2f8a4c", flexShrink: 0 }} />
                    {item}
                  </div>
                ))}
              </div>
              <Link href="/dashboard/bernard-kohn/impact" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 28px", borderRadius: 100, border: "2px solid #2C2C2C", background: "#fff", color: "#2C2C2C", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                Voir le module Impact dans le dashboard démo →
              </Link>
            </div>

            {/* Colonne droite — carte rapport */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#fff", border: "1.5px solid #E5DDD6", borderRadius: 22, padding: "28px 30px", width: "100%", maxWidth: 430, boxShadow: "0 4px 28px rgba(44,44,44,0.07)" }}>
                {/* En-tête carte */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: "#2C2C2C" }}>Rapport d'impact · T2 2026</div>
                    <div style={{ fontSize: 12.5, color: "#6B6460", marginTop: 2 }}>Tiers-lieu Bernard Kohn · auto-généré</div>
                  </div>
                  <span style={{ background: "#FFF0EB", border: "1.5px solid #FFB4A2", color: "#E8714D", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 100 }}>2026</span>
                </div>
                <div style={{ borderTop: "1px solid #F0EBE3", margin: "16px 0" }} />

                {/* Lignes métriques */}
                {[
                  { label: "Personnes accueillies", value: "1 240", pct: 85 },
                  { label: "Événements organisés",  value: "38",    pct: 55 },
                  { label: "Heures de bénévolat",   value: "2 180", pct: 78 },
                  { label: "Résidences accueillies", value: "9",    pct: 65 },
                  { label: "Partenaires actifs",     value: "14",   pct: 48 },
                  { label: "Revenus propres",        value: "28k €", pct: 38 },
                ].map((row, i, arr) => (
                  <div key={row.label}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", gap: 12 }}>
                      <span style={{ fontSize: 13.5, color: "#2C2C2C", flexShrink: 0 }}>{row.label}</span>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
                        <div style={{ flex: 1, height: 6, background: "#F0EBE3", borderRadius: 99, overflow: "hidden", maxWidth: 120 }}>
                          <div style={{ height: "100%", width: `${row.pct}%`, background: "#FF8A65", borderRadius: 99 }} />
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 15, color: "#2C2C2C", minWidth: 44, textAlign: "right" }}>{row.value}</span>
                      </div>
                    </div>
                    {i < arr.length - 1 && <div style={{ borderTop: "1px solid #F0EBE3" }} />}
                  </div>
                ))}

                <div style={{ borderTop: "1px solid #F0EBE3", marginTop: 6, paddingTop: 14, display: "flex", gap: 16, fontSize: 12.5, color: "#2f8a4c", fontWeight: 600 }}>
                  <span>↓ Export PDF</span>
                  <span>· partage aux financeurs</span>
                  <span>· narratif commenté</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 6. POUR QUI ══ */}
      <section style={{ padding: "clamp(64px,9vw,108px) 0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(36px,5vw,56px)", maxWidth: 780, marginLeft: "auto", marginRight: "auto" }}>
            <Eyebrow variant="mint">Pour qui</Eyebrow>
            <h2 style={{ fontSize: "clamp(28px,3.8vw,42px)", fontWeight: 700 }}>Pour les lieux qui veulent se structurer sans perdre leur âme.</h2>
            <p style={{ color: "#6B6460", marginTop: 14, lineHeight: 1.7 }}>Pensé pour les structures hybrides, à gouvernance collective, ancrées dans leur territoire.</p>
          </div>
          <div className="lp-pourqui-grid">
            {[
              { ic: "🏛", t: "Tiers-lieux associatifs", d: "Maisons de quartier, friches reconverties, fabriques de territoire." },
              { ic: "🎨", t: "Lieux culturels", d: "Centres d'art, fabriques, scènes indépendantes, ateliers d'artistes." },
              { ic: "💼", t: "Coworking engagés", d: "Coworkings solidaires, espaces de l'ESS, lieux à modèle hybride." },
              { ic: "🏡", t: "Résidences artistiques", d: "Lieux de résidence, ateliers partagés, lieux de création." },
              { ic: "🗳", t: "Collectifs en gouvernance partagée", d: "Coopératives, SCIC, SCOP, collectifs auto-organisés." },
              { ic: "⛪", t: "Associations avec un lieu", d: "Maisons des associations, locaux mutualisés, MJC." },
              { ic: "🏚", t: "Lieux patrimoniaux", d: "Bâtiments anciens en transformation, monuments en reconversion." },
              { ic: "🌱", t: "Lieux écologiques", d: "Fermes urbaines, lieux de transition, écovillages." },
            ].map((t) => (
              <div key={t.t} style={{ background: "#fff", border: "1px solid #E5DDD6", borderRadius: 18, padding: "22px 18px", textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", background: "linear-gradient(135deg, #FFF0EB, #FFFBF0)", border: "1px solid #FFB4A2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 4 }}>{t.ic}</div>
                <h4 style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>{t.t}</h4>
                <p style={{ fontSize: 12, color: "#6B6460", lineHeight: 1.5 }}>{t.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 7. DIFFÉRENCIATION ══ */}
      <section style={{ background: "#FAF6E8", padding: "clamp(64px,9vw,108px) 0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(36px,5vw,56px)", maxWidth: 780, marginLeft: "auto", marginRight: "auto" }}>
            <Eyebrow variant="gold">Le positionnement</Eyebrow>
            <h2 style={{ fontSize: "clamp(28px,3.8vw,42px)", fontWeight: 700 }}>Ni Drive, ni Notion, ni simple logiciel de coworking.</h2>
            <p style={{ color: "#6B6460", marginTop: 14, lineHeight: 1.7 }}>Chacun a sa force. Casa Minga Lieux relie ce qu'ils n'arrivent pas à relier.</p>
          </div>
          <div style={{ background: "#fff", border: "1px solid #E5DDD6", borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 14px rgba(255,138,101,0.10)" }}>
            {[
              { ic: "📁", name: "Drive · Dropbox", sub: "Stockage de fichiers", vs: "Drive range les fichiers. Casa Minga Lieux relie les actions autour de ces fichiers : la convention est liée à une résidence, qui est liée à une personne, qui paie via une facture." },
              { ic: "📄", name: "Notion · Coda", sub: "Espace de travail libre", vs: "Notion structure des pages. Casa Minga Lieux structure la vie du lieu : pas de page blanche à construire, les modules sont déjà pensés pour un tiers-lieu." },
              { ic: "🪑", name: "Cobot · Nexudus", sub: "Logiciels de coworking", vs: "Un logiciel de coworking gère des bureaux. Casa Minga Lieux gère un écosystème : résidences artistiques, gouvernance, partenariats, impact." },
              { ic: "🌐", name: "Site vitrine simple", sub: "Webflow · WordPress", vs: "Un site vitrine montre le lieu. Casa Minga Lieux connecte le site à la gestion : les demandes du site entrent directement dans le pilotage." },
            ].map((r, i) => (
              <div key={r.name} className="lp-diff-row" style={{ padding: "18px 22px", borderBottom: i < 3 ? "1px solid #E5DDD6" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FFFBF0", border: "1px solid #E5DDD6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{r.ic}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: "#6B6460", marginTop: 1 }}>{r.sub}</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "#3A3A3A", lineHeight: 1.55 }}>{r.vs}</div>
              </div>
            ))}
            <div className="lp-diff-row" style={{ padding: "18px 22px", background: "linear-gradient(135deg, #FFF0EB, #FFFBF0)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #FF8A65, #FF6D4D)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", flexShrink: 0, boxShadow: "0 4px 10px rgba(255,138,101,0.32)" }}>★</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#E8714D" }}>Casa Minga Lieux</div>
                  <div style={{ fontSize: 11.5, color: "#6B6460" }}>Le SaaS des tiers-lieux</div>
                </div>
              </div>
              <div style={{ fontSize: 14, color: "#3A3A3A", lineHeight: 1.55 }}>Casa Minga Lieux est <strong>spécifiquement conçu pour la diversité d'un tiers-lieu</strong> — accueil, organisation, pilotage, publication — dans un seul outil cohérent.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 8. CTA FINAL ══ */}
      <section style={{ background: "linear-gradient(135deg, #2C2C2C, #1a1a1a)", color: "#fff", padding: "clamp(64px,9vw,108px) 0", position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px", position: "relative", zIndex: 1 }}>
          <div className="lp-cta-grid">
            <div>
              <Eyebrow variant="white">Parlons-en</Eyebrow>
              <h2 style={{ fontSize: "clamp(28px,3.8vw,42px)", fontWeight: 700, color: "#fff", marginBottom: 14 }}>Vous portez un lieu collectif ? Parlons-en.</h2>
              <p style={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.7, marginBottom: 24 }}>Démo guidée, échanges sur votre lieu, ou candidature pour rejoindre les premiers lieux pilotes. Pas de pression commerciale, juste une conversation.</p>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {["Démo personnalisée en visio (30 min)", "Échange sur votre lieu et vos besoins", "Accès anticipé pour les lieux pilotes", "Aucune carte bancaire demandée"].map((li) => (
                  <li key={li} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 14, color: "rgba(255,255,255,0.92)" }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "rgba(255,138,101,0.22)", border: "1px solid rgba(255,138,101,0.55)", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path fill='none' stroke='%23FFB4A2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M2.5 6.5l2.5 2.5 4.5-5'/></svg>\")", backgroundRepeat: "no-repeat", backgroundPosition: "center" }} />
                    {li}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href={`/dashboard/${DEMO_SLUG}`} style={{ padding: "12px 22px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>▶ Voir le dashboard démo</Link>
                <Link href={`/site/${DEMO_SLUG}`} style={{ padding: "12px 22px", borderRadius: 100, background: "#fff", color: "#2C2C2C", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Voir un site public généré</Link>
              </div>
            </div>
            {/* Formulaire */}
            <div style={{ background: "#fff", color: "#2C2C2C", borderRadius: 28, padding: "28px 28px 22px", boxShadow: "0 24px 56px rgba(0,0,0,0.18)" }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Demander une démo</h3>
              <p style={{ fontSize: 13, color: "#6B6460", lineHeight: 1.55, marginBottom: 18 }}>Nous reviendrons vers vous sous 48h. Vos données restent strictement chez nous.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { id: "f-nom", label: "Nom complet *", type: "text", placeholder: "" },
                  { id: "f-structure", label: "Structure *", type: "text", placeholder: "Nom du lieu / collectif" },
                  { id: "f-email", label: "Email *", type: "email", placeholder: "" },
                ].map((f) => (
                  <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label htmlFor={f.id} style={{ fontSize: 12, fontWeight: 600 }}>{f.label}</label>
                    <input id={f.id} type={f.type} placeholder={f.placeholder} style={{ width: "100%", padding: "12px 14px", fontFamily: "inherit", fontSize: 14, background: "#fff", border: "1.5px solid #E5DDD6", borderRadius: 11, color: "#2C2C2C" }} />
                  </div>
                ))}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label htmlFor="f-type" style={{ fontSize: 12, fontWeight: 600 }}>Type de lieu</label>
                  <select id="f-type" style={{ width: "100%", padding: "12px 14px", fontFamily: "inherit", fontSize: 14, background: "#fff", border: "1.5px solid #E5DDD6", borderRadius: 11, color: "#2C2C2C" }}>
                    <option value="">— Précisez —</option>
                    {["Tiers-lieu associatif", "Lieu culturel", "Coworking engagé", "Résidence artistique", "Collectif / gouvernance partagée", "Association avec lieu", "Lieu patrimonial", "Lieu écologique", "Autre"].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
                <label htmlFor="f-message" style={{ fontSize: 12, fontWeight: 600 }}>Quelques mots sur votre lieu (facultatif)</label>
                <textarea id="f-message" placeholder="Quelques lignes sur le lieu, son fonctionnement, ce qui vous bloque aujourd'hui…" style={{ width: "100%", padding: "12px 14px", fontFamily: "inherit", fontSize: 14, background: "#fff", border: "1.5px solid #E5DDD6", borderRadius: 11, color: "#2C2C2C", minHeight: 90, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#6B6460", lineHeight: 1.5 }}>🔒 Données conservées localement</span>
                <button type="button" style={{ padding: "12px 22px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" }}>Envoyer la demande →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ background: "#1A1A1A", color: "rgba(255,255,255,0.7)", padding: "60px 0 28px", fontSize: 13 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
          <div className="lp-footer-grid">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14, fontWeight: 800, fontSize: 17, color: "#fff" }}>
                <img src="/logo.png" alt="Casa Minga Lieux" style={{ width: 34, height: 34, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                Casa Minga Lieux
              </div>
              <p style={{ lineHeight: 1.6, marginBottom: 10, maxWidth: "34ch", color: "rgba(255,255,255,0.65)" }}>Le système de pilotage des tiers-lieux, résidences et lieux collectifs. Pensé depuis le terrain.</p>
              <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Inspiré de l'ESS. Made with ❤ pour les communs.</p>
            </div>
            {[
              { title: "Produit", links: [["Modules", "#"], ["Dashboard démo", `/dashboard/${DEMO_SLUG}`], ["Site public généré", `/site/${DEMO_SLUG}`]] },
              { title: "Le projet", links: [["Histoire", "#histoire"], ["Pour qui", "#pour-qui"], ["Approche", "#difference"]] },
              { title: "Contact", links: [["Demander une démo", "#contact"], ["Se connecter", "/login"], ["contact@casaminga.com", "mailto:contact@casaminga.com"]] },
            ].map((col) => (
              <div key={col.title}>
                <h4 style={{ color: "#fff", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>{col.title}</h4>
                <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {col.links.map(([label, href]) => (
                    <li key={label}><Link href={href} style={{ color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 44, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>
            <span>© {new Date().getFullYear()} Casa Minga Lieux — Pensé depuis le terrain · Sobriété numérique</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
