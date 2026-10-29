// 只读阅读适配：按原文的选项、句界和括号边界拆分，不生成训练处方。
function recViewText(value){const el=document.createElement('div');el.innerHTML=String(value).replace(/<br\s*\/?\s*>/gi,'\n');return el.textContent||''}
function recViewEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function recViewName(value){return recViewEscape(value).replace(/（([^）]*[A-Za-z][^）]*)）/g,'<span class="rec-name-en">（$1）</span>')}
function recViewParts(value){return String(value).split(/<br\s*\/?\s*>|\r?\n/gi).map(recViewText).filter(text=>text.trim())}
function recViewChoices(slot){return recViewParts(slot[1]).filter(text=>/^\s*[ABC]\s*[：:]/.test(text))}
function recViewPhase(slot){
 if(/Quality Stop|权限|疼痛监控|停止条件|训练后记录/i.test(slot[0]))return 'rules';
 if(/整理|拉伸|Cooldown|Recovery|恢复/i.test(slot[0]))return 'cooldown';
 if(/热身|防伤|活动度|Warm.up|Prehab|Mobility/i.test(slot[0]))return 'prepare';
 return 'main';
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
