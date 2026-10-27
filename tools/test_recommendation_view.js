// 纯文本拆分边界回归；页面 file:// 交互与真实 DOM 另做浏览器验证。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({
 document: {createElement(){return {innerHTML:'',get textContent(){return this.innerHTML;}};}}
});
const viewFile=path.join(__dirname,'../train2.0/assets/recommendation-view.js');
vm.runInContext(fs.readFileSync(viewFile,'utf8'),context,{filename:viewFile});
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
// 显式分行的选项以行块为边界；保留旧式行内剂量及其共同说明的展示约定。
for(const separator of ['；',';']){
 const third='4×4'+separator+'休120秒'+separator+'末组仍做4次。保持原重量。';
 const complete=evaluate('recViewDoseOptions('+JSON.stringify('A 3×6\nB 3×5\nC '+third)+')');
 assert.equal(complete.options.C,third);
 assert.equal(complete.common,'');
}
const scoped=evaluate('recViewDoseOptions('+JSON.stringify('每槽只选一个：\nA 3×6\nB 3×5\nC 4×4；休120秒。\nA/B/C均须无痛；疼痛即停。')+')');
assert.equal(scoped.options.C,'4×4；休120秒。');
assert.equal(scoped.common,'每槽只选一个：\nA/B/C均须无痛；疼痛即停。');
const explicit=evaluate('recViewDoseOptions('+JSON.stringify('A：3×6；\nB：3×5；\nC：4×4；休120秒。\n共同限制：不憋气；不追加训练。')+')');
assert.equal(explicit.options.A,'3×6；');
assert.equal(explicit.options.B,'3×5；');
assert.equal(explicit.options.C,'4×4；休120秒。');
assert.equal(explicit.common,'共同限制：不憋气；不追加训练。');
assert.deepEqual(evaluate("recViewDoseOptions('A 3×6；C 4×4；疼痛即停。')"),{
 options:{},common:'A 3×6；C 4×4；疼痛即停。',prefix:''
});
for(const br of ['<br>','<br/>','<BR />','\n']){
 const slot=['三选一','A：动作甲'+br+'B：动作乙'+br+'C：动作丙',
  'A：3×6；保留余力。'+br+'B：3×5；轻重量。'+br+'C：4×4；休120秒。保持原重量。'];
 const parsed=evaluate('recViewDoseOptions('+JSON.stringify(slot[2])+')');
 assert.equal(parsed.options.A,'3×6；保留余力。');
 assert.equal(parsed.options.B,'3×5；轻重量。');
 assert.equal(parsed.options.C,'4×4；休120秒。保持原重量。');
 assert.equal(parsed.common,'');
 if(br==='\n')continue;
 const cards=evaluate('recViewSlotContent('+JSON.stringify(slot)+')').match(/<article class="rec-candidate">[\s\S]*?<\/article>/g);
 assert.equal(cards.length,3);
 assert(cards[2].includes('4×4')&&cards[2].includes('休120秒')&&cards[2].includes('保持原重量'));
 assert(!cards[2].includes('保留余力')&&!cards[2].includes('轻重量'));
}
// 正式推荐只读载入内存，对照每个显式分行的 A/B/C 原文检查卡片内剂量。
vm.runInContext(fs.readFileSync(path.join(__dirname,'../train2.0/assets/data/recommend-2026-10.js'),'utf8'),context);
const original=evaluate('RECOMMEND_2026_10');
let checked=0;
for(const slot of original.plans['2026-10-27']){
 const blocks=String(slot[2]).split(/<br\s*\/?\s*>/i);
 if(blocks.length!==3)continue;
 const parsed=evaluate('recViewDoseOptions('+JSON.stringify(slot[2])+')');
 const cards=evaluate('recViewSlotContent('+JSON.stringify(slot)+')').match(/<article class="rec-candidate">[\s\S]*?<\/article>/g);
 assert.equal(cards.length,3);
 blocks.forEach((block,index)=>{
  const match=block.match(/^([ABC])[：:]\s*([\s\S]*)$/);
  assert.equal(parsed.options[match[1]],match[2],slot[0]+' '+match[1]);
  const lines=evaluate('recViewDoseLines('+JSON.stringify(match[2])+').map(text=>recViewEscape(text.replace(/[，,；;。]+$/,\'\'))).filter(Boolean)');
  lines.forEach(line=>assert(cards[index].includes(line),slot[0]+' '+match[1]+': '+line));
 });
 assert.equal(parsed.tail,'');
 checked++;
}
assert.equal(checked,10);
assert.deepEqual(evaluate('RECOMMEND_2026_10'),original);
console.log('OK: 括号、间歇、小数、选项完整剂量、共同边界、分行与 '+checked+' 个真实推荐槽位');
