# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目性质与运行方式

这是一个个人篮球训练记录与管理仓库，不是需要编译的软件项目。Markdown 是人工维护的数据源，HTML 是无依赖的静态展示页（`file://` 直接打开即可，不需要服务器）；仓库没有包管理器、构建脚本、lint 配置或自动化测试套件。`tools/` 下只有一次性拆分与校验脚本，不属于运行时依赖。

直接在浏览器中预览：

```bash
explorer.exe "$(cygpath -w "$PWD/train1.0/dashboard.html")"
explorer.exe "$(cygpath -w "$PWD/train2.0/dashboard.html")"
```

因此不存在 build、lint、test 或“运行单个测试”的命令。修改后应在浏览器中分别检查相关 HTML 页面，并用 `git diff --check` 检查文本格式问题；2.0 的结构性改动另见文末「验证与 Git」。

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

### `train2.0/`：周期化训练与记录系统

这是独立的 12 周周期化体系，与 1.0 并存，不是 1.0 记录文件的派生层。正式周期从 2026-09-21 开始，默认采用 3 日版计划：

- `篮球运动训练理念.md` 定义能力模型与动作选择原则。
- `训练周期安排建议.md` 定义大周期、中周期、周微周期和每日训练之间的层级。
- `12周计划安排.md` 提供 A 版 3 日与 B 版 4–5 日计划，每 4 周按进入、增量、高刺激、Deload+测试推进。
- `动作库/` 是动作唯一事实源，按模块分册：`00_索引.md`（使用原则、刺激预算、Quality Stop、AI 选动作过滤流程、全部动作索引表、槽位→模块映射、动作关系链）加 `A_活动度.md` … `Q_训练后整理与拉伸.md` 共 17 本分册（动作详情：剂量、进退阶、Quality Stop、疼痛限制、标准描述）。`00_附录_等级体系与动作树.md` 是按需参考。
- `records/YYYY-MM.md` 是 Readiness、实际训练、Session Load 和疼痛数据的唯一事实源。
- `records/00_摘要.md` 是训练趋势速查索引（每次训练一行），不是事实源；细节以月度记录为准。
- `weakness-tracking.md` 是 2.0 弱点管理的唯一事实源；Dashboard 完整镜像其弱点项、板块、发现日期、状态、目标和备注。
- `ability-assessment.md` 是 2.0 能力评估的唯一事实源；只从正式训练记录提取可比较的真实动作结果，首次有效结果建立基线，后续仅由更优结果更新，并保留每项首次日期、最佳结果日期和更新时间。
- `records/YYYY-MM.html` 与 Dashboard 是月度记录、弱点管理和能力评估的同步展示层，不是独立数据源。Dashboard 拆为 `dashboard.html` 外壳 + `assets/dashboard.css`、`assets/dashboard.js`、`assets/data/*.js`：外壳只含标记与经典 `<script src>`，数据改动一律落在 `assets/data/`。Dashboard 能力评估保持只读，不使用手工输入或 localStorage。Dashboard 的训练推荐模块数据来自 `assets/data/recommend-YYYY-MM.js`（由 `assets/data/recommend-index.js` 汇总），与正式训练记录相互独立：推荐只由推荐流程写入、正式记录只由 `record-training-2` 写入，两者互不覆盖。
- `archive/` 存放拆分前原件（`动作库3.0-拆分前原件.md`）与历史版本（`动作库2.0-历史版本.md`），**不是事实源，任何技能都不得读取或引用**。

**`file://` 约束：** 页面用 `explorer.exe` 双击打开，因此只能用 `<link rel="stylesheet">` 与**经典** `<script src>`；**禁止 `fetch()` 与 `<script type="module">`**（两者在 `file://` 下被 CORS 拦截）。新增顶层 `const`/`let`/`function` 必须跨文件唯一——多份经典脚本共享全局词法作用域，重名会让整页失效。

**2.0 读取协议：** 先读 `动作库/00_索引.md` + `records/00_摘要.md` + `weakness-tracking.md`；动作详情按动作名在对应 `X_模块.md` 中检索（A–N 为 `### 动作名`，O/P/Q 为 `#### 动作名`），`12周计划安排.md` 只读当前 4 周区块，`records/YYYY-MM.md` 只按需打开 1–3 天。**不要整读全部 17 本分册，也不要整读 `dashboard.html` 外壳。**

旧 `localStorage` 中的 Readiness 和 Session 数据不迁移、不主动清除，也不得用于补齐正式历史。除非用户明确要求迁移，不要在 1.0 和 2.0 之间自动同步数据。

## 1.0 训练记录工作流

`.claude/skills/record-training/skill.md` 是完整 SOP。该技能文档中的 `records/`、`training-log.md`、`training-plans.md` 和 `dashboard.html` 均应解释为相对于 `train1.0/` 的路径。

关键约束：

1. 只记录用户明确提供的数据。不得补写次数、负重、评分、疼痛、身体感受或动作表现；缺失信息一次最多询问 2–3 项，用户记不清时跳过。
2. 先确认日期，再更新月度 Markdown、月度 HTML、主索引和 1.0 仪表盘；保留所有历史记录。
3. 休息日可以进入 HTML 的 `trainingDays` 以显示备注，但必须同时加入 `REST_DAYS`，使用 `.calendar-day.rest`，不可点击且不能使用训练日高亮。
4. 月度页详情 ID 使用 `detail-YYYY-MM-DD`；日历链接必须动态按日期拼接，不能硬编码到某一天。
5. HTML 中新增训练详情应插入 `<footer class="footer">` 前；编辑中文或 emoji 内容时优先用纯 ASCII 结构作为定位锚点。
6. 下次训练推荐必须同时读取 `train1.0/training-plans.md`、最近 3 周月度记录和 `train1.0/training-log.md` 的弱点追踪。动作与重量必须有计划或历史数据依据；未练过的动作标注“新动作，从轻重量开始试”。

## 2.0 推荐与记录工作流

- `.claude/skills/recommend-training-2/skill.md` 负责采集睡眠、疲劳、酸痛、疼痛和训练意愿，计算当日 Readiness，并结合当前周期、最近 3 个训练周、恢复间隔、疼痛、`train2.0/weakness-tracking.md` 的现存弱点及四份 2.0 训练文档推荐今日训练。疼痛限制优先于 Readiness 总分；推荐内容不能写成已完成训练。**推荐流程只写 Dashboard 训练推荐模块 `train2.0/assets/data/recommend-YYYY-MM.js`（`meta` / `readiness` / `plans` / `reason` / `skills` 五个分节），不写入也不修改 `train2.0/records/` 下的任何文件或 `assets/data/records.js`。** 推荐独立于训练记录：未再次推荐时 Dashboard 始终显示最近一条推荐，训练推荐模块的日期选择器可查看过往推荐。
- `.claude/skills/record-training-2/skill.md` 负责解析用户实际完成的训练，按需引导补充总时长、Session RPE、疼痛和 Readiness，并主动维护 `train2.0/weakness-tracking.md` 与 `train2.0/ability-assessment.md`：弱点仅根据明确反馈、动作表现、左右差异或测试数据新增/更新，同义项不得重复；能力评估只接受正式训练中完整、真实且可比较的动作结果，首次有效数据创建条目，之后仅在严格更优时更新最佳值和更新时间。一次最多询问 2–3 项；用户记不清的字段标记为未记录，不得推测。
- `Session Load = 训练时长（分钟）× Session RPE`。任一输入缺失时不得估算；同日重复记录更新原条目，不重复增加训练天数或负荷。

一次 2.0 正式训练记录按以下顺序同步，所有原始值、派生值和备注必须一致：

1. `train2.0/records/YYYY-MM.md`
2. `train2.0/records/00_摘要.md`（追加或原位更新本次训练一行，字段与月度记录一致）
3. `train2.0/weakness-tracking.md`（本次有可直接证实的新增弱点或已有弱点新证据时）
4. `train2.0/ability-assessment.md`（本次有首次有效动作结果、更优结果或正式记录纠错时）
5. `train2.0/records/YYYY-MM.html`
6. `train2.0/assets/data/records.js` 与 `reference.js`（Dashboard 数据层；**不写 `dashboard.html` 外壳**）

若月度模板或 Dashboard 对应模块尚未建立，应报告未同步项并停止，不得发明临时数据结构。训练记录只在运行 `record-training-2` 后写入：月度 Markdown、月度 HTML 与 `records.js` 都不得由推荐流程更新；当日 Readiness 由推荐模块的 `readiness` 分节提供原始值，训练时复用后写入正式记录。取消或未训练的日子可以只记录 Readiness 与原因，训练状态写「未训练」，不创建虚假的已完成训练，也不计入训练天数或 Session Load。

## 训练领域约定

- 训练日顺序：热身（5–10 分钟，含 Level 2 防伤）→ 爆发/速度 → 主项力量 → 辅助 → 核心 → 拉伸。
- 爆发力和速度敏捷始终优先；同一肌群的大重量训练间隔至少 48 小时。
- 板块图标：🏋️ 力量、⚡ 爆发力、🏃 速度敏捷、🔄 体能、🏀 篮球技巧、🧘 休息/停训。
- 评分范围为 1–10；HTML 评分圈配色为 7–10 green、5–6 yellow、1–4 red。
- 1.0 仪表盘进度条配色：力量 accent、核心 purple、篮球技巧 purple、爆发力 yellow、体能 green。
- 单次渐进只选择加重、加次、加组或控速中的一种；同一动作保持 6–8 次训练后再进阶。

## 验证与 Git

修改训练记录后至少核对：对应系统的月度 Markdown 与 HTML 详情一致，Dashboard 日历链接到正确日期，训练天数、Readiness、疼痛和 Session Load 没有因同日更新重复累计；休息日与训练日视觉状态正确。2.0 Dashboard 改动还需验证动作级联、详情弹层、刷新后的正式数据展示，以及旧 `localStorage` 数据不会被纳入训练历史。改动训练推荐模块时，需验证默认显示最近一条推荐、日期选择器可切换过往推荐且切换后槽位/依据/技能/Readiness 正确，并且推荐改动没有改变正式训练天数与 Session Load。

改动 2.0 结构时运行（`tools/` 下为一次性校验脚本，不参与运行时，也不是构建步骤）：

```bash
PYTHONIOENCODING=utf-8 python tools/verify_action_library_split.py   # 动作库分册与索引 1:1、逐字抽样一致
node --check train2.0/assets/dashboard.js                            # 逐文件语法（assets/data/*.js 同）
git diff --check
```

浏览器验证用本机 Chrome/Edge 无头模式打开 `train2.0/dashboard.html`（`--dump-dom` 或 `--screenshot`），确认无 JS 报错、动作库筛选与详情弹层可用、月历链接正确、训练推荐日期选择器可切换，且当月训练天数与 Session Load 未因同日更新推荐或记录而重复累计。

提交信息使用中文说明和 conventional 前缀，例如 `feat(records):`、`feat(training):`。仓库路径包含中文，文件工具始终使用完整绝对 Windows 路径，如 `D:\个人文件\train-log\train1.0\dashboard.html`。
