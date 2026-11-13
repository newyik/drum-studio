import type { Entry, StudioLocation } from './types';
import { addDays, fromISO, studioTime, studioWeek, toISO } from './utils';

export const LOCATIONS: StudioLocation[] = [
  { id: 'shinjuku', name: '新宿', address: '东京都新宿区 · 地址待补充' },
];

const uid = () => crypto.randomUUID();

/** Demo schedule for the current week, so the prototype always looks alive. */
export function createSeed(locationId: string, fromToday = false): Entry[] {
  const firstDate = fromToday ? fromISO(studioTime().date) : studioWeek();
  const day = (i: number) => toISO(addDays(firstDate, i));

  const make = (
    i: number,
    start: number,
    end: number,
    type: Entry['type'],
    extra: Partial<Entry> = {},
  ): Entry => ({
    id: uid(),
    locationId,
    date: day(i),
    start,
    end,
    type,
    ...extra,
  });

  return [
    // 周一
    make(0, 540, 1380, 'open'),
    make(0, 600, 660, 'lesson', { student: '示例学生 01', room: '2 号房' }),
    make(0, 780, 870, 'lesson', { student: '示例学生 02', room: '2 号房' }),
    make(0, 1080, 1200, 'practice', { room: '3 号房', openPractice: true }),

    // 周二
    make(1, 540, 1380, 'open'),
    make(1, 570, 630, 'lesson', { student: '示例学生 03', room: '1 号房' }),
    make(1, 720, 780, 'blocked', { note: '午休' }),
    make(1, 960, 1050, 'lesson', { student: '示例学生 04', room: '1 号房' }),

    // 周三
    make(2, 540, 1380, 'open'),
    make(2, 660, 720, 'lesson', { student: '示例学生 05', room: '2 号房' }),
    make(2, 1140, 1260, 'practice', { room: '1 号房', openPractice: true }),

    // 周四
    make(3, 540, 1260, 'open'),
    make(3, 570, 630, 'lesson', { student: '示例学生 06', room: '2 号房' }),
    make(3, 630, 720, 'lesson', { student: '示例学生 07', room: '2 号房' }),
    make(3, 1080, 1140, 'lesson', { student: '示例学生 08', room: '2 号房' }),

    // 周五（连着上好几节）
    make(4, 540, 1380, 'open'),
    make(4, 780, 840, 'lesson', { student: '示例学生 09', room: '1 号房' }),
    make(4, 1200, 1320, 'practice', { room: '2 号房', openPractice: true }),

    // 周六
    make(5, 600, 1200, 'open'),
    make(5, 660, 750, 'lesson', { student: '示例学生 10', room: '3 号房' }),
    make(5, 840, 900, 'lesson', { student: '示例学生 11', room: '3 号房' }),
    make(5, 900, 990, 'lesson', { student: '示例学生 12', room: '3 号房' }),

    // 周日
    make(6, 540, 1080, 'open'),
    make(6, 600, 660, 'lesson', { student: '示例学生 13', room: '1 号房' }),
    make(6, 720, 780, 'blocked', { note: '个人休息' }),
  ];
}
