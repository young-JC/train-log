// 本文件由 train2.0/dashboard.html 拆分而来，属于**只读展示层**；正式训练事实源见 CLAUDE.md。
// Dashboard 渲染逻辑与工具函数；全部数据来自 assets/data/*.js。
function daysForMode(mode, week){ if(mode==='3') return [1,3,6]; if(mode==='4') return [1,2,4,6]; return [1,2,4,6,7]; }
function dayPlan(day, mode){ if(mode==='3') return PLAN3[{1:1,3:2,6:3}[day]||1]||[]; if(mode==='4') return PLAN4[{1:1,2:2,4:3,6:4}[day]||1]||[]; const key={1:1,2:2,4:3,6:4,7:5}[day]; return key===5?[["动态热身","轻松慢跑（Easy Jog）→ 踝关节环绕（Ankle Circles）→ 前后摆腿（Front-to-Back Leg Swing）+ 侧向摆腿（Lateral Leg Swing）→ 手腕环绕（Wrist Circles）→ 原地大力运球（Pound Dribble）","2分钟；8圈/方向/侧；各10次/侧；10圈/方向；30秒/手；合计5–8分钟"],["Basketball","投篮60min / 3v3或轻实战",60],["训练后整理与拉伸","轻松步行（Easy Walk）2分钟 → 站姿腓肠肌拉伸（Standing Gastrocnemius Stretch）+ 半跪姿髋屈肌拉伸（Half-Kneeling Hip Flexor Stretch）+ 4字臀肌拉伸（Figure-Four Glute Stretch）+ 前臂屈伸肌拉伸（Forearm Flexor / Extensor Stretch）","各20–30秒/侧"]]:(PLAN4[key]||[]); }
function datePlus(dateStr,days){const d=new Date(dateStr+'T00:00:00');d.setDate(d.getDate()+days);return d;}
function weekIndex(){const s=new Date(document.getElementById('cycleStart').value+'T00:00:00');const now=new Date();const diff=Math.floor((now-s)/86400000);return Math.min(12,Math.max(1,Math.floor(diff/7)+1));}
function currentDateStr(){const d=new Date();return d.toISOString().slice(0,10)}
function currentWeekDay(){let d=new Date().getDay();return d===0?7:d;}

function load(key,def){try{return JSON.parse(localStorage.getItem('athlete_'+key)) ?? def}catch(e){return def}}
function save(key,val){localStorage.setItem('athlete_'+key,JSON.stringify(val))}

function renderCycle(){
 const w=weekIndex(), start=document.getElementById('cycleStart').value; document.getElementById('cycleDates').textContent=start+' → '+datePlus(start,83).toISOString().slice(0,10); document.getElementById('weekBadge').textContent='W'+w+' · '+WEEK_PHASES[w].name;
 const p=WEEK_PHASES[w];document.getElementById('phaseEyebrow').textContent='PHASE '+p.phase+' · '+(p.phase===1?'FOUNDATION':p.phase===2?'STRENGTH → POWER':'PERFORMANCE');document.getElementById('phaseTitle').textContent=p.name;document.getElementById('phaseDesc').textContent=p.desc;
 const row=document.getElementById('phaseRow');row.innerHTML='';for(let i=1;i<=12;i++){const el=document.createElement('div');el.className='phase '+WEEK_PHASES[i].type+(i===w?' current':'');el.innerHTML='<div class="wk">W'+i+'</div><strong>'+WEEK_PHASES[i].name+'</strong><span>'+WEEK_PHASES[i].focus.slice(0,2).join(' · ')+'</span>';row.appendChild(el)}
 document.getElementById('mesoCards').innerHTML='<div class="meso-card"><h4>W1–4 · 基础重建</h4><p>W1进入 · W2增量 · W3高刺激 · W4 Deload+Test</p></div><div class="meso-card"><h4>W5–8 · 力量→爆发</h4><p>最大力量、单腿力量、力量转化；W8复测</p></div><div class="meso-card"><h4>W9–12 · 专项表现</h4><p>加速、减速、COD、反应、比赛体能；W12总测</p></div>';
}
function calcReady(){const s=+sleep.value,f=+fatigue.value,so=+soreness.value,p=+pain.value,m=+motivation.value;let score=Math.round((s/5*20)+((6-f)/5*20)+((6-so)/5*20)+((10-p)/10*20)+(m/5*20));return score}
function syncSlider(id){document.getElementById(id+'Val').textContent=document.getElementById(id).value;updateReadiness()}
function updateReadiness(){const score=calcReady();document.getElementById('readyScore').textContent=score;let note='绿色区：按计划训练。';if(score<60||+pain.value>=5)note='红色区：建议恢复/Prehab，取消高冲击Plyo、Sprint和COD。';else if(score<75||+pain.value>=3)note='黄色区：建议总量下降20–30%，优先保留力量技术，减少高冲击。';document.getElementById('readyNote').textContent=note;document.getElementById('readinessBadge').textContent='Ready '+score;document.getElementById('painBadge').textContent='疼痛 '+pain.value+'/10';return score}
function saveReadiness(){save('readiness',{date:currentDateStr(),sleep:+sleep.value,fatigue:+fatigue.value,soreness:+soreness.value,pain:+pain.value,motivation:+motivation.value,score:calcReady()});updateRecommendation()}
function updateRecommendation(){const s=calcReady(), p=+pain.value;let title='正常执行计划', txt='保持动作质量；训练后记录Session RPE和第二天反应。';if(s<60||p>=5){title='恢复 / Prehab优先';txt='取消高冲击跳跃、高速变向和高量冲刺；选择L1/L2防伤、低强度力量或恢复。'} else if(s<75||p>=3){title='减量执行';txt='总训练量下降20–30%；Plyo/COD减少，主力量保持中等RPE。'} else if(currentRecKey==='2026-09-29'){title='今日主动恢复已完成';txt='已完成 65 分钟主动恢复，Session RPE 2，Session Load 130 AU；训练中右膝内侧最高 2/10，训练后回到 0/10。'}else if(currentRecKey==='2026-10-01'){title='今日半场实战已完成';txt='半场篮球实战 80 分钟，Session RPE 7，Session Load 560 AU；训练中膝盖轻微疼痛 1/10、不影响运动，训练后 0/10。'}else if(currentRecKey==='2026-10-08'){title='执行 W3 D1 · 落地门槛优先';txt='Readiness 88、当前疼痛 0/10；执行下肢力量 + 垂直爆发，Snap Down 替代 Drop Landing，不安排冲刺、COD 或篮球。'}else if(currentRecKey==='2026-10-09'){title='执行 W3 D2 · 上肢 + 核心 + 篮球技术';txt='Readiness 84、当前疼痛 0/10；10-08 下肢高负荷仅约 24 小时，今日不安排下肢大重量、跳跃、冲刺与高速变向；上肢动作不做力竭，篮球只做运球、投篮与终结。'}document.getElementById('systemDecision').textContent=title;document.getElementById('systemDecisionText').textContent=txt}

let currentRecKey='';
function recommendationDates(){return Object.keys(TODAY_RECOMMENDATION).sort()}
function latestRecKey(){const today=currentDateStr(),dates=recommendationDates();return dates.filter(d=>d<=today).pop()||dates[dates.length-1]||''}
function renderToday(pickedKey){
 const w=weekIndex(),mode=document.getElementById('mode').value;
 const today=currentDateStr();
 const recKey=pickedKey&&TODAY_RECOMMENDATION[pickedKey]?pickedKey:latestRecKey();
 currentRecKey=recKey||'';
 const select=document.getElementById('recDateSelect');
 if(select){const dates=recommendationDates();
  if(select.options.length!==dates.length)select.innerHTML=dates.slice().reverse().map(d=>'<option value="'+d+'">'+d+'</option>').join('');
  if(select.value!==currentRecKey)select.value=currentRecKey;}
 const meta=recKey?TODAY_META[recKey]:null;
 if(recKey&&meta){
  const pillIdx=meta.day.indexOf('D');
  const pillLabel=FORMAL_RECORDS[recKey]?.status==='training'?'已完成':meta.day.includes('恢复日')?'恢复日':(pillIdx>=0?meta.day.slice(pillIdx).replace(/（.*）/,''):'计划');
  document.getElementById('todayPill').textContent=pillLabel+' · '+meta.date;
  document.getElementById('todayModule').textContent=meta.week+' · '+meta.day;
  document.getElementById('todayTitle').textContent=meta.focus;
  document.getElementById('todayPurpose').textContent=recKey===today?'今日推荐 · '+meta.phase:(recKey===latestRecKey()?'最近一次推荐 · 未再次推荐时保持此内容':'过往推荐 · '+meta.date);
  document.getElementById('todayRpe').textContent=meta.readiness;
  document.getElementById('todayDuration').textContent=meta.duration;
  document.getElementById('recMeta').innerHTML='<span class="pill">'+meta.date+'</span><span class="pill">'+meta.week+' · '+meta.day+'</span><span class="pill">'+meta.phase+'</span><span class="pill '+(meta.readiness.includes('绿色')?'green':meta.readiness.includes('红色')?'red':'yellow')+'">'+meta.readiness+'</span><span class="pill">'+meta.pain+'</span><span class="pill green">'+meta.duration+'</span><span class="pill blue">'+meta.focus+'</span>';
 }else{
  const dow=currentWeekDay(), days=daysForMode(mode,w), todayDay=days.includes(dow)?dow:days[0], idx=days.indexOf(todayDay)+1, p=WEEK_PHASES[w];
  let title='训练日'; if(mode==='3'){title=['下肢爆发 + 力量','上肢 + 篮球技术','速度 + 减速 + 变向'][idx-1]||'训练';}else{title=['下肢A：垂直爆发 + 力量','上肢 + 篮球技术','速度 + 减速 + COD','下肢B：横向爆发 + 体能','篮球专项 / 可选恢复'][idx-1]||'训练'}
  document.getElementById('todayPill').textContent='DAY '+idx+' · 周'+todayDay;
  document.getElementById('todayTitle').textContent=title;
  document.getElementById('todayModule').textContent=(idx===1?'Lower A':idx===2?'Upper + Skill':idx===3?'Speed / Decel':idx===4?'Lower B + Conditioning':'Basketball / Optional');
  document.getElementById('todayPurpose').textContent=p.focus.join(' · ');
  document.getElementById('todayRpe').textContent='目标 RPE '+p.rpe;
  document.getElementById('recMeta').innerHTML='';
 }
 const p=WEEK_PHASES[w];
 const plan=(recKey&&TODAY_RECOMMENDATION[recKey])||dayPlan(daysForMode(mode,w).includes(currentWeekDay())?currentWeekDay():daysForMode(mode,w)[0],mode), container=document.getElementById('sessionSlots');container.innerHTML='';let html='';plan.forEach((s,i)=>{const dosage=s[2]||'按计划';html+='<div class="rec-slot"><div class="rec-slot-num">'+(i+1)+'</div><div class="rec-slot-body"><div class="rec-slot-name">'+s[0]+'</div><div class="rec-slot-detail">'+s[1]+'</div></div><div class="rec-slot-dose">'+dosage+'</div></div>'});container.innerHTML=html;
 const skills=(recKey&&TODAY_SKILLS[recKey])||[['运球','左手主导30%时间'],['投篮','定点→接球→移动'],['终结','左右手+对抗选择'],['防守/脚步','滑步→Closeout→追防']];
 document.getElementById('todaySkills').innerHTML=skills.map(x=>'<div class="skill"><h4>'+x[0]+'</h4><p>'+x[1]+'</p></div>').join('');
 document.getElementById('todayReason').innerHTML=(recKey&&TODAY_REASON[recKey])||'<p>① 训练顺序：速度/爆发 → 主力量 → 单腿/后链 → 核心/篮球。</p><p>② 当前阶段：'+p.name+'；重点是 '+p.focus.join('、')+'。</p><p>③ 选择规则：从动作库选择“当前阶段 + 能力短板 + 可承受冲击”的最高质量动作，而不是把动作库做遍。</p><p>④ 今日Ready状态会进一步决定训练量；训练后请使用 /record-training-2 记录实际完成内容、Session RPE 和疼痛。</p>';
 updateRecommendation();
}

function renderAssessment(){
 assessmentCount.textContent=ABILITY_ASSESSMENTS.length+' 项真实记录';
 assessmentList.innerHTML=ABILITY_ASSESSMENTS.map(item=>'<tr><td><strong>'+escapeHtml(item.action)+'</strong><br><span class="muted">'+escapeHtml(item.category)+'</span></td><td>'+escapeHtml(item.metric)+'</td><td><strong>'+escapeHtml(item.best)+'</strong></td><td>'+escapeHtml(item.comparison)+'</td><td>'+escapeHtml(item.firstDate)+'</td><td>'+escapeHtml(item.bestDate)+'</td><td><span class="assessment-status">'+escapeHtml(item.updatedAt)+'</span></td><td><a class="assessment-source" href="'+escapeHtml(item.source)+'">查看记录</a></td></tr>').join('');
}
function renderWeak(){document.getElementById('weakList').innerHTML=WEAKNESSES.map(w=>'<tr><td><strong>'+escapeHtml(w[0])+'</strong></td><td>'+escapeHtml(w[1])+'</td><td>'+escapeHtml(w[2])+'</td><td><span class="weak-status">'+escapeHtml(w[3])+'</span></td><td>'+escapeHtml(w[4])+'</td><td>'+escapeHtml(w[5])+'</td></tr>').join('')}
function updateLoad(){const entries=Object.entries(FORMAL_RECORDS),week=weekIndex(),start=(week-1)*7;const sorted=entries.filter(([,record])=>record.status==='training').sort((a,b)=>b[0].localeCompare(a[0]));if(sorted.length>0){const[date,record]=sorted[0];document.getElementById('latestTrainingDate').textContent=date;const r=record.readiness||{};document.getElementById('latestSessionLoad').textContent=Number.isFinite(record.sessionLoad)?record.sessionLoad+' AU':'未计算';const painNote=r.painNote||'无';document.getElementById('latestPainDetail').textContent=painNote.length>45?painNote.slice(0,45)+'…':painNote;document.getElementById('latestReadyScore').textContent=r.score?(r.score+(r.level?' · '+r.level:'')):'—';document.getElementById('latestLoadBox').className='status-box '+(Number.isFinite(record.sessionLoad)?(record.sessionLoad>=600?'green':record.sessionLoad>=400?'yellow':''):'');document.getElementById('latestPainBox').className='status-box '+(r.pain<=2?'green':r.pain<=4?'yellow':'red')}else{document.getElementById('latestTrainingDate').textContent='—';document.getElementById('latestSessionLoad').textContent='—';document.getElementById('latestPainDetail').textContent='—';document.getElementById('latestReadyScore').textContent='—'}const cycleStartDate=new Date(document.getElementById('cycleStart').value+'T00:00:00'),weekStart=new Date(cycleStartDate);weekStart.setDate(weekStart.getDate()+start);const weekEnd=new Date(weekStart);weekEnd.setDate(weekEnd.getDate()+7);const weekEntries=entries.filter(([date])=>{const d=new Date(date+'T00:00:00');return d>=weekStart&&d<weekEnd});const weekTraining=weekEntries.filter(([,record])=>record.status==='training');const weekLoad=weekTraining.reduce((total,[,record])=>total+(record.sessionLoad||0),0);document.getElementById('weeklyLoadDisplay').textContent=weekLoad+' AU';document.getElementById('loadTrainingDays').textContent=weekTraining.length;document.getElementById('loadWeekLabel').textContent='W'+week+' 本周统计';const painScores=weekEntries.filter(([,record])=>record.readiness).map(([,record])=>Math.max(record.readiness.pain||0,record.maxPain||0));const maxPain=painScores.length>0?Math.max(...painScores):-1;const trendBox=document.getElementById('weeklyPainBox');if(maxPain<=0){trendBox.className='status-box green';document.getElementById('weeklyPainTrend').textContent='无疼痛'}else if(maxPain<=2){trendBox.className='status-box green';document.getElementById('weeklyPainTrend').textContent='绿色 · 稳定'}else if(maxPain<=4){trendBox.className='status-box yellow';document.getElementById('weeklyPainTrend').textContent='黄色 · 注意'}else{trendBox.className='status-box red';document.getElementById('weeklyPainTrend').textContent='红色 · 需关注'}document.getElementById('weekLoadBadge').textContent='正式周负荷 '+weekLoad;const body=document.getElementById('loadHistoryBody');body.innerHTML=entries.filter(([,record])=>record.status==='training').sort((a,b)=>b[0].localeCompare(a[0])).map(([date,record])=>{const r=record.readiness||{};const weekNum=Math.min(12,Math.max(1,Math.floor((new Date(date+'T00:00:00')-new Date('2026-09-21T00:00:00'))/604800000)+1));const painNote=r.painNote?r.painNote:'—';return '<tr><td><strong>'+date+'</strong></td><td>W'+weekNum+'</td><td>'+(Number.isFinite(record.sessionLoad)?record.sessionLoad+' AU':'未计算')+'</td><td>'+(r.score||'—')+'</td><td>'+escapeHtml(painNote.length>35?painNote.slice(0,35)+'…':painNote)+'</td></tr>'}).join('')||'<tr><td colspan="5" class="muted" style="text-align:center">暂无正式训练记录</td></tr>'}
function saveReview(){save('review',{date:currentDateStr(),rate:+reviewRate.value||0,gain:reviewGain.value,gap:reviewGap.value,next:reviewNext.value});alert('周期复盘已保存。')}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function replaceOptions(select,placeholder,values){select.replaceChildren(new Option(placeholder,''),...values.map(value=>new Option(value,value)))}
let actionModalTrigger=null;
let actionInteractionsInitialized=false;
function actionMeta(label,value){return '<div><span>'+label+'</span><strong>'+escapeHtml(value)+'</strong></div>'}
function openActionModal(index,trigger){const action=ACTIONS[index];if(!action)return;actionModalTrigger=trigger;actionModalCategory.textContent=action.id+' · '+moduleDisplayName(action.module);actionModalTitle.textContent=actionDisplayName(action);actionModalDescription.textContent=actionDescription(action);actionModalMeta.innerHTML=actionMeta('能力',action.ability)+actionMeta('等级',action.level)+actionMeta('冲击',action.impact)+actionMeta('器材',action.equipment)+actionMeta('用途',action.use);actionModal.hidden=false;document.body.classList.add('no-scroll');actionModalClose.focus()}
function closeActionModal(){if(actionModal.hidden)return;actionModal.hidden=true;document.body.classList.remove('no-scroll');if(actionModalTrigger)actionModalTrigger.focus();actionModalTrigger=null}
function toggleActionGroup(btn){btn.parentElement.classList.toggle('open')}
function levelPill(level){return '<span class="lvl-pill l'+level.slice(1)+'">'+escapeHtml(level)+'</span>'}
function impactPill(impact){return '<span class="impact-pill '+(impact==='低'?'low':impact==='中'?'mid':'high')+'">'+escapeHtml(impact)+'</span>'}
function filterActions(){
 const level=fLevel.value,impact=fImpact.value,equipment=fEquipment.value,query=fSearch.value.trim().toLowerCase();
 const match=action=>(!level||action.level===level)&&(!impact||action.impact===impact)&&(!equipment||action.equipment===equipment)&&(!query||((action.name||'')+(action.en||'')+moduleDisplayName(action.module)+action.ability+action.equipment+action.use).toLowerCase().includes(query));
 let total=0;let html='';
 Object.keys(ACTION_MODULES).forEach(letter=>{
  const list=ACTIONS.map((a,i)=>({a,i})).filter(x=>x.a.id.charAt(0)===letter&&match(x.a));
  if(!list.length)return;
  total+=list.length;
  html+='<div class="lib-group"><button type="button" class="lib-group-toggle" onclick="toggleActionGroup(this)"><span>'+letter+' · '+escapeHtml(ACTION_MODULES[letter])+' <span class="lib-group-count">（'+list.length+' 个动作）</span></span><span class="lib-group-arrow">▶</span></button><div class="lib-group-body"><div class="table-wrap"><table class="lib-table"><thead><tr><th>动作</th><th>类别</th><th>能力</th><th>等级</th><th>冲击</th><th>器材</th></tr></thead><tbody>'
   +list.map(x=>'<tr class="lib-row" tabindex="0" data-action-index="'+x.i+'"><td class="lib-name">'+escapeHtml(x.a.name)+(x.a.en?'<span class="action-name-en">'+escapeHtml(x.a.en)+'</span>':'')+'</td><td>'+escapeHtml(moduleDisplayName(x.a.module))+'</td><td>'+escapeHtml(x.a.ability)+'</td><td>'+levelPill(x.a.level)+'</td><td>'+impactPill(x.a.impact)+'</td><td>'+escapeHtml(x.a.equipment)+'</td></tr>').join('')
   +'</tbody></table></div></div></div>';
 });
 actionCount.textContent=total+' 个动作';
 actionLibGroups.innerHTML=html;
 actionLibEmpty.style.display=total?'none':'block';
}
function renderActions(){
 replaceOptions(fEquipment,'全部器材',[...new Set(ACTIONS.map(action=>action.equipment))].sort());
 if(!actionInteractionsInitialized){
  ['fLevel','fImpact','fEquipment','fSearch'].forEach(id=>document.getElementById(id).addEventListener('input',filterActions));
  actionLibGroups.addEventListener('click',event=>{const row=event.target.closest('.lib-row');if(row)openActionModal(+row.dataset.actionIndex,row)});
  actionLibGroups.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const row=event.target.closest('.lib-row');if(!row)return;event.preventDefault();openActionModal(+row.dataset.actionIndex,row)});
  actionModalClose.addEventListener('click',closeActionModal);
  actionModal.addEventListener('click',event=>{if(event.target===actionModal)closeActionModal()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeActionModal()});
  actionInteractionsInitialized=true;
 }
 filterActions();
}
function calendarMonths(){return [...new Set([...Object.keys(FORMAL_RECORDS).map(date=>date.slice(0,7)),`${FORMAL_MONTH.year}-${FORMAL_MONTH.month}`])].sort()}
let calendarMonth='';
function shiftMonth(delta){const months=calendarMonths(),index=months.indexOf(calendarMonth),next=months[index+delta];if(index<0||!next)return;calendarMonth=next;renderFormalMonth()}
function renderFormalMonth(){
 const months=calendarMonths();
 if(!calendarMonth||!months.includes(calendarMonth))calendarMonth=months[months.length-1]||`${FORMAL_MONTH.year}-${FORMAL_MONTH.month}`;
 const [year,month]=calendarMonth.split('-'),monthNumber=+month;
 const days=new Date(+year,monthNumber,0).getDate();
 const startOffset=(new Date(`${calendarMonth}-01T00:00:00`).getDay()+6)%7;
 const weekdays=['周一','周二','周三','周四','周五','周六','周日'];
 const nodes=weekdays.map(label=>{const item=document.createElement('div');item.className='monthly-weekday';item.textContent=label;return item});
 for(let index=0;index<startOffset;index++){const blank=document.createElement('div');blank.className='monthly-day outside';blank.setAttribute('aria-hidden','true');nodes.push(blank)}
 for(let day=1;day<=days;day++){
  const date=`${calendarMonth}-${String(day).padStart(2,'0')}`,record=FORMAL_RECORDS[date],isRest=FORMAL_REST_DAYS.includes(date),offset=Math.floor((new Date(date+'T00:00:00')-new Date('2026-09-21T00:00:00'))/86400000);
  const cell=document.createElement('div');cell.className='monthly-day';if(date==='2026-09-21')cell.classList.add('cycle-start');if(isRest)cell.classList.add('rest');else if(record?.status==='training')cell.classList.add('training');else if(record?.status==='readiness')cell.classList.add('readiness');
  const content=document.createElement(record&&!isRest?'a':'div');if(record&&!isRest)content.href=`records/${calendarMonth}.html#detail-${date}`;
  const number=document.createElement('span');number.className='monthly-day-number';number.textContent=day;content.append(number);
  if(offset>=0){const position=document.createElement('span');position.className='monthly-position';position.textContent=`W${Math.floor(offset/7)+1}D${offset%7+1}`;content.append(position)}
  if(record||isRest||offset>=0){const status=document.createElement('span');status.className='monthly-status';status.textContent=isRest?'休息':record?.label||(date==='2026-09-21'?'正式周期开始':'等待记录');content.append(status)}
  cell.append(content);nodes.push(cell);
 }
 monthlyCalendar.replaceChildren(...nodes);
 const entries=Object.entries(FORMAL_RECORDS).filter(([date])=>date.startsWith(`${calendarMonth}-`)),training=entries.filter(([date,record])=>!FORMAL_REST_DAYS.includes(date)&&record.status==='training'),load=training.reduce((total,[,record])=>total+(record.sessionLoad||0),0);
 monthlySnapshotStatus.textContent=`${training.length} 个训练日 · ${load} AU`;
 const label=`${year} 年 ${monthNumber} 月`;
 monthlyTitle.textContent=`📅 ${label}正式记录`;monthLabel.textContent=label;monthlyCalendar.setAttribute('aria-label',`${label}正式训练月历`);monthlyRecordLink.href=`records/${calendarMonth}.html`;
 const monthIndex=months.indexOf(calendarMonth);monthPrev.disabled=monthIndex<=0;monthNext.disabled=monthIndex>=months.length-1;
}
function renderTodayReadiness(){
 const r=TODAY_READINESS[latestRecKey()]||FORMAL_TODAY_READINESS;if(!r)return;
 document.getElementById('sleep').value=r.sleep;document.getElementById('sleepVal').textContent=r.sleep;
 document.getElementById('fatigue').value=r.fatigue;document.getElementById('fatigueVal').textContent=r.fatigue;
 document.getElementById('soreness').value=r.soreness;document.getElementById('sorenessVal').textContent=r.soreness;
 document.getElementById('pain').value=r.pain;document.getElementById('painVal').textContent=r.pain;
 document.getElementById('motivation').value=r.motivation;document.getElementById('motivationVal').textContent=r.motivation;
 updateReadiness();
}
function stats(){const week=weekIndex(),entries=Object.entries(FORMAL_RECORDS),training=entries.filter(([date,record])=>!FORMAL_REST_DAYS.includes(date)&&record.status==='training'),load=training.reduce((total,[,record])=>total+(record.sessionLoad||0),0),readiness=entries.filter(([,record])=>record.readiness).length;document.getElementById('stats').innerHTML=[['本周期','W'+week,'12周周期'],['训练模式',document.getElementById('mode').value==='3'?'3日':document.getElementById('mode').value==='4'?'4日':'4+1','可随时切换'],['10月训练',Object.entries(FORMAL_RECORDS).filter(([d,r])=>d.startsWith('2026-10-')&&r.status==='training').length,'正式月度记录'],['10月负荷',Object.entries(FORMAL_RECORDS).filter(([d,r])=>d.startsWith('2026-10-')&&r.status==='training').reduce((t,[,r])=>t+(r.sessionLoad||0),0),'Session Load · AU'],['Readiness',readiness,'正式记录天数']].map((s,i)=>'<div class="stat"><div class="k">'+s[0]+'</div><div class="v '+(['orange','blue','green','yellow','purple'][i])+'">'+s[1]+'</div><div class="s">'+s[2]+'</div></div>').join('')}
function refresh(){renderCycle();renderFormalMonth();renderToday();renderTodayReadiness();updateReadiness();updateRecommendation();renderAssessment();renderWeak();updateLoad();renderActions();stats()}
document.getElementById('cycleStart').addEventListener('change',refresh);document.getElementById('mode').addEventListener('change',refresh);
document.getElementById('monthPrev').addEventListener('click',()=>shiftMonth(-1));document.getElementById('monthNext').addEventListener('click',()=>shiftMonth(1));
document.getElementById('recDateSelect').addEventListener('change',e=>{renderToday(e.target.value);updateReadiness();updateRecommendation()});
document.addEventListener('DOMContentLoaded',refresh);
