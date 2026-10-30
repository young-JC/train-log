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
 const row=document.getElementById('phaseRow');row.innerHTML='';
 for(let stage=0;stage<3;stage++){
  const group=document.createElement('div');group.className='cycle-stage';
  group.innerHTML='<div class="cycle-stage-label">阶段 0'+(stage+1)+'<span>W'+(stage*4+1)+'–'+(stage*4+4)+'</span></div>';
  const weeks=document.createElement('div');weeks.className='cycle-weeks';
  for(let i=stage*4+1;i<=stage*4+4;i++){
   const el=document.createElement('div');el.className='phase '+WEEK_PHASES[i].type+(i===w?' current':'');
   if(i===w)el.setAttribute('aria-current','step');
   el.innerHTML='<div class="wk">W'+i+(i===w?'<small>当前</small>':'')+'</div><strong>'+WEEK_PHASES[i].name+'</strong><span>'+WEEK_PHASES[i].focus.slice(0,2).join(' · ')+'</span>';
   weeks.appendChild(el);
  }
  group.appendChild(weeks);row.appendChild(group);
 }
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
// 推荐保持只读；折叠仅改变阅读视图，不选择动作、不改写历史数据。
function recPlainText(value){const el=document.createElement('div');el.innerHTML=String(value);return el.textContent||''}
function renderRecommendationSlots(plan){
 const slots=plan.filter(slot=>recViewPhase(slot)!=='rules'),optional=slots.filter(slot=>/可选|可跳过/.test(slot[0])).length;
 document.getElementById('recSlotCount').textContent=slots.length+' 个槽位'+(optional?' · 含 '+optional+' 个可选':'');
 const phases={prepare:['01','训练准备','热身与防伤'],main:['02','主训练','按顺序完成，保留必要休息'],cooldown:['03','整理恢复','逐步降速，照顾今日受力区域'],rules:['!','执行边界','权限、停止条件与训练后记录']};
 let previous='',opened=false,step=0,phaseStep=0;
 document.getElementById('sessionSlots').innerHTML=plan.map((slot,index)=>{
  const phase=recViewPhase(slot),pinned=phase==='rules',info=recViewSlotInfo(slot),learning=/可选|可跳过/.test(slot[0]);
  let heading='';
  if(phase!==previous){
   const id='rec-phase-'+index,group=[];
   for(let cursor=index;cursor<plan.length&&recViewPhase(plan[cursor])===phase;cursor++)group.push(plan[cursor]);
   const label=recViewPhaseLabel(phase,group,phases),description=phases[phase][2];
   heading='<div class="rec-phase-heading" id="'+id+'"><span>'+String(++phaseStep).padStart(2,'0')+'</span><h4>'+label+'</h4><p>'+description+'</p></div>';
   previous=phase;
  }
  if(pinned)return heading+'<article class="rec-slot rec-slot-caution" id="rec-slot-'+index+'" data-rec-index="'+index+'" data-rec-phase="'+phase+'" data-rec-pinned="true"><header class="rec-rule-head"><svg aria-hidden="true"><use href="#nb-notebook"/></svg><h4>'+escapeHtml(slot[0])+'</h4><span>训练前先看</span></header><div class="rec-slot-content">'+recViewSlotContent(slot)+'</div></article>';
  step++;
  const fullName=recPlainText(slot[0]),title=fullName.split(/[·；;]/)[0],note=fullName.slice(title.length).replace(/^[·；;]\s*/,'');
  const open=phase==='main'&&!learning&&!opened;if(open)opened=true;
  return heading+'<details class="rec-slot'+(learning?' rec-slot-optional':'')+'" id="rec-slot-'+index+'" data-rec-index="'+index+'" data-rec-phase="'+phase+'"'+(open?' open':'')+'><summary><span class="rec-slot-num">'+String(step).padStart(2,'0')+'</span><span class="rec-slot-heading"><span class="rec-slot-name">'+recViewName(title)+(learning?'<small class="rec-optional-tag">可选学习</small>':'')+'</span>'+(note?'<span class="rec-slot-note">'+escapeHtml(note)+'</span>':'')+'<span class="rec-slot-preview">'+(info.key?'<b>'+info.key+'</b>':'')+recViewName(info.action.name)+'</span>'+(info.dose?'<span class="rec-slot-dose">'+escapeHtml(info.dose)+'</span>':'')+'</span><span class="rec-slot-toggle"><span>'+(info.choices.length?'比较 '+info.choices.length+' 个方案':'查看详情')+'</span><i aria-hidden="true"></i></span></summary><div class="rec-slot-content">'+recViewSlotContent(slot)+'</div></details>';
 }).join('')||'<div class="rec-empty">还没有保存的训练推荐。生成推荐后，会在这里展示具体安排。</div>';
 recViewBuildRoute(plan,phases);
 recViewSetupReader();
 document.querySelector('.rec-choice-hint').hidden=!slots.some(slot=>recViewChoices(slot).length);
}
function renderRecommendationReason(value){
 const source=document.createElement('div');source.innerHTML=value;
 // 新推荐显式区分重点与可展开依据；旧段落保持原文，不猜测或截断安全条件。
 document.getElementById('todayReason').innerHTML=Array.from(source.childNodes).map(item=>{
  if(!item.textContent.trim())return '';
  if(item.nodeType===1&&item.matches('.rec-reason-summary,.rec-reason-evidence'))return item.outerHTML;
  return '<div class="rec-reason-item">'+(item.nodeType===1?item.outerHTML:escapeHtml(item.textContent))+'</div>';
 }).join('');
 document.querySelector('.rec-reason-card').hidden=!source.textContent.trim();
}
function renderRecommendationReadiness(key){
 document.querySelector('.rec-status-details').open=false;
 document.querySelector('.rec-status-details').hidden=!key;
 const readiness=TODAY_READINESS[key];
 const fields=[['sleep','睡眠',5],['fatigue','疲劳',5],['soreness','酸痛',5],['pain','疼痛',10],['motivation','意愿',5]];
 document.getElementById('recReadinessValues').innerHTML=readiness?'<span>当次自评</span>'+fields.map(([field,label,scale])=>'<span>'+label+' <b>'+(Number.isFinite(readiness[field])?readiness[field]:'—')+'</b><small>/'+scale+'</small></span>').join(''):'<span>该次推荐未保留五项原始自评</span>';
 document.getElementById('recReadinessValues').hidden=!key;
 const dates=recommendationDates(),index=dates.indexOf(key);
 document.getElementById('recPrevious').disabled=index<=0;
 document.getElementById('recNext').disabled=index<0||index>=dates.length-1;
 document.getElementById('recLatest').disabled=key===latestRecKey()||!dates.length;
 document.getElementById('recDateSelect').disabled=!dates.length;
}
function renderToday(pickedKey){
 const today=currentDateStr();
 const recKey=pickedKey&&TODAY_RECOMMENDATION[pickedKey]?pickedKey:latestRecKey();
 currentRecKey=recKey||'';
 const select=document.getElementById('recDateSelect');
 if(select){const dates=recommendationDates();
  if(select.options.length!==dates.length)select.innerHTML=dates.slice().reverse().map(d=>'<option value="'+d+'">'+d+'</option>').join('');
  if(select.value!==currentRecKey)select.value=currentRecKey;}
 const meta=recKey?TODAY_META[recKey]:null;
 if(recKey&&meta){
  const pillLabel=recKey===today?'今日推荐':recKey===latestRecKey()?'最近一次':'历史推荐';
  document.getElementById('todayPill').textContent=pillLabel+' · '+meta.date;
  document.getElementById('todayModule').textContent=meta.week+' · '+meta.day;
  document.getElementById('todayTitle').textContent=meta.focus;
  document.getElementById('todayPurpose').textContent=meta.phase;
  document.getElementById('todayRpe').textContent=meta.readiness;
  document.getElementById('todayDuration').textContent=meta.duration;
  document.getElementById('todayRpe').className=meta.readiness.includes('绿色')?'green':meta.readiness.includes('红色')?'red':'yellow';
  document.getElementById('recMeta').innerHTML='<span class="rec-label">疼痛与权限</span><p>'+escapeHtml(meta.pain)+'</p>';
 }else{
  document.getElementById('todayPill').textContent='待生成';
  document.getElementById('todayTitle').textContent='等待下一份训练安排';
  document.getElementById('todayModule').textContent='训练推荐';
  document.getElementById('todayPurpose').textContent='从当日状态与实际训练出发';
  document.getElementById('todayRpe').textContent='—';
  document.getElementById('todayRpe').className='';
  document.getElementById('todayDuration').textContent='—';
  document.getElementById('recMeta').innerHTML='';
 }
 renderRecommendationReadiness(recKey);
 const plan=(recKey&&TODAY_RECOMMENDATION[recKey])||[];
 renderRecommendationSlots(plan);
 TrainingVisuals.renderRecommendation(meta);
 const skills=(recKey&&TODAY_SKILLS[recKey])||[];
 document.getElementById('todaySkills').innerHTML=skills.map(x=>'<div class="skill"><h4>'+x[0]+'</h4><p>'+x[1]+'</p></div>').join('');
 document.getElementById('recSkillsCard').hidden=skills.length===0;
 renderRecommendationReason((recKey&&TODAY_REASON[recKey])||'');
 updateRecommendation();
}

function renderAssessment(){
 assessmentCount.textContent=ABILITY_ASSESSMENTS.length+' 项真实记录';
 assessmentList.innerHTML=ABILITY_ASSESSMENTS.map(item=>'<tr><td><strong>'+escapeHtml(item.action)+'</strong><br><span class="muted">'+escapeHtml(item.category)+'</span></td><td>'+escapeHtml(item.metric)+'</td><td><strong>'+escapeHtml(item.best)+'</strong></td><td>'+escapeHtml(item.comparison)+'</td><td>'+escapeHtml(item.firstDate)+'</td><td>'+escapeHtml(item.bestDate)+'</td><td><span class="assessment-status">'+escapeHtml(item.updatedAt)+'</span></td><td><a class="assessment-source" href="'+escapeHtml(item.source)+'">查看记录</a></td></tr>').join('');
 assessmentList.innerHTML+=ABILITY_MASTERY_FEEDBACK.map(item=>'<tr><td><strong>'+escapeHtml(item.action)+'</strong><br><span class="muted">动作掌握反馈（定性）</span></td><td colspan="7">'+escapeHtml(item.status)+'<br>'+escapeHtml(item.progression)+'<br><span class="muted">确认日期：'+escapeHtml(item.confirmedAt)+'；来源：'+escapeHtml(item.source)+'。不计入正式最佳成绩。</span></td></tr>').join('');
}
function renderWeak(){document.getElementById('weakList').innerHTML=WEAKNESSES.map(w=>'<tr><td><strong>'+escapeHtml(w[0])+'</strong></td><td>'+escapeHtml(w[1])+'</td><td>'+escapeHtml(w[2])+'</td><td><span class="weak-status">'+escapeHtml(w[3])+'</span></td><td>'+escapeHtml(w[4])+'</td><td>'+escapeHtml(w[5])+'</td></tr>').join('')}
function updateLoad(){const entries=Object.entries(FORMAL_RECORDS),week=weekIndex(),start=(week-1)*7;const sorted=entries.filter(([,record])=>record.status==='training').sort((a,b)=>b[0].localeCompare(a[0]));if(sorted.length>0){const[date,record]=sorted[0];document.getElementById('latestTrainingDate').textContent=date;document.getElementById('loadLatestBadge').textContent='最新：'+date;const r=record.readiness||{};document.getElementById('latestSessionLoad').textContent=Number.isFinite(record.sessionLoad)?record.sessionLoad+' AU':'未计算';const painNote=r.painNote||'无';document.getElementById('latestPainDetail').textContent=painNote.length>45?painNote.slice(0,45)+'…':painNote;document.getElementById('latestReadyScore').textContent=r.score?(r.score+(r.level?' · '+r.level:'')):'—';document.getElementById('latestLoadBox').className='status-box '+(Number.isFinite(record.sessionLoad)?(record.sessionLoad>=600?'green':record.sessionLoad>=400?'yellow':''):'');document.getElementById('latestPainBox').className='status-box '+(r.pain<=2?'green':r.pain<=4?'yellow':'red')}else{document.getElementById('latestTrainingDate').textContent='—';document.getElementById('loadLatestBadge').textContent='暂无正式训练';document.getElementById('latestSessionLoad').textContent='—';document.getElementById('latestPainDetail').textContent='—';document.getElementById('latestReadyScore').textContent='—'}const cycleStartDate=new Date(document.getElementById('cycleStart').value+'T00:00:00'),weekStart=new Date(cycleStartDate);weekStart.setDate(weekStart.getDate()+start);const weekEnd=new Date(weekStart);weekEnd.setDate(weekEnd.getDate()+7);const weekEntries=entries.filter(([date])=>{const d=new Date(date+'T00:00:00');return d>=weekStart&&d<weekEnd});const weekTraining=weekEntries.filter(([,record])=>record.status==='training');const weekLoad=weekTraining.reduce((total,[,record])=>total+(record.sessionLoad||0),0);document.getElementById('weeklyLoadDisplay').textContent=weekLoad+' AU';document.getElementById('loadTrainingDays').textContent=weekTraining.length;document.getElementById('loadWeekLabel').textContent='W'+week+' 本周统计';const painScores=weekEntries.filter(([,record])=>record.readiness).map(([,record])=>Math.max(record.readiness.pain||0,record.maxPain||0));const maxPain=painScores.length>0?Math.max(...painScores):-1;const trendBox=document.getElementById('weeklyPainBox');if(maxPain<=0){trendBox.className='status-box green';document.getElementById('weeklyPainTrend').textContent='无疼痛'}else if(maxPain<=2){trendBox.className='status-box green';document.getElementById('weeklyPainTrend').textContent='绿色 · 稳定'}else if(maxPain<=4){trendBox.className='status-box yellow';document.getElementById('weeklyPainTrend').textContent='黄色 · 注意'}else{trendBox.className='status-box red';document.getElementById('weeklyPainTrend').textContent='红色 · 需关注'}document.getElementById('weekLoadBadge').textContent='正式周负荷 '+weekLoad;const body=document.getElementById('loadHistoryBody');body.innerHTML=entries.filter(([,record])=>record.status==='training').sort((a,b)=>b[0].localeCompare(a[0])).map(([date,record])=>{const r=record.readiness||{};const weekNum=Math.min(12,Math.max(1,Math.floor((new Date(date+'T00:00:00')-new Date('2026-09-21T00:00:00'))/604800000)+1));const painNote=r.painNote?r.painNote:'—';return '<tr><td><strong>'+date+'</strong></td><td>W'+weekNum+'</td><td>'+(Number.isFinite(record.sessionLoad)?record.sessionLoad+' AU':'未计算')+'</td><td>'+(r.score||'—')+'</td><td>'+escapeHtml(painNote.length>35?painNote.slice(0,35)+'…':painNote)+'</td></tr>'}).join('')||'<tr><td colspan="5" class="muted" style="text-align:center">暂无正式训练记录</td></tr>'}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function replaceOptions(select,placeholder,values){select.replaceChildren(new Option(placeholder,''),...values.map(value=>new Option(value,value)))}
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
  cell.append(content);decorateTrainingCalendarCell(cell,date,record,isRest);nodes.push(cell);
 }
 monthlyCalendar.replaceChildren(...nodes);
 renderTrainingCalendarLegend(document.querySelector('.calendar-key'));
 const entries=Object.entries(FORMAL_RECORDS).filter(([date])=>date.startsWith(`${calendarMonth}-`)),training=entries.filter(([date,record])=>!FORMAL_REST_DAYS.includes(date)&&record.status==='training'),load=training.reduce((total,[,record])=>total+(record.sessionLoad||0),0);
 monthlySnapshotStatus.textContent=`${training.length} 个训练日 · ${load} AU`;
 const label=`${year} 年 ${monthNumber} 月`;
 monthlyTitle.textContent=`${label}正式记录`;monthLabel.textContent=label;monthlyCalendar.setAttribute('aria-label',`${label}正式训练月历`);monthlyRecordLink.href=`records/${calendarMonth}.html`;
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
function refresh(){renderCycle();renderFormalMonth();renderToday();renderTodayReadiness();updateReadiness();updateRecommendation();renderAssessment();renderWeak();updateLoad();renderActions();stats();renderAthleteProfile();TrainingReviewPanel.render()}
document.getElementById('cycleStart').addEventListener('change',refresh);document.getElementById('mode').addEventListener('change',refresh);
document.getElementById('monthPrev').addEventListener('click',()=>shiftMonth(-1));document.getElementById('monthNext').addEventListener('click',()=>shiftMonth(1));
document.getElementById('recDateSelect').addEventListener('change',e=>{renderToday(e.target.value);updateReadiness();updateRecommendation()});
document.getElementById('recPrevious').addEventListener('click',()=>{const dates=recommendationDates(),index=dates.indexOf(currentRecKey);if(index>0)renderToday(dates[index-1])});
document.getElementById('recNext').addEventListener('click',()=>{const dates=recommendationDates(),index=dates.indexOf(currentRecKey);if(index>=0&&index<dates.length-1)renderToday(dates[index+1])});
document.getElementById('recLatest').addEventListener('click',()=>renderToday());
document.getElementById('recExpandAll').addEventListener('click',()=>document.querySelectorAll('#sessionSlots details').forEach(slot=>slot.open=true));
document.getElementById('recCollapseAll').addEventListener('click',()=>document.querySelectorAll('#sessionSlots details').forEach(slot=>slot.open=slot.hasAttribute('data-rec-pinned')));
recViewBindNavigation();
document.addEventListener('DOMContentLoaded',refresh);

// 侧栏与内容滚动保持同步；不参与训练数据的读取或保存。
(()=>{
 const links=[...document.querySelectorAll('#nav a[href^="#"]')];
 const targets=links.map(link=>document.querySelector(link.getAttribute('href'))).filter(Boolean);
 let pending=false;
 function markLocation(){
  const offset=matchMedia('(min-width:1200px)').matches?100:150;
  let current=targets[0];
  for(const target of targets){if(target.getBoundingClientRect().top<=offset)current=target}
  for(const link of links){
   const active=link.getAttribute('href')==='#'+current.id;
   link.classList.toggle('active',active);
   if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
  }
  pending=false;
 }
 function scheduleLocation(){if(!pending){pending=true;requestAnimationFrame(markLocation)}}
 addEventListener('scroll',scheduleLocation,{passive:true});
 addEventListener('resize',scheduleLocation);
 addEventListener('load',scheduleLocation);
})();
