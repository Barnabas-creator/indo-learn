// 入口：路由分发、CORS、错误兜底。业务逻辑都在 routes.js。
import { handleRegister, handleLogin, handleActivate, handleContentKey, json } from './routes.js';

export function corsHeaders(env) {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN ?? '',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
  };
}

const ROUTES = {
  'POST /register': handleRegister,
  'POST /login': handleLogin,
  'POST /activate': handleActivate,
  'GET /content-key': handleContentKey,
};

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const handler = ROUTES[`${request.method} ${url.pathname}`];

    let res;
    if (!handler) {
      res = json({ error: 'not_found' }, 404);
    } else {
      try {
        res = await handler(request, env);
      } catch (err) {
        console.error(err);
        res = json({ error: 'server_error' }, 500);
      }
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
};
