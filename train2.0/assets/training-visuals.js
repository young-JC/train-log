/* 只按已有标题识别封面主题，不生成训练安排或完成状态。 */
window.TrainingVisuals=(()=>{
 const base=new URL('.',document.currentScript.src);
 const themes={
  strength:{label:'力量与爆发',caption:'STRENGTH DAY',file:'training-strength.svg'},
  upper:{label:'传力与核心',caption:'BUILD & CONNECT',file:'training-upper.svg'},
  speed:{label:'速度与敏捷',caption:'MOVE WITH INTENT',file:'training-speed.svg'},
  basketball:{label:'篮球训练',caption:'ON THE COURT',file:'records-court.svg'},
  aerobic:{label:'有氧训练',caption:'FIND YOUR RHYTHM',file:'training-aerobic.svg'},
  recovery:{label:'恢复与舒展',caption:'ROOM TO RECOVER',file:'training-recovery.svg'},
  assessment:{label:'能力测试',caption:'SMALL WINS',file:'training-assessment.svg'},
  general:{label:'今日训练',caption:'ONE SESSION AT A TIME',file:'training-strength.svg'}
 };
 function identify(title){
  const text=String(title||'');
  if(/自测|能力测试|仅测试/.test(text))return 'assessment';
  if(/主动恢复|居家恢复|居家控制|恢复日|恢复课|休息|停训|取消/.test(text))return 'recovery';
  if(/\bD3\b|速度|敏捷|减速|横向移动/.test(text))return 'speed';
  if(/\bD2\b|上肢/.test(text))return 'upper';
  if(/\bD1\b|下肢|力量|负重爆发/.test(text))return 'strength';
  if(/有氧|体能|Zone\s*2/i.test(text))return 'aerobic';
  if(/篮球|实战|投篮|运球/.test(text))return 'basketball';
  if(/恢复|拉伸|呼吸/.test(text))return 'recovery';
  return 'general';
 }
 function get(title){const key=identify(title);return {key,...themes[key],src:new URL(themes[key].file,base).href}}
 function renderRecommendation(meta){
  const cover=document.querySelector('.rec-overview');
  if(!cover)return;
  const theme=get(meta?[meta.day,meta.focus].filter(Boolean).join(' '):'');
  cover.dataset.trainingVisual=theme.key;
  document.getElementById('recArtwork').src=theme.src;
  document.getElementById('recArtworkCaption').textContent=theme.caption;
  document.getElementById('recArtworkLabel').textContent=theme.label;
  document.getElementById('recCoverArt').hidden=!meta;
 }
 return {get,renderRecommendation};
})();
