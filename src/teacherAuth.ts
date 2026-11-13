/// <reference types="vite/client" />

const { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_DRUM_TEACHER_EMAIL, VITE_DRUM_TEACHER_ID } =
  import.meta.env;

export const sharedSchedule = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_PUBLISHABLE_KEY && VITE_DRUM_TEACHER_EMAIL && VITE_DRUM_TEACHER_ID);

export async function verifyTeacher(password: string) {
  const supabase = [VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_DRUM_TEACHER_EMAIL, VITE_DRUM_TEACHER_ID];
  if (supabase.some(Boolean) && !supabase.every(Boolean)) {
    throw new Error('老师登录配置不完整。');
  }

  const remote = supabase.every(Boolean);
  if (!remote && !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
    throw new Error('线上老师登录尚未配置，可以从「体验版」试用排课。');
  }

  const response = remote
    ? await fetch(new URL('/auth/v1/token?grant_type=password', VITE_SUPABASE_URL), {
        method: 'POST',
        headers: { apikey: VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: VITE_DRUM_TEACHER_EMAIL, password }),
      })
    : await fetch('/api/teacher-login', { method: 'POST', body: password });

  if (response.status === 429) throw new Error('尝试次数过多，请稍后再试。');
  if (response.status === 503) throw new Error('线上老师登录尚未配置，可以从「体验版」试用排课。');
  if ([400, 401, 403].includes(response.status)) return false;
  if (!response.ok) throw new Error('登录服务暂时不可用，请稍后再试。');
  if (!remote) return response.status === 204;

  const session = await response.json();
  return session.user?.id === VITE_DRUM_TEACHER_ID && typeof session.access_token === 'string' ? session.access_token : false;
}

export async function scheduleRequest<T>(resource: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('apikey', VITE_SUPABASE_PUBLISHABLE_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(new URL(`/rest/v1/${resource}`, VITE_SUPABASE_URL), { ...init, headers });
  if (response.status === 401 || response.status === 403) throw new Error('登录已失效或权限不足，请重新登录。');
  if (response.status === 409) throw new Error('安排与现有时段冲突，请刷新课表后重试。');
  if (!response.ok) throw new Error('无法同步课表，请稍后重试。');
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

export async function readSchedule(resource: string, token?: string) {
  const entries = [];
  for (let offset = 0; ; offset += 500) {
    const batch = await scheduleRequest<import('./types').Entry[]>(`${resource}?order=id&limit=500&offset=${offset}`, token);
    entries.push(...batch);
    if (batch.length < 500) return entries;
  }
}
