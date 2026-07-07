"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

type CS = React.CSSProperties;

const ACCENT = "#FE8B65";

const MENU_GROUPS = [
  {
    title: "Découvrir",
    items: [
      { num: "01", l: "Accueil", href: "/" },
      { num: "02", l: "Notre approche", href: "/approche" },
      { num: "03", l: "La plateforme", href: "/fonctionnement" },
      { num: "04", l: "Notre histoire", href: "/histoire" },
      { num: "05", l: "Centre d'aide", href: "/aide" },
    ],
  },
  {
    title: "Essayer",
    items: [
      { num: "06", l: "Voir un lieu en action", href: "/site/bernard-kohn" },
      { num: "07", l: "Connexion", href: "/login" },
      { num: "08", l: "S'inscrire", href: "/signup" },
    ],
  },
];

const STATS = [
  { n: "1 240", l: "personnes accueillies" },
  { n: "38", l: "événements organisés" },
  { n: "2 180 h", l: "de bénévolat" },
  { n: "9", l: "résidences accueillies" },
  { n: "14", l: "partenaires actifs" },
  { n: "28k €", l: "revenus propres" },
];

const PILIERS = [
  { num: "01", t: "Accueillir", img: "/accueil/p-pilier1.jpg", delay: ".1s", d: "Demandes, personnes, résidences, événements : tous les flux d'arrivée par un même point d'entrée." },
  { num: "02", t: "Organiser", img: "/accueil/p-pilier2.jpg", delay: ".22s", d: "Espaces, réservations, documents, tâches : le quotidien sans réinventer Excel à chaque fois." },
  { num: "03", t: "Piloter", img: "/accueil/p-pilier3.jpg", delay: ".34s", d: "Finances, impact, partenaires, gouvernance : la vue stratégique du lieu, pour l'équipe et les financeurs." },
  { num: "04", t: "Publier", img: "/accueil/p-pilier4.jpg", delay: ".46s", d: "Site public, formulaires, médiathèque : ce que le lieu produit sort à l'extérieur sans double saisie." },
];

const DRAW_SVG = (
  <svg viewBox="0 0 220 80" fill="none" preserveAspectRatio="none" style={{ position: "absolute", inset: "-4px -8px", width: "calc(100% + 16px)", height: "calc(100% + 8px)" }}>
    <path pathLength={1} d="M168 11C92 4 24 18 19 42 14 65 72 81 142 78 213 75 227 52 218 35 211 21 175 12 120 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </svg>
);

const GLOBAL_CSS = `
  #cm-root * { box-sizing: border-box; }
  #cm-scroller::-webkit-scrollbar { height: 0; width: 0; }
  #cm-scroller { scrollbar-width: none; }
  @keyframes cmSpin { to { transform: rotate(360deg); } }
  @keyframes cmFloatA { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-26px); } }
  @keyframes cmFloatB { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(22px) rotate(2deg); } }
  @keyframes cmDrift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-18px,14px); } }
  @keyframes cmHint { 0%,100% { transform: translateX(0); opacity: .55; } 50% { transform: translateX(10px); opacity: 1; } }
  #cm-root .rv { transform: translateY(26px); }
  #cm-root .rv[data-shown] { transform: none; transition: transform 1.3s cubic-bezier(.16,.84,.28,1) var(--d,0s); }
  #cm-root .lr-line { display: block; overflow: hidden; }
  #cm-root .lr-in { display: block; will-change: transform; }
  #cm-root .line-reveal.armed .lr-line { padding-bottom: .14em; margin-bottom: -.14em; }
  #cm-root .line-reveal.armed .lr-in { transform: translateY(120%); }
  #cm-root .line-reveal.armed[data-shown] .lr-in { transform: translateY(0); transition: transform 1.4s cubic-bezier(.16,.84,.28,1); }
  #cm-root .line-reveal.lr-done .lr-in { transform: none !important; transition: none !important; }
  #cm-root .cm-draw svg path { stroke-dasharray: 1; stroke-dashoffset: 1; }
  #cm-root .cm-draw.drawn svg path { stroke-dashoffset: 0; transition: stroke-dashoffset 1.05s cubic-bezier(.65,0,.35,1) var(--draw-delay,.15s); }
  #cm-menu-btn:hover { transform: scale(1.04); }
  .cm-menu-item:hover { color: #FE8B65 !important; padding-left: 14px; }
  #cm-login:hover { background: #FFFFFF; transform: scale(1.04); }
  @media (prefers-reduced-motion: reduce) {
    #cm-root .rv, #cm-root .rv[data-shown] { transform: none; transition: none; }
    #cm-root .cm-draw svg path { stroke-dashoffset: 0; }
  }
`;

export default function HomeLanding() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const demoBtnRef = useRef<HTMLAnchorElement>(null);
  const loginRef = useRef<HTMLAnchorElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // load fonts not in root layout
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    const addLink = (rel: string, href: string, extra?: Partial<HTMLLinkElement>) => {
      const el = document.createElement("link");
      el.rel = rel;
      el.href = href;
      if (extra) Object.assign(el, extra);
      document.head.appendChild(el);
      links.push(el);
    };
    addLink("preconnect", "https://fonts.googleapis.com");
    addLink("preconnect", "https://fonts.gstatic.com", { crossOrigin: "anonymous" });
    addLink("stylesheet", "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&display=swap");
    return () => { links.forEach(l => document.head.removeChild(l)); };
  }, []);

  // main scroll/animation logic
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // video autoplay
    const heroVideo = scroller.querySelector("video") as HTMLVideoElement | null;
    if (heroVideo) {
      heroVideo.muted = true;
      heroVideo.playsInline = true;
      heroVideo.loop = true;
      const playV = () => { const p = heroVideo.play(); if (p?.catch) p.catch(() => {}); };
      playV();
      window.addEventListener("pointerdown", playV, { once: true });
      document.addEventListener("visibilitychange", () => { if (!document.hidden) playV(); });
    }

    // infinite loop: clone first/last panels
    const reals = [...scroller.children] as HTMLElement[];
    const N = reals.length;
    let vw = scroller.clientWidth;
    let loopW = N * vw;
    const headClone = reals[N - 1].cloneNode(true) as HTMLElement;
    const tailClone = reals[0].cloneNode(true) as HTMLElement;
    [headClone, tailClone].forEach(c => { c.setAttribute("data-clone", ""); c.setAttribute("aria-hidden", "true"); });
    scroller.insertBefore(headClone, reals[0]);
    scroller.appendChild(tailClone);
    scroller.scrollLeft = vw;

    let targetScroll = vw;
    let raf: number | null = null;

    const wrap = () => {
      if (scroller.scrollLeft >= (N + 1) * vw) { scroller.scrollLeft -= loopW; targetScroll -= loopW; }
      else if (scroller.scrollLeft <= 0) { scroller.scrollLeft += loopW; targetScroll += loopW; }
    };

    const lerpFn = () => {
      wrap();
      const cur = scroller.scrollLeft;
      const d = targetScroll - cur;
      if (Math.abs(d) < 0.6) { scroller.scrollLeft = targetScroll; wrap(); raf = null; return; }
      scroller.scrollLeft = cur + d * 0.16;
      raf = requestAnimationFrame(lerpFn);
    };

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        if (raf === null) targetScroll = scroller.scrollLeft;
        targetScroll += e.deltaY;
        if (raf === null) raf = requestAnimationFrame(lerpFn);
      }
    };

    const handleScrollWrap = () => { if (raf === null) wrap(); };
    const handleResize = () => { vw = scroller.clientWidth; loopW = N * vw; };

    scroller.addEventListener("wheel", handleWheel, { passive: false });
    scroller.addEventListener("scroll", handleScrollWrap, { passive: true });
    window.addEventListener("resize", handleResize);

    // reveal helpers
    const inView = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.left < vw && r.right > 0;
    };
    const reveal = (el: Element) => {
      el.setAttribute("data-shown", "");
      if (el.classList.contains("line-reveal")) {
        setTimeout(() => el.classList.add("lr-done"), 2200);
      }
    };

    const io = new IntersectionObserver(
      (entries) => entries.forEach(en => { if (en.isIntersecting) reveal(en.target); }),
      { root: scroller, threshold: 0.12 }
    );
    document.querySelectorAll(".rv").forEach(el => { io.observe(el); if (inView(el)) reveal(el); });

    // SVG draw circles
    const drawIO = new IntersectionObserver(
      (entries) => entries.forEach(en => {
        if (en.isIntersecting) en.target.classList.add("drawn");
        else en.target.classList.remove("drawn");
      }),
      { root: scroller, threshold: 0.55 }
    );
    document.querySelectorAll(".cm-draw").forEach(el => { drawIO.observe(el); if (inView(el)) el.classList.add("drawn"); });

    // line-reveal: split into visual lines then animate
    const splitLines = (el: HTMLElement) => {
      if (el.dataset.lines === "manual") {
        el.classList.add("armed");
        [...el.children].forEach((child, i) => {
          const line = document.createElement("span"); line.className = "lr-line";
          const inner = document.createElement("span"); inner.className = "lr-in";
          inner.style.transitionDelay = i * 0.14 + "s";
          const styleAttr = child.getAttribute("style");
          if (styleAttr) inner.style.cssText += ";" + styleAttr;
          while (child.firstChild) inner.appendChild(child.firstChild);
          line.appendChild(inner);
          el.replaceChild(line, child);
        });
        return;
      }
      // word-based line detection
      type WordFrag = { w: string; color: string; italic: boolean };
      const frag: WordFrag[] = [];
      const collect = (node: Node) => {
        node.childNodes.forEach(c => {
          if (c.nodeType === 3) {
            const cs = getComputedStyle(node as Element);
            (c.textContent ?? "").split(/(\s+)/).forEach(t => {
              if (t.trim() !== "") frag.push({ w: t, color: cs.color, italic: cs.fontStyle === "italic" });
            });
          } else if (c.nodeType === 1) { collect(c); }
        });
      };
      collect(el);
      if (!frag.length) return;
      el.textContent = "";
      const ws = frag.map(f => {
        const s = document.createElement("span");
        s.textContent = f.w;
        s.style.display = "inline-block";
        s.style.color = f.color;
        if (f.italic) s.style.fontStyle = "italic";
        el.appendChild(s);
        el.appendChild(document.createTextNode(" "));
        return s;
      });
      const lines: HTMLSpanElement[][] = []; let topY: number | null = null; let curL: HTMLSpanElement[] | null = null;
      ws.forEach(w => {
        const t = w.offsetTop;
        if (topY === null || Math.abs(t - topY) > 6) { curL = []; lines.push(curL); topY = t; }
        curL!.push(w);
      });
      el.textContent = "";
      lines.forEach((arr, i) => {
        const line = document.createElement("span"); line.className = "lr-line";
        const inner = document.createElement("span"); inner.className = "lr-in";
        inner.style.transitionDelay = i * 0.14 + "s";
        arr.forEach((w, j) => { w.style.display = ""; inner.appendChild(w); if (j < arr.length - 1) inner.appendChild(document.createTextNode(" ")); });
        line.appendChild(inner);
        el.appendChild(line);
      });
      el.classList.add("armed");
    };

    const animate = !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const armAll = () => {
      document.querySelectorAll<HTMLElement>(".line-reveal").forEach(el => { splitLines(el); io.observe(el); });
      requestAnimationFrame(() => {
        document.querySelectorAll(".line-reveal").forEach(el => { if (inView(el)) reveal(el); });
      });
    };
    if (animate) {
      if (document.fonts.ready) document.fonts.ready.then(armAll);
      else armAll();
    }

    // chrome theme per panel (only panel 0 is dark)
    const darkScene = [true, false, false, false, false, false, false, false];
    const wm = wordmarkRef.current;
    const demo = demoBtnRef.current;
    const prog = progressRef.current;
    const hint = hintRef.current;
    const login = loginRef.current;
    let curScene = -1;
    const applyTheme = (i: number) => {
      if (i === curScene) return; curScene = i;
      const dark = darkScene[i];
      if (wm) wm.style.color = dark ? "#FFF9EC" : "#2C2D2D";
      if (demo) { demo.style.background = dark ? ACCENT : "#2C2D2D"; demo.style.color = dark ? "#2C2D2D" : "#FFF9EC"; }
      // login : fond crème permanent → lisible sur tous les panneaux, pas de swap
      void login;
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const pos = (((scroller.scrollLeft - vw) % loopW) + loopW) % loopW;
        const p = loopW > 0 ? pos / loopW : 0;
        if (prog) prog.style.width = 6 + p * 94 + "%";
        if (hint) hint.style.opacity = scroller.scrollLeft > vw + 40 ? "0" : "1";
        const idx = ((Math.round(scroller.scrollLeft / vw) - 1) % N + N) % N;
        applyTheme(idx);
        document.querySelectorAll(".rv:not([data-shown]),.line-reveal:not([data-shown])").forEach(el => { if (inView(el)) reveal(el); });
        ticking = false;
      });
    };
    scroller.addEventListener("scroll", onScroll);
    applyTheme(0);

    // menu + navigation
    const goTo = (i: number) => { targetScroll = (i + 1) * vw; if (raf === null) raf = requestAnimationFrame(lerpFn); };
    const menu = menuRef.current;
    const openMenu = () => { if (menu) menu.style.display = "flex"; };
    const closeMenu = () => { if (menu) menu.style.display = "none"; };
    const menuBtn = document.getElementById("cm-menu-btn");
    const menuClose = document.getElementById("cm-menu-close");
    if (menuBtn) menuBtn.addEventListener("click", openMenu);
    if (menuClose) menuClose.addEventListener("click", closeMenu);
    document.querySelectorAll<HTMLAnchorElement>(".cm-menu-item").forEach(b => {
      b.addEventListener("click", closeMenu);
    });

    return () => {
      scroller.removeEventListener("wheel", handleWheel);
      scroller.removeEventListener("scroll", handleScrollWrap);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", handleResize);
      io.disconnect();
      drawIO.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  const panelBase: CS = { flex: "0 0 100vw", width: "100vw", height: "100vh", position: "relative", overflow: "hidden" };
  const monoTag: CS = { fontFamily: "var(--font-dmmono), monospace", fontSize: "13px", letterSpacing: ".2em", textTransform: "uppercase" };
  const displayFont = "var(--font-dmserif), Georgia, serif";
  const pad: CS = { padding: "0 clamp(28px,5vw,64px)" };

  return (
    <div
      id="cm-root"
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "#222323", fontFamily: "'DM Sans', system-ui, sans-serif", "--accent": ACCENT, "--display": "var(--font-dmserif)" } as CS}
    >
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />

      {/* ── FIXED CHROME ── */}
      <div style={{ position: "fixed", top: 0, left: 0, display: "flex", alignItems: "center", gap: "13px", padding: "26px 0 0 clamp(28px,5vw,64px)", zIndex: 50, pointerEvents: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-maloka.webp" alt="Casa Minga" style={{ height: "42px", width: "auto", display: "block" }} />
        <div ref={wordmarkRef} style={{ lineHeight: 1, color: "#FFF9EC", transition: "color .5s ease" }}>
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "18px", letterSpacing: "-.02em" }}>Casa Minga</div>
          <div style={{ fontFamily: "var(--font-dmmono), monospace", fontSize: "10px", letterSpacing: ".22em", textTransform: "uppercase", opacity: .6, marginTop: "3px" }}>Lieux</div>
        </div>
      </div>

      <button id="cm-menu-btn" style={{ position: "fixed", top: "24px", right: "clamp(20px,4vw,52px)", zIndex: 51, width: "58px", height: "58px", borderRadius: "50%", border: "none", cursor: "pointer", background: "#FFF9EC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "5px", boxShadow: "0 10px 30px -10px rgba(0,0,0,.45)", transition: "transform .2s ease" }}>
        <span style={{ width: "22px", height: "2px", background: "#2C2D2D", borderRadius: "2px" }} />
        <span style={{ width: "22px", height: "2px", background: "#2C2D2D", borderRadius: "2px" }} />
        <span style={{ width: "22px", height: "2px", background: "#2C2D2D", borderRadius: "2px" }} />
      </button>

      <a ref={loginRef} id="cm-login" href="/login" style={{ position: "fixed", top: "31px", right: "calc(clamp(20px,4vw,52px) + 72px)", zIndex: 51, display: "flex", alignItems: "center", gap: "9px", padding: "13px 22px", borderRadius: "40px", textDecoration: "none", fontFamily: "var(--font-dmmono), monospace", fontSize: "13px", letterSpacing: ".04em", border: "none", color: "#2C2D2D", background: "#FFF9EC", boxShadow: "0 10px 30px -10px rgba(0,0,0,.45)", transition: "background .25s ease, transform .2s ease" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg>
        Connexion
      </a>

      <a ref={demoBtnRef} id="cm-demo-btn" href="/signup" style={{ position: "fixed", bottom: "26px", right: "clamp(20px,4vw,52px)", zIndex: 51, display: "flex", alignItems: "center", gap: "10px", padding: "14px 22px", borderRadius: "40px", textDecoration: "none", fontFamily: "var(--font-dmmono), monospace", fontSize: "13px", letterSpacing: ".04em", background: ACCENT, color: "#2C2D2D", fontWeight: 500, boxShadow: "0 12px 32px -10px rgba(0,0,0,.5)", transition: "background .5s ease, color .5s ease, transform .25s ease" }}>
        <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(44,45,45,.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>✦</span>
        Créer mon espace gratuit
      </a>

      <div style={{ position: "fixed", left: 0, bottom: 0, width: "100vw", height: "3px", background: "rgba(0,0,0,.10)", zIndex: 50 }}>
        <div ref={progressRef} id="cm-progress" style={{ height: "100%", width: "6%", background: ACCENT, transition: "width .12s linear" }} />
      </div>

      <div ref={hintRef} id="cm-hint" style={{ position: "fixed", left: "clamp(28px,5vw,64px)", bottom: "46px", zIndex: 40, display: "flex", alignItems: "center", gap: "12px", color: "#FFF9EC", transition: "opacity .5s ease" }}>
        <span style={{ ...monoTag, fontSize: "12px", letterSpacing: ".18em", opacity: .8 }}>Défilez</span>
        <svg width="48" height="14" viewBox="0 0 48 14" fill="none" className="amb" style={{ animation: "cmHint 1.8s ease-in-out infinite" }}>
          <path d="M1 7h42M37 2l7 5-7 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* ── MENU OVERLAY ── */}
      <div ref={menuRef} id="cm-menu" style={{ position: "fixed", inset: 0, zIndex: 60, background: "#222323", display: "none", flexDirection: "column", justifyContent: "center", padding: "0 clamp(32px,8vw,120px)" }}>
        <button id="cm-menu-close" style={{ position: "absolute", top: "24px", right: "clamp(20px,4vw,52px)", width: "58px", height: "58px", borderRadius: "50%", border: "none", cursor: "pointer", background: "#FFF9EC", color: "#2C2D2D", fontSize: "24px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        <div style={{ ...monoTag, color: ACCENT, marginBottom: "26px" }}>Navigation</div>
        {MENU_GROUPS.map((g, gi) => (
          <div key={g.title} style={{ marginTop: gi === 0 ? 0 : "28px" }}>
            <div style={{ fontFamily: "var(--font-dmmono), monospace", fontSize: "11.5px", letterSpacing: ".18em", textTransform: "uppercase", color: "rgba(255,249,236,.4)", marginBottom: "10px" }}>{g.title}</div>
            {g.items.map(m => (
              <Link key={m.href} href={m.href} className="cm-menu-item" style={{ display: "flex", alignItems: "baseline", gap: "20px", textDecoration: "none", padding: "6px 0", color: "#FFF9EC", fontFamily: displayFont, fontSize: "clamp(26px,4vw,50px)", lineHeight: 1, transition: "color .25s ease, padding-left .25s ease" }}>
                <span style={{ fontFamily: "var(--font-dmmono), monospace", fontSize: "13px", letterSpacing: ".1em", opacity: .45 }}>{m.num}</span>
                {m.l}
              </Link>
            ))}
          </div>
        ))}
      </div>

      {/* ── HORIZONTAL SCROLLER ── */}
      <div ref={scrollerRef} id="cm-scroller" style={{ height: "100vh", width: "100vw", display: "flex", overflowX: "auto", overflowY: "hidden" }}>

        {/* PANEL 0 · HERO */}
        <section style={{ ...panelBase, background: "#1b1c1c" }}>
          <video autoPlay muted loop playsInline poster="/accueil/p-hero.jpg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}>
            <source src="/accueil/tiers-lieu-bernard-kohn-saint-mande-header.mp4" type="video/mp4" />
          </video>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(20,21,21,.74) 0%,rgba(20,21,21,.34) 46%,rgba(20,21,21,.12) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent 88%,rgba(255,249,236,.5) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", ...pad }}>
            <h1 className="line-reveal" data-lines="manual" style={{ margin: 0, fontFamily: displayFont, fontWeight: 400, color: "#FFF9EC", fontSize: "clamp(52px,11vw,168px)", lineHeight: .92, letterSpacing: "-.01em", textShadow: "0 4px 40px rgba(0,0,0,.45)" }}>
              <span style={{ display: "block" }}>Faire vivre</span>
              <span style={{ display: "block" }}>les lieux</span>
              <span style={{ display: "block", fontStyle: "italic", color: ACCENT }}>collectifs.</span>
            </h1>
            <div className="rv" style={{ "--d": ".4s", marginTop: "30px", fontFamily: "var(--font-dmmono), monospace", fontSize: "clamp(13px,1.4vw,16px)", letterSpacing: ".2em", textTransform: "uppercase", color: "rgba(255,249,236,.85)" } as CS}>
              un lieu à la fois
            </div>
          </div>
        </section>

        {/* PANEL 1 · LE MOUVEMENT */}
        <section style={{ ...panelBase, background: "linear-gradient(90deg,#FFF9EC,#FDF2E7)", display: "flex", alignItems: "center", gap: "clamp(32px,5vw,80px)", ...pad }}>
          <div style={{ flex: 1, maxWidth: "560px" }}>
            <div className="rv" style={{ "--d": ".05s", display: "flex", alignItems: "center", gap: "16px", marginBottom: "34px" } as CS}>
              <span style={{ fontFamily: "var(--font-dmmono), monospace", fontSize: "13px", letterSpacing: ".2em", textTransform: "uppercase", color: "#9a8d7e" }}>Né depuis le terrain</span>
              <svg width="60" height="22" viewBox="0 0 60 22" fill="none" style={{ color: ACCENT }}><path d="M1 4c20 2 38 6 46 14M40 18l8 1 1-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="line-reveal" style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: "clamp(30px,4.4vw,62px)", lineHeight: 1.04, letterSpacing: "-.02em", color: "#2C2D2D" }}>
              Des centaines de personnes, de résidences et d&apos;événements <span style={{ color: ACCENT }}>coordonnés</span> — dans un seul outil, simple et vivant.
            </p>
          </div>
          <div className="amb" style={{ flex: "0 0 auto", width: "clamp(340px,46vw,640px)", position: "relative", animation: "cmFloatA 7s ease-in-out infinite" }}>
            <span style={{ position: "absolute", left: "-64px", right: "-30px", top: "50%", height: "2px", background: ACCENT, transform: "translateY(-50%)", zIndex: 0 }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/accueil/p-equipe.jpg" alt="Ouverture du Tiers-lieu Bernard Kohn" style={{ position: "relative", zIndex: 1, width: "100%", height: "auto", aspectRatio: "5/4", display: "block", objectFit: "cover", borderRadius: "24px", boxShadow: "0 32px 64px -28px rgba(44,45,45,.45)" }} />
            <figcaption style={{ position: "relative", zIndex: 1, marginTop: "12px", fontFamily: "var(--font-dmmono), monospace", fontSize: "11px", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(44,45,45,.45)", textAlign: "center" }}>
              Ouverture du Tiers-lieu Bernard Kohn
            </figcaption>
          </div>
        </section>

        {/* PANEL 2 · LE NOM */}
        <section style={{ ...panelBase, background: "linear-gradient(90deg,#FDF2E7,#FBEADD)", display: "flex", alignItems: "center", gap: "clamp(28px,5vw,80px)", ...pad }}>
          <div style={{ flex: 1, maxWidth: "680px" }}>
            <div className="rv" style={{ "--d": ".05s", fontFamily: "var(--font-dmmono), monospace", fontSize: "13px", letterSpacing: ".2em", textTransform: "uppercase", color: "#b5572f", marginBottom: "26px" } as CS}>D&apos;où vient le nom</div>
            <h2 className="line-reveal" style={{ margin: "0 0 32px", fontFamily: "'Poppins', sans-serif", fontWeight: 500, fontSize: "clamp(46px,6.4vw,104px)", lineHeight: .94, letterSpacing: "-.015em", color: "#2C2D2D" }}>
              Casa <span style={{ fontStyle: "italic", color: "#b5572f" }}>Minga.</span>
            </h2>
            <div className="rv" style={{ "--d": ".24s", maxWidth: "580px" } as CS}>
              <p style={{ margin: "0 0 18px", fontSize: "clamp(15px,1.35vw,19px)", lineHeight: 1.62, color: "rgba(44,45,45,.78)" }}>
                <strong style={{ color: "#2C2D2D", fontWeight: 700 }}>Une minga</strong> — du quechua <em>mink&apos;a</em> — est une tradition sud-américaine de travail collectif, festif et convivial, mis au service d&apos;une communauté.
              </p>
              <p style={{ margin: "0 0 18px", fontSize: "clamp(15px,1.35vw,19px)", lineHeight: 1.62, color: "rgba(44,45,45,.78)" }}>
                On s&apos;y retrouve quand un effort compte vraiment : récoltes, constructions, grands moments de la vie d&apos;un lieu. <strong style={{ color: "#2C2D2D", fontWeight: 700 }}>Casa</strong>, c&apos;est la maison qui abrite ce commun.
              </p>
              <p style={{ margin: 0, fontSize: "clamp(15px,1.35vw,19px)", lineHeight: 1.62, color: "#2C2D2D", fontStyle: "italic" }}>
                Léo a créé Casa Minga pour faciliter le vivre ensemble. <span style={{ color: "#b5572f", fontStyle: "normal", fontWeight: 600 }}>Contribuons ensemble à développer cette philosophie.</span>
              </p>
            </div>
            <div className="rv" style={{ "--d": ".36s", marginTop: "30px", display: "flex", alignItems: "center", gap: "14px", fontFamily: "var(--font-dmmono), monospace", fontSize: "12px", letterSpacing: ".08em", textTransform: "uppercase", color: "#9a8d7e" } as CS}>
              <span style={{ width: "26px", height: "1px", background: "#c9a98f" }} />
              Pérou · Équateur · Bolivie · Chili
            </div>
          </div>
          <div className="amb" style={{ flex: "0 0 auto", width: "clamp(280px,40vw,560px)", animation: "cmFloatA 8s ease-in-out infinite" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/accueil/maloka-clean.webp" alt="Minga — cercle de travail collectif sous la casa" style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 22px 44px rgba(110,66,48,.24))" }} />
          </div>
        </section>

        {/* PANEL 3 · LA PLATEFORME */}
        <section style={{ ...panelBase, background: "linear-gradient(90deg,#FDF2E7,#FAE6D5)", display: "flex", flexDirection: "column", justifyContent: "center", gap: "clamp(28px,3vw,48px)", ...pad }}>
          {/* Top: texte + mockup */}
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(32px,4vw,72px)" }}>
            {/* Gauche */}
            <div style={{ flex: "0 0 auto", maxWidth: "clamp(280px,36vw,500px)" }}>
              <div className="rv" style={{ "--d": ".05s", ...monoTag, color: "#b5572f", marginBottom: "18px" } as CS}>Le produit</div>
              <h2 className="line-reveal" style={{ margin: "0 0 18px", fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(28px,4vw,58px)", lineHeight: 1, letterSpacing: "-.01em", color: "#2C2D2D" }}>
                Le système de pilotage des <span style={{ fontStyle: "italic", color: ACCENT }}>tiers-lieux</span> et lieux collectifs.
              </h2>
              <p className="rv" style={{ "--d": ".12s", margin: "0 0 22px", fontSize: "clamp(13px,1.1vw,15.5px)", lineHeight: 1.6, color: "rgba(44,45,45,.62)" } as CS}>
                17 modules métier articulés autour des usages réels d&apos;un tiers-lieu — sans sur-ingénierie.
              </p>
              <ul className="rv" style={{ "--d": ".18s", listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: "9px" } as CS}>
                {[
                  ["Demandes & personnes", "boîte unifiée, CRM, membres"],
                  ["Espaces & réservations", "planning, conflits évités"],
                  ["Finances", "factures, dons, prévisionnel"],
                  ["Événements", "programmation et publication"],
                  ["Site public connecté", "vitrine mise à jour automatiquement"],
                ].map(([bold, rest]) => (
                  <li key={bold} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "clamp(12px,0.95vw,14px)", color: "rgba(44,45,45,.8)" }}>
                    <span style={{ color: ACCENT, fontWeight: 800, fontSize: "13px", marginTop: "1px", flexShrink: 0 }}>✓</span>
                    <span><strong style={{ fontWeight: 700 }}>{bold}</strong> — {rest}</span>
                  </li>
                ))}
              </ul>
              <Link href="/site/bernard-kohn" className="rv" style={{ "--d": ".24s", display: "inline-block", padding: "13px 26px", borderRadius: "100px", background: ACCENT, color: "#fff", fontWeight: 700, fontSize: "clamp(12px,0.9vw,14.5px)", textDecoration: "none", letterSpacing: ".01em" } as CS}>
                Découvrir le lieu pilote →
              </Link>
            </div>
            {/* Droite — mockup navigateur */}
            <div className="amb" style={{ flex: 1, minWidth: 0, animation: "cmFloatA 7s ease-in-out infinite" }}>
              {/* Chrome */}
              <div style={{ borderRadius: "14px", overflow: "hidden", boxShadow: "0 28px 60px -18px rgba(44,45,45,.28)", border: "1px solid rgba(44,45,45,.10)", background: "#fff" }}>
                {/* Barre navigateur */}
                <div style={{ background: "#F5F4F0", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid rgba(0,0,0,.07)" }}>
                  <div style={{ display: "flex", gap: "5px" }}>
                    {["#FF5F57","#FFBD2E","#28C840"].map(c => <span key={c} style={{ width: "11px", height: "11px", borderRadius: "50%", background: c, display: "block" }} />)}
                  </div>
                  <div style={{ flex: 1, background: "#ECEAE4", borderRadius: "6px", padding: "4px 12px", fontSize: "11px", color: "rgba(44,45,45,.5)", fontFamily: "var(--font-dmmono), monospace" }}>
                    admin.casaminga.com/dashboard/bernard-kohn
                  </div>
                </div>
                {/* Dashboard */}
                <div style={{ display: "flex", height: "clamp(220px,26vw,380px)" }}>
                  {/* Sidebar */}
                  <div style={{ width: "140px", background: "#2C2D2D", padding: "14px 0", flexShrink: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                    {[
                      { label: "Dashboard", group: "PILOTAGE" },
                      { label: "Demandes" },
                      { label: "Personnes" },
                      { label: "Tâches", active: true },
                      { label: "Espaces", group: "LIEU" },
                      { label: "Événements" },
                      { label: "Finances", group: "FINANCES" },
                      { label: "Factures" },
                    ].map((item) => (
                      <div key={item.label}>
                        {item.group && <div style={{ padding: "8px 14px 3px", fontSize: "8.5px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.3)" }}>{item.group}</div>}
                        <div style={{ margin: "1px 6px", padding: "5px 10px", borderRadius: "6px", fontSize: "11px", color: item.active ? "#fff" : "rgba(255,255,255,.5)", background: item.active ? ACCENT : "transparent", fontWeight: item.active ? 600 : 400 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Contenu */}
                  <div style={{ flex: 1, padding: "16px", background: "#FAFAF7", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#2C2D2D" }}>Tâches &amp; alertes</div>
                      <div style={{ background: ACCENT, color: "#fff", fontSize: "9px", fontWeight: 700, padding: "3px 9px", borderRadius: "100px" }}>+ Nouvelle tâche</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                      {[["12","OUVERTES"],["3","URGENTES"],["5","ALERTES"]].map(([n, l]) => (
                        <div key={l} style={{ flex: 1, background: "#fff", border: "1px solid #EEEBE4", borderRadius: "8px", padding: "8px 10px" }}>
                          <div style={{ fontSize: "18px", fontWeight: 800, color: "#2C2D2D", lineHeight: 1 }}>{n}</div>
                          <div style={{ fontSize: "8px", color: "rgba(44,45,45,.4)", letterSpacing: ".08em", marginTop: "3px" }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {[
                      { tag: "URGENTE", tagColor: "#FFF0EB", tagText: "#C0550A", text: "Relancer Studio Petite Lune · facture 290 €", badge: "Finances", badgeColor: "#E8F4FF", badgeText: "#1A6FA8" },
                      { tag: "EN COURS", tagColor: "#E8F4FF", tagText: "#1A6FA8", text: "Préparer dossier subvention Région", badge: "Gouvernance", badgeColor: "#F3E8FF", badgeText: "#7A2DBE" },
                      { tag: "À FAIRE", tagColor: "#F5F4F0", tagText: "rgba(44,45,45,.5)", text: "Commander affiches portes ouvertes", badge: "Communication", badgeColor: "#E8FFF3", badgeText: "#0E7A4A" },
                    ].map((row) => (
                      <div key={row.text} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff", border: "1px solid #EEEBE4", borderRadius: "8px", padding: "7px 10px", marginBottom: "6px" }}>
                        <span style={{ background: row.tagColor, color: row.tagText, fontSize: "7px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", flexShrink: 0, letterSpacing: ".05em" }}>{row.tag}</span>
                        <span style={{ flex: 1, fontSize: "10px", color: "#2C2D2D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.text}</span>
                        <span style={{ background: row.badgeColor, color: row.badgeText, fontSize: "7px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px", flexShrink: 0 }}>{row.badge}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Bas — modules en pills */}
          <div className="rv" style={{ "--d": ".3s", display: "flex", flexWrap: "wrap", gap: "8px" } as CS}>
            {["Demandes","Personnes","Espaces","Réservations","Résidences","Événements","Tâches","Finances","Factures","Dépenses","Subventions","Dons","Documents","Gouvernance","Impact","Communication","Site public"].map(m => (
              <span key={m} style={{ padding: "5px 13px", borderRadius: "100px", border: "1px solid rgba(44,45,45,.15)", fontSize: "clamp(10.5px,0.8vw,12.5px)", color: "rgba(44,45,45,.65)", background: "rgba(255,255,255,.55)", whiteSpace: "nowrap" }}>{m}</span>
            ))}
          </div>
        </section>

        {/* PANEL 4 · NOTRE IMPACT */}
        <section style={{ ...panelBase, background: "linear-gradient(90deg,#FAE6D5,#F6D2B8)", display: "flex", alignItems: "center", gap: "clamp(30px,5vw,90px)", ...pad }}>
          <div style={{ flex: 1, maxWidth: "560px" }}>
            <div className="rv" style={{ "--d": ".05s", ...monoTag, color: "#b5572f", marginBottom: "22px" } as CS}>Voir notre portée</div>
            <h2 className="line-reveal" style={{ margin: "0 0 34px", fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(32px,4.6vw,68px)", lineHeight: 1, letterSpacing: "-.01em", color: "#2C2D2D" }}>
              Rendre visible ce que le lieu crée <span style={{ fontStyle: "italic", color: "#b5572f" }}>vraiment.</span>
            </h2>
            <div className="rv" style={{ "--d": ".28s", display: "grid", gridTemplateColumns: "repeat(3,auto)", gap: "26px 38px", marginBottom: "38px" } as CS}>
              {STATS.map(s => (
                <div key={s.l}>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: "clamp(30px,2.9vw,46px)", color: "#2C2D2D", lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontFamily: "var(--font-dmmono), monospace", fontSize: "clamp(12.5px,1.05vw,15px)", letterSpacing: ".03em", color: "rgba(44,45,45,.62)", marginTop: "8px" }}>{s.l}</div>
                </div>
              ))}
            </div>
            <p className="rv" style={{ "--d": ".34s", margin: "-26px 0 34px", fontFamily: "var(--font-dmmono), monospace", fontSize: "11.5px", letterSpacing: ".05em", color: "rgba(44,45,45,.45)" } as CS}>
              Chiffres 2025 du Tiers-lieu Bernard Kohn, lieu pilote de Casa Minga
            </p>
            <Link href="/approche" className="cm-draw rv" style={{ "--d": ".4s", position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "16px 34px", textDecoration: "none", fontFamily: "var(--font-dmmono), monospace", fontSize: "14px", letterSpacing: ".04em", color: "#2C2D2D" } as CS}>
              Notre impact
              {DRAW_SVG}
            </Link>
          </div>
          <div style={{ flex: "0 0 auto", position: "relative", width: "clamp(260px,34vw,460px)", height: "clamp(260px,34vw,460px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px dashed rgba(181,87,47,.45)" }} />
            <div className="amb" style={{ position: "absolute", inset: 0, animation: "cmSpin 26s linear infinite" }}>
              <span style={{ position: "absolute", top: "-5px", left: "50%", width: "10px", height: "10px", borderRadius: "50%", background: ACCENT, transform: "translateX(-50%)" }} />
              <span style={{ position: "absolute", bottom: "14%", right: "6%", width: "7px", height: "7px", borderRadius: "50%", background: "#2C2D2D" }} />
            </div>
            <div className="amb" style={{ width: "78%", height: "78%", animation: "cmSpin 60s linear infinite" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/accueil/eye-bleu.png" alt="Illustration" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          </div>
        </section>

        {/* PANEL 5 · NOTRE HISTOIRE */}
        <section style={{ ...panelBase, background: "linear-gradient(90deg,#F6D2B8,#F2BE9E)", display: "flex", alignItems: "center", gap: "clamp(30px,5vw,80px)", ...pad }}>
          <div style={{ flex: 1, maxWidth: "820px" }}>
            <div className="rv" style={{ "--d": ".05s", fontFamily: displayFont, fontWeight: 400, fontStyle: "italic", color: "#b5572f", fontSize: "clamp(60px,9vw,140px)", lineHeight: .6, height: ".5em" } as CS}>&ldquo;</div>
            <blockquote className="line-reveal" style={{ margin: 0, fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(30px,5vw,76px)", lineHeight: 1.02, letterSpacing: "-.01em", color: "#2C2D2D" }}>
              Le lieu nous parlait, mais nous n&apos;avions pas d&apos;outil pour l&apos;écouter.
            </blockquote>
            <div className="rv" style={{ "--d": ".3s", marginTop: "34px", display: "flex", alignItems: "center", gap: "22px" } as CS}>
              <span style={{ fontFamily: "var(--font-dmmono), monospace", fontSize: "13px", letterSpacing: ".06em", color: "#6b4a35" }}>— Léo · coordination, tiers-lieu Bernard Kohn</span>
              <Link href="/histoire" className="cm-draw" style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "14px 28px", textDecoration: "none", fontFamily: "var(--font-dmmono), monospace", fontSize: "13px", color: "#2C2D2D" }}>
                Notre histoire
                {DRAW_SVG}
              </Link>
            </div>
          </div>
          <div className="amb" style={{ flex: "0 0 auto", animation: "cmFloatB 8s ease-in-out infinite", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/accueil/p-portrait.jpg" alt="Léo et Bernard" style={{ width: "clamp(200px,24vw,340px)", height: "clamp(260px,32vw,440px)", objectFit: "cover", borderRadius: "20px", display: "block" }} />
            <figcaption style={{ fontFamily: "var(--font-dmmono), monospace", fontSize: "11px", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(44,45,45,.45)" }}>
              Léo et Bernard
            </figcaption>
          </div>
        </section>

        {/* PANEL 6 · LES 4 PILIERS */}
        <section style={{ ...panelBase, background: "linear-gradient(90deg,#F2BE9E,#EC9E72)", display: "flex", flexDirection: "column", justifyContent: "center", ...pad }}>
          <div className="rv" style={{ "--d": ".05s", marginBottom: "clamp(16px,2.4vh,28px)", maxWidth: "760px" } as CS}>
            <div style={{ ...monoTag, color: "#7a3d28", marginBottom: "12px" }}>La promesse</div>
            <h2 style={{ margin: 0, fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(28px,3.8vw,56px)", lineHeight: 1, letterSpacing: "-.01em", color: "#2C2D2D" }}>
              Tout relier, sans tout <span style={{ fontStyle: "italic", color: "#7a3d28" }}>complexifier.</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "clamp(16px,1.6vw,26px)" }}>
            {PILIERS.map(p => (
              <div key={p.num} className="rv" style={{ "--d": p.delay } as CS}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.img} alt={p.t} style={{ width: "100%", height: "clamp(150px,28vh,260px)", display: "block", objectFit: "cover", borderRadius: "16px" }} />
                <div style={{ display: "flex", alignItems: "baseline", gap: "12px", margin: "12px 0 6px" }}>
                  <span style={{ fontFamily: "var(--font-dmmono), monospace", fontSize: "13px", color: "#7a3d28" }}>{p.num}</span>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: "clamp(18px,1.7vw,26px)", color: "#2C2D2D" }}>{p.t}</span>
                </div>
                <p style={{ margin: 0, fontSize: "clamp(12.5px,1vw,14.5px)", lineHeight: 1.55, color: "rgba(44,45,45,.62)" }}>{p.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PANEL 7 · PARLONS-EN */}
        <section style={{ ...panelBase, background: "linear-gradient(90deg,#EFAE86,#C9764E)", display: "flex", alignItems: "center", ...pad }}>
          <div style={{ maxWidth: "1000px", position: "relative", zIndex: 2 }}>
            <h2 className="line-reveal" style={{ margin: 0, fontFamily: displayFont, fontWeight: 400, fontSize: "clamp(40px,7.4vw,116px)", lineHeight: .96, letterSpacing: "-.015em", color: "#2C2D2D" }}>
              Vous portez un lieu collectif&nbsp;?{" "}
              <span style={{ fontStyle: "italic" }}>Parlons-en.</span>
            </h2>
            <div className="rv" style={{ "--d": ".28s", marginTop: "36px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" } as CS}>
              <a href="/signup" className="cm-draw" style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "18px 40px", textDecoration: "none", fontFamily: "var(--font-dmmono), monospace", fontSize: "15px", background: ACCENT, color: "#FFF9EC", borderRadius: "44px" }}>
                Créer mon espace gratuit →
                {DRAW_SVG}
              </a>
              <a href="/dashboard/bernard-kohn" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "18px 40px", textDecoration: "none", fontFamily: "var(--font-dmmono), monospace", fontSize: "15px", background: "#2C2D2D", color: "#FFF9EC", borderRadius: "44px" }}>
                Découvrir le lieu pilote →
              </a>
            </div>
            <div className="rv" style={{ "--d": ".40s", marginTop: "14px" } as CS}>
              <span style={{ fontFamily: "var(--font-dmmono), monospace", fontSize: "13px", letterSpacing: ".04em", color: "#7a3d28" }}>Gratuit · sans carte bancaire · votre lieu en ligne en 5 minutes</span>
            </div>
          </div>
          <div className="amb" style={{ position: "absolute", right: "clamp(20px,5vw,90px)", bottom: "clamp(20px,6vh,80px)", zIndex: 1, animation: "cmDrift 9s ease-in-out infinite" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/accueil/eye-bleu.png" alt="Illustration" style={{ width: "clamp(150px,20vw,280px)", height: "clamp(150px,20vw,280px)", objectFit: "contain" }} />
          </div>
        </section>

      </div>
    </div>
  );
}
