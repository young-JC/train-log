---
name: update-athlete-profile
description: 根据用户明确输入建立或更新 train2.0 个人训练档案、身体测量历史及 Dashboard 镜像；用于个人资料、目标、训练条件、长期限制的维护和测量纠错，不记录实际训练或生成训练推荐。
---

# 维护个人训练档案

项目根目录下的事实源与规则：

- `train2.0/athlete-profile.md`：基础资料、目标、条件、长期限制与重要变更。
- `train2.0/body-metrics.md`：测量历史与纠错，完整维护规则在该文件中。
- `train2.0/assets/data/athlete.js`：上述文件的只读镜像，唯一全局对象 `ATHLETE_DATA`。

先读这三个文件。不读取 archive、1.0 或 localStorage，不从正式训练中的单次疼痛推断长期伤病。所有字段可缺失，只保存用户明确提供的事实，不把对话示例或计划目标写成测量结果。

## 解析与更新

1. 区分基础资料、目标、日常训练条件、明确长期限制和新测量。用户说“今天只有 30 分钟”属于临时条件，除非明确要求修改日常档案，否则不持久化。
2. 相对日期按用户时区转换为绝对日期（本项目默认 Asia/Shanghai）。年龄没有出生日期时同时记录年龄与对应日期，不推算出生日期；训练经历原样保留适用日期，不自动累加年限。
3. 只补问影响这次保存的歧义，一次最多 2–3 项。测量日期、单位、纠错对象不清楚时先澄清；其余缺失可以保留未记录。不要求完整填写档案。目标排序由用户决定，只有一个目标时可作为主目标。
4. 新测量、同次补充、重复提交、同日多次、历史补录与纠错按 `body-metrics.md` 规则处理。纠错保留 ID 和原值审计；更新后的历史按测量日期、时间、ID 排序。未注明时间的同日多条记录不能宣称知道实际先后。
5. 先改涉及的 Markdown，再同步完整 `ATHLETE_DATA`。未涉及的资料或指标不改写；只补测量不刷新档案更新时间。实质档案变化记入重要变更；重复输入不新增记录、不刷新更新时间。
6. 运行 `python tools/verify_athlete_profile.py` 和 `node --check train2.0/assets/data/athlete.js`，再运行 `git diff --check`。核对日期、来源、数值、方法、历史条数与纠错记录一致。失败时修正同步问题后再报告完成。

维护只修改涉及的两个事实源与 `athlete.js`。不要修改训练记录、能力成绩、弱点或过往推荐。不编辑 Dashboard 外壳，不需要服务器、fetch、网页输入或 localStorage。

## 镜像格式

保留现有 `ATHLETE_DATA` 结构；所有未记录标量为 `null`，列表为 `[]`，日期 `YYYY-MM-DD`，时间 `HH:mm`。下面只定义对象字段，不是用户数据：

- `profile.updatedAt`：档案实质变化日期。
- `profile.basic`：`birthDate`、`ageYears`（整数）、`ageAsOf`、`sex`、`strengthExperience`、`basketballExperience`、`dominantHand`、`basketballPosition`。身高仅存测量历史，面板派生最新值。
- `profile.goals[]`：`{priority, title, target, targetDate, updatedAt}`。priority 从 1 连续排序；target 为包含单位的目标文本或 null。
- `profile.conditions`：`weeklyDays`（固定天数用 0–7 整数；范围用「3–4」格式文本，两端均为 0–7 整数且下限不大于上限，不擅自取单一值）、`sessionMinutes`（正数）、`basketballSchedule`、`equipment`、`venues`（后三项为文本）。
- `profile.restrictions[]`：`{description, source, updatedAt}`，来源必须是用户明确说明，不能把“未记录”解释为“无限制”。
- `profile.changes[]`：`{date, detail, source}`，与 Markdown 重要变更逐行一致。
- `metricsUpdatedAt`：测量记录最近一次维护日期，无记录时 null。
- `measurements[]`：`{id, date, time, heightCm, weightKg, bodyFatPct, waistCm, methods, note, source, updatedAt}`。四个指标为数字或 null；`methods` 对象使用相同四个键，值为每项测量的方法/设备文本或 null。备注和来源为文本，来源可写“用户对话（日期）”；不要编造对话 ID 或医疗来源。
- `corrections[]`：`{date, recordId, field, previous, value, reason}`。previous、value 用文本保存旧值与修正值，reason 包含原因和来源。

Markdown 表格的缺失值写“未记录”，不新增占位数据行；文本中的竖线转义为 `\|`。不要使用 `undefined`、NaN 或任意计算填充原始值；保留 JS 数字类型，不加单位字符串。

## 数据的使用边界

身体指标按各自日期取分析日之前的最新有效值，补录旧数据不得覆盖更晚测量。不同方法、设备或条件的体脂数据不直接比较；方法不明不生成改善结论。单纯变轻或体脂下降不等于能力提升。不从身高体重计算训练重量、动作等级、诊断或能力成绩。

完成后简要说明更新了哪些项目、采用的日期，以及仍有歧义的未保存项。可以提示刷新 Dashboard 查看；不用反复索取完整档案。
