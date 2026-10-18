/**
 * 视频链接代理（Cloudflare Worker）
 *
 * 只做一件事：浏览器把目标地址和 API Key 发过来，这里带上密钥去取文件，
 * 再把文件原样回传，顺便补上浏览器需要的跨域响应头。
 *
 * 密钥不保存，请求处理完就没了。
 *
 * 要支持别的中转站，把域名加到下面的 ALLOWED_HOSTS 里，重新部署一次即可。
 */

const ALLOWED_HOSTS = [
  'api.huanling.icu',
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'X-Target, X-Api-Key, Content-Type',
  'Access-Control-Expose-Headers': 'X-Total-Size, Content-Type',
  'Access-Control-Max-Age': '86400',
};

function reply(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS),
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return reply({ error: '只接受 POST 请求' }, 405);
    }

    const target = request.headers.get('X-Target');
    const key = request.headers.get('X-Api-Key');

    if (!target) return reply({ error: '缺少 X-Target' }, 400);
    if (!key) return reply({ error: '缺少 X-Api-Key' }, 400);

    let url;
    try {
      url = new URL(target);
    } catch (e) {
      return reply({ error: 'X-Target 不是一条合法地址' }, 400);
    }

    if (!ALLOWED_HOSTS.includes(url.host)) {
      return reply({
        error: '这个域名不在白名单里：' + url.host,
        detail: '要支持它，改 Worker 代码顶部的 ALLOWED_HOSTS，再重新部署一次。',
      }, 403);
    }

    let upstream;
    try {
      upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + key,
          // 有些中转站会按 UA 拦请求（默认那几个机器人味的 UA 会被挡），固定成一个普通浏览器
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      });
    } catch (e) {
      return reply({ error: '转发失败：' + e.message }, 502);
    }

    if (!upstream.ok) {
      let detail = '';
      try {
        detail = (await upstream.text()).slice(0, 400);
      } catch (e) {
        detail = '(读不到响应内容)';
      }
      return reply({ error: '中转站返回 ' + upstream.status, detail: detail }, upstream.status);
    }

    const headers = new Headers(CORS);
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'video/mp4');

    // 用自定义头把总大小带给前端算进度，不去动 Content-Length，免得和流式回传打架
    const len = upstream.headers.get('Content-Length');
    if (len) headers.set('X-Total-Size', len);

    return new Response(upstream.body, { status: 200, headers });
  },
};
