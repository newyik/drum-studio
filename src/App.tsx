import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Entry, EntryType, StudioLocation } from './types';
import { verifyTeacher } from './teacherAuth';
import { LOCATIONS, createSeed } from './mock';
import {
  WEEKDAYS,
  addDays,
  availabilityLabel,
  formatDayDate,
  formatRangeLabel,
  fromISO,
  studioTime,
  studioWeek,
  toHM,
  toISO,
  weekDates,
} from './utils';
import {
  DayTimeline,
  WeekCalendar,
  WeekStrip,
  freeMinutes,
  useNow,
} from './calendar';

const STUDENTS_KEY = 'drum-studio-students-v1';
const DEMO_STUDENTS = ['体验学生 A', '体验学生 B'];
const STORAGE_KEY = 'drum-studio-proto-v1';
const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => 540 + i * 30); // 09:00 – 23:00

const TYPE_LABEL: Record<EntryType, string> = {
  open: '可约',
  lesson: '课程',
  practice: '练鼓',
  blocked: '休息',
};

function loadEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved: unknown = raw === null ? null : JSON.parse(raw);
    if (Array.isArray(saved)) return saved as Entry[];
  } catch {
    /* ignore broken storage */
  }
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    ? createSeed(LOCATIONS[0].id) : [];
}

export default function App() {
  const [demo, setDemo] = useState(() => window.location.hash === '#demo');
  useEffect(() => {
    function syncDemo() { setDemo(window.location.hash === '#demo'); }
    window.addEventListener('hashchange', syncDemo);
    return () => window.removeEventListener('hashchange', syncDemo);
  }, []);
  return <Studio key={String(demo)} demo={demo} />;
}

function loadStudents(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STUDENTS_KEY) ?? '[]');
    if (Array.isArray(saved)) return saved.filter((name): name is string => typeof name === 'string');
  } catch {
    // Start with an empty roster when browser storage is unavailable.
  }
  return [];
}

function Studio({ demo }: { demo: boolean }) {
  const [entries, setEntries] = useState<Entry[]>(() => demo ? createSeed(LOCATIONS[0].id, true) : loadEntries());
  const [students, setStudents] = useState<string[]>(() => demo ? DEMO_STUDENTS : loadStudents());
  const [loginOpen, setLoginOpen] = useState(false);
  const [view, setView] = useState<'public' | 'admin'>('public');
  const [weekStart, setWeekStart] = useState<Date>(() => studioWeek());
  const [location] = useState<StudioLocation>(LOCATIONS[0]);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    if (demo) return;
    try {
      localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [demo, entries, students]);

  const locationEntries = useMemo(
    () => entries.filter((e) => e.locationId === location.id),
    [entries, location.id],
  );

  function saveEntry(entry: Entry) {
    if (entry.type === 'lesson' && entry.student) {
      const name = entry.student;
      setStudents((previous) => [...new Set([...previous, name])]);
    }
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === entry.id);
      return exists ? prev.map((e) => (e.id === entry.id ? entry : e)) : [...prev, entry];
    });
  }

  function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function resetDemo() {
    if (window.confirm('重置为示例数据？你手动添加的安排会丢失。')) {
      setEntries(createSeed(location.id, demo));
      if (demo) setStudents(DEMO_STUDENTS);
      setWeekStart(studioWeek());
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView('public')}>
          <span className="brand-mark">鼓</span>
          <span className="brand-text">鼓房课表</span>
        </button>
        <div className="topbar-actions">
          <a className="preview-link" href={demo ? '#' : '#demo'}>{demo ? '退出体验' : '体验版'}</a>
          <button className="ghost" onClick={() => {
            if (view === 'admin') setView('public');
            else if (demo) setView('admin');
            else setLoginOpen(true);
          }}>
            {view === 'admin' ? '返回课表' : demo ? '体验排课' : '老师入口'}
          </button>
        </div>
      </header>

      {demo && <p className="demo-banner">体验版 · 示例数据，本次修改仅在当前页面有效</p>}

      {storageError && <p className="error" role="alert">无法保存到浏览器，刷新后可能丢失本次修改。</p>}

      {view === 'public' ? (
        <PublicView
          entries={locationEntries}
          location={location}
        />
      ) : (
        <AdminView
          entries={locationEntries}
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          location={location}
          onSave={saveEntry}
          onDelete={deleteEntry}
          onReset={resetDemo}
          students={[...new Set([...students, ...locationEntries.flatMap((entry) => entry.type === 'lesson' && entry.student ? [entry.student] : [])])]}
          onAddStudent={(name) => setStudents((previous) => [...new Set([...previous, name])])}
        />
      )}

      {loginOpen && (
        <TeacherLogin
          onClose={() => setLoginOpen(false)}
          onLogin={() => {
            setLoginOpen(false);
            setView('admin');
          }}
        />
      )}
    </div>
  );
}

interface WeekProps {
  weekStart: Date;
  onWeekChange: (d: Date) => void;
}

function WeekNav({ weekStart, onWeekChange, today, atCurrentWeek }: WeekProps & {
  today?: Date;
  atCurrentWeek?: boolean;
}) {
  const end = addDays(weekStart, 6);
  return (
    <div className="weekbar">
      <div>
        <div className="weeklabel">
          {formatRangeLabel(toISO(weekStart), toISO(end))}
        </div>
        <div className="weekmeta">{today ? '日本时间' : '周一 – 周日 · JST'}</div>
      </div>
      <div className="navbtns">
        <button
          className="iconbtn"
          aria-label="上一周"
          disabled={atCurrentWeek}
          onClick={() => onWeekChange(addDays(weekStart, -7))}
        >
          ‹
        </button>
        <button className="todaybtn" onClick={() => onWeekChange(today ?? studioWeek())}>
          {today ? '今天' : '本周'}
        </button>
        <button
          className="iconbtn"
          aria-label="下一周"
          onClick={() => onWeekChange(addDays(weekStart, 7))}
        >
          ›
        </button>
      </div>
    </div>
  );
}

interface PublicProps {
  entries: Entry[];
  location: StudioLocation;
}

function PublicView({ entries, location }: PublicProps) {
  const now = useNow();
  const { date: todayISO, minute } = studioTime(now);
  const today = fromISO(todayISO);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = addDays(today, weekOffset * 7);
  const days = weekDates(weekStart);
  const isos = days.map(toISO);
  const [selected, setSelected] = useState('');
  const nextSlot = Math.ceil(minute / 30) * 30;

  const weekEntries = entries.flatMap((entry): Entry[] => {
    if (!isos.includes(entry.date)) return [];
    const isToday = entry.date === todayISO;
    const start = isToday && entry.type === 'open' ? Math.max(entry.start, nextSlot) : entry.start;
    if (entry.end <= start || (isToday && entry.end <= minute)) return [];

    // Send only the fields that the public calendar needs to render.
    const { id, date, end, locationId, type } = entry;
    const practice = type === 'practice' ? { room: entry.room, openPractice: entry.openPractice } : {};
    return [{ id, date, start, end, locationId, type, ...practice }];
  });

  const activeSelected = isos.includes(selected) ? selected : isos[0];
  const selectedDate = fromISO(activeSelected);
  const selectedEntries = weekEntries.filter((e) => e.date === activeSelected);
  const selectedFree = freeMinutes(selectedEntries);
  return (
    <main>
      <section className="hero hero-public">
        <div className="eyebrow">{location.name}鼓房</div>
        <h1>空档时间表</h1>
        <div className="drum-art" aria-hidden="true">
          <i className="drum-ring" /><i className="drum-core" />
          <i className="drum-stick one" /><i className="drum-stick two" />
        </div>
      </section>

      <WeekNav
        weekStart={weekStart}
        today={today}
        atCurrentWeek={weekOffset === 0}
        onWeekChange={(date) => {
          setWeekOffset(Math.max(0, Math.round((date.getTime() - today.getTime()) / (7 * 86_400_000))));
          setSelected('');
        }}
      />

      <div className="legend">
        <span className="legend-item">
          <i className="dot free" />可约
        </span>
        <span className="legend-item">
          <i className="dot lesson" />已约
        </span>
        <span className="legend-item">
          <i className="dot practice" />麻衣练鼓时间
        </span>
        <span className="legend-item">
          <i className="dot blocked" />休息
        </span>
      </div>

      {weekEntries.some((entry) => entry.type === 'practice' && entry.openPractice) && (
        <details className="practice-help">
          <summary>练鼓标注「可来」是什么意思？</summary>
          <p>可以到同一间或隔壁鼓房，老师会过去指导。</p>
        </details>
      )}

      <div className="cal-mobile">
        <WeekStrip
          days={days}
          entries={weekEntries}
          selected={activeSelected}
          todayISO={todayISO}
          mode="public"
          onSelect={setSelected}
        />

        <div className="day-detail">
          <div>
            <div className="dd-title">
              {WEEKDAYS[(selectedDate.getUTCDay() + 6) % 7]}
              <span>{formatDayDate(selectedDate)}</span>
              {activeSelected === todayISO && <em className="dd-today">今天</em>}
            </div>
            <div className="dd-sub">{availabilityLabel(selectedEntries, selectedFree)}</div>
          </div>
        </div>

        <DayTimeline
          iso={activeSelected}
          entries={weekEntries}
          mode="public"
          isToday={activeSelected === todayISO}
          now={now}
        />
      </div>

      <div className="cal-desktop">
        <WeekCalendar
          days={days}
          entries={weekEntries}
          todayISO={todayISO}
          mode="public"
          now={now}
        />
      </div>

      <p className="footnote">课程时间以老师确认为准 · 时区 JST</p>
    </main>
  );
}

interface AdminProps extends WeekProps {
  entries: Entry[];
  location: StudioLocation;
  onSave: (entry: Entry) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
  students: string[];
  onAddStudent: (name: string) => void;
}

function AdminView({
  entries,
  weekStart,
  onWeekChange,
  location,
  onSave,
  onDelete,
  onReset,
  students,
  onAddStudent,
}: AdminProps) {
  const days = weekDates(weekStart);
  const now = useNow();
  const todayISO = studioTime(now).date;
  const isos = days.map(toISO);
  const [selected, setSelected] = useState(() =>
    isos.includes(todayISO) ? todayISO : isos[0],
  );
  const [draft, setDraft] = useState<Entry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);

  useEffect(() => {
    const next = weekDates(weekStart).map(toISO);
    setSelected(next.includes(todayISO) ? todayISO : next[0]);
  }, [weekStart, todayISO]);

  const activeSelected = isos.includes(selected) ? selected : isos[0];
  const selectedIndex = Math.max(isos.indexOf(activeSelected), 0);
  const selectedDate = fromISO(activeSelected);
  const selectedEntries = entries.filter((e) => e.date === activeSelected);
  const selectedFree = freeMinutes(selectedEntries);

  function openNew(date: string, start = 540, type: EntryType = 'open') {
    setDraft({
      id: crypto.randomUUID(),
      locationId: location.id,
      date,
      start,
      end: Math.min(start + 60, 1380),
      type,
    });
    setIsNew(true);
  }

  function openEdit(entry: Entry) {
    setDraft({ ...entry });
    setIsNew(false);
  }

  return (
    <main>
      <section className="hero admin-hero">
        <div className="eyebrow">{location.name}鼓房</div>
        <h1>老师后台</h1>
        <p className="sub">
          点时间轴空白处添加时段，点已有色块编辑。学生端只读，看到空档后私下联系你。
        </p>
      </section>

      <div className="admin-toolbar">
        <WeekNav weekStart={weekStart} onWeekChange={onWeekChange} />
        <div className="admin-actions">
          <button className="ghost" onClick={() => setRosterOpen(true)}>学生名单</button>
          <button className="btn-add" onClick={() => openNew(activeSelected, 540, 'lesson')}>＋ 排课</button>
        </div>
      </div>

      <p className="admin-hint">浅绿色是开放范围。点日期下方的绿色时间按钮可编辑。</p>

      <div className="cal-mobile">
        <WeekStrip
          days={days}
          entries={entries}
          selected={activeSelected}
          todayISO={todayISO}
          mode="admin"
          onSelect={setSelected}
        />

        <div className="day-detail">
          <div>
            <div className="dd-title">
              {WEEKDAYS[selectedIndex]}
              <span>{formatDayDate(selectedDate)}</span>
              {activeSelected === todayISO && <em className="dd-today">今天</em>}
            </div>
            <div className="dd-sub">
              {availabilityLabel(selectedEntries, selectedFree)}
            </div>
          </div>
          <button className="dd-add" onClick={() => openNew(activeSelected)}>
            ＋ 添加
          </button>
        </div>

        <DayTimeline
          iso={activeSelected}
          entries={entries}
          mode="admin"
          isToday={activeSelected === todayISO}
          now={now}
          onEntryClick={openEdit}
          onEmptyClick={openNew}
        />
      </div>

      <div className="cal-desktop">
        <WeekCalendar
          days={days}
          entries={entries}
          todayISO={todayISO}
          mode="admin"
          now={now}
          onEntryClick={openEdit}
          onEmptyClick={openNew}
        />
      </div>

      <div className="admin-foot">
        <button className="link-danger" onClick={onReset}>
          重置示例数据
        </button>
        <span>原型阶段：数据只保存在这台设备</span>
      </div>

      {rosterOpen && (
        <StudentRoster students={students} onAdd={onAddStudent} onClose={() => setRosterOpen(false)} />
      )}
      {draft && (
        <EntrySheet
          initial={draft}
          students={students}
          isNew={isNew}
          weekDays={isos}
          entries={entries}
          onClose={() => setDraft(null)}
          onSave={(entry) => {
            onSave(entry);
            setDraft(null);
          }}
          onDelete={(id) => {
            onDelete(id);
            setDraft(null);
          }}
        />
      )}
    </main>
  );
}

interface SheetProps {
  initial: Entry;
  students: string[];
  isNew: boolean;
  weekDays: string[];
  entries: Entry[];
  onClose: () => void;
  onSave: (entry: Entry) => void;
  onDelete: (id: string) => void;
}

function EntrySheet({
  initial,
  students,
  isNew,
  weekDays,
  entries,
  onClose,
  onSave,
  onDelete,
}: SheetProps) {
  const [form, setForm] = useState<Entry>(initial);
  const [error, setError] = useState('');

  const update = (patch: Partial<Entry>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError('');
  };

  function changeType(type: EntryType) {
    update({ type });
  }

  function changeStart(start: number) {
    update({ start, end: Math.max(form.end, start + 30) });
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (form.end <= form.start) {
      setError('结束时间要晚于开始时间');
      return;
    }
    if (form.type !== 'open') {
      const clash = entries.some(
        (e) =>
          e.id !== form.id &&
          e.date === form.date &&
          e.type !== 'open' &&
          e.start < form.end &&
          form.start < e.end,
      );
      if (clash) {
        setError('这个时间和已有的课程 / 练鼓 / 休息重叠了');
        return;
      }
    }
    onSave({
      ...form,
      student: form.type === 'lesson' ? form.student?.trim() || undefined : undefined,
      room: form.type === 'lesson' || form.type === 'practice' ? form.room?.trim() || undefined : undefined,
      openPractice: form.type === 'practice' ? !!form.openPractice : undefined,
      note: form.note?.trim() || undefined,
    });
  }

  return (
    <Sheet onClose={onClose}>
      <form onSubmit={submit}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2 id="sheet-title">{isNew ? '添加时段' : '编辑时段'}</h2>
          <button type="button" className="iconbtn" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="field">
          <label htmlFor="entry-date">日期</label>
          <select
            id="entry-date"
            value={form.date}
            onChange={(e) => update({ date: e.target.value })}
          >
            {weekDays.map((iso, i) => (
              <option key={iso} value={iso}>
                {WEEKDAYS[i]} {iso.slice(5).replace('-', '/')}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>类型</label>
          <div className="seg">
            {(Object.keys(TYPE_LABEL) as EntryType[]).map((t) => (
              <button
                type="button"
                key={t}
                className={form.type === t ? 'active' : ''}
                aria-pressed={form.type === t}
                onClick={() => changeType(t)}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="field row2">
          <div>
            <label htmlFor="entry-start">开始</label>
            <select
              id="entry-start"
              value={form.start}
              onChange={(e) => changeStart(Number(e.target.value))}
            >
              {TIME_OPTIONS.filter((m) => m < 1380).map((m) => (
                <option key={m} value={m}>
                  {toHM(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="entry-end">结束</label>
            <select
              id="entry-end"
              value={form.end}
              onChange={(e) => update({ end: Number(e.target.value) })}
            >
              {TIME_OPTIONS.filter((m) => m > form.start).map((m) => (
                <option key={m} value={m}>
                  {toHM(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.type === 'lesson' && (
          <>
            <div className="field">
              <label htmlFor="entry-student">学生姓名</label>
              <select id="entry-student" value={form.student ?? ''} onChange={(e) => update({ student: e.target.value })}>
                <option value="">选择学生</option>
                {students.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              {!students.length && <p className="hint">可在「学生名单」中添加学生。</p>}
              <p className="hint">只在老师后台显示，公开页只会看到「已约」。</p>
            </div>
            <div className="field">
              <label htmlFor="entry-room">鼓房</label>
              <input
                id="entry-room"
                value={form.room ?? ''}
                placeholder="例：2 号房"
                onChange={(e) => update({ room: e.target.value })}
              />
            </div>
          </>
        )}

        {form.type === 'practice' && (
          <>
            <div className="field">
              <label htmlFor="entry-room-practice">鼓房</label>
              <input
                id="entry-room-practice"
                value={form.room ?? ''}
                placeholder="例：3 号房"
                onChange={(e) => update({ room: e.target.value })}
              />
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={!!form.openPractice}
                onChange={(e) => update({ openPractice: e.target.checked })}
              />
              <span>学生可来（公开页显示「可来」）</span>
            </label>
          </>
        )}

        <div className="field">
          <label htmlFor="entry-note">备注</label>
          <input
            id="entry-note"
            value={form.note ?? ''}
            placeholder="仅自己可见"
            onChange={(e) => update({ note: e.target.value })}
          />
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <button className="btn-primary" type="submit">
          保存
        </button>

        {!isNew && (
          <button
            type="button"
            className="link-danger delete"
            onClick={() => {
              if (window.confirm('删除这个时段？')) onDelete(form.id);
            }}
          >
            删除这个时段
          </button>
        )}
      </form>
    </Sheet>
  );
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

function StudentRoster({ students, onAdd, onClose }: {
  students: string[];
  onAdd: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) {
      setStatus('请输入学生姓名。');
      return;
    }
    if (students.includes(value)) {
      setStatus('名单中已有这位学生。');
      return;
    }
    onAdd(value);
    setName('');
    setStatus(`已添加 ${value}`);
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-head">
        <h2 id="sheet-title">学生名单</h2>
        <button type="button" className="iconbtn" aria-label="关闭" onClick={onClose}>×</button>
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="roster-name">学生姓名</label>
          <input id="roster-name" value={name} maxLength={80} required onChange={(event) => {
            setName(event.target.value);
            setStatus('');
          }} />
        </div>
        <button className="btn-primary" type="submit">添加学生</button>
        <p className="hint" role="status">{status}</p>
      </form>
      {students.length ? (
        <ul className="roster-list">
          {students.map((student) => <li key={student}>{student}</li>)}
        </ul>
      ) : <p className="hint">名单里还没有学生。</p>}
    </Sheet>
  );
}

function TeacherLogin({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const closed = useRef(false);

  function close() {
    closed.current = true;
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const valid = await verifyTeacher(password);
      if (closed.current) return;
      if (valid) onLogin();
      else setError('密码不正确，请重试。');
    } catch (cause) {
      if (!closed.current) {
        setError(cause instanceof TypeError ? '无法连接登录服务，请重试。' : '登录失败。' +
          (cause instanceof Error ? cause.message : '请重试。'));
      }
    } finally {
      if (!closed.current) setPending(false);
    }
  }

  return (
    <Sheet onClose={close}>
      <form onSubmit={submit}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2 id="sheet-title">老师登录</h2>
          <button type="button" className="iconbtn" aria-label="关闭" onClick={close}>×</button>
        </div>
        <div className="field">
          <label htmlFor="teacher-password">密码</label>
          <input
            id="teacher-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError('');
            }}
          />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? '登录中…' : '登录'}
        </button>
      </form>
    </Sheet>
  );
}
