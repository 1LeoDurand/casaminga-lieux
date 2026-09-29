import "server-only";
/**
 * IMAP reading for the contacts module (spec 6.2, 6.3, 11). One connection per
 * mailbox and run. Folders are opened READ-ONLY (EXAMINE) and messages are
 * fetched as BODY.PEEK[]: nothing is marked read, nothing is modified.
 * Credentials come from the mailbox's env prefix (outreach_mailboxes.env_prefix);
 * they are never logged and never leave this file.
 */
import { ImapFlow } from "imapflow";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  sentFolder: string | null;
}

/**
 * IMAP settings of a mailbox from the environment, or null when a required
 * variable is missing (reading is then skipped for this mailbox).
 * IMAP_USER / IMAP_PASS fall back on SMTP_USER / SMTP_PASS.
 */
export function imapConfigFor(prefix: string): ImapConfig | null {
  const e = process.env;
  const host = e[`${prefix}IMAP_HOST`]?.trim();
  const user = (e[`${prefix}IMAP_USER`] || e[`${prefix}SMTP_USER`])?.trim();
  const pass = e[`${prefix}IMAP_PASS`] || e[`${prefix}SMTP_PASS`];
  if (!host || !user || !pass) return null;
  const port = Number(e[`${prefix}IMAP_PORT`]?.trim() || 993);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port, user, pass, sentFolder: e[`${prefix}SENT_FOLDER`]?.trim() || null };
}

export interface FolderState {
  /** null = never read. */
  uidvalidity: number | null;
  last_uid: number;
}

export interface RawMessage {
  uid: number;
  source: Buffer;
  size: number;
}

export interface FolderRead {
  uidValidity: number;
  /** Highest UID fully handled (the new cursor). */
  lastUid: number;
  handled: number;
  oversize: number;
  /** More messages wait beyond this batch. */
  more: boolean;
  /** UIDVALIDITY changed (or first read): the cursor was recomputed. */
  reset: boolean;
}

const MAX_MESSAGE_BYTES = 15 * 1024 * 1024;
/** First read of a folder: only look back this far. */
const FIRST_READ_DAYS = 3;

export class ImapSession {
  constructor(private readonly client: ImapFlow) {}

  /** Configured folder, else the one flagged \Sent, else null. */
  async resolveSentFolder(configured: string | null): Promise<string | null> {
    if (configured) return configured;
    const boxes = await this.client.list();
    return boxes.find((b) => b.specialUse === "\\Sent")?.path ?? null;
  }

  /**
   * Reads UIDs above the cursor, oldest first, at most `batch` per call, and
   * hands each to `onMessage`. If it throws, reading stops and the cursor stays
   * on the last message that succeeded (the error is rethrown by the caller
   * through `failed`).
   */
  async readFolder(
    folder: string,
    state: FolderState,
    batch: number,
    onMessage: (m: RawMessage) => Promise<void>,
  ): Promise<FolderRead & { failed: unknown | null }> {
    const lock = await this.client.getMailboxLock(folder, { readOnly: true });
    try {
      const box = this.client.mailbox;
      if (!box) throw new Error("imap: mailbox not open");
      const uidValidity = Number(box.uidValidity);
      const uidNext = Number(box.uidNext);
      let cursor = state.last_uid;
      let reset = false;

      if (state.uidvalidity === null || state.uidvalidity !== uidValidity) {
        reset = true;
        const since = new Date(Date.now() - FIRST_READ_DAYS * 86_400_000);
        const found = (await this.client.search({ since }, { uid: true })) || [];
        cursor = found.length > 0 ? Math.min(...found) - 1 : Math.max(uidNext - 1, 0);
      }

      let handled = 0;
      let oversize = 0;
      let lastUid = cursor;
      let failed: unknown | null = null;
      let more = false;

      if (uidNext > cursor + 1) {
        // "N:*" always returns the last message even when N is past the end.
        const metas = (await this.client.fetchAll(`${cursor + 1}:*`, { uid: true, size: true }, { uid: true }))
          .filter((m) => m.uid > cursor)
          .sort((a, b) => a.uid - b.uid);
        more = metas.length > batch;
        for (const meta of metas.slice(0, batch)) {
          if ((meta.size ?? 0) > MAX_MESSAGE_BYTES) {
            oversize++;
            lastUid = meta.uid;
            continue;
          }
          try {
            const full = await this.client.fetchOne(String(meta.uid), { source: true }, { uid: true });
            if (!full || !full.source) { lastUid = meta.uid; continue; }
            await onMessage({ uid: meta.uid, source: full.source, size: meta.size ?? full.source.length });
            handled++;
            lastUid = meta.uid;
          } catch (err) {
            failed = err;
            break;
          }
        }
      }
      return { uidValidity, lastUid, handled, oversize, more, reset, failed };
    } finally {
      lock.release();
    }
  }
}

/** Opens a connection, runs `fn`, always closes. Errors carry no credential. */
export async function withImap<T>(cfg: ImapConfig, fn: (s: ImapSession) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 993,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
    emitLogs: false,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
  client.on("error", () => { /* surfaced through the pending command */ });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(`imap connect failed: ${safeMessage(err)}`);
  }
  try {
    return await fn(new ImapSession(client));
  } finally {
    try { await client.logout(); } catch { client.close(); }
  }
}

/** Error text without anything that could carry a host, user or password. */
export function safeMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  const resp = (err as { responseStatus?: string })?.responseStatus;
  const msg = err instanceof Error ? err.message : String(err);
  return [code, resp, msg.replace(/[\w.+-]+@[\w.-]+/g, "<addr>").slice(0, 120)].filter(Boolean).join(" ");
}
