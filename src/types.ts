export type EntryType = 'open' | 'lesson' | 'practice' | 'blocked';

export interface Entry {
  id: string;
  locationId: string;
  /** YYYY-MM-DD */
  date: string;
  /** minutes from midnight, always a multiple of 30 */
  start: number;
  end: number;
  type: EntryType;
  room?: string;
  student?: string;
  openPractice?: boolean;
  note?: string;
}

export interface StudioLocation {
  id: string;
  name: string;
  address: string;
}
