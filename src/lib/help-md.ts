/**
 * Mini-renderer markdown → HTML pour les articles d'aide.
 * Volontairement minimal et sans dépendance. Le contenu provenant
 * exclusivement du repo (help-content.ts), il est de confiance ; on échappe
 * tout de même le HTML en entrée par précaution.
 *
 * Supporte : titres ## / ###, **gras**, `code`, liens [txt](url),
 * listes - et 1., citations >, paragraphes.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline : gras, code, liens. Entrée déjà échappée. */
function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      '<a href="$2" rel="noopener noreferrer">$1</a>'
    );
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = escapeHtml(raw.trimEnd());
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    // Titres
    const h = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushAll();
      const level = h[1].length; // 2 ou 3
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    // Citation
    const q = /^&gt;\s?(.*)$/.exec(trimmed);
    if (q) {
      flushParagraph();
      flushList();
      quote.push(q[1]);
      continue;
    } else {
      flushQuote();
    }

    // Liste ordonnée
    const ol = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (ol) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    // Liste à puces
    const ul = /^[-*]\s+(.*)$/.exec(trimmed);
    if (ul) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    // Paragraphe
    flushList();
    paragraph.push(trimmed);
  }

  flushAll();
  return out.join("\n");
}
