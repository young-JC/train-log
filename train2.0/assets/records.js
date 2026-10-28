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
 addEventListener('load',selectHash);
 selectHash();
})();
