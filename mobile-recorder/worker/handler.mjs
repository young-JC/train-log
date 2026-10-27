/* Sites dispatch authenticates private-site requests before invoking this Worker.
 * No browser draft/result endpoint exists. Only recommendation templates go to R2.
 */
export function createRecorderWorker(core, assets) {
  const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});
  const keyFor = date => 'recommendations/' + date + '.json';
  async function latest(bucket, asOf) {
    const dates = [];
    let cursor;
    do {
      const page = await bucket.list({prefix: 'recommendations/', ...(cursor ? {cursor} : {})});
      page.objects.forEach(object => {
        const match = /^recommendations\/(\d{4}-\d{2}-\d{2})\.json$/.exec(object.key);
        if (match && core.validDate(match[1]) && match[1] <= asOf) dates.push(match[1]);
      });
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    for (const date of dates.sort().reverse()) {
      const object = await bucket.get(keyFor(date));
      if (object) return object.json();
    }
    return null;
  }
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      try {
        if (url.pathname === '/api/recommendations/latest') {
          if (request.method !== 'GET') return json({error: 'Method not allowed'}, 405);
          if (!env.BUCKET) return json({error: '推荐收件箱尚未配置'}, 503);
          const asOf = url.searchParams.get('asOf') || core.today();
          if (!core.validDate(asOf)) return json({error: 'asOf 日期无效'}, 400);
          return json({inbox: await latest(env.BUCKET, asOf)});
        }
        if (url.pathname === '/api/recommendations') {
          if (request.method !== 'POST') return json({error: 'Method not allowed'}, 405);
          if (!env.BUCKET) return json({error: '推荐收件箱尚未配置'}, 503);
          const origin = request.headers.get('origin');
          if (origin && origin !== url.origin) return json({error: '不接受跨站写入'}, 403);
          if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({error: '需要 application/json'}, 415);
          if (Number(request.headers.get('content-length')) > 2000000) return json({error: '推荐超过 2 MB'}, 413);
          const raw = await request.text();
          if (new TextEncoder().encode(raw).byteLength > 2000000) return json({error: '推荐超过 2 MB'}, 413);
          let recommendation;
          try { recommendation = core.validateRecommendation(raw); }
          catch (error) { return json({error: error.message}, 400); }
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(recommendation)));
          const revision = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
          const key = keyFor(recommendation.date), existing = await env.BUCKET.get(key);
          const previous = existing ? await existing.json() : null;
          if (previous?.revision === revision) return json({ok: true, date: recommendation.date, revision, publishedAt: previous.publishedAt, unchanged: true});
          const inbox = {recommendation, revision, publishedAt: new Date().toISOString()};
          await env.BUCKET.put(key, JSON.stringify(inbox), {httpMetadata: {contentType: 'application/json'}});
          return json({ok: true, date: recommendation.date, revision, publishedAt: inbox.publishedAt, unchanged: false});
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', {status: 405});
        const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const asset = assets[name];
        if (!asset) return new Response('Not found', {status: 404});
        return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.body), c => c.charCodeAt(0)), {headers: {'content-type': asset.type, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff', ...(name === 'sw.js' ? {'service-worker-allowed': '/'} : {})}});
      } catch (_) {
        return json({error: '推荐同步暂不可用，请稍后重试；手机草稿不受影响'}, 503);
      }
    }
  };
}

export default createRecorderWorker(globalThis.TrainingRecorder, RECORDER_ASSETS);
