// 本文件由 train2.0/dashboard.html 拆分而来，属于**只读展示层**；正式训练事实源见 CLAUDE.md。
// 逐日推荐数据的汇总层：把各月度文件合并为 renderToday() 使用的全局量。
// 新增月份：新建 assets/data/recommend-YYYY-MM.js，并在 RECOMMEND_FILES 末尾登记。

const RECOMMEND_FILES=[RECOMMEND_2026_09,RECOMMEND_2026_10];
const TODAY_META=Object.assign({},...RECOMMEND_FILES.map(f=>f.meta));
const TODAY_RECOMMENDATION=Object.assign({},...RECOMMEND_FILES.map(f=>f.plans));
const TODAY_REASON=Object.assign({},...RECOMMEND_FILES.map(f=>f.reason));
const TODAY_SKILLS=Object.assign({},...RECOMMEND_FILES.map(f=>f.skills));
