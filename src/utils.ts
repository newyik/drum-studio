import type { Entry } from './types';

export interface Range {
  start: number;
  end: number;
}

export interface FreeSlot {
  kind: 'free';
  start: number;
  end: number;
}

export interface BusySlot {
  kind: 'busy';
  start: number;
  end: number;
  entry: Entry;
}

export type DaySlot = FreeSlot | BusySlot;

export const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const toHM = (minutes: number) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

const studioClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function studioTime(now = new Date()) {
  const parts = Object.fromEntries(studioClock.formatToParts(now).map(({ type, value }) => [type, value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// Calendar dates use UTC as a container for the Tokyo date, independent of device DST.
export const toISO = (date: Date) => date.toISOString().slice(0, 10);

export const fromISO = (date: string) => new Date(`${date}T00:00:00Z`);

export const studioWeek = () => startOfWeek(fromISO(studioTime().date));

export const addDays = (d: Date, n: number) => {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
};

export const startOfWeek = (d: Date) => {
  const next = new Date(d);
  const offset = (next.getUTCDay() + 6) % 7;
  next.setUTCDate(next.getUTCDate() - offset);
  next.setUTCHours(0, 0, 0, 0);
  return next;
};

export const weekDates = (monday: Date) =>
  Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export const formatRangeLabel = (startISO: string, endISO: string) => {
  const a = fromISO(startISO);
  const b = fromISO(endISO);
  return `${a.getUTCMonth() + 1}/${a.getUTCDate()} – ${b.getUTCMonth() + 1}/${b.getUTCDate()}`;
};

export const formatDayDate = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

export const formatMinutes = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分钟`;
  return m === 0 ? `${h}小时` : `${h}小时${m}分`;
};

export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

export function subtractRanges(base: Range[], cuts: Range[]): Range[] {
  const mergedCuts = mergeRanges(cuts);
  let out = mergeRanges(base);
  for (const cut of mergedCuts) {
    const next: Range[] = [];
    for (const r of out) {
      if (cut.end <= r.start || cut.start >= r.end) {
        next.push(r);
        continue;
      }
      if (cut.start > r.start) next.push({ start: r.start, end: Math.min(cut.start, r.end) });
      if (cut.end < r.end) next.push({ start: Math.max(cut.end, r.start), end: r.end });
    }
    out = next.filter((r) => r.end > r.start);
  }
  return out;
}

/** Free time = open ranges minus everything that occupies the teacher. */
export function freeGaps(entries: Entry[]): Range[] {
  const open = entries
    .filter((e) => e.type === 'open')
    .map((e) => ({ start: e.start, end: e.end }));
  if (open.length === 0) return [];
  const busy = entries
    .filter((e) => e.type !== 'open')
    .map((e) => ({ start: e.start, end: e.end }));
  return subtractRanges(open, busy);
}

export function buildDaySlots(entries: Entry[]): DaySlot[] {
  const free: FreeSlot[] = freeGaps(entries).map((r) => ({ kind: 'free', ...r }));
  const busy: BusySlot[] = entries
    .filter((e) => e.type !== 'open')
    .map((e) => ({ kind: 'busy', start: e.start, end: e.end, entry: e }));
  return [...free, ...busy].sort((a, b) => a.start - b.start || a.end - b.end);
}

export function availabilityLabel(entries: Entry[], minutes: number) {
  if (minutes > 0) return `${formatMinutes(minutes)}可约`;
  return entries.some((entry) => entry.type === 'open') ? '无空档' : '未开放';
}
