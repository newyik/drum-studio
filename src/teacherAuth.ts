/// <reference types="vite/client" />

const { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_DRUM_TEACHER_EMAIL, VITE_DRUM_TEACHER_ID } =
  import.meta.env;

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
  return session.user?.id === VITE_DRUM_TEACHER_ID && !!session.access_token;
}
