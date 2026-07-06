import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Notre approche — un outil qui en fait moins, exprès · Casa Minga",
  description:
    "Pourquoi Casa Minga refuse la sur-ingénierie des Yapla, Assoconnect ou Notion+Drive+HelloAsso : un socle simple, des modules activés selon vos besoins réels.",
};

function Eyebrow({ children, variant = "coral" }: {
  children: React.ReactNode;
  variant?: "coral" | "mint" | "blue" | "gold" | "dark";
}) {
  const cls = {
    coral: "bg-[#FFF0EB] text-[#E8714D] border-[#FFB4A2]",
    mint:  "bg-[#E8F3E9] text-[#2f8a4c] border-[#bfe0c5]",
    blue:  "bg-[#E6F4F7] text-[#0e6e7a] border-[#B3D4DE]",
    gold:  "bg-[#FFF8E0] text-[#a06800] border-[#FFE4A8]",
    dark:  "bg-white/10 text-white border-white/20",
  }[variant];
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest mb-5 ${cls}`}>
      {children}
    </div>
  );
}

// Carte conviction : titre + preuve + encart illustratif optionnel
function ConvictionCard({
  num, title, body, proof, children,
}: {
  num: string; title: string; body: string; proof: string; children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(36px,5vw,72px)", alignItems: "center", padding: "clamp(56px,8vw,96px) 0", borderBottom: "1px solid #F0E8E2" }} className="hist-two-col">
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#FF8A65", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 16 }}>{num}</div>
        <h2 style={{ fontSize: "clamp(22px,2.8vw,34px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 18 }}>{title}</h2>
        <p style={{ fontSize: 16, color: "#3A3A3A", lineHeight: 1.8, marginBottom: 22 }}>{body}</p>
        {/* Encart preuve */}
        <div style={{ background: "#FFF5F2", border: "1px solid #FFD0BC", borderRadius: 14, padding: "16px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>✓</span>
          <p style={{ fontSize: 14, color: "#A0400F", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{proof}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

// Encart placeholder (photo à venir)
function Encart({ label, ratio = "4/3", note }: { label: string; ratio?: string; note?: string }) {
  return (
    <div style={{ background: "linear-gradient(135deg,#FFF0EB,#FFFBF0)", border: "2px dashed #FFB4A2", borderRadius: 22, padding: "32px 24px", textAlign: "center", aspectRatio: ratio, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <div style={{ fontSize: 28 }}>📸</div>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#2C2C2C" }}>{label}</div>
      {note && <div style={{ fontSize: 11.5, color: "#6B6460", lineHeight: 1.5 }}>{note}</div>}
    </div>
  );
}

// Mini-démo modules progressifs
function ModuleDemo() {
  const socle = ["Tableau de bord", "Demandes", "Personnes", "Site public"];
  const tiers = ["Espaces", "Réservations", "Événements", "Adhésions"];
  const avance = ["Subventions", "Gouvernance", "Impact"];

  return (
    <div style={{ background: "#fff", border: "1.5px solid #E5DDD6", borderRadius: 20, padding: "24px 22px", boxShadow: "0 6px 24px rgba(28,28,28,0.06)" }}>
      {/* Header fictif sidebar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid #F0E8E2" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FF8A65", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14 }}>🏠</span>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Tiers-lieu Les Halles</div>
          <div style={{ fontSize: 10.5, color: "#9C9590" }}>Tiers-lieu hybride</div>
        </div>
      </div>

      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Pilotage — toujours là</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
        {socle.map((m) => (
          <span key={m} style={{ background: "#FFF0EB", color: "#E8714D", border: "1px solid #FFD0BC", fontSize: 11, fontWeight: 600, borderRadius: 100, padding: "3px 10px" }}>{m}</span>
        ))}
      </div>

      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Activé pour vous</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
        {tiers.map((m) => (
          <span key={m} style={{ background: "#E8F3E9", color: "#2f8a4c", border: "1px solid #bfe0c5", fontSize: 11, fontWeight: 600, borderRadius: 100, padding: "3px 10px" }}>{m}</span>
        ))}
      </div>

      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#9C9590", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Disponibles si besoin</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {avance.map((m) => (
          <span key={m} style={{ background: "#F4EFE9", color: "#9C9590", border: "1px solid #E5DDD6", fontSize: 11, fontWeight: 500, borderRadius: 100, padding: "3px 10px" }}>{m}</span>
        ))}
      </div>
    </div>
  );
}

export default function ApprochePage() {
  return (
    <main style={{ fontFamily: "'Poppins', sans-serif", background: "#FFFBF0", color: "#2C2C2C" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ══ NAV ══ */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,251,240,0.94)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,180,162,0.28)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 16, color: "#2C2C2C", textDecoration: "none" }}>
            <img src="/logo-icon.webp" alt="Casa Minga Lieux" style={{ width: 34, height: 34, objectFit: "contain" }} />
            Casa Minga Lieux
          </Link>
          <span style={{ color: "#E5DDD6", fontSize: 18 }}>·</span>
          <span style={{ fontSize: 13, color: "#6B6460", fontWeight: 500 }}>Notre approche</span>
          <div style={{ flex: 1 }} />
          <Link href="/histoire" style={{ fontSize: 13, fontWeight: 600, color: "#6B6460", textDecoration: "none" }}>Notre histoire</Link>
          <Link href="/login" style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff", textDecoration: "none", borderRadius: 100, background: "#FF8A65" }}>Voir le dashboard</Link>
        </div>
      </nav>

      {/* ══ 1. HERO ══ */}
      <header style={{ padding: "clamp(64px,9vw,108px) 0 clamp(56px,8vw,88px)", background: "linear-gradient(180deg, #FFFBF0 0%, #FFF5EE 100%)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
          <Eyebrow>Notre approche</Eyebrow>
          <h1 style={{ fontSize: "clamp(38px,5.5vw,64px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, marginBottom: 24, maxWidth: 680 }}>
            Un outil qui en fait{" "}
            <span style={{ background: "linear-gradient(180deg, transparent 60%, rgba(255,138,101,0.28) 60%, rgba(255,138,101,0.28) 92%, transparent 92%)", padding: "0 4px" }}>moins.</span>
            {" "}Exprès.
          </h1>
          <p style={{ fontSize: "clamp(16px,1.8vw,19px)", color: "#6B6460", lineHeight: 1.75, maxWidth: "54ch", marginBottom: 32 }}>
            Yapla, Assoconnect, Notion + Drive + HelloAsso + Trello : tous essaient d'en faire plus. Nous faisons le pari inverse — et cette page explique pourquoi c'est une décision, pas un manque.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/signup" style={{ padding: "14px 28px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 6px 18px rgba(255,138,101,0.28)" }}>
              Créer mon espace →
            </Link>
            <Link href="/histoire" style={{ padding: "14px 28px", borderRadius: 100, background: "transparent", border: "1.5px solid #FFB4A2", color: "#2C2C2C", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
              Notre histoire
            </Link>
          </div>
        </div>
      </header>

      {/* ══ 2. CONVICTIONS ══ */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>

        {/* Conviction 1 */}
        <ConvictionCard
          num="01"
          title="Construit dans un vrai lieu, pas dans un bureau."
          body="Casa Minga est né et tourne à Bernard Kohn, un tiers-lieu de Saint-Mandé. Chaque fonctionnalité règle un problème qu'on a vécu — pas une case sur une roadmap sortie d'une étude de marché. Quand la caisse certifiée NF525 est arrivée, c'est parce qu'on en avait besoin pour encaisser légalement. Pareil pour les résidences d'artistes, les subventions, la gouvernance."
          proof="Léo Durand, fondateur, est coordinateur d'un tiers-lieu depuis la création de l'outil. Il l'utilise chaque semaine. Il voit les bugs avant vous."
        >
          <Encart label="Léo au tiers-lieu Bernard Kohn" ratio="4/3" note="Photo : vie quotidienne du lieu pilote" />
        </ConvictionCard>

        {/* Conviction 2 — pièce maîtresse */}
        <ConvictionCard
          num="02"
          title="L'outil démarre sobre et grandit avec vous."
          body="La plupart des outils vous accueillent avec 25 modules, 40 réglages et un guide de démarrage de 12 pages. Nous faisons l'inverse. À l'inscription, vous dites ce qu'est votre lieu — tiers-lieu, espace de coworking, résidence artistique, association. On n'affiche que ce qui vous concerne. Le reste existe, il se révèle quand vous en avez besoin."
          proof="Un tiers-lieu démarre avec 10 modules. Un espace de coworking avec 5. Une asso sans lieu avec 4. Activables et désactivables à tout moment, sans perdre une donnée."
        >
          <ModuleDemo />
        </ConvictionCard>

        {/* Conviction 3 */}
        <ConvictionCard
          num="03"
          title="Tout est relié, pour ne plus jongler."
          body="Dans un tiers-lieu, une information peut naître dans une demande de location, devenir une réservation, générer une facture, alimenter l'impact annuel et finir dans un rapport de subvention. Avec Casa Minga, ce chemin se fait sans ressaisie. Une seule entrée, tout est connecté."
          proof="Fini le trio HelloAsso + Google Drive + Trello + mails + Notion. Vos données vivent au même endroit et se parlent — comme les gens dans votre lieu."
        >
          <div style={{ background: "#fff", border: "1.5px solid #E5DDD6", borderRadius: 20, padding: "24px 22px", boxShadow: "0 6px 24px rgba(28,28,28,0.06)" }}>
            {[
              { from: "Formulaire de demande", to: "Personne (CRM)", color: "#FF8A65" },
              { from: "Personne (CRM)", to: "Adhérent", color: "#FF8A65" },
              { from: "Adhérent", to: "Facture", color: "#2f8a4c" },
              { from: "Facture", to: "Indicateur d'impact", color: "#0e6e7a" },
              { from: "Impact", to: "Dossier subvention", color: "#a06800" },
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#2C2C2C", background: "#FAFAF7", border: "1px solid #E5DDD6", borderRadius: 8, padding: "5px 10px", whiteSpace: "nowrap" }}>{step.from}</span>
                <span style={{ fontSize: 14, color: step.color, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#2C2C2C", background: "#FAFAF7", border: "1px solid #E5DDD6", borderRadius: 8, padding: "5px 10px", whiteSpace: "nowrap" }}>{step.to}</span>
              </div>
            ))}
          </div>
        </ConvictionCard>

        {/* Conviction 4 */}
        <ConvictionCard
          num="04"
          title="Sobres dans le produit, sobres dans les valeurs."
          body="Casa Minga est un projet à taille humaine, pas une machine à lever des fonds. Pas de modèle freemium conçu pour vous pousser vers le haut. Pas de données revendues. Hébergement en France. Tarif solidaire pour les assos. Et si un jour ça ne vous convient plus, vos données sont exportables — toutes, en un clic."
          proof="Léo a accompagné plus de 50 associations en 10 ans de création de sites. Il a vu les outils qu'on revend cher à des bénévoles non-techniques. Il a décidé de construire autre chose."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: "🇫🇷", label: "Hébergé en France", sub: "Vos données restent en Europe, sur des serveurs Infomaniak (Genève)." },
              { icon: "💚", label: "Tarif solidaire asso", sub: "Remise dédiée aux associations loi 1901 et structures de l'ESS." },
              { icon: "📦", label: "Export total", sub: "Toutes vos données exportables à tout moment. Aucun verrouillage." },
              { icon: "🔒", label: "Zéro revente", sub: "Jamais de revente de données, jamais de profilage publicitaire." },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#fff", border: "1px solid #E5DDD6", borderRadius: 14, padding: "14px 16px" }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 12.5, color: "#6B6460", lineHeight: 1.5 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </ConvictionCard>

      </div>

      {/* ══ 3. CE QU'ON NE FERA JAMAIS — section sombre ══ */}
      <section style={{ background: "#2C2C2C", color: "#fff", padding: "clamp(64px,9vw,108px) 0", position: "relative", overflow: "hidden", marginTop: "clamp(56px,8vw,88px)" }}>
        <div style={{ position: "absolute", left: -100, top: -100, width: 400, height: 400, borderRadius: "50%", background: "rgba(255,138,101,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: -80, bottom: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,138,101,0.04)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ maxWidth: 640, marginBottom: "clamp(36px,5vw,56px)" }}>
            <Eyebrow variant="dark">Notre serment</Eyebrow>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)", fontWeight: 800, lineHeight: 1.12, marginBottom: 16 }}>
              Ce que nous ne ferons jamais.
            </h2>
            <p style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.75, fontSize: 16 }}>
              Un outil qui se définit par ce qu'il fait est honnête. Un outil qui se définit par ce qu'il refuse l'est encore plus.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }} className="hist-tools-grid">
            {[
              {
                icon: "✗",
                title: "Pas d'empilement pour « faire riche »",
                body: "Si une fonctionnalité n'a pas de cas d'usage concret dans un tiers-lieu réel, elle n'existe pas. La richesse d'un outil se juge à ce qu'il enlève, pas à ce qu'il ajoute.",
              },
              {
                icon: "✗",
                title: "Pas de manuel de 40 pages",
                body: "Si une action demande une explication ou une formation, c'est qu'on a raté la conception. L'outil doit être évident pour un bénévole non-technique le premier jour.",
              },
              {
                icon: "✗",
                title: "Pas de dark patterns",
                body: "Pas de fausse urgence, pas d'abonnement impossible à annuler, pas d'emails marketing non choisis. Votre attention est précieuse, on ne la piège pas.",
              },
              {
                icon: "✗",
                title: "Pas de promesses qu'on ne tient pas",
                body: "Pas de module « bientôt disponible » affiché pendant 18 mois. Ce qui est dans l'outil fonctionne. Ce qui ne fonctionne pas n'est pas montré.",
              },
            ].map((item) => (
              <div key={item.title} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "24px" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,138,101,0.15)", border: "1px solid rgba(255,138,101,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: "#FF8A65", marginBottom: 14 }}>
                  {item.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4. CTA FINAL ══ */}
      <section style={{ background: "#FFFBF0", padding: "clamp(64px,9vw,108px) 0" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 28px", textAlign: "center" }}>
          <Eyebrow>Prêt ?</Eyebrow>
          <h2 style={{ fontSize: "clamp(28px,3.8vw,46px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 20 }}>
            Un seul outil.<br />Tout relié. Rien de superflu.
          </h2>
          <p style={{ fontSize: "clamp(15px,1.6vw,17px)", color: "#6B6460", lineHeight: 1.75, marginBottom: 36, maxWidth: "46ch", marginLeft: "auto", marginRight: "auto" }}>
            Essai gratuit, aucune carte bancaire. Votre espace est prêt en 2 minutes — avec exactement les modules dont votre lieu a besoin.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" style={{ padding: "16px 32px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 8px 20px rgba(255,138,101,0.3)" }}>
              Créer mon espace →
            </Link>
            <Link href="/histoire" style={{ padding: "16px 32px", borderRadius: 100, background: "transparent", border: "1.5px solid #FFB4A2", color: "#2C2C2C", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
              Notre histoire
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER minimal ══ */}
      <footer style={{ borderTop: "1px solid #E5DDD6", background: "#FFFBF0", padding: "28px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap", fontSize: 13, color: "#9C9590" }}>
          <Link href="/" style={{ color: "#9C9590", textDecoration: "none", fontWeight: 600 }}>← Accueil</Link>
          <Link href="/histoire" style={{ color: "#9C9590", textDecoration: "none" }}>Notre histoire</Link>
          <Link href="/signup" style={{ color: "#E8714D", textDecoration: "none", fontWeight: 600 }}>Créer un espace →</Link>
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: "#C8C0BC" }}>© {new Date().getFullYear()} Casa Minga Lieux — Sobre. Utile. Ancré dans le terrain.</p>
      </footer>
    </main>
  );
}
