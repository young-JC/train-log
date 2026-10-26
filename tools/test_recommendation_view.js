// 纯文本拆分边界回归；页面 file:// 交互与真实 DOM 另做浏览器验证。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({
 document: {createElement(){return {innerHTML:'',get textContent(){return this.innerHTML;}};}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../train2.0/assets/recommendation-view.js'),'utf8'),context);
const evaluate = code => JSON.parse(JSON.stringify(vm.runInContext(code,context)));

assert.deepEqual(evaluate("recViewSplit('4组（工作30秒@RPE6–7 + 轻骑90秒）+ 步行（Easy Walk）','+')"),[
 '4组（工作30秒@RPE6–7 + 轻骑90秒）+','步行（Easy Walk）'
]);
assert.deepEqual(evaluate("recViewSplit('右膝0.5/10。采用14kg。','。；')"),['右膝0.5/10。','采用14kg。']);

const dosing = evaluate("recViewDoseOptions('每槽只选一个：A 3×6/侧@RPE6–7；B 3×3–5/侧@RPE5–6；C 4×4@RPE6–7。A/B/C均须无痛；疼痛即停止。')");
assert.equal(dosing.options.A,'3×6/侧@RPE6–7；');
assert.equal(dosing.options.B,'3×3–5/侧@RPE5–6；');
assert.equal(dosing.options.C,'4×4@RPE6–7。');
assert.equal(dosing.common,'每槽只选一个：\nA/B/C均须无痛；疼痛即停止。');

const history = evaluate("recViewDoseOptions('A 4×5，RPE6–7；参考单侧30kg，旧记录0.5/10。B轻负荷3×6；C轻负荷3×5；B/C不复制其他动作重量。')");
assert(history.options.A.includes('参考单侧30kg，旧记录0.5/10。'));
assert.equal(history.options.B,'轻负荷3×6；');
assert.equal(history.options.C,'轻负荷3×5；');
assert.equal(history.common,'B/C不复制其他动作重量。');
assert.deepEqual(evaluate("recViewDoseOptions('各动作30秒/侧，不累加。').options"),{});

const paired = evaluate("recViewExerciseRows('胸椎旋转 + 弹力带拉开','胸椎1×6/侧、拉开1×10；自然呼吸。')");
assert.equal((paired.match(/class="rec-exercise-row"/g)||[]).length,2);
assert.equal((paired.match(/class="rec-exercise-amount"/g)||[]).length,2);
assert(paired.includes('自然呼吸'));
const shared = evaluate("recViewExerciseRows('胸椎旋转 + 弹力带拉开','各1组；自然呼吸。')");
assert(!shared.includes('class="rec-exercise-amount"'));
assert(shared.includes('各1组'));
assert(!evaluate("recViewList('。；正常呼吸。')").includes('<li></li>'));
assert.equal(evaluate("recViewList('。')"),'');
console.log('OK: 括号、间歇、小数、选项剂量、共同限制及组合逐项对应');
