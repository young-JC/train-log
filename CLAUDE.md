# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目性质与运行方式

这是一个个人篮球训练记录与管理仓库，不是需要编译的软件项目。Markdown 是人工维护的数据源，HTML 是无依赖的静态展示页；仓库没有包管理器、构建脚本、lint 配置或自动化测试套件。

直接在浏览器中预览：

```bash
explorer.exe "$(cygpath -w "$PWD/train1.0/dashboard.html")"
explorer.exe "$(cygpath -w "$PWD/train2.0/dashboard.html")"
```

因此不存在 build、lint、test 或“运行单个测试”的命令。修改后应在浏览器中分别检查相关 HTML 页面，并用 `git diff --check` 检查文本格式问题。

## 双系统架构

### `train1.0/`：训练记录系统

这是当前日常记录入口。数据流为：

`train1.0/records/YYYY-MM.md`（月度记录源）→ 同步更新月度 HTML、主索引和仪表盘。

| 文件 | 角色 |
|------|------|
| `train1.0/training-plans.md` | 周计划方案与动作库，提供推荐动作、组次和负荷依据 |
| `train1.0/training-prehab.md` | 膝部防伤体系；每次训练前 Level 2 必做 |
| `train1.0/records/YYYY-MM.md` | 月度日历和每日训练详情，是单次训练记录的主要数据源 |
| `train1.0/records/YYYY-MM.html` | 月度记录的静态页面；JS `trainingDays` 驱动日历，详情区块用日期 ID 定位 |
| `train1.0/training-log.md` | 跨月份汇总：训练概览、弱点追踪、进步追踪和阶段总结 |
| `train1.0/dashboard.html` | 1.0 总览；镜像当月统计、最近训练、弱点和进步数据，并链接月度 HTML |

一次训练记录必须同步修改以下 4 个文件，且数字、评分、备注、改进方向和总结完全一致：

1. `train1.0/records/YYYY-MM.md`
2. `train1.0/records/YYYY-MM.html`
3. `train1.0/training-log.md`
4. `train1.0/dashboard.html`

### `train2.0/`：周期化训练系统

这是独立的 12 周周期化体系，与 1.0 并存，不是 1.0 记录文件的派生层：

- `篮球运动训练理念.md` 定义能力模型与动作选择原则。
- `训练周期安排建议.md` 定义大周期、中周期、周微周期和每日训练之间的层级。
- `12周计划安排.md` 提供 A 版 3 日与 B 版 4–5 日计划，每 4 周按进入、增量、高刺激、Deload+测试推进。
- `篮球运动员版动作库 2.0.md` 是面向篮球专项能力的扩展动作库。
- `dashboard.html` 是交互式单页应用；Readiness、今日训练、Session Load 和学习打卡写入浏览器 `localStorage`，键统一以 `athlete_` 开头，不会回写 Markdown。

除非用户明确要求迁移或同步，不要把 1.0 的文件数据自动写入 2.0，也不要把 2.0 浏览器数据视为仓库数据。

## 训练记录工作流

`.claude/skills/record-training/skill.md` 是完整 SOP。该技能文档中的 `records/`、`training-log.md`、`training-plans.md` 和 `dashboard.html` 均应解释为相对于 `train1.0/` 的路径。

关键约束：

1. 只记录用户明确提供的数据。不得补写次数、负重、评分、疼痛、身体感受或动作表现；缺失信息一次最多询问 2–3 项，用户记不清时跳过。
2. 先确认日期，再更新月度 Markdown、月度 HTML、主索引和 1.0 仪表盘；保留所有历史记录。
3. 休息日可以进入 HTML 的 `trainingDays` 以显示备注，但必须同时加入 `REST_DAYS`，使用 `.calendar-day.rest`，不可点击且不能使用训练日高亮。
4. 月度页详情 ID 使用 `detail-YYYY-MM-DD`；日历链接必须动态按日期拼接，不能硬编码到某一天。
5. HTML 中新增训练详情应插入 `<footer class="footer">` 前；编辑中文或 emoji 内容时优先用纯 ASCII 结构作为定位锚点。
6. 下次训练推荐必须同时读取 `train1.0/training-plans.md`、最近 3 周月度记录和 `train1.0/training-log.md` 的弱点追踪。动作与重量必须有计划或历史数据依据；未练过的动作标注“新动作，从轻重量开始试”。

## 训练领域约定

- 训练日顺序：热身（5–10 分钟，含 Level 2 防伤）→ 爆发/速度 → 主项力量 → 辅助 → 核心 → 拉伸。
- 爆发力和速度敏捷始终优先；同一肌群的大重量训练间隔至少 48 小时。
- 板块图标：🏋️ 力量、⚡ 爆发力、🏃 速度敏捷、🔄 体能、🏀 篮球技巧、🧘 休息/停训。
- 评分范围为 1–10；HTML 评分圈配色为 7–10 green、5–6 yellow、1–4 red。
- 1.0 仪表盘进度条配色：力量 accent、核心 purple、篮球技巧 purple、爆发力 yellow、体能 green。
- 单次渐进只选择加重、加次、加组或控速中的一种；同一动作保持 6–8 次训练后再进阶。

## 验证与 Git

修改训练记录后至少核对：月度 Markdown 与 HTML 的详情一致；两个日历链接到正确日期；`training-log.md` 与 1.0 仪表盘中的统计、弱点和进步一致；休息日与训练日视觉状态正确。2.0 仪表盘改动还需验证刷新后的 `localStorage` 持久化及清空数据功能。

提交信息使用中文说明和 conventional 前缀，例如 `feat(records):`、`feat(training):`。仓库路径包含中文，文件工具始终使用完整绝对 Windows 路径，如 `D:\个人文件\train-log\train1.0\dashboard.html`。
