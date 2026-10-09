// 本文件由 train2.0/dashboard.html 拆分而来，属于**只读展示层**；正式训练事实源见 CLAUDE.md。
// 正式训练记录镜像（数据源：train2.0/records/YYYY-MM.md）。
const FORMAL_MONTH={year:2026,month:'10',days:31,startOffset:3};
const FORMAL_TODAY_READINESS={date:'2026-10-08',sleep:4,fatigue:1,soreness:1,pain:0,motivation:3,score:88,level:'绿色',painNote:'训练前 0/10；高杠后蹲整套动作双膝内侧疼痛 2/10，保加利亚单腿蹲时右膝内侧疼痛 2/10；训练后 0/10'};
const FORMAL_RECORDS={
 '2026-09-21':{status:'training',label:'训练 · Ready 92 · 700 AU',sessionLoad:700,readiness:{sleep:3,fatigue:1,soreness:1,pain:0,painNote:'训练前无疼痛；训练中膝盖左2/10、右3/10；训练后无疼痛',motivation:5,score:92,level:'绿色'}},
 '2026-09-22':{status:'readiness',label:'取消 · 加班',sessionLoad:0,readiness:{sleep:3,fatigue:2,soreness:2,pain:2,painNote:'左膝极轻微疼痛，静止和走路无感觉，热身后不出现；次日活动时轻微 2/10',motivation:3,score:72,level:'黄色'}},
 '2026-09-23':{status:'training',label:'训练 · Ready 94 · 840 AU',sessionLoad:840,readiness:{sleep:4,fatigue:1,soreness:1,pain:1,painNote:'训练前左膝轻微疼痛 1/10；弓步时左右膝轻微刺痛，重复欧洲步后左膝轻微刺痛；训练中最高及训练后均为 1/10',motivation:5,score:94,level:'绿色'}},
 '2026-09-26':{status:'training',label:'有氧 · Ready 82 · 90 AU',sessionLoad:90,readiness:{sleep:3,fatigue:1,soreness:1,pain:1,painNote:'训练前 0/10；训练中左膝内侧 2/10；训练后 0/10',motivation:3,score:82,level:'绿色'}},
 '2026-09-27':{status:'training',label:'居家训练 · Ready 100 · 90 AU',sessionLoad:90,readiness:{sleep:5,fatigue:1,soreness:1,pain:0,painNote:'训练前 0/10；站姿膝控开始时右膝内侧 1/10，随后逐渐缓解；训练后 0/10',motivation:5,score:100,level:'绿色'}},
 '2026-09-28':{status:'training',label:'训练 · Ready 88 · 553 AU',sessionLoad:553,readiness:{sleep:4,fatigue:1,soreness:2,pain:0,painNote:'训练前 0/10（双侧踝外侧轻微酸，非疼痛）；训练中右膝内侧 2/10（CMJ 落地不稳时）；训练后 0/10；次日 0/10',motivation:4,score:88,level:'绿色'}},
 '2026-09-29':{status:'training',label:'恢复 · Ready 80 · 130 AU',sessionLoad:130,maxPain:2,readiness:{sleep:4,fatigue:2,soreness:2,pain:0,painNote:'训练前 0/10；站姿膝控时右膝内侧偶尔 2/10；训练后 0/10',motivation:3,score:80,level:'绿色'}},
 '2026-09-30':{status:'training',label:'D2 部分 · Ready 96 · 469 AU',sessionLoad:469,maxPain:0,readiness:{sleep:4,fatigue:1,soreness:1,pain:0,painNote:'训练前、中、后均为 0/10，无疼痛',motivation:5,score:96,level:'绿色'}},
 '2026-10-01':{status:'training',label:'半场实战 · Ready 88 · 560 AU',sessionLoad:560,maxPain:1,readiness:{sleep:4,fatigue:1,soreness:1,pain:0,painNote:'训练前 0/10；训练中膝盖轻微疼痛 1/10，不影响运动（侧别未说明）；训练后 0/10',motivation:3,score:88,level:'绿色'}},
 '2026-10-04':{status:'training',label:'速度/减速 · Ready 88 · Load 未计算',sessionLoad:null,maxPain:2,readiness:{sleep:3,fatigue:1,soreness:1,pain:0,painNote:'训练前 0/10；训练中右膝内侧疼痛 2/10（触发动作未记录）；训练后 0/10',motivation:4,score:88,level:'绿色'}},
 '2026-10-06':{status:'training',label:'篮球训练 · Ready 92 · 300 AU',sessionLoad:300,maxPain:2,readiness:{sleep:4,fatigue:1,soreness:1,pain:0,painNote:'训练前 0/10；左侧突破时右腿蹬地发力触发右膝内侧疼痛 2/10；训练后 0/10',motivation:4,score:92,level:'绿色'}},
 '2026-10-08':{status:'training',label:'训练 · Ready 88 · 576 AU',sessionLoad:576,maxPain:2,readiness:{sleep:4,fatigue:1,soreness:1,pain:0,painNote:'训练前 0/10；高杠后蹲整套动作双膝内侧疼痛 2/10，保加利亚单腿蹲时右膝内侧疼痛 2/10；训练后 0/10',motivation:3,score:88,level:'绿色'}}
};
const FORMAL_REST_DAYS=[];
