/* 详情阅读视图只整理已有 DOM；原表格与所有实绩保留，可随时切换。 */
(()=>{
 'use strict';
 const paths={
  readiness:'M3 12h4l3-8 4 16 3-8h4',
  prepare:'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Zm-4 9 3 3 5-6',
  power:'m13 2-8 12h6l-1 8 9-13h-6l1-7Z',
  strength:'m6 4-2 2m3 1-3 3m3-6 13 13M17 14l3-3m-4 8 3-3M3 7l4-4m10 18 4-4',
  basketball:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-15-6 12 12M6 18 18 6M3 11c6 2 8 4 10 10M11 3c2 6 4 8 10 10',
  recovery:'M20 7a8 8 0 1 0 0 10M20 3v5h-5M8 12h8m-4-4v8',
  feedback:'M4 20V10m8 10V4m8 16v-7M2 20h20',
  note:'M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M8 8h6m-6 5h3m2 2 7-7 2 2-7 7-3 1 1-3Z',
  attention:'m12 3 10 17H2L12 3Zm0 6v5m0 3h.01',
  calendar:'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Zm4 9h2m3 0h2m-7 3h2',
  check:'m5 12 4 4L19 6'
 };
 function iconFor(text){
  if(/Readiness/.test(text))return 'readiness';
  if(/待补充|纠错/.test(text))return 'calendar';
  if(/负荷与|反馈/.test(text))return 'feedback';
  if(/疼痛|关注/.test(text))return 'attention';
  if(/总结/.test(text))return 'note';
  if(/完成/.test(text))return 'check';
  if(/准备|防伤|热身/.test(text))return 'prepare';
  if(/篮球|实战|对抗/.test(text))return 'basketball';
  if(/整理|拉伸|恢复|呼吸|活动度/.test(text))return 'recovery';
  if(/爆发|落地|速度|制动|弹性/.test(text))return 'power';
  return 'strength';
 }
 function icon(name){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
  svg.setAttribute('stroke-width','1.6');svg.setAttribute('stroke-linecap','round');
  svg.setAttribute('stroke-linejoin','round');
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]);
  svg.append(path);return svg;
 }
 function copyValue(cell,className='record-value'){
  const value=document.createElement('div');value.className=className;
  value.append(...[...cell.childNodes].map(node=>node.cloneNode(true)));return value;
 }
 function metric(label,cell){
  const item=document.createElement('div');
  const term=document.createElement('dt');term.textContent=label;
  const definition=document.createElement('dd');definition.append(copyValue(cell));
  item.append(term,definition);return item;
 }
 let tableIndex=0;
 function readableTable(wrapper){
  const table=wrapper.querySelector('table');
  if(!table||table.dataset.readable)return;
  const headers=[...table.querySelectorAll('thead th')].map(cell=>cell.textContent.trim());
  const rows=[...table.querySelectorAll('tbody tr')];
  if(!headers.length||!rows.length||rows.some(row=>row.cells.length!==headers.length||[...row.cells].some(cell=>cell.colSpan>1||cell.rowSpan>1)))return;
  const isReadiness=headers.includes('睡眠')&&headers.includes('得分');
  if(isReadiness&&rows.length!==1)return;
  const nameIndex=headers.findIndex(label=>/项目|动作/.test(label));
  const isPairs=headers.length===2&&nameIndex===0;
  if(!isReadiness&&!isPairs&&(nameIndex<0||headers.length<4))return;
  const view=document.createElement('div');view.className='record-table-view';
  view.id='record-table-view-'+(++tableIndex);
  if(isReadiness&&rows.length===1){
   view.classList.add('readiness-layout');
   const metrics=document.createElement('dl');metrics.className='readiness-metrics';
   const result=document.createElement('dl');result.className='readiness-result-card';
   headers.forEach((label,index)=>{
    const item=metric(label,rows[0].cells[index]);
    if(/得分|等级/.test(label))result.append(item);else metrics.append(item);
   });
   view.append(metrics,result);
  }else if(isPairs){
   const facts=document.createElement('dl');facts.className='record-facts';
   for(const row of rows)facts.append(metric(row.cells[0].textContent.trim(),row.cells[1]));
   view.append(facts);
  }else{
   view.classList.add('exercise-cards');
   rows.forEach((row,index)=>{
    const card=document.createElement('article');card.className='exercise-card';
    const heading=document.createElement('header');heading.className='exercise-card-head';
    const number=document.createElement('span');number.className='exercise-card-number';
    const orderIndex=headers.findIndex(label=>label==='顺序');
    number.textContent=orderIndex>=0?row.cells[orderIndex].textContent.trim():String(index+1).padStart(2,'0');
    const name=document.createElement('h5');
    name.append(...[...row.cells[nameIndex].childNodes].map(node=>node.cloneNode(true)));
    heading.append(number,name);card.append(heading);
    const metrics=document.createElement('dl');metrics.className='exercise-metrics';
    const notes=document.createElement('dl');notes.className='exercise-notes';
    headers.forEach((label,cellIndex)=>{
     if(cellIndex===nameIndex||cellIndex===orderIndex)return;
     const item=metric(label,row.cells[cellIndex]);
     if(/备注|反馈/.test(label))notes.append(item);
     else if(label==='模块'){item.className='exercise-module';notes.prepend(item)}
     else metrics.append(item);
    });
    if(metrics.children.length)card.append(metrics);
    if(notes.children.length)card.append(notes);
    view.append(card);
   });
  }
  const toolbar=document.createElement('div');toolbar.className='record-view-toolbar';
  const label=document.createElement('span');label.textContent=isReadiness?'训练前状态':isPairs?'本次记录':'动作与实绩';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='record-view-toggle';
  toggle.textContent='表格视图';toggle.setAttribute('aria-pressed','false');
  toggle.setAttribute('aria-controls',view.id);
  table.hidden=true;table.dataset.readable='true';wrapper.classList.add('record-table');
  toolbar.append(label,toggle);wrapper.prepend(toolbar,view);
  toggle.addEventListener('click',()=>{
   const showingTable=table.hidden;
   table.hidden=!showingTable;view.hidden=showingTable;
   toggle.textContent=showingTable?'卡片视图':'表格视图';
   toggle.setAttribute('aria-pressed',String(showingTable));
   wrapper.classList.toggle('showing-table',showingTable);
   dispatchEvent(new Event('resize'));
  });
 }
 for(const article of document.querySelectorAll('main article.detail')){
  const heading=article.querySelector(':scope > h3');
  if(heading){
   const cover=document.createElement('div');cover.className='detail-cover';
   const theme=TrainingVisuals.get(heading.textContent);cover.dataset.trainingVisual=theme.key;
   const copy=document.createElement('div');copy.className='detail-heading';
   const kicker=document.createElement('div');kicker.className='detail-kicker';kicker.textContent=theme.caption;
   const meta=article.querySelector(':scope > .training-meta');
   copy.append(kicker,heading);if(meta)copy.append(meta);
   const figure=document.createElement('figure');figure.className='detail-illustration';figure.setAttribute('aria-hidden','true');
   const image=document.createElement('img');image.src=theme.src;image.alt='';image.width=200;image.height=148;
   figure.append(image);cover.append(copy,figure);article.prepend(cover);
  }
  for(const tag of article.querySelectorAll('.training-tag')){
   const text=tag.textContent.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u,'').trim();
   if(text!==tag.textContent.trim())tag.replaceChildren(icon(iconFor(text)),document.createTextNode(text));
  }
  let section=null;
  for(const node of [...article.childNodes]){
   if(node.nodeType===1&&node.classList.contains('detail-cover'))continue;
   if(node.nodeType===1&&node.classList.contains('detail-section-title')){
    const text=node.textContent.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u,'').trim();
    const type=iconFor(text);
    section=document.createElement('section');section.className='record-block record-block-'+type;
    if(/^疼痛(?:备注|说明)/.test(text))section.classList.add('record-block-pain-note');
    const title=document.createElement('h4');title.className='detail-section-title';
    const label=document.createElement('span');label.textContent=text;title.append(icon(type),label);
    node.replaceWith(section);section.append(title);
   }else if(section)section.append(node);
  }
  for(const paragraph of article.querySelectorAll('p')){
   if(paragraph.childNodes.length!==1||paragraph.firstChild.nodeType!==3||paragraph.textContent.length<200)continue;
   const text=paragraph.textContent;
   const sentences=text.match(/[^。！？]*[。！？]|[^。！？]+$/g)||[text];
   const chunks=[];let chunk='';
   for(const sentence of sentences){chunk+=sentence;if(chunk.length>=110){chunks.push(chunk);chunk=''}}
   if(chunk)chunks.push(chunk);
   if(chunks.length<2||chunks.join('')!==text)continue;
   paragraph.replaceChildren(...chunks.map(content=>{const span=document.createElement('span');span.className='record-prose-chunk';span.textContent=content;return span}));
  }
  article.querySelectorAll('.table-wrap').forEach(readableTable);
  article.classList.add('detail-readable');
 }
})();

/* 日期目录从当前页面已有详情生成；不创建或修改训练记录。 */
(()=>{
 'use strict';
 const list=document.getElementById('recordTimeline');
 if(!list)return;
 const articles=[...document.querySelectorAll('main article.detail[id]')]
  .filter(article=>/^detail-\d{4}-\d{2}-\d{2}$/.test(article.id))
  .sort((a,b)=>a.id.localeCompare(b.id));
 const links=new Map();
 const calendarLinks=new Map([...document.querySelectorAll('#calendar a[href^="#detail-"]')]
  .map(link=>[link.getAttribute('href').slice(1),link]));
 for(const article of articles){
  const date=article.id.slice(7);
  const heading=article.querySelector('h3');
  const title=(heading?heading.textContent:date).replace(/^\d{4}-\d{2}-\d{2}\s*[·・—-]?\s*/,'').trim();
  const record=typeof trainingDays!=='undefined'?trainingDays[date]:null;
  const link=document.createElement('a');
  link.className='timeline-date'+(record?.status==='readiness'?' readiness':'');
  link.href='#'+article.id;
  link.setAttribute('aria-label',date+' '+title);
  const day=document.createElement('span');
  day.className='timeline-day';
  day.textContent=date.slice(8);
  const copy=document.createElement('span');
  copy.className='timeline-copy';
  copy.append(document.createTextNode(title||'查看记录'));
  const caption=document.createElement('small');
  caption.textContent=date.slice(5).replace('-',' / ')+' · '+new Intl.DateTimeFormat('zh-CN',{weekday:'short'}).format(new Date(date+'T12:00:00'));
  copy.append(caption);
  link.append(day,copy);
  links.set(article.id,link);
  list.append(link);
 }
 const count=document.getElementById('timelineCount');
 if(count)count.textContent=articles.length+' 条记录';
 if(!articles.length){
  const empty=document.createElement('p');
  empty.className='timeline-empty';
  empty.textContent='本月还没有详情记录';
  list.append(empty);
  return;
 }
 let currentId='';
 let pending=false;
 function markCurrent(article){
  const nextId=article?article.id:'';
  if(currentId===nextId)return;
  currentId=nextId;
  for(const [id,link] of links){
   const active=id===currentId;
   link.classList.toggle('active',active);
   if(active)link.setAttribute('aria-current','date');else link.removeAttribute('aria-current');
   const calendarLink=calendarLinks.get(id);
   if(calendarLink)calendarLink.parentElement.classList.toggle('active',active);
  }
  // 仅滚动目录自身，避免浏览长记录时改变正文位置。
  const link=links.get(currentId);
  if(!link)return;
  const box=link.getBoundingClientRect(),frame=list.getBoundingClientRect();
  if(matchMedia('(min-width:1100px)').matches){
   if(box.top<frame.top+4)list.scrollTop+=box.top-frame.top-4;
   else if(box.bottom>frame.bottom-4)list.scrollTop+=box.bottom-frame.bottom+4;
  }else{
   if(box.left<frame.left+4)list.scrollLeft+=box.left-frame.left-4;
   else if(box.right>frame.right-4)list.scrollLeft+=box.right-frame.right+4;
  }
 }
 function updateCurrent(){
  const offset=matchMedia('(min-width:1100px)').matches?80:160;
  let current=null;
  for(const article of articles){
   if(article.getBoundingClientRect().top<=offset)current=article;
   else break;
  }
  // 月历上方不预选日期；进入详情后随滚动更新。
  markCurrent(current);
  pending=false;
 }
 function scheduleUpdate(){if(!pending){pending=true;requestAnimationFrame(updateCurrent)}}
 function selectHash(){
  const article=articles.find(item=>'#'+item.id===location.hash);
  if(article)markCurrent(article);
  else scheduleUpdate();
 }
 addEventListener('scroll',scheduleUpdate,{passive:true});
 addEventListener('resize',scheduleUpdate);
 addEventListener('hashchange',selectHash);
 addEventListener('load',()=>requestAnimationFrame(()=>{
  // 卡片展开会改变全文高度；等版面稳定后再定位外部日期链接。
  const article=articles.find(item=>'#'+item.id===location.hash);
  if(article)article.scrollIntoView({block:'start',behavior:'instant'});
  selectHash();
 }));
 selectHash();
})();
