/* Local fake storage/transport only. Never upload a fixture to the live Site. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = require('../mobile-recorder/dist/core.js');
const {publish} = require('./push_training_recommendation.js');
execFileSync(process.execPath, [path.join(root, 'mobile-recorder/scripts/build-worker.mjs')]);
const bundle = readFileSync(path.join(root, 'mobile-recorder/dist/server/index.js'), 'utf8');
const {default: worker} = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
const data = new Map();
const bucket = {
  get: async key => data.has(key) ? {json: async () => JSON.parse(data.get(key))} : null,
  put: async (key, body) => { data.set(key, body); },
  list: async () => ({objects: [...data.keys()].map(key => ({key})), truncated: false})
};
const env = {BUCKET: bucket}, base = 'https://fictional-test.chatgpt.site';
const source = {kind: 'train2.recommendation', schemaVersion: 1, date: '2026-10-27', title: '虚构本地测试，不上线', readiness: null, slots: [{id: 'main', module: '三选一', selectedOptionId: null, options: [{id: 'A', name: '示例动作甲', prescription: '2×8'}, {id: 'B', name: '示例动作乙', prescription: '2×5'}]}]};
source.guidance = {focus: ['动作稳定'], arrangement: ['按顺序练'], safety: ['疼痛即停']};
source.slots[0].options[0].defaults = {doseMode: 'reps', count: '2', reps: '8', rest: '90', load: '20', unit: 'kg', basis: '总重'};
async function request(route, body, headers = {}) {
  const response = await worker.fetch(new Request(base + route, body === undefined ? {} : {method: 'POST', headers: {'content-type': 'application/json', ...headers}, body: JSON.stringify(body)}), env);
  return {response, result: await response.json()};
}
assert.equal((await request('/api/recommendations/latest?asOf=2026-10-27')).result.inbox, null);
const first = await request('/api/recommendations', source);
assert.equal(first.response.status, 200); assert.equal(first.result.ok, true);
const repeated = await request('/api/recommendations', source);
assert.equal(repeated.result.unchanged, true); assert.equal(repeated.result.publishedAt, first.result.publishedAt);
assert.equal(data.size, 1);
const updated = await request('/api/recommendations', {...source, title: '虚构新版'});
assert.notEqual(updated.result.revision, first.result.revision); assert.equal(data.size, 1);
await request('/api/recommendations', {...source, date: '2026-10-28', title: '虚构未来推荐'});
await request('/api/recommendations', {...source, date: '2026-10-26', title: '虚构历史推荐'});
const latest = await request('/api/recommendations/latest?asOf=2026-10-27');
assert.equal(latest.result.inbox.recommendation.date, '2026-10-27');
assert.equal(latest.result.inbox.recommendation.title, '虚构新版');
assert.deepEqual(latest.result.inbox.recommendation.guidance, source.guidance);
assert.deepEqual(latest.result.inbox.recommendation.slots[0].options[0].defaults, source.slots[0].options[0].defaults);
assert.equal(latest.response.headers.get('cache-control'), 'no-store');
assert.equal((await request('/api/recommendations/latest?asOf=2026-02-30')).response.status, 400);
assert.equal((await request('/api/recommendations', source, {origin: 'https://unrelated.invalid'})).response.status, 403);
assert.equal((await request('/api/recommendations', {kind: 'train2.recorder-draft'})).response.status, 400);
assert.equal((await request('/api/recommendations', {...source, slots: [{...source.slots[0], selectedOptionId: 'bad'}]})).response.status, 400);
const missingBinding = await worker.fetch(new Request(base + '/api/recommendations/latest'), {});
assert.equal(missingBinding.status, 503);
const unavailable = await worker.fetch(new Request(base + '/api/recommendations/latest'), {BUCKET: {list: async () => { throw new Error('storage error'); }}});
assert.equal(unavailable.status, 503);
assert.equal((await worker.fetch(new Request(base + '/api/drafts'), env)).status, 404);
for (const [url, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/sw.js', 'text/javascript'], ['/icons/icon-192.png', 'image/png']]) {
  const response = await worker.fetch(new Request(base + url), env);
  assert.equal(response.status, 200); assert.ok(response.headers.get('content-type').startsWith(type));
}
const versionReply = await worker.fetch(new Request(base + '/version.json'), env);
const version = (await versionReply.json()).version;
assert.match(version, /^[a-f0-9]{12}$/);
assert.equal(versionReply.headers.get('cache-control'), 'no-cache');
const page = await (await worker.fetch(new Request(base + '/'), env)).text();
const sw = await (await worker.fetch(new Request(base + '/sw.js'), env)).text();
assert.ok(page.includes('name="recorder-build" content="' + version + '"'));
assert.ok(sw.includes('suilian-shell-' + version));
assert.equal((await worker.fetch(new Request(base + '/update.html'), env)).status, 200);
// Sites service access is checked before making any network request; mock transport sees no real token.
const privateSite = {id: 'appgprj_6ae01a8504488191b227e468a441d8a7', current_user_role: 'owner', current_live_url: base, access_policy: {access_mode: 'custom', allowed_users: [{role: 'owner'}], allowed_groups: [], allowed_workspace_group_ids: [], allowed_tenant_group_ids: []}, siwc_bypass_bearer_token: 'FICTIONAL_TEST_ONLY'};
let calls = 0;
const mockTransport = async (url, init) => {
  calls++;
  assert.equal(url.origin, base); assert.equal(init.redirect, 'error');
  assert.equal(init.headers['OAI-Sites-Authorization'], 'Bearer FICTIONAL_TEST_ONLY');
  return worker.fetch(new Request(url, init), env);
};
const pushed = await publish({site: privateSite, recommendation: source}, mockTransport);
assert.equal(pushed.ok, true); assert.equal(pushed.date, source.date); assert.equal(calls, 1);
assert.ok(!JSON.stringify(pushed).includes('FICTIONAL_TEST_ONLY'));
await assert.rejects(publish({site: {...privateSite, access_policy: {...privateSite.access_policy, access_mode: 'public'}}, recommendation: source}, mockTransport), /本人私有/);
await assert.rejects(publish({site: {...privateSite, siwc_bypass_bearer_token: null}, recommendation: source}, mockTransport), /凭据/);
assert.equal(calls, 1);
const session = C.createSession(latest.result.inbox.recommendation);
assert.ok(session.actions.every(a => a.status === 'pending' && a.actual.dose === ''));
console.log('PASS: local inbox, idempotency, updates, future exclusion, validation, static assets, service access and draft separation. No live requests made.');
