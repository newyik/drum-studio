import { useEffect, useState, type CSSProperties } from 'react';
import type { Entry, EntryType } from './types';
import {
  WEEKDAYS,
  availabilityLabel,
  buildDaySlots,
  formatDayDate,
  formatMinutes,
  freeGaps,
  pad2,
  studioTime,
  toHM,
  toISO,
} from './utils';

const DAY_START = 540;
const DAY_END = 1380;
const DAY_SPAN = DAY_END - DAY_START;
const HOURS = Array.from({ length: 15 }, (_, i) => DAY_START + i * 60);

export type Mode = 'public' | 'admin';

type BlockKind = 'free' | EntryType;

interface CalBlock {
  kind: BlockKind;
  start: number;
  end: number;
  entry?: Entry;
}

const pct = (minute: number) => ((minute - DAY_START) / DAY_SPAN) * 100;

const blockStyle = (block: CalBlock): CSSProperties => ({
  top: `${pct(block.start)}%`,
  height: `${pct(block.end) - pct(block.start)}%`,
});

export function freeMinutes(entries: Entry[]) {
  return freeGaps(entries).reduce((sum, range) => sum + (range.end - range.start), 0);
}

export function freeShort(minutes: number) {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function blocksForDay(entries: Entry[], mode: Mode): CalBlock[] {
  if (mode === 'admin') {
    return [...entries]
      .sort((a, b) => (a.type === 'open' ? 0 : 1) - (b.type === 'open' ? 0 : 1) || a.start - b.start)
      .map((entry) => ({ kind: entry.type, start: entry.start, end: entry.end, entry }));
  }
  return buildDaySlots(entries).map((slot) =>
    slot.kind === 'free'
      ? { kind: 'free' as const, start: slot.start, end: slot.end }
      : { kind: slot.entry.type, start: slot.start, end: slot.end, entry: slot.entry },
  );
}

function blockText(block: CalBlock, mode: Mode): { title: string; sub?: string } {
  if (block.kind === 'free') {
    return { title: '可约', sub: `${toHM(block.start)}–${toHM(block.end)}` };
  }
  const entry = block.entry;
  if (!entry) return { title: '' };

  if (block.kind === 'open') {
    return {
      title: '可约',
      sub: mode === 'admin' ? `${formatMinutes(block.end - block.start)}空档` : undefined,
    };
  }

  if (block.kind === 'lesson') {
    return mode === 'admin'
      ? { title: entry.student || '课程', sub: entry.room }
      : { title: '已约' };
  }

  if (block.kind === 'practice') {
    return {
      title: '麻衣练鼓时间',
      sub: [entry.room, entry.openPractice ? '可来' : ''].filter(Boolean).join(' · '),
    };
  }

  return { title: '休息', sub: mode === 'admin' ? entry.note : undefined };
}

function BusyBlock({
  block,
  mode,
  onEntryClick,
}: {
  block: CalBlock;
  mode: Mode;
  onEntryClick?: (entry: Entry) => void;
}) {
  const text = blockText(block, mode);
  const compact = block.end - block.start <= 30;
  const title = compact && block.kind === 'free' && text.sub ? `${text.title} · ${text.sub}` : text.title;
  const className = `cal-block ${block.kind}${compact ? ' compact' : ''}`;
  const style = blockStyle(block);

  const body = (
    <>
      <span className="cal-block-title">{title}</span>
      {(!compact || block.kind === 'practice') && text.sub && <span className="cal-block-sub">{text.sub}</span>}
    </>
  );

  if (mode === 'admin' && block.entry) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        onClick={(event) => {
          event.stopPropagation();
          onEntryClick?.(block.entry!);
        }}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={className} style={style} title={[text.title, text.sub].filter(Boolean).join(' · ')}>
      {body}
    </div>
  );
}

function OpenRanges({ entries, onEdit }: { entries: Entry[]; onEdit?: (entry: Entry) => void }) {
  const ranges = entries.filter((entry) => entry.type === 'open').sort((a, b) => a.start - b.start);
  if (!ranges.length) return null;
  return (
    <div className="open-ranges" aria-label="编辑开放时段">
      {ranges.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className="open-chip"
          aria-label={`编辑 ${entry.date} ${toHM(entry.start)}–${toHM(entry.end)} 的可约时段`}
          onClick={() => onEdit?.(entry)}
        >
          {toHM(entry.start)}–{toHM(entry.end)}
        </button>
      ))}
    </div>
  );
}

interface StripProps {
  days: Date[];
  entries: Entry[];
  selected: string;
  todayISO: string;
  mode: Mode;
  onSelect: (iso: string) => void;
}

export function WeekStrip({ days, entries, selected, todayISO, mode, onSelect }: StripProps) {
  return (
    <div className="weekstrip" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((date) => {
        const iso = toISO(date);
        const dayEntries = entries.filter((entry) => entry.date === iso);
        const blocks = blocksForDay(dayEntries, mode);
        const free = freeMinutes(dayEntries);
        return (
          <button
            key={iso}
            type="button"
            className={`ws-day${selected === iso ? ' selected' : ''}${iso === todayISO ? ' today' : ''}`}
            onClick={() => onSelect(iso)}
            aria-pressed={selected === iso}
            aria-current={iso === todayISO ? 'date' : undefined}
            aria-label={`${WEEKDAYS[(date.getUTCDay() + 6) % 7]} ${formatDayDate(date)}，${availabilityLabel(dayEntries, free)}`}
          >
            <span className="ws-dow">{WEEKDAYS[(date.getUTCDay() + 6) % 7]}</span>
            <span className="ws-date">{formatDayDate(date)}</span>
            <span className="ws-bar">
              {blocks.map((block, i) => (
                <span
                  key={`${block.kind}-${block.start}-${i}`}
                  className={`ws-seg ${block.kind}`}
                  style={{
                    top: `${pct(block.start)}%`,
                    height: `${pct(block.end) - pct(block.start)}%`,
                  }}
                />
              ))}
            </span>
            <span className={`ws-free${free === 0 ? ' zero' : ''}`}>
              {free > 0 ? freeShort(free) : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface TimelineProps {
  iso: string;
  entries: Entry[];
  mode: Mode;
  isToday: boolean;
  now: Date;
  onEntryClick?: (entry: Entry) => void;
  onEmptyClick?: (iso: string, start: number) => void;
}

export function DayTimeline({
  iso,
  entries,
  mode,
  isToday,
  now,
  onEntryClick,
  onEmptyClick,
}: TimelineProps) {
  const dayEntries = entries.filter((entry) => entry.date === iso);
  const blocks = blocksForDay(dayEntries, mode);
  const nowMinute = studioTime(now).minute;
  const showNow = isToday && nowMinute >= DAY_START && nowMinute <= DAY_END;

  return (
    <>
      {mode === 'admin' && <OpenRanges entries={dayEntries} onEdit={onEntryClick} />}
      <div className="timeline">
        <div className="timeline-hours">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className={`tl-hour${hour === DAY_START ? ' first' : ''}${hour === DAY_END ? ' last' : ''}`}
              style={{ top: `${pct(hour)}%` }}
            >
              {pad2(hour / 60)}:00
            </div>
          ))}
        </div>

        <div className="timeline-body">
          {HOURS.slice(1, -1).map((hour) => (
            <div key={`line-${hour}`} className="tl-line" style={{ top: `${pct(hour)}%` }} />
          ))}
          {HOURS.slice(0, -1).map((hour) => (
            <div key={`half-${hour}`} className="tl-halfline" style={{ top: `${pct(hour + 30)}%` }} />
          ))}

          {mode === 'admin' &&
            Array.from({ length: 28 }, (_, i) => {
              const start = DAY_START + i * 30;
              if (blocks.some((block) => block.kind !== 'open' && block.start <= start && start < block.end)) return null;
              return (
                <button
                  key={start}
                  type="button"
                  className="tl-cell"
                  style={{
                    top: `${pct(start)}%`,
                    height: `${pct(start + 30) - pct(start)}%`,
                  }}
                  onClick={() => onEmptyClick?.(iso, start)}
                  aria-label={`添加 ${iso} ${toHM(start)} 的时段`}
                />
              );
            })}

          {mode === 'admin' &&
            blocks
              .filter((block) => block.kind === 'open')
              .map((block) => <div key={block.entry?.id} className="open-band" style={blockStyle(block)} />)}

          {blocks
            .filter((block) => block.kind !== 'open')
            .map((block, i) => (
              <BusyBlock
                key={`${block.kind}-${block.start}-${i}`}
                block={block}
                mode={mode}
                onEntryClick={onEntryClick}
              />
            ))}

          {blocks.length === 0 && (
            <div className="timeline-empty">
              {mode === 'admin' ? '点空白格添加时段' : '这一天还没有开放'}
            </div>
          )}

          {showNow && (
            <div className="now-line" style={{ top: `${pct(nowMinute)}%` }}>
              <span>现在</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface CalendarProps {
  days: Date[];
  entries: Entry[];
  todayISO: string;
  mode: Mode;
  now: Date;
  onEntryClick?: (entry: Entry) => void;
  onEmptyClick?: (iso: string, start: number) => void;
}

export function WeekCalendar({
  days,
  entries,
  todayISO,
  mode,
  now,
  onEntryClick,
  onEmptyClick,
}: CalendarProps) {
  const nowMinute = studioTime(now).minute;
  const showNow = nowMinute >= DAY_START && nowMinute <= DAY_END;

  return (
    <div className="weekcal" style={{ '--day-count': days.length } as CSSProperties}>
      <div className="wc-head">
        <div className="wc-corner" />
        {days.map((date) => {
          const iso = toISO(date);
          const dayEntries = entries.filter((entry) => entry.date === iso);
          const free = freeMinutes(dayEntries);
          return (
            <div key={iso} className={`wc-dayhead${iso === todayISO ? ' today' : ''}`}>
              <span className="wc-dow">{WEEKDAYS[(date.getUTCDay() + 6) % 7]}</span>
              <span className="wc-date">{formatDayDate(date)}</span>
              <span className={`wc-free${free === 0 ? ' zero' : ''}`}>
                {free > 0 ? `${freeShort(free)} 空档` : availabilityLabel(dayEntries, free)}
              </span>
              {mode === 'admin' && <OpenRanges entries={dayEntries} onEdit={onEntryClick} />}
            </div>
          );
        })}
      </div>

      <div className="wc-body">
        <div className="wc-hours">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className={`tl-hour${hour === DAY_START ? ' first' : ''}${hour === DAY_END ? ' last' : ''}`}
              style={{ top: `${pct(hour)}%` }}
            >
              {pad2(hour / 60)}:00
            </div>
          ))}
        </div>

        {days.map((date) => {
          const iso = toISO(date);
          const dayEntries = entries.filter((entry) => entry.date === iso);
          const blocks = blocksForDay(dayEntries, mode);
          const isToday = iso === todayISO;
          return (
            <div key={iso} className={`wc-col${isToday ? ' today' : ''}`}>
              {mode === 'admin' &&
                Array.from({ length: 28 }, (_, i) => {
                  const start = DAY_START + i * 30;
                  if (blocks.some((block) => block.kind !== 'open' && block.start <= start && start < block.end)) return null;
                  return (
                    <button
                      key={start}
                      type="button"
                      className="tl-cell"
                      style={{
                        top: `${pct(start)}%`,
                        height: `${pct(start + 30) - pct(start)}%`,
                      }}
                      onClick={() => onEmptyClick?.(iso, start)}
                      aria-label={`添加 ${iso} ${toHM(start)} 的时段`}
                    />
                  );
                })}

              {mode === 'admin' &&
                blocks
                  .filter((block) => block.kind === 'open')
                  .map((block) => <div key={block.entry?.id} className="open-band" style={blockStyle(block)} />)}

              {blocks
                .filter((block) => block.kind !== 'open')
                .map((block, i) => (
                  <BusyBlock
                    key={`${block.kind}-${block.start}-${i}`}
                    block={block}
                    mode={mode}
                    onEntryClick={onEntryClick}
                  />
                ))}

              {isToday && showNow && (
                <div className="now-line" style={{ top: `${pct(nowMinute)}%` }}>
                  <span>现在</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
