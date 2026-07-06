import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Notre histoire — le lieu d'abord, l'outil ensuite · Casa Minga",
  description:
    "Casa Minga est né dans un tiers-lieu réel, le Tiers-lieu Bernard Kohn, avec de vraies contraintes de gestion associative — pas dans une startup.",
};

// ── Helpers ────────────────────────────────────────────────────────────────
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

function PhotoEncart({
  label, ratio = "4/3", note, src, alt, width, height
}: {
  label: string; ratio?: string; note?: string;
  src?: string; alt?: string; width?: number; height?: number;
}) {
  if (src) {
    return (
      <div style={{ borderRadius: 22, overflow: "hidden", width: "100%" }}>
        <Image src={src} alt={alt ?? label} width={width!} height={height!}
          style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
    );
  }
  return (
    <div style={{ background: "linear-gradient(135deg,#FFF0EB,#FFFBF0)", border: "2px dashed #FFB4A2", borderRadius: 22, padding: "32px 24px", textAlign: "center", aspectRatio: ratio, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <div style={{ fontSize: 28 }}>📸</div>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#2C2C2C" }}>{label}</div>
      {note && <div style={{ fontSize: 11.5, color: "#6B6460", lineHeight: 1.5 }}>{note}</div>}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function HistoirePage() {
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
          <span style={{ fontSize: 13, color: "#6B6460", fontWeight: 500 }}>Notre histoire</span>
          <div style={{ flex: 1 }} />
          <Link href="/" style={{ fontSize: 13, fontWeight: 600, color: "#6B6460", textDecoration: "none" }}>← Accueil</Link>
          <Link href="/login" style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff", textDecoration: "none", borderRadius: 100, background: "#FF8A65" }}>Voir le dashboard</Link>
        </div>
      </nav>

      {/* ══ 1. HERO ══ */}
      <header style={{ padding: "clamp(56px,8vw,96px) 0 0", background: "linear-gradient(180deg, #FFFBF0 0%, #FFF5EE 100%)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ maxWidth: 700, marginBottom: "clamp(40px,6vw,72px)" }}>
            <Eyebrow>Notre histoire</Eyebrow>
            <h1 style={{ fontSize: "clamp(38px,5.5vw,64px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, marginBottom: 22 }}>
              Le lieu d'abord,<br />
              <span style={{ background: "linear-gradient(180deg, transparent 60%, rgba(255,138,101,0.28) 60%, rgba(255,138,101,0.28) 92%, transparent 92%)", padding: "0 4px" }}>l'outil ensuite.</span>
            </h1>
            <p style={{ fontSize: "clamp(16px,1.8vw,19px)", color: "#6B6460", lineHeight: 1.7, maxWidth: "52ch" }}>
              Casa Minga Lieux n'est pas né dans une startup. Il est né dans un tiers-lieu réel, avec de vraies contraintes, de vrais bénévoles, et trop de mails le vendredi soir.
            </p>
          </div>

          {/* Grande image hero pleine largeur */}
          <div style={{ borderRadius: "22px 22px 0 0", overflow: "hidden", height: "clamp(280px,38vw,480px)" }}>
            <Image
              src="/images/hero-lieu.webp"
              alt="Le tiers-lieu Bernard Kohn"
              width={900}
              height={1350}
              priority
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }}
            />
          </div>
        </div>
      </header>

      {/* ══ 2. LE LIEU ══ */}
      <section style={{ background: "#fff", padding: "clamp(64px,9vw,108px) 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "clamp(32px,5vw,72px)", alignItems: "center" }} className="hist-two-col">
            <div>
              <Eyebrow variant="mint">Le lieu</Eyebrow>
              <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)", fontWeight: 800, lineHeight: 1.12, marginBottom: 20 }}>
                Un lieu patrimonial,<br />collectif, vivant.
              </h2>
              <p style={{ fontSize: 16, color: "#3A3A3A", lineHeight: 1.8, marginBottom: 16 }}>
                Bernard Kohn est l'ancienne maison et atelier d'un architecte de renom. Un endroit où le patrimoine architectural côtoie l'expérimentation collective. Où la même journée peut réunir une résidence d'artiste, une réunion de CA, un atelier ouvert au quartier, une visite presse et une demande de location de salle.
              </p>
              <p style={{ fontSize: 16, color: "#3A3A3A", lineHeight: 1.8, marginBottom: 24 }}>
                L'idée fondatrice n'est pas commerciale. Elle est simple : <strong>faire vivre le collectif.</strong> Le tiers-lieu est un espace de <em>vivre ensemble</em> — pas un produit à optimiser.
              </p>
              <blockquote style={{ borderLeft: "4px solid #FF8A65", paddingLeft: 18, margin: 0, fontStyle: "italic", color: "#6B6460", lineHeight: 1.7, fontSize: 15 }}>
                "Ce lieu nous parlait, mais nous n'avions pas d'outil pour l'écouter."
              </blockquote>
            </div>
            <PhotoEncart
              src="/images/facade.webp"
              alt="Façade du tiers-lieu Bernard Kohn"
              width={800}
              height={1067}
              label="Façade Bernard Kohn"
            />
          </div>
        </div>
      </section>

      {/* ══ 3. LE PROBLÈME — section sombre ══ */}
      <section style={{ background: "#2C2C2C", color: "#fff", padding: "clamp(64px,9vw,108px) 0", position: "relative", overflow: "hidden" }}>
        {/* Cercle déco */}
        <div style={{ position: "absolute", right: -120, top: -120, width: 480, height: 480, borderRadius: "50%", background: "rgba(255,138,101,0.06)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ maxWidth: 640, marginBottom: "clamp(36px,5vw,56px)" }}>
            <Eyebrow variant="dark">La réalité du terrain</Eyebrow>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)", fontWeight: 800, lineHeight: 1.12, marginBottom: 20 }}>
              Autant de temps à administrer qu'à faire ce qu'on aime.
            </h2>
            <p style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.8, fontSize: 16 }}>
              Dans une association, personne n'est dédié à une seule tâche. Il n'y a pas de comptable à plein temps. Pas d'admin dédié. Des bénévoles aux contrats distendus, des informations éparpillées — et des heures passées au téléphone à chercher qui sait quoi.
            </p>
          </div>

          {/* Grille outils éparpillés */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 48 }} className="hist-tools-grid">
            {[
              { ic: "📂", t: "Le gros Drive", d: "Chaque personne doit être formée. Et on oublie au fur et à mesure." },
              { ic: "📨", t: "Les mails sans fin", d: "Des échanges incessants pour retrouver qui a l'information." },
              { ic: "🧩", t: "5 outils différents", d: "HelloAsso · Compta · Drive · Trello · Notion. Sans jamais se parler." },
            ].map((item) => (
              <div key={item.t} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, padding: "22px 20px" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{item.ic}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 8 }}>{item.t}</div>
                <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{item.d}</div>
              </div>
            ))}
          </div>

          {/* Encart photo contexte */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(20px,4vw,48px)", alignItems: "center" }} className="hist-two-col">
            <div style={{ borderRadius: 22, overflow: "hidden" }}>
              <Image src="/images/leo-tiers-lieu.webp" alt="Léo dans le tiers-lieu" width={900} height={676}
                style={{ width: "100%", height: "auto", display: "block" }} />
            </div>
            <div>
              <p style={{ fontSize: "clamp(18px,2.2vw,24px)", fontWeight: 700, lineHeight: 1.5, color: "#fff", marginBottom: 16 }}>
                "On crée d'abord un gros Drive pour tout centraliser. Puis on réalise que personne ne sait vraiment s'en servir."
              </p>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
                Le numérique, censé aider, avait ajouté une couche de friction supplémentaire. L'outil était devenu le problème.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 4. LE TOURNANT ══ */}
      <section style={{ padding: "clamp(64px,9vw,108px) 0", background: "linear-gradient(180deg, #FFFBF0, #FFF5EE)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: "clamp(32px,5vw,72px)", alignItems: "start" }} className="hist-two-col hist-two-col-rev">

            {/* Portrait */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ borderRadius: 22, overflow: "hidden" }}>
                <Image src="/images/leo-portrait.webp" alt="Léo Durand" width={800} height={1422}
                  style={{ width: "100%", height: "auto", display: "block" }} />
              </div>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { n: "+50", l: "associations accompagnées" },
                  { n: "10 ans", l: "de création de sites web" },
                  { n: "1", l: "tiers-lieu construit de zéro" },
                  { n: "∞", l: "mails évités chaque semaine" },
                ].map((s) => (
                  <div key={s.l} style={{ background: "#fff", border: "1.5px solid #EDE8E3", borderRadius: 16, padding: "16px 16px", textAlign: "center", boxShadow: "0 2px 10px rgba(44,44,44,0.05)" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#E8714D", lineHeight: 1 }}>{s.n}</div>
                    <div style={{ fontSize: 11.5, color: "#6B6460", lineHeight: 1.4, marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Texte */}
            <div style={{ paddingTop: 8 }}>
              <Eyebrow variant="blue">Le tournant</Eyebrow>
              <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)", fontWeight: 800, lineHeight: 1.12, marginBottom: 20 }}>
                Quelqu'un qui connaît le métier.
              </h2>
              <p style={{ fontSize: 16, color: "#3A3A3A", lineHeight: 1.8, marginBottom: 16 }}>
                <strong>Léo Durand</strong> a 30 ans. Il coordonne Bernard Kohn au quotidien et dirige une agence de communication dédiée aux associations — dans l'écologie, l'environnement, la thérapie et le sens du collectif.
              </p>
              <p style={{ fontSize: 16, color: "#3A3A3A", lineHeight: 1.8, marginBottom: 16 }}>
                En dix ans, il a créé des sites web pour des dizaines de structures. Accompagné plus de cinquante associations. Et partout, il a vu le même chaos : des outils qui s'accumulent, des équipes épuisées par l'administration, des WordPress devenus impossibles à maintenir.
              </p>
              <p style={{ fontSize: 16, color: "#3A3A3A", lineHeight: 1.8, marginBottom: 28 }}>
                Ce n'est pas un problème propre à Bernard Kohn. <strong>C'est structurel.</strong> La gestion associative est universellement épuisante — et personne n'avait encore construit l'outil à sa mesure.
              </p>
              <div style={{ background: "#FFF0EB", border: "1.5px solid #FFB4A2", borderRadius: 16, padding: "18px 22px" }}>
                <p style={{ fontSize: 15, color: "#E8714D", fontWeight: 600, lineHeight: 1.7, margin: 0 }}>
                  "On ne manque pas de bonne volonté. On manque d'un outil qui comprend comment fonctionne vraiment un tiers-lieu."
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ 5. ENCART PHOTO PLEINE LARGEUR ══ */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
        <PhotoEncart
          label="Photo lieu en action — vie collective"
          ratio="21/9"
          note="Format cinémascope · événement / atelier / moment de vie collective"
        />
      </div>

      {/* ══ 6. LA PHILOSOPHIE ══ */}
      <section style={{ padding: "clamp(64px,9vw,108px) 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto clamp(40px,5vw,60px)" }}>
            <Eyebrow>La philosophie</Eyebrow>
            <h2 style={{ fontSize: "clamp(26px,3.2vw,40px)", fontWeight: 800, lineHeight: 1.12 }}>
              Sobre. Utile. Ancré dans le terrain.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 48 }} className="hist-values-grid">
            {[
              {
                ic: "🌿", title: "Sobre", color: "#2a7d6e", bg: "#E6F4F1",
                text: "Pas de fonctionnalités pour impressionner. Des fonctionnalités pour libérer. Un outil qui s'efface derrière l'action.",
              },
              {
                ic: "🎯", title: "Utile", color: "#E8714D", bg: "#FFF0EB",
                text: "Chaque module répond à un vrai besoin de terrain, pas à une roadmap de startup. Si ça ne sert à rien au quotidien, ça n'existe pas.",
              },
              {
                ic: "🤝", title: "Collectif", color: "#0e6e7a", bg: "#E6F4F7",
                text: "L'outil est pensé pour des équipes bénévoles, des coordinateurs sur-sollicités, des lieux qui vivent de la diversité de leurs membres.",
              },
            ].map((v) => (
              <div key={v.title} style={{ background: "#fff", border: "1.5px solid #EDE8E3", borderRadius: 20, padding: "28px 24px", boxShadow: "0 2px 14px rgba(44,44,44,0.05)" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: v.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16 }}>{v.ic}</div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: v.color, marginBottom: 10 }}>{v.title}</h3>
                <p style={{ fontSize: 14, color: "#6B6460", lineHeight: 1.7, margin: 0 }}>{v.text}</p>
              </div>
            ))}
          </div>

          {/* Encart photo ambiance */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(20px,4vw,48px)" }} className="hist-two-col">
            <PhotoEncart
              src="/images/detail-architectural.webp"
              alt="Détail architectural Bernard Kohn"
              width={800}
              height={1067}
              label="Détail"
            />
            <PhotoEncart
              src="/images/jardin.webp"
              alt="Jardin et lumière"
              width={800}
              height={600}
              label="Jardin"
            />
          </div>
        </div>
      </section>

      {/* ══ 7. LA VISION — CTA ══ */}
      <section style={{ background: "linear-gradient(135deg, #2C2C2C, #1a1a1a)", color: "#fff", padding: "clamp(64px,9vw,108px) 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 28px", textAlign: "center", position: "relative" }}>
          <Eyebrow variant="dark">La vision</Eyebrow>
          <h2 style={{ fontSize: "clamp(28px,3.8vw,46px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>
            Un seul outil.<br />Tout relié. Rien de superflu.
          </h2>
          <p style={{ fontSize: "clamp(16px,1.8vw,19px)", color: "rgba(255,255,255,0.7)", lineHeight: 1.75, marginBottom: 40, maxWidth: "54ch", marginLeft: "auto", marginRight: "auto" }}>
            Ce qu'on voudrait entendre, un jour, d'un coordinateur de tiers-lieu croisé par hasard :
          </p>
          <blockquote style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,138,101,0.3)", borderRadius: 20, padding: "28px 32px", marginBottom: 44, fontStyle: "italic", fontSize: "clamp(16px,1.8vw,19px)", lineHeight: 1.75, color: "rgba(255,255,255,0.9)" }}>
            <span style={{ color: "#FF8A65", fontStyle: "normal", fontWeight: 700 }}>"</span>
            Grâce à toi, j'ai un seul outil qui unifie notre organisation, simplifie nos échanges, mesure notre impact et permet aux gens de nous découvrir plus facilement.
            <span style={{ color: "#FF8A65", fontStyle: "normal", fontWeight: 700 }}>"</span>
          </blockquote>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/site/bernard-kohn" style={{ padding: "16px 30px", borderRadius: 100, background: "#FF8A65", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 8px 20px rgba(255,138,101,0.3)" }}>
              Découvrir le lieu pilote →
            </Link>
            <Link href="/" style={{ padding: "16px 30px", borderRadius: 100, background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.2)", color: "#fff", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ background: "#1A1A1A", color: "rgba(255,255,255,0.7)", padding: "40px 0 24px", fontSize: 13 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 14, color: "#fff", textDecoration: "none" }}>
            <img src="/logo-icon.webp" alt="" style={{ width: 28, height: 28, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            Casa Minga Lieux
          </Link>
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)" }}>© {new Date().getFullYear()} — Pensé depuis le terrain · Sobriété numérique</span>
        </div>
      </footer>
    </main>
  );
}
