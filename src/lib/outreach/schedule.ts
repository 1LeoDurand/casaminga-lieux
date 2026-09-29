/**
 * Sending window, next slot and ramp of the contacts module (spec 5.1 and 5.3).
 * Pure functions: no I/O, no server-only import, so scripts/outreach-schedule-check.mjs
 * can load the transpiled file. Every wall-clock computation goes through
 * Intl.DateTimeFormat in the program's time zone (GitHub Actions runs in UTC and
 * Paris changes offset on the last Sunday of March and October).
 * Public holidays are ignored in v1.
 */

export interface WindowSettings {
  /** ISO weekdays: 1 = Monday ... 7 = Sunday. */
  send_days: number[];
  /** "HH:MM" or "HH:MM:SS" (Postgres time). Inclusive. */
  send_start: string;
  /** Exclusive: at 17:30:00 with send_end 17:30 the window is closed. */
  send_end: string;
  timezone: string;
}

export interface RampSettings {
  daily_cap: number;
  ramp_steps: number[];
  /** "YYYY-MM-DD" in the program's time zone, or null (ramp not started: no cold mail). */
  ramp_started_on: string | null;
  timezone: string;
}

const DAY_MS = 86_400_000;

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 1 = Monday ... 7 = Sunday. */
  isoDay: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall clock of an instant in a time zone. */
export function wallClock(at: Date, tz: string): Wall {
  const parts: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(at)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const utcDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay(); // 0 = Sunday
  return {
    year: parts.year, month: parts.month, day: parts.day,
    hour: parts.hour, minute: parts.minute, second: parts.second,
    isoDay: utcDay === 0 ? 7 : utcDay,
  };
}

/** Parses "HH:MM" or "HH:MM:SS" into minutes since midnight. */
export function minutesOf(t: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** UTC instant of a wall-clock time in a zone (handles the DST change days). */
export function zonedToUtc(year: number, month: number, day: number, minutes: number, tz: string): Date {
  const naive = Date.UTC(year, month - 1, day, 0, minutes);
  // Offset of the zone at the guessed instant, then once more at the corrected one.
  let guess = naive;
  for (let i = 0; i < 2; i++) {
    const w = wallClock(new Date(guess), tz);
    const shown = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
    const offset = shown - Math.floor(guess / 1000) * 1000;
    guess = naive - offset;
  }
  return new Date(guess);
}

/**
 * Is the sending window open at this instant? Open on a send day from
 * send_start (included) to send_end (excluded), in the program's time zone.
 */
export function sendWindowOpen(now: Date, s: WindowSettings): boolean {
  const start = minutesOf(s.send_start);
  const end = minutesOf(s.send_end);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const w = wallClock(now, s.timezone);
  if (!s.send_days.includes(w.isoDay)) return false;
  const nowMin = w.hour * 60 + w.minute + w.second / 60;
  return nowMin >= start && nowMin < end;
}

/**
 * Earliest instant at or after `after` inside the window: `after` itself when
 * the window is open, else the next opening. With no send day at all, returns
 * `after` (the caller's guard, not this function, refuses such a program).
 */
export function nextSendSlot(after: Date, s: WindowSettings): Date {
  if (sendWindowOpen(after, s)) return after;
  const start = minutesOf(s.send_start);
  const end = minutesOf(s.send_end);
  if (Number.isNaN(start) || Number.isNaN(end) || s.send_days.length === 0) return after;
  const w = wallClock(after, s.timezone);
  const nowMin = w.hour * 60 + w.minute + w.second / 60;
  // Calendar day arithmetic on a UTC date holding the local Y-M-D.
  const base = Date.UTC(w.year, w.month - 1, w.day);
  for (let i = 0; i <= 14; i++) {
    const d = new Date(base + i * DAY_MS);
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (!s.send_days.includes(iso)) continue;
    if (i === 0 && nowMin >= start) continue; // today, but past the opening (closed, so past the end)
    return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), start, s.timezone);
  }
  return after;
}

/** Local calendar date of an instant, "YYYY-MM-DD". */
export function localDate(at: Date, tz: string): string {
  const w = wallClock(at, tz);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** Instant of the local midnight that opens the day of `at`. */
export function startOfLocalDay(at: Date, tz: string): Date {
  const w = wallClock(at, tz);
  return zonedToUtc(w.year, w.month, w.day, 0, tz);
}

/**
 * Cold-mail cap for a day: min(daily_cap, ramp step of the week). The ramp
 * counts calendar weeks from ramp_started_on (week 1 = the first 7 days, the
 * last step holds from then on). No start date, or a day before it: 0.
 */
export function coldCapForDay(day: Date, s: RampSettings): number {
  if (!s.ramp_started_on || s.ramp_steps.length === 0) return 0;
  const start = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.ramp_started_on);
  if (!start) return 0;
  const startUtc = Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]));
  const w = wallClock(day, s.timezone);
  const days = Math.round((Date.UTC(w.year, w.month - 1, w.day) - startUtc) / DAY_MS);
  if (days < 0) return 0;
  const week = Math.floor(days / 7);
  const step = s.ramp_steps[Math.min(week, s.ramp_steps.length - 1)];
  return Math.max(0, Math.min(s.daily_cap, step));
}

/**
 * Slots for a batch: the first at the next opening, each following one
 * `stepMinutes` after the previous one, moved to the next opening when the
 * window closes. Only the earliest instant: the queue's caps decide the pace.
 */
export function spreadSlots(after: Date, count: number, stepMinutes: number, s: WindowSettings): Date[] {
  const out: Date[] = [];
  let at = nextSendSlot(after, s);
  for (let i = 0; i < count; i++) {
    out.push(at);
    at = nextSendSlot(new Date(at.getTime() + stepMinutes * 60_000), s);
  }
  return out;
}
