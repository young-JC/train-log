// 无浏览器依赖的日期/适用性/渲染回归检查；不写仓库。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {innerHTML: '', value: '', disabled: false,
    replaceChildren(...options) { this.options = options; this.value = options[0]?.value || ''; }});
  return elements.get(id);
}
class FakeDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-13T10:00:00+08:00'])); }
}
const context = vm.createContext({Date: FakeDate, Intl, document: {getElementById: element},
  Option: function(text, value) { this.text = text; this.value = value; }});
vm.runInContext(fs.readFileSync(path.join(root, 'train2.0/assets/data/reviews.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'train2.0/assets/review-panel.js'), 'utf8'), context);
const panel = vm.runInContext('TrainingReviewPanel', context);
const data = {cycleStart: '2026-09-21', mode: '3', currentSources: {'2026-09-28': 'a'}, reports: []};
assert.equal(panel.pending(data, '2026-09-27').length, 0);
assert.equal(panel.pending(data, '2026-10-13').length, 3);
assert.equal(panel.pending(data, '2026-10-19').length, 5);
const metric = {known: 0, total: 1, sum: null, mean: null, max: null, complete: false, missingDates: ['2026-10-04']};
const report = {id: '2026-09-21-weekly-2026-09-28-2026-10-04', cycleStart: '2026-09-21', type: 'weekly',
  start: '2026-09-28', end: '2026-10-04', dataThrough: '2026-10-04', status: 'complete',
  generatedAt: '2026-10-05T10:00:00+08:00', updatedAt: '2026-10-06T10:00:00+08:00', profileUpdatedAt: '2026-10-10',
  sources: {'2026-09-28': 'a'}, applicability: {start: '2026-10-05', end: '2026-10-11'},
  summary: '<script>bad()</script>', execution: [{week: 2, slot: 'D1', status: 'partial', dates: ['2026-09-28'], note: '部分'}],
  stats: {trainingDays: 1, metrics: {load: metric}}, findings: [{text: '证据', dates: ['2026-09-28']}],
  extraSessions: [], decisions: [], gaps: ['缺时长']};
data.reports.push(report);
assert.equal(panel.applicable(data, '2026-10-05').length, 0);
assert.equal(panel.applicable(data, '2026-10-06').length, 1);
assert.equal(panel.applicable(data, '2026-10-12').length, 0);
data.currentSources['2026-10-02'] = 'new';
assert.equal(panel.isStale(report, data.currentSources), true);
assert.equal(panel.applicable(data, '2026-10-06').length, 0);
delete data.currentSources['2026-10-02'];
assert.equal(panel.isStale(report, data.currentSources), false);
report.status = 'progress';
assert.equal(panel.applicable(data, '2026-10-06').length, 0);
report.status = 'complete';
vm.runInContext('TRAINING_REVIEWS.reports.length = 0; TrainingReviewPanel.render()', context);
assert.match(element('reviewReport').innerHTML, /还没有复盘报告/);
assert.equal(element('reviewSelect').disabled, true);
const dataInContext = vm.runInContext('TRAINING_REVIEWS', context);
dataInContext.reports.push(report, {...report, id: 'older', updatedAt: '2026-10-05T10:00:00+08:00', summary: '旧报告'});
dataInContext.currentSources = {...data.currentSources};
panel.render();
assert.equal(element('reviewSelect').value, report.id);
assert.match(element('reviewReport').innerHTML, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
assert.doesNotMatch(element('reviewReport').innerHTML, /<script>/);
assert.match(element('reviewReport').innerHTML, /records\/2026-09.html#detail-2026-09-28/);
assert.match(element('reviewReport').innerHTML, /已知合计（不完整）|未记录/);
element('reviewSelect').value = 'older';
element('reviewSelect').onchange();
assert.match(element('reviewReport').innerHTML, /旧报告/);
panel.render();
assert.equal(element('reviewSelect').value, 'older');
dataInContext.currentSources['2026-09-28'] = 'changed';
panel.render();
assert.match(element('reviewReport').innerHTML, /待刷新/);
console.log('Review panel checks passed (dates, eligibility, history, escaping, evidence, stale state).');
