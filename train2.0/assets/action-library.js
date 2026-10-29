// 动作库只读阅读视图。数据与原始描述均来自 assets/data/actions.js。
let actionModalTrigger=null;
let actionInteractionsInitialized=false;
let actionActiveModule='';
let actionBackgroundState=[];
let actionScrollWasLocked=false;
let actionReturnPosition={left:0,top:0};
const actionOpenModules=new Set(['A']);

function levelPill(level){return '<span class="lvl-pill l'+escapeHtml(level.slice(1))+'">'+escapeHtml(level)+'</span>'}
function impactPill(impact){return '<span class="impact-pill '+(impact==='低'?'low':impact==='中'?'mid':'high')+'">'+escapeHtml(impact)+'冲击</span>'}
function actionMeta(label,value){return '<div><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(value)+'</strong></div>'}
function actionModuleLabel(letter){return (ACTION_MODULES[letter]||'').split('（')[0]}
function actionHasFilters(){return !!(fSearch.value.trim()||fLevel.value||fImpact.value||fEquipment.value)}
function syncActionDirectory(){
 const mobile=matchMedia('(max-width:760px)').matches;
 actionDirectoryToggle.disabled=!mobile;
 actionDirectoryToggle.setAttribute('aria-expanded',String(!mobile||actionDirectory.classList.contains('expanded')));
}

function actionDescriptionParts(description){
 // 仅按原描述显式标签分段；普通描述整段保留，不补写剂量或准入。
 const marks=[...description.matchAll(/(?:剂量|准入|退阶|进阶|质量停止|周期|说明|疼痛限制|来源)[：:]/g)];
 if(!marks.length)return {intro:description,sections:[]};
 return {intro:description.slice(0,marks[0].index).trim(),sections:marks.map((match,index)=>({
  title:match[0].slice(0,-1),text:description.slice(match.index+match[0].length,marks[index+1]?.index??description.length).trim()
 }))};
}
function openActionModal(index,trigger){
 const action=ACTIONS[index];if(!action)return;
 actionModalTrigger=trigger||document.activeElement;
 actionModalCategory.textContent=action.id+' · '+actionModuleLabel(action.id.charAt(0));
 actionModalTitle.textContent=action.name;
 actionModalEnglish.textContent=action.en||'';
 actionModalEnglish.hidden=!action.en;
 const description=actionDescriptionParts(actionDescription(action));
 actionModalDescription.textContent=description.intro;
 document.querySelector('.lib-detail-intro').hidden=!description.intro;
 actionModalDetails.innerHTML=description.sections.map(section=>'<section class="lib-detail-section'+(/质量停止|疼痛限制/.test(section.title)?' lib-detail-caution':'')+'"><h4>'+escapeHtml(section.title)+'</h4><p>'+escapeHtml(section.text)+'</p></section>').join('');
 actionModalTags.innerHTML=levelPill(action.level)+impactPill(action.impact)+'<span class="lib-equipment">器材 · '+escapeHtml(action.equipment)+'</span>';
 actionModalMeta.innerHTML=actionMeta('训练能力',action.ability)+actionMeta('动作分类',moduleDisplayName(action.module))+actionMeta('器材',action.equipment)+actionMeta('训练用途',action.use);
 if(actionModal.hidden){
  actionReturnPosition={left:window.scrollX,top:window.scrollY};
  actionBackgroundState=[...document.querySelectorAll('main,#nav')].map(element=>[element,element.inert]);
  actionBackgroundState.forEach(([element])=>{element.inert=true});
  actionScrollWasLocked=document.body.classList.contains('no-scroll');
 }
 actionModal.hidden=false;
 document.body.classList.add('no-scroll');
 actionModal.querySelector('.modal-panel').scrollTop=0;
 actionModalClose.focus({preventScroll:true});
}
function closeActionModal(){
 if(actionModal.hidden)return;
 actionModal.hidden=true;
 actionBackgroundState.forEach(([element,wasInert])=>{element.inert=wasInert});
 actionBackgroundState=[];
 if(!actionScrollWasLocked)document.body.classList.remove('no-scroll');
 const target=actionModalTrigger?.isConnected?actionModalTrigger:fSearch;
 target.focus({preventScroll:true});
 window.scrollTo({...actionReturnPosition,behavior:'instant'});
 actionModalTrigger=null;
}
function renderActionDirectory(matches){
 const countFor=letter=>matches.filter(({a})=>a.id.startsWith(letter)).length;
 const button=(letter,label,count)=>'<button type="button" class="lib-module'+(actionActiveModule===letter?' active':'')+'" data-module="'+letter+'" aria-pressed="'+(actionActiveModule===letter)+'"'+(count===0&&actionActiveModule!==letter?' disabled':'')+'><span class="lib-module-letter">'+(letter||'↗')+'</span><span class="lib-module-label">'+escapeHtml(label)+'</span><span class="lib-module-count">'+count+'</span></button>';
 actionModuleList.innerHTML=button('','全部动作',matches.length)+Object.keys(ACTION_MODULES).map(letter=>button(letter,actionModuleLabel(letter),countFor(letter))).join('');
 actionDirectoryToggle.querySelector('small').textContent=actionActiveModule?actionModuleLabel(actionActiveModule):Object.keys(ACTION_MODULES).length+' 个模块 · 全部动作';
}
function renderActionFilters(){
 const filters=[['module','模块',actionActiveModule?actionModuleLabel(actionActiveModule):''],['fSearch','搜索',fSearch.value.trim()],['fLevel','等级',fLevel.value],['fImpact','冲击',fImpact.value],['fEquipment','器材',fEquipment.value]].filter(([, ,value])=>value);
 actionActiveFilters.hidden=!filters.length;
 actionActiveFilters.innerHTML=filters.map(([key,label,value])=>'<button type="button" class="lib-filter-chip" data-clear-filter="'+key+'" aria-label="'+escapeHtml('移除'+label+'：'+value)+'"><span>'+escapeHtml(label)+' · '+escapeHtml(value)+'</span><span aria-hidden="true">×</span></button>').join('')+(filters.length?'<button class="lib-reset" type="button" data-clear-filter="all">清除全部</button>':'');
 const count=[fLevel.value,fImpact.value,fEquipment.value].filter(Boolean).length;
 actionFilterCount.hidden=!count;actionFilterCount.textContent=count;
}
function filterActions(){
 const query=fSearch.value.trim().toLowerCase(),level=fLevel.value,impact=fImpact.value,equipment=fEquipment.value;
 const words=query.split(/\s+/).filter(Boolean);
 const matches=ACTIONS.map((a,i)=>({a,i})).filter(({a})=>(!level||a.level===level)&&(!impact||a.impact===impact)&&(!equipment||a.equipment===equipment)&&words.every(word=>[a.name,a.en,a.id,moduleDisplayName(a.module),ACTION_MODULES[a.id.charAt(0)],a.ability,a.equipment,a.use].join(' ').toLowerCase().includes(word)));
 const visible=matches.filter(({a})=>!actionActiveModule||a.id.startsWith(actionActiveModule));
 renderActionDirectory(matches);renderActionFilters();
 actionCount.textContent=ACTIONS.length+' 个动作 · '+Object.keys(ACTION_MODULES).length+' 个模块';
 actionResultsTitle.textContent=actionActiveModule?actionModuleLabel(actionActiveModule):'全部动作';
 actionResultsCount.textContent=visible.length+' 个'+(actionHasFilters()?'匹配结果':'动作');
 actionLibGroups.innerHTML=Object.keys(ACTION_MODULES).map(letter=>{
  const list=visible.filter(({a})=>a.id.startsWith(letter));if(!list.length)return '';
  const expanded=!!actionActiveModule||actionHasFilters()||actionOpenModules.has(letter);
  return '<details class="lib-category" data-module="'+letter+'"'+(expanded?' open':'')+'><summary><span class="lib-category-letter">'+letter+'</span><span>'+escapeHtml(ACTION_MODULES[letter])+'</span><small>'+list.length+' 个动作</small><i aria-hidden="true"></i></summary><div class="lib-action-list">'+list.map(({a,i})=>'<button class="lib-row" type="button" data-action-index="'+i+'" aria-haspopup="dialog"><span class="lib-row-name"><strong>'+escapeHtml(a.name)+'</strong>'+(a.en?'<span class="action-name-en">'+escapeHtml(a.en)+'</span>':'')+'<span class="lib-row-ability">'+escapeHtml(a.ability)+'</span></span><span class="lib-row-tags">'+levelPill(a.level)+impactPill(a.impact)+'<span class="lib-equipment">器材 · '+escapeHtml(a.equipment)+'</span></span><span class="lib-row-arrow" aria-hidden="true">↗</span></button>').join('')+'</div></details>';
 }).join('');
 actionLibEmpty.hidden=visible.length>0;
 actionEmptyHint.textContent=actionActiveModule&&matches.length?'当前模块没有匹配项，其他模块还有 '+matches.length+' 个结果。':'试试其他关键词，或减少筛选条件。';
 actionClearEmpty.textContent=actionActiveModule&&matches.length?'查看其他模块':'清除筛选';
 actionClearEmpty.dataset.clearFilter=actionActiveModule&&matches.length?'module':'all';
}
function clearActionFilter(key){
 if(key==='all'){
  actionActiveModule='';[fSearch,fLevel,fImpact,fEquipment].forEach(input=>{input.value=''});
 }else if(key==='module')actionActiveModule='';
 else document.getElementById(key).value='';
 filterActions();
 const control=key==='module'||key==='all'?fSearch:document.getElementById(key);
 (control.getClientRects().length?control:fSearch).focus({preventScroll:true});
}
function renderActions(){
 const equipment=fEquipment.value;
 replaceOptions(fEquipment,'全部器材',[...new Set(ACTIONS.map(action=>action.equipment))].sort());
 fEquipment.value=equipment;
 if(!actionInteractionsInitialized){
  ['fLevel','fImpact','fEquipment'].forEach(id=>document.getElementById(id).addEventListener('input',filterActions));
  fSearch.addEventListener('input',()=>{actionActiveModule='';filterActions()});
  actionModuleList.addEventListener('click',event=>{
   const button=event.target.closest('[data-module]');if(!button)return;
   actionActiveModule=button.dataset.module;filterActions();
   actionDirectory.classList.remove('expanded');syncActionDirectory();
   if(matchMedia('(max-width:760px)').matches)actionDirectoryToggle.focus({preventScroll:true});
   else actionModuleList.querySelector('[data-module="'+actionActiveModule+'"]').focus({preventScroll:true});
  });
  actionFilterToggle.addEventListener('click',()=>{
   actionFilterPanel.hidden=!actionFilterPanel.hidden;actionFilterToggle.setAttribute('aria-expanded',String(!actionFilterPanel.hidden));
  });
  actionDirectoryToggle.addEventListener('click',()=>{
   const expanded=actionDirectory.classList.toggle('expanded');actionDirectoryToggle.setAttribute('aria-expanded',String(expanded));
  });
  actionActiveFilters.addEventListener('click',event=>{const button=event.target.closest('[data-clear-filter]');if(button)clearActionFilter(button.dataset.clearFilter)});
  actionClearEmpty.addEventListener('click',()=>clearActionFilter(actionClearEmpty.dataset.clearFilter));
  matchMedia('(max-width:760px)').addEventListener('change',syncActionDirectory);
  actionLibGroups.addEventListener('click',event=>{const row=event.target.closest('.lib-row');if(row)openActionModal(+row.dataset.actionIndex,row)});
  actionLibGroups.addEventListener('toggle',event=>{
   const group=event.target;if(!group.matches('.lib-category')||!group.isConnected||actionActiveModule||actionHasFilters())return;
   if(group.open)actionOpenModules.add(group.dataset.module);else actionOpenModules.delete(group.dataset.module);
  },true);
  actionModalClose.addEventListener('click',closeActionModal);
  actionModalDone.addEventListener('click',closeActionModal);
  actionModal.addEventListener('click',event=>{if(event.target===actionModal)closeActionModal()});
  actionModal.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();closeActionModal();return}
   if(event.key!=='Tab')return;
   const controls=[...actionModal.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(element=>element.getClientRects().length);
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });
  actionInteractionsInitialized=true;
 }
 syncActionDirectory();
 filterActions();
}
