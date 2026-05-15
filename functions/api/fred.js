// functions/api/fred.js
// Cloudflare Pages Function — FRED API 代理
// 环境变量 FRED_API_KEY 在 Cloudflare Pages 控制台设置

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const series = url.searchParams.get('series');
  const limit  = url.searchParams.get('limit') || '52';

  if (!series) {
    return new Response(JSON.stringify({ error: 'Missing series parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = env.FRED_API_KEY || 'aec35073cfcd24002343239c7cf60522';

  const fredUrl = new URL('https://api.stlouisfed.org/fred/series/observations');
  fredUrl.searchParams.set('series_id', series);
  fredUrl.searchParams.set('api_key', apiKey);
  fredUrl.searchParams.set('file_type', 'json');
  fredUrl.searchParams.set('sort_order', 'asc');
  fredUrl.searchParams.set('limit', limit);

  try {
    const res = await fetch(fredUrl.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `FRED upstream error: ${res.status}` }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600', // 1hr cache
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
