# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目性质

这是一个**个人篮球训练记录与管理系统**（非软件项目），以 Markdown 文档为数据源、HTML 静态页面为展示层。没有构建工具、测试套件或包管理器——HTML 文件直接在浏览器打开即可预览。

## 文档架构（双系统并存）

### 1.0 系统（记录体系，根目录）

数据流：`records/YYYY-MM.md`（记录源）→ 同步派生 `records/YYYY-MM.html`、`training-log.md`、`dashboard.html`。

| 文件 | 角色 |
|------|------|
| `training-plans.md` | 训练计划框架 + 完整动作库（方案A：3练/周，方案B：4练/周；动作分板块，标注难度⭐与进退阶） |
| `training-prehab.md` | 膝部防伤体系（Level 1 每日激活 / Level 2 训前准备 / Level 3 力量巩固）——每次训练前 Level 2 必做 |
| `training-log.md` | 主索引：训练概览、核心板块、**弱点追踪**、进步追踪、阶段总结 |
| `records/YYYY-MM.md` | 月度记录：训练日历（按周表格）+ 每日训练详情（四阶段：准备/激活/训练/核心） |
| `records/YYYY-MM.html` | 月度记录的 HTML 版，JS `trainingDays` 对象驱动日历渲染 |
| `dashboard.html` | 总览仪表盘：统计卡片、当月日历（链接到 `records/YYYY-MM.html#detail-...`）、弱点/进步追踪镜像 |

**同步规则**：以上 5 个文件中任何训练数据必须完全一致（数字、评分、备注、改进方向、总结）。改记录时按 `.claude/skills/record-training/skill.md` 的流程同步更新全部文件。

### 2.0 系统（周期化训练体系，`train2.0/`）

独立的周期化系统，当前处于搭建阶段（新文件，部分未提交）。与 1.0 并存，1.0 仍是日常记录入口。

| 文件 | 角色 |
|------|------|
| `篮球运动训练理念.md` | 能力模型：从"练肌肉"转向"练篮球运动能力"的选材逻辑 |
| `训练周期安排建议.md` | 系统层级：能力评估 → 12周大周期 → 4周中周期 → 周微周期 → 每日训练 → 数据记录 |
| `12周计划安排.md` | 落地方案：A版 3日 / B版 4-5日；每 4 周一个中周期（进入→增量→高刺激→Deload+测试） |
| `篮球运动员版动作库 2.0.md` | 扩展动作库（增加减速、落地、单腿、腘绳肌、内收肌等模块） |
| `dashboard.html` | 交互式仪表盘（**localStorage 持久化**，键前缀 `athlete_`）：Readiness 自评、今日训练、负荷监控（Session Load = 时长 × RPE）、学习打卡——数据仅存浏览器，不写入文件 |

## 核心技能：record-training

`.claude/skills/record-training/skill.md` 是训练记录的完整 SOP（含初始化模板）。触发词：`记录训练`、`训练记录`、`今天练了` 等。关键纪律：

1. **禁止编造数据**——用户没说的次数/负重/评分/身体感受一律不写；缺失信息最多一次问 2-3 个引导问题，用户说"记不清"就跳过。
2. **只改这 4 个文件**：`records/YYYY-MM.md`、`records/YYYY-MM.html`、`training-log.md`、`dashboard.html`。
3. **HTML 编辑技巧**：emoji/中文在 Edit 工具中易编码匹配失败，优先用纯 ASCII 锚点（如 `<section class="section" id="detail-`）；新增训练详情 section 时插入到 `<footer class="footer">` 之前。
4. **休息日渲染规则**（HTML 日历）：休息日也进 `trainingDays` 以显示备注（如"血小板偏低"），但用 `REST_DAYS` 数组 + `.calendar-day.rest` 灰色样式渲染，不可点击、不用 `trained` 高亮——训练日才是视觉焦点。
5. **日历链接**：检查 `buildCalendar()` 内 `link.href` 是否硬编码单一日期，若是则改为动态拼接 `#detail-YYYY-MM-' + pad(d)`（每文件只需修一次）。
6. **下次训练推荐**必须三方数据源齐全：`training-plans.md`（周计划模板）、`records/` 最近 3 周详情、`training-log.md` 弱点追踪。推荐的动作/重量必须来自计划文档，新动作须标注"新动作，从轻重量开始试"。

## 训练领域约定

- 训练日结构固定：热身（5-10min 含 Level 2 防伤）→ 爆发/速度 → 主项力量 → 辅助 → 核心 → 拉伸
- 排序原则：爆发力/速度敏捷永远最优先（神经兴奋度）；同一肌群大重量训练间隔 ≥48h
- 板块图标：🏋️ 力量、⚡ 爆发力、🏃 速度敏捷、🔄 体能、🏀 篮球技巧、🧘 休息/停训
- 评分均为 1-10；HTML 中评分圈配色：7-10 green、5-6 yellow、1-4 red
- 进度条配色（dashboard）：力量→accent、核心→purple、篮球技巧→purple、爆发力→yellow、体能→green
- 渐进方式（每次只选一种）：加重 → 加次 → 加组 → 控速；同一动作保持 6-8 次训练再进阶

## Git 工作流

提交信息用中文 + conventional 前缀（如 `feat(records):`、`feat(training):`）。仓库根路径含中文（`D:\个人文档`），文件路径请用完整绝对 Windows 路径。
