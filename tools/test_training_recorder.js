/* Contract and data-integrity checks; no repository or training data writes. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../mobile-recorder/dist/core.js');
let cases = 0;
function test(name, fn) { fn(); cases++; console.log('✓ ' + name); }
const fixture = {
  kind: 'train2.recommendation', schemaVersion: 1, date: '2026-10-27', title: '虚构测试，不入库', cycle: '测试槽位',
  readiness: {sleep: 4, fatigue: 2, soreness: 2, pain: 0, motivation: 4, score: 84, redFlags: false, painNote: '虚构：无疼痛'},
  slots: [
    {id: 'warm', module: '热身', selectedOptionId: 'A', options: [{id: 'A', name: '步行', prescription: '推荐目标 2分钟'}]},
    {id: 'main', module: '力量三选一', options: [{id: 'A', name: '动作甲', prescription: '3×8 @ RPE 7'}, {id: 'B', name: '动作乙', prescription: '2×10'}, {id: 'C', name: '动作丙', prescription: '2×8/侧'}]},
    {id: 'learn', module: '可选学习', optional: true, replacesSlotId: 'main', options: [{id: 'A', name: '学习动作', prescription: '2×3'}]}
  ]
};
function complete() {
  const s = C.createSession(fixture);
  s.sessionStatus = '已完成'; s.duration = '60'; s.sessionRpe = '5'; s.painDuring = '0'; s.painAfter = '0';
  s.actions[0].status = 'completed'; s.actions[0].actual.dose = '90秒';
  s.actions[1].status = 'completed'; s.actions[1].selectedOptionId = 'B'; s.actions[1].actual.dose = '2×8';
  s.actions[2].status = 'skipped';
  return s;
}
test('JSON contract, fenced whole reply, missing and unsupported versions', () => {
  assert.equal(C.validateRecommendation('说明\n```json\n' + JSON.stringify(fixture) + '\n```').date, fixture.date);
  assert.throws(() => C.validateRecommendation({...fixture, schemaVersion: 2}), /schemaVersion/);
  assert.throws(() => C.validateRecommendation('今天建议深蹲3组'), /完整/);
  assert.throws(() => C.validateRecommendation({...fixture, date: '2026-02-30'}), /日期/);
  assert.throws(() => C.validateRecommendation({...fixture, readiness: 'text'}), /readiness/);
  assert.throws(() => C.validateRecommendation({...fixture, slots: [fixture.slots[0], fixture.slots[0]]}), /重复/);
  assert.throws(() => C.validateRecommendation({...fixture, slots: [{...fixture.slots[0], selectedOptionId: 'bad'}]}), /不存在/);
  assert.throws(() => C.validateRecommendation({...fixture, slots: [fixture.slots[2]]}), /替换关系/);
  assert.throws(() => C.validateRecommendation({...fixture, readiness: {...fixture.readiness, score: 99}}), /不一致/);
});
test('Actual results start blank; A/B/C and optional learning remain unselected', () => {
  const s = C.createSession(fixture);
  assert.equal(s.actions[1].selectedOptionId, null);
  assert.equal(s.actions[2].selectedOptionId, null);
  assert.ok(s.actions.every(a => a.status === 'pending' && a.actual.dose === '' && a.actual.load === '' && a.actual.rpe === ''));
  s.actions[0].actual.dose = '用户数据';
  assert.equal(fixture.slots[0].options[0].prescription, '推荐目标 2分钟');
});
test('Contaminated option fields lose only labels and move descriptions into notes', () => {
  const raw = {id: 'A', name: '： A：：下肢准备组合；足踝与髋部；痛则停止', prescription: '： A：2×8/侧；休90秒', notes: '组合说明补充'};
  const before = JSON.stringify(raw), clean = C.optionDetails(raw);
  assert.equal(clean.name, '下肢准备组合');
  assert.equal(clean.prescription, '2×8/侧；休90秒');
  assert.ok(clean.notes.includes('足踝与髋部；痛则停止') && clean.notes.includes('组合说明补充'));
  assert.deepEqual(C.optionDetails(clean), clean);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(C.optionDetails({id: 'B', name: 'B-stance RDL（RDL; 单腿变式）', prescription: '休息60:30'}).name, 'B-stance RDL（RDL; 单腿变式）');
  assert.equal(C.optionDetails({id: 'B', name: '动作乙', prescription: '休息60:30'}).prescription, '休息60:30');
});
test('Legacy drafts display and export short defaults while preserving explicitly entered actual values', () => {
  const s = complete();
  s.actions[1].slot.options[1] = {id: 'B', name: '：动作乙；动作说明和安全边界', prescription: '：2×8', notes: ''};
  const before = JSON.stringify(s);
  assert.equal(C.selected(s.actions[1]).name, '动作乙');
  assert.ok(C.selected(s.actions[1]).notes.includes('动作说明和安全边界'));
  const table = C.exportMarkdown(s).split('## 实际训练内容')[1].split('## 训练负荷与疼痛')[0];
  assert.match(table, /动作乙/); assert.doesNotMatch(table, /动作说明和安全边界|：动作乙/);
  assert.equal(JSON.stringify(s), before);
  s.actions[1].actualName = '用户明确填写的名称；保留原文';
  assert.equal(C.actionName(s.actions[1]), '用户明确填写的名称；保留原文');
});
test('Readiness preserves zero, integer ranges, red flags and unknown distinction', () => {
  const s = C.createSession(fixture);
  assert.deepEqual(C.readinessResult(s.readiness), {score: 84, level: '绿色'});
  s.readiness.redFlags = true; assert.equal(C.readinessResult(s.readiness).level, '红色');
  s.readiness.redFlags = ''; assert.match(C.readinessResult(s.readiness).level, /待确认/);
  s.readiness.pain = 5; assert.equal(C.readinessResult(s.readiness).level, '红色');
  s.readiness.sleep = C.UNKNOWN; assert.equal(C.readinessResult(s.readiness).score, null);
  s.readiness.sleep = 0; assert.throws(() => C.readinessResult(s.readiness), /范围/);
});
test('Cross-date template clears Readiness and cycle and never copies actuals', () => {
  const s = C.createSession(fixture, '2026-10-28');
  assert.equal(s.readiness.sleep, ''); assert.equal(s.readiness.pain, ''); assert.equal(s.cycle, '');
  assert.equal(s.source.date, '2026-10-27'); assert.ok(s.actions.every(a => a.status === 'pending'));
});
test('Incomplete Readiness remains stable across validation and compatible with old draft sources', () => {
  const normalized = C.validateRecommendation({...fixture, readiness: {sleep: 4}});
  assert.deepEqual(C.validateRecommendation(normalized), normalized);
  const session = C.createSession(normalized);
  assert.equal(session.readiness.pain, ''); assert.equal(session.readiness.redFlags, '');
  session.source.readiness.pain = ''; session.source.readiness.redFlags = '';
  assert.doesNotThrow(() => C.validateSession(session));
});
test('Load uses confirmed duration × SRPE, zero is valid and absent remains uncomputed', () => {
  const s = complete(); assert.equal(C.sessionLoad(s), 300);
  s.sessionRpe = '0'; assert.equal(C.sessionLoad(s), 0);
  s.duration = ''; assert.equal(C.sessionLoad(s), null);
  s.duration = C.UNKNOWN; assert.equal(C.sessionLoad(s), null);
  s.duration = '60'; s.sessionRpe = '11'; assert.throws(() => C.sessionLoad(s), /范围/);
  s.sessionRpe = '-1'; assert.throws(() => C.sessionLoad(s), /数字/);
});
test('Export excludes recommendation doses, pending candidates and skipped actions from actual table', () => {
  const s = complete(), md = C.exportMarkdown(s);
  const actual = md.split('## 实际训练内容')[1].split('## 训练负荷与疼痛')[0];
  assert.match(actual, /动作乙/); assert.doesNotMatch(actual, /动作甲|动作丙|学习动作|推荐目标|RPE 7/);
  assert.match(md, /跳过：可选学习/); assert.match(md, /300 AU/);
  assert.ok(!C.issues(s).missing.length);
  s.painAfter = ''; assert.ok(C.issues(s).missing.includes('训练后疼痛'));
  s.painAfter = C.UNKNOWN; assert.ok(!C.issues(s).missing.includes('训练后疼痛'));
  assert.match(C.exportMarkdown(s), /未记录/);
});
test('Per-set values, unit, weight basis, side differences, replacements and additions survive export', () => {
  const s = complete(), a = s.actions[1];
  a.actualName = '实际替代动作'; a.status = 'partial'; a.actual.mode = 'sets';
  a.actual.sets = [{dose: '5次/侧', load: '30', unit: 'kg', basis: '单侧', rpe: '6–7', notes: '左6右7'}, {dose: '4次/侧', load: '70', unit: 'lb', basis: '总重', rpe: '8', notes: '右侧先做'}];
  const extra = C.addAction(s); extra.actualName = '投篮测试'; extra.status = 'completed'; extra.actual.dose = '10分钟，命中20，出手30';
  const md = C.exportMarkdown(s);
  assert.match(md, /30 kg 单侧/); assert.match(md, /70 lb 总重/); assert.match(md, /左6右7/);
  assert.match(md, /动作乙 → 实际替代动作/); assert.match(md, /临时加练：投篮测试/);
  assert.match(md, /命中20，出手30/); assert.doesNotMatch(md, /66\.7%/);
  a.actual.sets[0].rpe = '12'; assert.ok(C.issues(s).errors.some(e => e.includes('RPE')));
});
test('Mutually replacing slots, ambiguous completion and untrained contradictions block export', () => {
  const s = complete(); s.actions[2].status = 'completed'; s.actions[2].selectedOptionId = 'A';
  assert.throws(() => C.exportMarkdown(s), /替换槽位重复完成/);
  s.actions[2].status = 'skipped'; s.actions[1].selectedOptionId = null;
  assert.throws(() => C.exportMarkdown(s), /实际动作|待选/);
  s.sessionStatus = '未训练'; assert.throws(() => C.exportMarkdown(s), /冲突/);
});
test('Recovery and cancelled session do not create fictitious activity/load', () => {
  const s = complete(); s.sessionStatus = '恢复日'; assert.match(C.exportMarkdown(s), /恢复日/);
  s.sessionStatus = '未训练'; s.actions.forEach(a => { a.status = 'skipped'; });
  const md = C.exportMarkdown(s); assert.match(md, /未训练，无实际动作/); assert.match(md, /不计负荷/);
  s.duration = ''; s.sessionRpe = ''; assert.ok(!C.issues(s).missing.includes('训练总时长'));
});
test('Backups round-trip complete drafts and reject duplicates/corruption before restore', () => {
  const s = complete(), restored = C.readBackup(C.backup([s])); assert.deepEqual(restored, [s]);
  assert.throws(() => C.readBackup({kind: 'train2.recorder-backup', schemaVersion: 1, sessions: [s, s]}), /重复日期/);
  assert.throws(() => C.readBackup({kind: 'train2.recorder-backup', schemaVersion: 1, sessions: [{...s, updatedAt: null}]}), /时间/);
  assert.throws(() => C.readBackup({kind: 'train2.recorder-backup', schemaVersion: 1, sessions: [{...s, readiness: {sleep: 3.5}}]}), /整数/);
});
test('Shared skill instructions and example stay parseable and never modify source data structure', () => {
  const root = path.join(__dirname, '..');
  const doc = fs.readFileSync(path.join(root, 'mobile-recorder/FORMAT.md'), 'utf8');
  assert.equal(C.validateRecommendation(doc).slots.length, 1);
  for (const file of ['.codex/skills/recommend-training-2/SKILL.md', '.claude/skills/recommend-training-2/skill.md', '.codex/skills/record-training-2/SKILL.md', '.claude/skills/record-training-2/skill.md']) assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /mobile-recorder\/FORMAT\.md/);
  assert.equal(fs.readFileSync(path.join(root, '.codex/skills/record-training-2/SKILL.md'), 'utf8'), fs.readFileSync(path.join(root, '.claude/skills/record-training-2/skill.md'), 'utf8'));
});
async function verifyServiceWorker() {
  const events = {}, deleted = [], added = [], state = {claimed: false, migrated: false};
  const caches = {
    keys: async () => ['suilian-shell-v0', 'suilian-shell-v1', 'suilian-shell-v2', 'suilian-shell-v3', 'suilian-shell-v4', 'other-app-cache'],
    delete: async key => { deleted.push(key); return true; },
    open: async () => ({addAll: async requests => { assert.ok(requests.every(request => request.cache === 'reload')); added.push(...requests.map(request => request.url)); }, match: async key => ({cachedUrl: key})})
  };
  const context = {URL, Response, Request, caches, self: {location: {href: 'https://example.test/recorder/sw.js'}, skipWaiting: async () => { state.migrated = true; }, clients: {claim: async () => { state.claimed = true; }}, addEventListener: (name, listener) => { events[name] = listener; }}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../mobile-recorder/dist/sw.js'), 'utf8'), context);
  let pending;
  events.install({waitUntil: value => { pending = value; }}); await pending;
  assert.ok(state.migrated);
  assert.ok(added.includes('https://example.test/recorder/index.html'));
  for (const url of added) assert.ok(fs.existsSync(path.join(__dirname, '../mobile-recorder/dist', new URL(url).pathname.replace('/recorder/', ''))));
  events.activate({waitUntil: value => { pending = value; }}); await pending;
  assert.deepEqual(deleted, ['suilian-shell-v0', 'suilian-shell-v1', 'suilian-shell-v2', 'suilian-shell-v3']); assert.ok(state.claimed);
  let response;
  events.fetch({request: {method: 'GET', url: 'https://example.test/recorder/?source=home'}, respondWith: value => { response = value; }});
  assert.equal((await response).cachedUrl, 'https://example.test/recorder/index.html');
  response = null;
  events.fetch({request: {method: 'GET', url: 'https://example.test/signin-with-chatgpt'}, respondWith: value => { response = value; }});
  assert.equal(response, null);
  console.log('✓ Service-worker upgrades only replace owned static caches; authentication routes stay outside interception');
  console.log('Passed ' + (cases + 1) + ' training-recorder integrity scenarios.');
}
verifyServiceWorker().catch(error => { console.error(error); process.exitCode = 1; });
