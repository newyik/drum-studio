import { timingSafeEqual } from 'node:crypto';

export function teacherAuth(env) {
  const expected = Buffer.from(env.DRUM_TEACHER_PASSWORD ?? '');
  let failed = 0;
  let resetAt = 0;

  function install(server) {
    server.middlewares.use('/api/teacher-login', async (request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      if (request.method !== 'POST') {
        response.writeHead(405, { Allow: 'POST' }).end();
        return;
      }
      if (!expected.length) {
        response.writeHead(503).end();
        return;
      }
      if (Date.now() >= resetAt) {
        failed = 0;
        resetAt = Date.now() + 60_000;
      }
      if (failed >= 8) {
        response.writeHead(429).end();
        return;
      }
      failed++;
      try {
        let size = 0;
        const chunks = [];
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 1024) {
            response.writeHead(413).end();
            return;
          }
          chunks.push(chunk);
        }
        const input = Buffer.concat(chunks);
        const valid = input.length === expected.length && timingSafeEqual(input, expected);
        if (valid) failed = 0;
        response.writeHead(valid ? 204 : 401).end();
      } catch {
        response.writeHead(400).end();
      }
    });
  }

  return {
    name: 'drum-local-teacher-auth',
    configureServer: install,
    configurePreviewServer: install,
  };
}
