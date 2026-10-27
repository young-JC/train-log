'use strict';
const assert = require('node:assert/strict');
const L = require('../mobile-recorder/dist/recommendation-layout.js');

assert.deepEqual(L.lines('3×8/侧；休90秒。自然呼吸'), ['3×8/侧', '休90秒', '自然呼吸']);
assert.deepEqual(L.lines('3×5；RPE 6.5；疼痛0.5/10时仍如实记录'), ['3×5', 'RPE 6.5', '疼痛0.5/10时仍如实记录']);
assert.deepEqual(L.lines('预演8、5、3次；休息120秒', true), ['预演8、5、3次', '休息120秒']);
assert.deepEqual(L.lines('负荷30kg+5kg；保持其他条件', true), ['负荷30kg+5kg', '保持其他条件']);
assert.deepEqual(L.lines('间歇（工作30秒 + 轻骑90秒；4轮）；步行2分钟', true), ['间歇（工作30秒 + 轻骑90秒；4轮）', '步行2分钟']);
assert.deepEqual(L.lines('步行（Easy Walk）2分钟＋踝背屈（Ankle）1×8/侧', true), ['步行（Easy Walk）2分钟', '踝背屈（Ankle）1×8/侧']);
assert.deepEqual(L.lines('前后摆腿（Front Swing）、侧向摆腿（Side Swing）各8次/侧', true), ['前后摆腿（Front Swing）', '侧向摆腿（Side Swing）', '各8次/侧']);
assert.deepEqual(L.lines('以下各30秒/侧、1轮：腓肠肌拉伸（Calf）＋腘绳肌拉伸（Hamstring）', true), ['以下各30秒/侧、1轮：', '腓肠肌拉伸（Calf）', '腘绳肌拉伸（Hamstring）']);
const group = L.prescription('前后摆腿（Front Swing）、侧向摆腿（Side Swing）各8次/侧');
assert.ok(group.includes('class="common-dose">各8次/侧'));
assert.equal((group.match(/<li>/g) || []).length, 2);
const option = {name: '动作甲', prescription: '3×8；休120秒', notes: '动作甲；RPE6–7；膝内扣或疼痛即停'};
const before = JSON.stringify(option), html = L.reference(option, 'power');
assert.equal((html.match(/class="prescription-lines"/g) || []).length, 1);
assert.ok(html.includes('推荐安排') && html.includes('动作说明与停止条件') && html.includes('膝内扣或疼痛即停'));
assert.equal(JSON.stringify(option), before);
assert.equal((html.match(/动作甲/g) || []).length, 0); // Already in the action heading, not repeated in notes.
const unsafe = L.reference({name: '<img>', prescription: '<img src=x onerror=alert(1)>；3×8', notes: '<script>alert(1)</script>'});
assert.ok(!unsafe.includes('<img') && !unsafe.includes('<script>'));
assert.ok(unsafe.includes('&lt;img') && unsafe.includes('3×8'));
assert.deepEqual(L.lines('动作一<br/>动作二；提示'), ['动作一', '动作二', '提示']);
assert.deepEqual(L.lines('：先热身；：动作条件；：'), ['先热身', '动作条件']);
console.log('PASS: recommendation layout preserves doses, decimals, parenthesized intervals, shared quantities and raw data; text remains escaped.');
