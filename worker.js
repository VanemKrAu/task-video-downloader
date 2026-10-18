// 视频链接代理 · 部署到 Cloudflare Workers。要支持别的中转站，改下面 ALLOWED_HOSTS 那一行。
const ALLOWED_HOSTS = ['api.huanling.icu'];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'X-Target, X-Api-Key, Content-Type',
  'Access-Control-Expose-Headers': 'X-Total-Size, Content-Type',
  'Access-Control-Max-Age': '86400'
};
function reply(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS)
  });
}
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return reply({ error: 'POST only' }, 405);
    }
    const target = request.headers.get('X-Target');
    const key = request.headers.get('X-Api-Key');
    if (!target) return reply({ error: 'missing X-Target' }, 400);
    if (!key) return reply({ error: 'missing X-Api-Key' }, 400);
    let url;
    try {
      url = new URL(target);
    } catch (e) {
      return reply({ error: 'bad url' }, 400);
    }
    if (!ALLOWED_HOSTS.includes(url.host)) {
      return reply({ error: 'host not allowed: ' + url.host }, 403);
    }
    let upstream;
    try {
      upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + key,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      });
    } catch (e) {
      return reply({ error: 'fetch failed: ' + e.message }, 502);
    }
    if (!upstream.ok) {
      let detail = '';
      try { detail = (await upstream.text()).slice(0, 400); } catch (e) { detail = ''; }
      return reply({ error: 'upstream ' + upstream.status, detail: detail }, upstream.status);
    }
    const headers = new Headers(CORS);
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'video/mp4');
    const len = upstream.headers.get('Content-Length');
    if (len) headers.set('X-Total-Size', len);
    return new Response(upstream.body, { status: 200, headers });
  }
};
