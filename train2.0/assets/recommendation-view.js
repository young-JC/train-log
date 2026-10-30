// 只读阅读适配：按原文的选项、句界和括号边界拆分，不生成训练处方。
function recViewText(value){const el=document.createElement('div');el.innerHTML=String(value).replace(/<br\s*\/?\s*>/gi,'\n');return el.textContent||''}
function recViewEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function recViewName(value){return recViewEscape(value).replace(/（([^）]*[A-Za-z][^）]*)）/g,'<span class="rec-name-en">（$1）</span>')}
function recViewParts(value){return String(value).split(/<br\s*\/?\s*>|\r?\n/gi).map(recViewText).filter(text=>text.trim())}
function recViewChoices(slot){return recViewParts(slot[1]).filter(text=>/^\s*[ABC]\s*[：:]/.test(text))}
function recViewPhase(slot){
 if(/Quality Stop|权限|疼痛监控|停止条件|训练后记录/i.test(slot[0]))return 'rules';
 if(/有氧|体能/.test(slot[0]))return 'main';
 if(/整理|拉伸|Cooldown|Recovery|恢复/i.test(slot[0]))return 'cooldown';
 if(/热身|防伤|活动度|Warm.up|Prehab|Mobility/i.test(slot[0]))return 'prepare';
 return 'main';
}

function recViewBuildRoute(plan,phases){
 const groups=[];let step=0;
 plan.forEach((slot,index)=>{
  const phase=recViewPhase(slot),previous=groups.at(-1);
  if(!previous||previous.phase!==phase)groups.push({phase,index,items:[]});
  const title=recViewText(slot[0]).split(/[·；;（(]/)[0].trim();
  groups.at(-1).items.push({index,title,number:phase==='rules'?'!':String(++step).padStart(2,'0'),optional:/可选|可跳过/.test(slot[0])});
 });
 document.getElementById('recRoute').innerHTML=groups.map((group,index)=>{
  const label=recViewPhaseLabel(group.phase,group.items.map(item=>plan[item.index]),phases);
  const id='rec-route-bubble-'+index;
  return '<section class="rec-route-stage" data-rec-phase="'+group.phase+'"><button type="button" class="rec-route-head" aria-expanded="false" aria-haspopup="dialog" aria-controls="'+id+'"><span class="rec-route-number">'+String(index+1).padStart(2,'0')+'</span><strong id="'+id+'-label">'+label+'</strong><small>'+group.items.length+(group.phase==='rules'?' 项提醒':' 个槽位')+'</small><span class="rec-route-arrow" aria-hidden="true">→</span></button><div class="rec-route-bubble" id="'+id+'" popover="auto" role="dialog" aria-labelledby="'+id+'-label"><div class="rec-bubble-head"><span>'+label+'<small>点击动作查看详情</small></span><button type="button" class="rec-bubble-close" aria-label="关闭动作槽位">×</button></div><div class="rec-route-slots">'+group.items.map(item=>'<a class="rec-route-slot" href="#rec-slot-'+item.index+'" data-rec-target="'+item.index+'"><span>'+item.number+'</span><span>'+recViewEscape(item.title)+(item.optional?'<small>可选</small>':'')+'</span><span class="rec-bubble-link-arrow" aria-hidden="true">↗</span></a>').join('')+'</div></div></section>';
 }).join('');
}

function recViewPositionBubble(bubble){
 const trigger=bubble.closest('.rec-route-stage').querySelector('.rec-route-head'),anchor=trigger.getBoundingClientRect();
 const padding=12,width=Math.min(380,innerWidth-padding*2);
 bubble.style.width=width+'px';
 bubble.style.maxHeight=Math.max(120,innerHeight-padding*2)+'px';
 bubble.style.setProperty('--rec-bubble-max-height',Math.max(120,innerHeight-padding*2)+'px');
 const initialHeight=bubble.offsetHeight,left=Math.max(padding,Math.min(anchor.left+(anchor.width-width)/2,innerWidth-width-padding));
 const above=anchor.bottom+12+initialHeight>innerHeight-padding&&anchor.top>innerHeight-anchor.bottom;
 const available=above?anchor.top-padding-12:innerHeight-anchor.bottom-padding-12;
 bubble.style.maxHeight=Math.max(100,available)+'px';
 bubble.style.setProperty('--rec-bubble-max-height',Math.max(100,available)+'px');
 const height=bubble.offsetHeight;
 const top=above?anchor.top-height-12:anchor.bottom+12;
 bubble.style.left=left+'px';bubble.style.top=Math.max(padding,Math.min(top,innerHeight-height-padding))+'px';
 bubble.style.setProperty('--rec-bubble-pointer',Math.max(20,Math.min(width-20,anchor.left+anchor.width/2-left))+'px');
 bubble.classList.toggle('rec-bubble-above',above);
}

function recViewPhaseLabel(phase,slots,phases){
 if(phase==='main'&&slots.every(slot=>/有氧|体能/.test(slot[0])))return '轻松有氧';
 if(phase==='prepare'&&slots.every(slot=>/活动度|Mobility/i.test(slot[0])))return '活动度准备';
 return phases[phase][1];
}

let recViewActiveIndex=-1;
function recViewSetActive(index,navigate=false){
 const slots=[...document.querySelectorAll('#sessionSlots .rec-slot')],slot=slots.find(item=>Number(item.dataset.recIndex)===index);
 if(!slot)return;
 recViewActiveIndex=index;
 const position=slots.indexOf(slot);
 document.querySelectorAll('#recRoute [data-rec-target]').forEach(link=>{
  if(Number(link.dataset.recTarget)===index)link.setAttribute('aria-current','step');
  else link.removeAttribute('aria-current');
 });
 slots.forEach(item=>item.classList.toggle('rec-slot-reading',item===slot));
 document.getElementById('recReaderNav').hidden=false;
 document.getElementById('recReaderPosition').textContent='查看 '+(position+1)+' / '+slots.length;
 document.getElementById('recReaderTitle').textContent=(slot.querySelector('.rec-slot-name,.rec-rule-head h4')?.textContent||'').replace('可选学习','');
 document.getElementById('recSlotPrevious').disabled=position===0;
 document.getElementById('recSlotNext').disabled=position===slots.length-1;
 if(navigate){
  slots.filter(item=>item.tagName==='DETAILS').forEach(item=>item.open=item===slot);
  const target=slot.querySelector('summary,.rec-rule-head');
  if(target){if(!target.hasAttribute('tabindex'))target.tabIndex=-1;target.focus({preventScroll:true});}
  slot.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
}

function recViewSelectOption(tabs,button,focus=false){
 const container=tabs.nextElementSibling;
 tabs.querySelectorAll('[role="tab"]').forEach(tab=>{
  const selected=tab===button;
  tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
  const panel=container.querySelector('#'+tab.getAttribute('aria-controls'));
  if(panel)panel.hidden=!selected;
 });
 if(focus)button.focus();
}

function recViewSetupReader(){
 recViewActiveIndex=-1;
 const container=document.getElementById('sessionSlots'),slots=[...container.querySelectorAll('.rec-slot')];
 document.getElementById('recReaderNav').hidden=!slots.length;
 slots.forEach(slot=>{
  const candidates=slot.querySelector('.rec-candidates');
  if(!candidates||candidates.children.length<2)return;
  const tabs=document.createElement('div');tabs.className='rec-option-switch';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','查看候选方案（每槽只练一个）');
  [...candidates.children].forEach((card,index)=>{
   const id='rec-option-'+slot.dataset.recIndex+'-'+index,button=document.createElement('button');
   button.type='button';button.id=id+'-tab';button.setAttribute('role','tab');button.setAttribute('aria-controls',id);
   const key=card.querySelector('.rec-candidate-key')?.textContent||String(index+1),label=card.querySelector('.rec-candidate-label>span:last-child')?.textContent||'方案';
   button.innerHTML='<b>'+recViewEscape(key)+'</b><span>'+recViewEscape(label.replace(/^方案\s*[ABC]$/,'方案'))+'</span>';
   button.setAttribute('aria-selected',String(index===0));button.tabIndex=index===0?0:-1;
   card.id=id;card.setAttribute('role','tabpanel');card.setAttribute('aria-labelledby',button.id);card.tabIndex=0;card.hidden=index!==0;
   tabs.append(button);
  });
  candidates.before(tabs);
 });
 const first=slots.find(slot=>slot.open)||slots[0];
 if(first)recViewSetActive(Number(first.dataset.recIndex));
}

// 仅浏览槽位与候选方案；浏览状态不代表已选择或已完成训练。
function recViewBindNavigation(){
document.addEventListener('click',event=>{
 const trigger=event.target.closest('#recRoute .rec-route-head');
 if(trigger){
  const bubble=document.getElementById(trigger.getAttribute('aria-controls'));
  if(bubble.matches(':popover-open'))bubble.hidePopover();
  else{
   bubble.showPopover();recViewPositionBubble(bubble);
   if(event.detail===0)bubble.querySelector('.rec-route-slot')?.focus({preventScroll:true});
  }
 }
 const close=event.target.closest('.rec-bubble-close');
 if(close){const bubble=close.closest('.rec-route-bubble');bubble.hidePopover();bubble.closest('.rec-route-stage').querySelector('.rec-route-head').focus({preventScroll:true});}
 const route=event.target.closest('#recRoute a[data-rec-target]');
 if(route){
  event.preventDefault();
  const bubble=route.closest('.rec-route-bubble');
  if(bubble?.matches(':popover-open'))bubble.hidePopover();
  const target=route.dataset.recTarget;
  if(target!==undefined)recViewSetActive(Number(target),true);
 }
 const tab=event.target.closest('.rec-option-switch [role="tab"]');
 if(tab)recViewSelectOption(tab.parentElement,tab);
 if(event.target.closest('#recSlotPrevious,#recSlotNext')){
  const slots=[...document.querySelectorAll('#sessionSlots .rec-slot')],position=slots.findIndex(slot=>Number(slot.dataset.recIndex)===recViewActiveIndex);
  const next=slots[position+(event.target.closest('#recSlotNext')?1:-1)];
  if(next)recViewSetActive(Number(next.dataset.recIndex),true);
 }
});
document.addEventListener('toggle',event=>{
 if(event.target.matches('.rec-route-bubble')){
  const trigger=event.target.closest('.rec-route-stage').querySelector('.rec-route-head');
  trigger.setAttribute('aria-expanded',String(event.target.matches(':popover-open')));
 }
 if(event.target.matches('#sessionSlots details.rec-slot[open]')&&!event.target.classList.contains('rec-slot-reading'))recViewSetActive(Number(event.target.dataset.recIndex));
},true);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){
  const bubble=document.querySelector('.rec-route-bubble:popover-open');
  if(bubble){event.preventDefault();bubble.hidePopover();bubble.closest('.rec-route-stage').querySelector('.rec-route-head').focus({preventScroll:true});}
  return;
 }
 const tab=event.target.closest('.rec-option-switch [role="tab"]');
 if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();
 const tabs=tab.parentElement,buttons=[...tabs.children],index=buttons.indexOf(tab);
 const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
 recViewSelectOption(tabs,buttons[next],true);
});
 const positionOpen=()=>document.querySelectorAll('.rec-route-bubble:popover-open').forEach(recViewPositionBubble);
 window.addEventListener('resize',positionOpen);
 window.addEventListener('scroll',positionOpen,{passive:true,capture:true});
}
function recViewSlotInfo(slot){
 const choices=recViewChoices(slot),first=choices[0];
 const action=recViewAction(first?first.replace(/^\s*[ABC]\s*[：:]\s*/,''):recViewParts(slot[1])[0]||'');
 const doses=recViewDoseOptions(slot[2]||''),key=first?.match(/^\s*([ABC])/)[1];
 const dose=key?doses.options[key]||'':String(slot[2]||'');
 return {choices,action,dose:recViewDoseLines(dose)[0]?.replace(/[，,；;。]+$/,'')||'',key};
}
function recViewSplit(value,separators){
 const result=[];let depth=0,start=0;
 for(let i=0;i<value.length;i++){
  if('（(['.includes(value[i]))depth++;
  else if('）)]'.includes(value[i]))depth=Math.max(0,depth-1);
  else if(!depth&&separators.includes(value[i])){result.push(value.slice(start,i+1).trim());start=i+1;}
 }
 result.push(value.slice(start).trim());return result.filter(Boolean);
}
function recViewList(value,extraClass=''){
 const items=recViewSplit(recViewText(value),'；;。\n').map(text=>text.replace(/[；;。]+$/,'')).filter(text=>/[^\s，,：:]/.test(text));
 return items.length?'<ul class="rec-instructions '+extraClass+'">'+items.map(text=>'<li>'+recViewEscape(text)+'</li>').join('')+'</ul>':'';
}
function recViewLineDoseOptions(text){
 const lines=text.split(/\r?\n/);
 const marked=lines.map((line,index)=>({index,match:line.match(/^\s*([ABC])(?![A-Za-z/])\s*[：:]?\s*/)})).filter(item=>item.match);
 if(!marked.length||new Set(marked.map(item=>item.match[1])).size!==marked.length)return null;
 if(marked.length===1&&(!/^\s*[ABC]\s*[：:]/.test(lines[marked[0].index])||/[；;。]\s*[ABC](?![A-Za-z/])\s*[：:]?\s*\S/.test(text)))return null;
 if(marked.length===2&&!text.includes('\n'))return null;
 if(marked.some((item,index)=>index&&item.match[1]<=marked[index-1].match[1]))return null;
 // 显式分行时保留每个选项的整段；只把另起一行且明确标记的共同说明分离。
 const boundary=lines.findIndex((line,index)=>index>marked.at(-1).index&&/^\s*(?:共同(?:剂量|安排|限制|说明|条件)|[ABC](?:\/[ABC])+)/.test(line));
 const end=boundary<0?lines.length:boundary;
 const options=Object.fromEntries(marked.map((item,index)=>[
  item.match[1],lines.slice(item.index,index<marked.length-1?marked[index+1].index:end).join('\n').slice(item.match[0].length).trim()
 ]));
 const prefix=lines.slice(0,marked[0].index).join('\n').trim(),tail=lines.slice(end).join('\n').trim();
 return {options,common:[prefix,tail].filter(Boolean).join('\n'),prefix,tail};
}
function recViewDoseOptions(value){
 const text=recViewText(String(value).replace(/<br\s*\/?\s*>/gi,'\n')),lined=recViewLineDoseOptions(text);
 if(lined)return lined;
 const matches=[...text.matchAll(/(?:^|[：:；;。])\s*([ABC])(?![A-Za-z/])\s*[：:]?\s*/g)];
 const ordered=[];
 for(const letter of ['A','B','C']){
  const match=matches.find(m=>m[1]===letter&&(!ordered.length||m.index>ordered.at(-1).index));
  if(!match)return {options:{},common:text,prefix:''};ordered.push(match);
 }
 const options={},prefix=text.slice(0,ordered[0].index+(ordered[0][0].startsWith('A')?0:1)).trim();
 let common='';
 ordered.forEach((match,index)=>{
  const start=match.index+match[0].length;
  if(index<2)options[match[1]]=text.slice(start,ordered[index+1].index+1).trim();
  else{
   const rest=text.slice(start).trimStart(),first=recViewSplit(rest,'；;。')[0]||'';
   options.C=first;common=rest.slice(first.length).trim();
  }
 });
 return {options,common:[prefix,common].filter(Boolean).join('\n'),prefix,tail:common};
}
function recViewAction(value){
 let text=recViewText(value).trim();
 const role=text.match(/^(最推荐|兼容推荐|新动作或过往少练)\s*[｜|]\s*/);
 if(role)text=text.slice(role[0].length);
 const parts=recViewSplit(text,'，,；;。：:');
 const first=parts[0]||text;
 return {name:first.replace(/[，,；;。：:]$/,''),notes:text.slice(first.length).trim(),role:role?.[1]||''};
}
function recViewDoseLines(value){
 // 数值小数点与括号内的间歇安排不拆开；每条原文独立一行。
 return recViewSplit(recViewText(value),'；;。').flatMap(sentence=>recViewSplit(sentence,'，,'));
}
function recViewDose(value){
 const lines=recViewDoseLines(value).map(text=>text.replace(/[，,；;。]+$/,'')).filter(Boolean);
 if(!lines.length)return '';
 return '<div class="rec-prescription"><span class="rec-label">训练剂量</span><strong>'+recViewEscape(lines[0])+'</strong>'+(lines.length>1?'<ul class="rec-instructions">'+lines.slice(1).map(line=>'<li>'+recViewEscape(line)+'</li>').join('')+'</ul>':'')+'</div>';
}
function recViewExerciseRows(action,dose){
 const actions=recViewSplit(action,'+＋→').map(name=>name.replace(/[+＋→]$/,'').trim());
 const doseParts=recViewSplit(dose,'；;。'),firstDose=doseParts[0]||'';
 const doses=recViewSplit(firstDose,'、+＋').map(value=>value.replace(/[、+＋；;。]$/,'').trim());
 // 仅在原文逐项数量一致时按顺序对应；不明确的共同剂量单列，避免猜配。
 const paired=actions.length>1&&doses.length===actions.length;
 const rows=actions.map((name,index)=>'<div class="rec-exercise-row"><span class="rec-exercise-index">'+(index+1)+'</span><span class="rec-exercise-title">'+recViewName(name)+'</span>'+(paired?'<strong class="rec-exercise-amount">'+recViewEscape(doses[index])+'</strong>':'')+'</div>').join('');
 return '<div class="rec-exercise-list">'+rows+'</div>'+recViewDose(paired?dose.slice(firstDose.length).trim():dose);
}
function recViewCandidate(action,dose,key,recommended){
 const parsed=recViewAction(action),multiple=recViewSplit(parsed.name,'+＋→').length>1;
 return '<article class="rec-candidate"><header><div class="rec-candidate-label">'+(key?'<span class="rec-candidate-key">'+key+'</span>':'')+'<span>'+(parsed.role|| (recommended?'建议 · 待选':key?'方案 '+key:'推荐动作'))+'</span></div><h4>'+recViewName(parsed.name)+'</h4></header>'
  +'<div class="rec-candidate-dose">'+(multiple?recViewExerciseRows(parsed.name,dose):recViewDose(dose))+'</div>'
  +(parsed.notes?'<div class="rec-exercise-notes"><span class="rec-label">依据、经历与执行条件</span>'+recViewList(parsed.notes)+'</div>':'')+'</article>';
}
function recViewSlotContent(slot){
 const pieces=recViewParts(slot[1]);
 const choices=pieces.filter(text=>/^\s*[ABC]\s*[：:]/.test(text));
 if(!choices.length){
  if(/Quality Stop|权限|训练后记录|疼痛监控/i.test(slot[0]))return '<div class="rec-shared-guidance"><h4>执行边界</h4>'+recViewList(slot[1])+'<h4>执行与记录</h4>'+recViewList(slot[2]||'按计划')+'</div>';
  return recViewCandidate(slot[1],String(slot[2]||'按计划'),'','');
 }
 const dose=recViewDoseOptions(slot[2]||'按计划');
 const shared=pieces.filter(text=>!/^\s*[ABC]\s*[：:]/.test(text));
 let common=dose.common;
 return (shared.length?'<div class="rec-shared-guidance"><h4>共同安排</h4>'+shared.map(text=>{
  const preparation=text.match(/^共同准备[：:]\s*/),action=recViewAction(preparation?text.slice(preparation[0].length):text);
  if(recViewSplit(action.name,'+＋→').length<2)return recViewList(text);
  let sharedDose='',intro='';
  if(preparation&&dose.prefix){
   const separator=dose.prefix.search(/[：:]/);
   if(separator>=0){intro=dose.prefix.slice(0,separator+1);sharedDose=dose.prefix.slice(separator+1);common=dose.tail;}
  }
  return (preparation?'<span class="rec-label">共同准备</span>':'')+recViewList(intro)+recViewExerciseRows(action.name,sharedDose)+recViewList(action.notes);
 }).join('')+'</div>':'')
  +'<div class="rec-candidates">'+choices.map(text=>{
   const match=text.match(/^\s*([ABC])\s*[：:]\s*/),key=match[1];
   return recViewCandidate(text.slice(match[0].length),dose.options[key]||'',key,key==='A'&&slot[0].includes('A建议'));
  }).join('')+'</div>'
  +(common?'<div class="rec-shared-guidance rec-shared-limits"><h4>共同剂量、执行与停止条件</h4>'+recViewList(common)+'</div>':'');
}
