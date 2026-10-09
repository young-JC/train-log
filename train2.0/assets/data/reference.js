// 本文件由 train2.0/dashboard.html 拆分而来，属于**只读展示层**；正式训练事实源见 CLAUDE.md。
// 参考数据：周期阶段、3/4/5 日版默认计划、能力评估镜像、弱点镜像。
const WEEK_PHASES={1:{phase:1,name:'基础重建',desc:'技术、稳定、基础力量、低冲击爆发',type:'p1',focus:['Prehab','Landing','基础力量','单腿'],rpe:'6'},2:{phase:1,name:'基础重建',desc:'增加训练容量，同时保持动作质量',type:'p1',focus:['基础力量','单腿','低量Plyo'],rpe:'6-7'},3:{phase:1,name:'基础重建',desc:'第一阶段高刺激周',type:'p1',focus:['力量','爆发','基础COD'],rpe:'7-8'},4:{phase:1,name:'Deload + 测试',desc:'训练量下降30–40%，完成第一次复测',type:'p1',focus:['恢复','复测'],rpe:'5-6'},5:{phase:2,name:'力量→爆发',desc:'最大力量、单腿力量与力量转化',type:'p2',focus:['最大力量','单腿','Plyo'],rpe:'7'},6:{phase:2,name:'力量→爆发',desc:'提高力量和水平/横向爆发',type:'p2',focus:['Strength','Sprint','Plyo'],rpe:'7-8'},7:{phase:2,name:'力量→爆发',desc:'第二阶段最高刺激周',type:'p2',focus:['力量','Reactive','COD'],rpe:'8'},8:{phase:2,name:'Deload + 测试',desc:'降低训练量，复测力量、跳跃、速度、COD',type:'p2',focus:['恢复','复测'],rpe:'5-6'},9:{phase:3,name:'专项表现',desc:'加速、减速、变向进入主导位置',type:'p3',focus:['Acceleration','Decel','COD'],rpe:'7'},10:{phase:3,name:'专项表现',desc:'增加反应和篮球专项变向',type:'p3',focus:['Decel','Reactive','Closeout'],rpe:'7-8'},11:{phase:3,name:'专项表现',desc:'最高专项刺激，力量保持、篮球体能上升',type:'p3',focus:['Reaction','Basketball','Game Conditioning'],rpe:'8'},12:{phase:3,name:'Taper + 总测试',desc:'训练量下降40–50%，保持速度/力量/爆发',type:'p3',focus:['Taper','Final Test'],rpe:'5-6'}};


const PLAN3={
 1:[
  ['动态热身','轻松慢跑/原地小步跑（Easy Jog / March in Place）→ 踝关节环绕（Ankle Circles）→ 动态踝背屈（Dynamic Ankle Dorsiflexion）→ 前后摆腿（Front-to-Back Leg Swing）→ 腘绳肌扫地步（Hamstring Sweep）→ 世界最伟大拉伸（World’s Greatest Stretch）','90秒；6圈/方向/侧；8次/侧；8次/侧；6步/侧；4次/侧；合计5–8分钟'],
  ['Level 2 防伤','弹力带侧走 + 站姿膝控','约5分钟'],
  ['落地','快速下落定住（Snap Down）','2×5'],
  ['爆发','反向动作纵跳（CMJ）','3×3'],
  ['主项力量','六角杠硬拉（Trap Bar Deadlift）','3×6 · RPE 6'],
  ['单腿力量','保加利亚分腿蹲','3×8/侧 · RPE 6'],
  ['后链','罗马尼亚硬拉（RDL）','2×8 · RPE 6'],
  ['小腿','双腿提踵','3×12'],
  ['核心','死虫式（Dead Bug）','3×8/侧'],
  ['训练后整理与拉伸','轻松步行（Easy Walk）2分钟 → 站姿腓肠肌拉伸（Standing Gastrocnemius Stretch）+ 半跪姿髋屈肌拉伸（Half-Kneeling Hip Flexor Stretch）+ 仰卧腘绳肌拉伸（Supine Hamstring Stretch）','各30秒/侧']
 ],
 2:[
  ['动态热身','轻松慢跑/原地小步跑（Easy Jog / March in Place）→ 胸椎旋转（Thoracic Rotation）→ 手臂环绕（Arm Circles）→ 弹力带拉开（Band Pull-Apart）→ 手腕环绕（Wrist Circles）','90秒；6次/侧；10次/方向；1×10；10圈/方向；合计5–7分钟'],
  ['Upper','MB Chest Pass + DB Bench + Pull-up',3],
  ['Core','Side Plank / Pallof',2],
  ['Basketball','投篮 + 运球 + 终结',45],
  ['训练后整理与拉伸','轻松步行（Easy Walk）1–2分钟 → 门框胸肌拉伸（Doorway Pectoral Stretch）+ 儿童式背阔肌拉伸（Child’s Pose Lat Stretch）+ 横臂肩后侧拉伸（Cross-Body Posterior Shoulder Stretch）+ 前臂屈伸肌拉伸（Forearm Flexor / Extensor Stretch）','各20–30秒/侧']
 ],
 3:[
  ['动态热身','轻松慢跑（Easy Jog）→ 踝关节环绕（Ankle Circles）→ 前后摆腿（Front-to-Back Leg Swing）+ 侧向摆腿（Lateral Leg Swing）→ A式小步跳（A-Skip）→ 渐进加速跑（Build-Up Run）','2分钟；8圈/方向/侧；各10次/侧；2×10米；3×15米（50%→80%）；合计7–10分钟'],
  ['Prehab','侧走 + 踝背屈',3],
  ['Elastic','Pogo',2],
  ['Speed','10m Sprint',4],
  ['Decel','Sprint→Stop',4],
  ['COD','5-10-5',3],
  ['Basketball','反应 + 防守 + 实战',45],
  ['训练后整理与拉伸','轻松步行（Easy Walk）2分钟 → 站姿腓肠肌拉伸（Standing Gastrocnemius Stretch）+ 半跪姿髋屈肌拉伸（Half-Kneeling Hip Flexor Stretch）+ 4字臀肌拉伸（Figure-Four Glute Stretch）+ 半跪姿内收肌拉伸（Half-Kneeling Adductor Stretch）','各30秒/侧']
 ]
};
const PLAN4={
 1:[
  ['动态热身','轻松慢跑/原地小步跑（Easy Jog / March in Place）→ 踝关节环绕（Ankle Circles）→ 动态踝背屈（Dynamic Ankle Dorsiflexion）→ 前后摆腿（Front-to-Back Leg Swing）→ 腘绳肌扫地步（Hamstring Sweep）→ 世界最伟大拉伸（World’s Greatest Stretch）','90秒；6圈/方向/侧；8次/侧；8次/侧；6步/侧；4次/侧；合计5–8分钟'],
  ['Prehab','L2防伤',3],
  ['Landing','Drop Landing',2],
  ['Power','CMJ / Box Jump',3],
  ['Strength','Trap Bar + Bulgarian + RDL',3],
  ['Core','Pallof',2],
  ['训练后整理与拉伸','轻松步行（Easy Walk）2分钟 → 站姿腓肠肌拉伸（Standing Gastrocnemius Stretch）+ 半跪姿髋屈肌拉伸（Half-Kneeling Hip Flexor Stretch）+ 仰卧腘绳肌拉伸（Supine Hamstring Stretch）','各30秒/侧']
 ],
 2:[
  ['动态热身','轻松慢跑/原地小步跑（Easy Jog / March in Place）→ 胸椎旋转（Thoracic Rotation）→ 手臂环绕（Arm Circles）→ 弹力带拉开（Band Pull-Apart）→ 手腕环绕（Wrist Circles）','90秒；6次/侧；10次/方向；1×10；10圈/方向；合计5–7分钟'],
  ['Upper Power','MB Chest Pass',3],
  ['Upper','DB Bench + Pull-up + Row + Shoulder',3],
  ['Basketball','投篮 + 运球 + 终结',50],
  ['训练后整理与拉伸','轻松步行（Easy Walk）1–2分钟 → 门框胸肌拉伸（Doorway Pectoral Stretch）+ 儿童式背阔肌拉伸（Child’s Pose Lat Stretch）+ 横臂肩后侧拉伸（Cross-Body Posterior Shoulder Stretch）+ 前臂屈伸肌拉伸（Forearm Flexor / Extensor Stretch）','各20–30秒/侧']
 ],
 3:[
  ['动态热身','轻松慢跑（Easy Jog）→ 踝关节环绕（Ankle Circles）→ 前后摆腿（Front-to-Back Leg Swing）+ 侧向摆腿（Lateral Leg Swing）→ A式小步跳（A-Skip）→ 渐进加速跑（Build-Up Run）','2分钟；8圈/方向/侧；各10次/侧；2×10米；3×15米（50%→80%）；合计7–10分钟'],
  ['Prehab','侧走 + 踝背屈',3],
  ['Elastic','Pogo',2],
  ['Speed','10m + 20m Sprint',4],
  ['Decel/COD','Sprint→Stop + 45° Cut + 5-10-5',4],
  ['Reaction','视觉/口令反应',3],
  ['训练后整理与拉伸','轻松步行（Easy Walk）2分钟 → 站姿腓肠肌拉伸（Standing Gastrocnemius Stretch）+ 半跪姿髋屈肌拉伸（Half-Kneeling Hip Flexor Stretch）+ 4字臀肌拉伸（Figure-Four Glute Stretch）+ 半跪姿内收肌拉伸（Half-Kneeling Adductor Stretch）','各30秒/侧']
 ],
 4:[
  ['动态热身','轻松慢跑（Easy Jog）→ 踝关节环绕（Ankle Circles）→ 侧向摆腿（Lateral Leg Swing）→ 行进弓步加胸椎旋转（Walking Lunge with Thoracic Rotation）','2分钟；8圈/方向/侧；10次/侧；4步/侧；合计5–7分钟'],
  ['Lateral Power','Lateral Bound + Broad Jump',3],
  ['Strength','Hip Thrust + Reverse Lunge + Single-leg RDL',3],
  ['Prehab','Copenhagen + Soleus',2],
  ['Conditioning','Repeat Sprint / 全场折返',15],
  ['训练后整理与拉伸','轻松步行（Easy Walk）2分钟 → 屈膝比目鱼肌拉伸（Bent-Knee Soleus Stretch）+ 站姿股四头肌拉伸（Standing Quadriceps Stretch）+ 4字臀肌拉伸（Figure-Four Glute Stretch）+ 半跪姿内收肌拉伸（Half-Kneeling Adductor Stretch）','各30秒/侧']
 ]
};
const ABILITY_ASSESSMENTS=[
 {category:'力量',action:'六角杠铃深蹲',metric:'同动作标准下的负重表现',best:'单侧 35kg · 3×7 · RPE 6',comparison:'负荷和完成量均不下降且至少一项提高；负荷与完成量相同时 RPE 更低',firstDate:'2026-09-21',bestDate:'2026-09-28',updatedAt:'2026-09-28',source:'records/2026-09.html#detail-2026-09-28'},
 {category:'力量',action:'高杠后蹲',metric:'同动作标准下的负重表现',best:'30kg · 4×5 · RPE 7–8',comparison:'负荷和完成量均不下降且至少一项提高；负荷与完成量相同时 RPE 更低',firstDate:'2026-10-08',bestDate:'2026-10-08',updatedAt:'2026-10-08',source:'records/2026-10.html#detail-2026-10-08'},
 {category:'单腿力量',action:'保加利亚单腿蹲',metric:'同动作标准下的负重表现',best:'单侧哑铃 14kg · 3×8 · RPE 7（左腿 8）',comparison:'负荷和完成量均不下降且至少一项提高；负荷与完成量相同时双侧 RPE 均不升高且至少一侧更低',firstDate:'2026-09-21',bestDate:'2026-09-28',updatedAt:'2026-09-28',source:'records/2026-09.html#detail-2026-09-28'},
 {category:'后链力量',action:'RDL',metric:'同动作标准下的负重表现',best:'单侧哑铃 20kg · 3×8 · RPE 5',comparison:'负荷和完成量均不下降且至少一项提高；负荷与完成量相同时 RPE 更低',firstDate:'2026-09-21',bestDate:'2026-10-08',updatedAt:'2026-10-08',source:'records/2026-10.html#detail-2026-10-08'},
 {category:'全身力量传递',action:'弓步单臂哑铃推举',metric:'同动作标准下的负重表现',best:'单侧 14kg · 3×6/侧 · RPE 5',comparison:'负荷和完成量均不下降且至少一项提高；负荷与完成量相同时 RPE 更低',firstDate:'2026-09-23',bestDate:'2026-09-23',updatedAt:'2026-09-23',source:'records/2026-09.html#detail-2026-09-23'},
 {category:'上肢推力',action:'哑铃卧推',metric:'同动作标准下的负重表现',best:'单侧 20kg · 3×12 · RPE 5',comparison:'负荷和完成量均不下降且至少一项提高；负荷与完成量相同时 RPE 更低',firstDate:'2026-09-23',bestDate:'2026-09-23',updatedAt:'2026-09-23',source:'records/2026-09.html#detail-2026-09-23'},
 {category:'上肢拉力',action:'引体向上',metric:'自重完成量',best:'自重 · 3×6',comparison:'仅比较自重引体向上；总完成次数更高且组数不下降为更好',firstDate:'2026-09-23',bestDate:'2026-09-23',updatedAt:'2026-09-23',source:'records/2026-09.html#detail-2026-09-23'},
 {category:'上肢拉力',action:'单臂俯身哑铃划船',metric:'同动作标准下的负重表现',best:'18kg · 3×10/侧 · RPE 右 5、左 6（左侧最后一组约 9）',comparison:'负荷和完成量均不下降且至少一项提高；负荷与完成量相同时双侧 RPE 均不升高且至少一侧更低',firstDate:'2026-09-23',bestDate:'2026-09-23',updatedAt:'2026-09-23',source:'records/2026-09.html#detail-2026-09-23'},
 {category:'肩部健康',action:'面拉',metric:'同动作标准下的负重表现',best:'42.2kg · 2×15 · RPE 5',comparison:'使用同一器械与设定；负荷和完成量均不下降且至少一项提高，或完全相同时 RPE 更低',firstDate:'2026-09-23',bestDate:'2026-09-23',updatedAt:'2026-09-23',source:'records/2026-09.html#detail-2026-09-23'},
 {category:'核心稳定',action:'侧桥',metric:'自重保持时间',best:'2×30秒/侧 · 比较轻松',comparison:'仅比较同为自重、双侧相同组数的侧桥；保持时间更长且主观难度不增加为更好',firstDate:'2026-09-23',bestDate:'2026-09-23',updatedAt:'2026-09-23',source:'records/2026-09.html#detail-2026-09-23'},
 {category:'篮球技巧',action:'中投',metric:'固定时长命中数',best:'10 分钟命中 53 个',comparison:'仅与同为认真完成的 10 分钟中投比较，命中数更高为更好',firstDate:'2026-09-23',bestDate:'2026-09-23',updatedAt:'2026-09-23',source:'records/2026-09.html#detail-2026-09-23'},
 {category:'内收肌/侧向核心',action:'长杠杆哥本哈根侧桥',metric:'单侧保持时间与主观用力程度',best:'3×25秒/侧 · RPE 5 · 组间休息 1 分钟',comparison:'仅比较相同长杠杆动作标准与组间休息；组数不下降、单侧保持时间更长且 RPE 不升高为更好，或组次与时长相同时 RPE 更低',firstDate:'2026-09-27',bestDate:'2026-09-27',updatedAt:'2026-09-27',source:'records/2026-09.html#detail-2026-09-27'},
 {category:'核心稳定',action:'帕洛夫抗旋推',metric:'同动作标准下的负重表现',best:'绳索 30kg · 3×10/侧 · RPE 2',comparison:'使用同一器械与设定（绳索）；负荷和完成量均不下降且至少一项提高，或完全相同时 RPE 更低',firstDate:'2026-09-28',bestDate:'2026-09-28',updatedAt:'2026-09-28',source:'records/2026-09.html#detail-2026-09-28'},
 {category:'内收肌/侧向核心',action:'短杠杆哥本哈根侧桥',metric:'自重单侧保持时间',best:'2×15秒/侧',comparison:'仅比较相同短杠杆动作标准与自重条件；组数不下降且单侧保持时间更长为更好',firstDate:'2026-10-04',bestDate:'2026-10-04',updatedAt:'2026-10-04',source:'records/2026-10.html#detail-2026-10-04'}
];
const WEAKNESSES=[
 ['反手篮下终结不稳定','篮球技巧','2026-09-10','待改善','左侧反手上篮稳定命中','定点反手打板练习；09-11 全场终结选择仍不佳'],
 ['弱侧手运球衔接差','篮球技巧','2026-09-10','待改善','右手→左手变向流畅','体前/胯下/背后左手主导练习'],
 ['三步上篮步幅小/起跳无力','篮球技巧','2026-09-10','待改善','大步幅三步上篮顺畅有力','可能与单腿爆发力相关；09-11 体能下降时上篮成功率明显下滑'],
 ['转身技巧缺失','篮球技巧','2026-09-10','待改善','实战中能自然运用转身','从基础转身运球开始'],
 ['左侧核心稳定弱于右侧','核心','2026-09-10','待改善','双侧核心稳定对称','侧支撑/鸟狗式等单侧核心训练'],
 ['体能不足影响全场持续输出','体能','2026-09-11','待改善','全场三节不降速，投篮上篮稳定性保持','间歇跑/折返跑每周至少1次'],
 ['快攻对抗时机把握不准','篮球技巧','2026-09-11','待改善','快攻中准确判断对抗节点','快攻1v1/2v1练习'],
 ['突破禁区终结选择差','篮球技巧','2026-09-11','待改善','根据防守做出正确终结决策','慢下来观察/分球中投/假动作后终结'],
 ['左侧踝背屈活动度不足、前移伴膝内扣','活动度/膝控制','2026-09-21','待改善','左右踝背屈差异缩小，前移时膝盖保持对准脚尖','09-21 踝背屈热身时左脚活动度明显不如右脚，用力向前伴随膝盖内扣'],
 ['左侧上肢拉力弱于右侧','上肢力量','2026-09-23','待改善','同负荷划船时双侧主观用力程度接近','09-23 单臂俯身哑铃划船 18kg 3×10：右侧 RPE 5、左侧 RPE 6，左侧最后一组约 RPE 9'],
 ['CMJ 起跳后身体倾斜、落地不稳','落地控制','2026-09-28','待改善','起跳后身体保持稳定，落地平稳无晃动且无右膝内侧不适','09-28 不摆臂 CMJ 3×3：跳起后空中身体倾斜导致落地不稳，后段明显改善；不稳落地时右膝内侧 2/10，平稳落地无疼痛'],
 ['左侧单腿力量弱于右侧','单腿力量','2026-09-28','待改善','同负荷保加利亚单腿蹲时双侧 RPE 接近','09-28 保加利亚单腿蹲 单侧14kg 3×8：左腿 RPE 8、右腿 RPE 7；10-08 单侧12kg：左 RPE 7、右 RPE 6，左侧主观用力持续高于右侧']
];
