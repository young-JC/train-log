---
name: recommend-training-2.0
description: >
  基于 Readiness、疼痛与恢复、12 周周期、近期训练记录、
  动作模式、刺激预算、动作进退阶链、弱点优先级和篮球运动员动作库，
  为 train2.0 生成今日训练推荐，并同步 Dashboard 今日推荐与每日 Readiness。
---

# recommend-training-2.0

为 `train2.0` 生成今日篮球运动员训练建议。

本技能遵循：

**安全与疼痛权限 → Readiness → 周期位置 → 周计划槽位 → 近期刺激暴露 → 恢复 → 弱点 → 动作模式 → 动作等级与进退阶 → 刺激预算 → 最少必要动作**

所有训练结论必须可追溯到：

- 用户明确输入；
- 正式训练记录；
- 12 周训练计划；
- 篮球运动训练理念；
- 动作库；
- 弱点追踪；
- 已有训练表现。

不得凭空补充：

- 训练重量；
- 动作表现；
- 疼痛情况；
- Readiness；
- Session Load；
- 跳跃高度；
- 冲刺成绩；
- 恢复程度；
- 改善结论。

---

# 1. 适用请求

用户表达以下意图时使用：

- “推荐今天训练什么”
- “今天该怎么练”
- “根据我的状态安排训练”
- “帮我生成今天训练”
- “今天适合练腿吗”
- “今天适合爆发/速度吗”
- “更新 Readiness”
- “根据最近训练调整一下今天计划”
- “根据膝盖状态安排训练”
- “帮我从动作库选今天的动作”

本技能只负责：

1. 采集当日状态；
2. 计算 Readiness；
3. 确定训练权限；
4. 分析周期位置；
5. 分析近期训练和恢复；
6. 确定本周训练槽位；
7. 匹配弱点；
8. 从动作库筛选动作；
9. 控制训练刺激；
10. 生成今日训练推荐；
11. 同步 Dashboard 推荐展示和 Readiness。

本技能**不得把尚未完成的推荐写成正式训练记录**。

训练结束后：

使用 `record-training-2` 记录实际完成内容。

---

# 2. 固定配置

- 12 周周期开始日期：`2026-09-21`
- 默认计划：`train2.0/12周计划安排.md` 的 **3 日版**
- 正式训练记录唯一事实源：
  `train2.0/records/YYYY-MM.md`
- 弱点管理唯一事实源：
  `train2.0/weakness-tracking.md`
- 动作唯一事实源：
  `train2.0/篮球运动员版动作库 3.0.md`
- Dashboard：
  `train2.0/dashboard.html`
- 月度 HTML 与 Dashboard 均属于展示层
- 不读取旧 `localStorage` 作为正式训练历史
- 不自动迁移 `train1.0/`
- 不允许用旧版本训练记录补齐 2.0 历史
- 推荐计划和正式训练记录严格分离

---

# 3. 术语显示规范

所有面向用户和 Dashboard 展示的训练术语必须优先采用：

**中文（英文）**

例如：

- 活动度（Mobility）
- 防伤训练（Prehab）
- 落地控制（Landing）
- 减速制动（Deceleration）
- 增强式训练（Plyometric）
- 爆发力（Power）
- 力量（Strength）
- 单腿力量（Single-leg Strength）
- 后链（Posterior Chain）
- 速度（Speed）
- 加速（Acceleration）
- 变向（Change of Direction, COD）
- 敏捷反应（Agility / Reaction）
- 核心抗旋转（Anti-Rotation）
- 全身力量传递（Kinetic Chain）
- 篮球专项体能（Basketball Conditioning）
- 主观用力程度（RPE）
- 剩余次数（RIR）

动作名称同样使用：

**中文动作名（英文动作名）**

不得在主要展示区域只使用英文动作名称。

---

# 4. Step 1：确认日期

首先确定训练日期。

规则：

1. 用户明确说某个日期时使用用户日期。
2. 用户说“今天”且日期无歧义时使用当前日期。
3. 如果当前系统日期与用户语境明显冲突，先确认。
4. 日期早于周期开始日或晚于第 12 周，不得擅自循环周期。
5. 超出 12 周范围时询问用户是否：
   - 延续当前周期；
   - 开始新周期；
   - 仅做临时训练推荐。

---

# 5. Step 2：采集每日 Readiness

通过 AI 对话收集以下五项。

| 指标 | 范围 | 方向 |
|---|---:|---|
| 睡眠 | 1–5 | 越高越好 |
| 当前疲劳 | 1–5 | 越低越好 |
| 当前酸痛 | 1–5 | 越低越好 |
| 当前疼痛 | 0–10 | 越低越好 |
| 当前训练意愿 | 1–5 | 越高越好 |

规则：

1. 只使用用户明确提供的数据。
2. 不自行打分。
3. 缺少输入时一次最多追问 2–3 项。
4. 五项未齐全时：
   - 可以做初步分析；
   - 不计算正式 Readiness；
   - 不输出正式训练计划。
5. 超出范围必须重新确认。
6. 疼痛 > 0 时还需要记录：
   - 部位；
   - 性质；
   - 是否影响动作；
   - 是否比平时明显增加。
7. 如果用户描述以下情况，标记为红旗：
   - 尖锐痛；
   - 明显肿胀；
   - 卡顿；
   - 关节不稳或打软腿；
   - 明显跛行；
   - 活动范围明显下降；
   - 疼痛持续恶化。

本技能不进行医学诊断。

---

# 6. Step 3：计算 Readiness

使用以下等权公式：

```text
Readiness = round(20 × (
  睡眠 / 5
  + (6 - 疲劳) / 5
  + (6 - 酸痛) / 5
  + (10 - 疼痛) / 10
  + 训练意愿 / 5
))
```

结果范围：

`0–100`

Readiness 主要用于确定**训练权限区间**，不要把 82 与 79 等小差异解释成具有精确生理意义。

---

# 7. Readiness 权限

| 等级 | 条件 | 训练权限 |
|---|---|---|
| 绿色 | ≥75 且疼痛 ≤2 且无红旗 | 可以执行计划训练，再结合近期负荷调整 |
| 黄色 | 60–74，或疼痛 3–4，且无红旗 | 总量减少约 20%–30%，降低冲击、复杂度或容量 |
| 红色 | <60，或疼痛 ≥5，或存在红旗 | 取消跳跃、冲刺、高速变向和疼痛相关负重 |

优先级：

```text
红旗
>
疼痛权限
>
Readiness 总分
```

例如：

```text
Readiness = 83
疼痛 = 5
```

仍然属于红色权限。

不得因为总分高而突破疼痛限制。

---

# 8. Step 4：读取必需数据源

正式推荐前必须读取：

## 8.1 篮球运动训练理念

`train2.0/篮球运动训练理念.md`

读取：

- 能力模型；
- 动作排序；
- 篮球运动员训练原则；
- 爆发、速度和力量关系；
- 防伤原则。

---

## 8.2 训练周期安排建议

`train2.0/训练周期安排建议.md`

读取：

- 大周期（Macrocycle）
- 中周期（Mesocycle）
- 周微周期（Microcycle）
- Deload
- 训练量调整原则
- 周期阶段目标

---

## 8.3 12 周计划

`train2.0/12周计划安排.md`

读取：

- 当前周次；
- 当前阶段；
- 本周目标；
- 默认 3 日版槽位；
- 当日训练结构；
- 组数；
- 次数；
- RPE；
- Deload；
- 测试安排。

---

## 8.4 动作库

`train2.0/篮球运动员版动作库 3.0.md`

动作推荐必须来自动作库。

优先读取字段：

- 中文名称；
- 英文名称；
- 模块；
- 能力；
- 动作模式；
- Level；
- 冲击等级；
- 训练意图；
- 单侧/双侧；
- 器材；
- 周期适用；
- 退阶；
- 进阶；
- 替代动作；
- 疼痛限制。

---

## 8.5 弱点追踪

`train2.0/weakness-tracking.md`

读取：

- 弱点；
- 优先级；
- 板块；
- 发现日期；
- 当前状态；
- 目标；
- 证据；
- 最近训练表现。

---

## 8.6 正式训练记录

读取训练日前最近 **3 个训练周**：

`train2.0/records/`

记录内容包括：

- 日期；
- 训练类型；
- 动作；
- 重量；
- 组次；
- RPE；
- Session RPE；
- 训练时长；
- Session Load；
- 疼痛；
- Readiness；
- 技术表现；
- 总结；
- 弱点证据。

如果历史不足 3 周：

使用现有全部记录，并明确：

**“当前正式训练历史不足 3 周。”**

不得调用 `train1.0` 补齐。

---

## 8.7 Dashboard

`train2.0/dashboard.html`

只读取：

- 当前页面结构；
- Readiness 挂载位置；
- 今日训练挂载位置；
- todayReason；
- todaySkills；
- 日历结构；
- 当前计划模式。

不得把旧 localStorage 当成正式训练历史。

---

# 9. Step 5：确定周期位置

以：

`2026-09-21`

作为：

**Week 1 Day 1**

按照连续 7 天计算当前周。

阶段：

```text
W1–W4
基础重建（Foundation）

W5–W8
力量 → 爆发（Strength → Power）

W9–W12
篮球运动表现（Performance）
```

每个 4 周中周期：

```text
Week 1
进入 / 适应

Week 2
增量

Week 3
高刺激

Week 4
Deload + 测试
```

对应：

```text
W1 进入
W2 增量
W3 高刺激
W4 Deload

W5 进入
W6 增量
W7 高刺激
W8 Deload

W9 进入
W10 专项强化
W11 高质量峰值
W12 Taper + 测试
```

Deload 永远优先于：

“最近状态很好所以再加量”。

---

# 10. Step 6：确定本周训练槽位

默认使用：

**3 日版**

典型槽位：

```text
Day 1
下肢力量 + 爆发

Day 2
上肢 + 核心 + 篮球技术

Day 3
速度 + 减速 + 变向 + 篮球
```

选择规则：

1. 根据正式记录确定本周已经完成哪些槽位。
2. 不按星期机械选择。
3. 优先完成本周尚未完成的计划槽位。
4. 如果对应槽位恢复不足：
   - 延后；
   - 调整；
   - 使用低冲击替代。
5. 同一主项不因为错过某一天就连续补做。
6. 如果本周槽位全部完成：
   - 技术训练；
   - Zone 2；
   - Mobility；
   - Prehab；
   - Recovery；
   作为优先选项。

---

# 11. Step 7：分析最近 48–72 小时刺激暴露

除了查看“练了哪个肌群”，还必须分析：

**训练刺激类型（Training Exposure）**

至少统计：

- 高负荷下肢力量；
- 单腿高负荷；
- 高冲击跳跃；
- 中低冲击跳跃；
- 高速冲刺；
- 高强度减速；
- 高速变向；
- 篮球对抗；
- 高密度篮球专项体能。

例如：

```text
昨天：

5v5 实战 60 分钟
+
多次冲刺
+
急停
+
变向
```

即使没有“力量训练”：

也视为一次明显的高强度下肢暴露。

不得因为：

“昨天没深蹲”

就判断：

“今天下肢完全恢复”。

---

# 12. Step 8：恢复间隔

一般原则：

### 大重量同肌群

至少约 48 小时。

### 高冲击跳跃

需要检查最近一次：

- Drop Jump；
- Depth Jump；
- 高量 CMJ；
- 高量 Lateral Bound。

### 高速冲刺

检查：

- Sprint；
- Flying Sprint；
- Resisted Sprint。

### 减速与高速 COD

检查：

- Sprint → Stop；
- 45° Cut；
- 90° Cut；
- 180° Cut；
- 5-10-5；
- Reactive COD。

### 篮球实战

5v5、长时间 3v3 或高强度 1v1：

应视为综合性的：

**跳跃 + 冲刺 + 减速 + COD + Conditioning**

暴露。

---

# 13. Step 9：分析训练负荷趋势

重点读取：

- Session RPE；
- 训练时间；
- Session Load；
- 连续训练天数；
- 连续高冲击日；
- 篮球对抗时间；
- 疼痛变化；
- 第二天反应。

不得单独使用：

某个固定 Session Load 数字

作为是否训练的唯一依据。

---

# 14. Step 10：疼痛趋势

比较：

```text
晨起疼痛
训练前
热身后
训练中
训练后
第二天
```

检查：

- 是否越来越严重；
- 是否特定动作诱发；
- 是否跳跃后增加；
- 是否变向后增加；
- 是否单腿动作后增加；
- 是否负重后增加；
- 热身是否能缓解；
- 次日是否返回基线。

疼痛管理优先级高于周期任务。

---

# 15. Step 11：弱点优先级

弱点新增优先级：

## P1 — 安全与动作控制

例如：

- 落地控制差；
- 单腿膝控制差；
- 减速能力不足；
- 明显左右差异；
- 疼痛相关能力问题。

## P2 — 运动表现

例如：

- 单腿力量不足；
- 起跳不足；
- 加速不足；
- 横向爆发不足；
- 体能不足。

## P3 — 优化项目

例如：

- 上肢力量；
- 某些辅助核心能力；
- 技能细节优化。

推荐优先：

```text
P1
>
P2
>
P3
```

但必须满足：

- 今日槽位相关；
- 当前周期允许；
- Readiness 允许；
- 疼痛允许；
- 刺激预算允许。

不得为了处理 P1 弱点而在疼痛状态下强行训练相关高冲击动作。

---

# 16. Step 12：动作模式分析

训练动作不得只按照动作名称选择。

必须识别主要动作模式。

## 下肢

- 膝主导（Knee Dominant）
- 髋主导（Hip Dominant）
- 单腿（Unilateral）
- 水平爆发（Horizontal Power）
- 垂直爆发（Vertical Power）
- 横向爆发（Lateral Power）
- 落地（Landing）
- 减速（Deceleration）

## 上肢

- 水平推（Horizontal Push）
- 垂直推（Vertical Push）
- 水平拉（Horizontal Pull）
- 垂直拉（Vertical Pull）

## 核心

- 抗伸展（Anti-Extension）
- 抗旋转（Anti-Rotation）
- 抗侧屈（Anti-Lateral Flexion）
- 旋转（Rotation）
- 力量传递（Force Transfer）

## 全身

- 携重（Carry）
- 髋爆发（Hip Power）
- 三关节伸展（Triple Extension）
- 全身力量传递（Kinetic Chain）

---

# 17. 避免动作模式重复堆叠

同一训练不应因为动作名称不同，就重复堆叠相同刺激。

例如：

```text
六角杠硬拉（Trap Bar Deadlift）
+
罗马尼亚硬拉（RDL）
+
臀推（Hip Thrust）
+
壶铃摆动（Kettlebell Swing）
+
早安式（Good Morning）
```

属于明显的：

**髋主导/髋伸刺激过度集中**

正常推荐中应减少。

原则：

> 优先使用最少必要动作覆盖当天主要能力。

---

# 18. Step 13：全身力量传递

动作库应支持：

**全身力量传递（Kinetic Chain / Total-Body Power）**

典型动作：

- 分腿姿单臂哑铃推举（Split-Stance Single-Arm Dumbbell Press）
- 分腿姿爆发单臂推举（Split-Stance Explosive Push Press）
- 单臂哑铃推举（Single-Arm Dumbbell Push Press）
- 哑铃高拉（Dumbbell High Pull）
- 哑铃高翻（Dumbbell Clean）
- 单臂哑铃抓举（Single-Arm Dumbbell Snatch）
- 壶铃摆动（Kettlebell Swing）
- 单臂壶铃摆动（Single-Arm Kettlebell Swing）
- 壶铃高翻（Kettlebell Clean）
- 药球旋转抛（Rotational Medicine Ball Throw）
- 跨步药球旋转抛（Step-Behind Medicine Ball Throw）
- 单侧负重行走（Suitcase Carry）
- 前架负重行走（Front Rack Carry）
- 俯卧撑位交替哑铃划船（Renegade Row）

这些动作主要训练：

```text
地面
↓
脚
↓
踝
↓
膝
↓
髋
↓
核心
↓
肩
↓
手
```

不得简单把所有这类动作归入“辅助”。

---

# 19. 周期中的力量传递使用

## W1–W4

优先：

- 技术稳定；
- 抗旋转；
- 低复杂度力量传递。

例如：

- 分腿姿单臂推举；
- Pallof Press；
- Suitcase Carry；
- KB Swing；
- Medicine Ball Chest Pass。

---

## W5–W8

增加：

**负重爆发（Loaded Power）**

例如：

- DB High Pull；
- Hang DB Clean；
- Single-Arm Push Press；
- KB Clean。

---

## W9–W12

增加：

**动态和篮球专项力量传递**

例如：

- Step-Behind Medicine Ball Throw；
- Rotational Throw；
- Dynamic Split-Stance Push Press；
- Reactive Total-Body Power。

---

# 20. Step 14：动作等级

动作按照：

```text
L1
基础动作

L2
运动员基础

L3
运动表现

L4
篮球专项 / 反应 / 疲劳 / 复杂环境
```

AI 不得只因为：

“这是更高级动作”

就进行升级。

升级必须满足：

- 当前动作稳定；
- 无明显疼痛；
- 技术质量良好；
- 当前周期适合；
- 刺激预算允许。

---

# 21. Step 15：动作进阶分两种

## A. 动作内进阶

同一动作内部：

- 重量增加；
- 次数增加；
- 组数增加；
- 动作质量提高；
- 动作速度提高；
- 控制时间变化。

原则：

一次优先只改变一个主要变量。

---

## B. 动作间进阶

沿能力链升级。

例如：

### 髋爆发链

```text
罗马尼亚硬拉（RDL）
↓
壶铃摆动（Kettlebell Swing）
↓
哑铃高拉（Dumbbell High Pull）
↓
哑铃高翻（Dumbbell Clean）
↓
单臂哑铃抓举（Single-Arm DB Snatch）
```

---

### 核心抗旋转/力量传递链

```text
抗旋转推（Pallof Press）
↓
单侧负重行走（Suitcase Carry）
↓
俯卧撑位交替划船（Renegade Row）
↓
分腿姿单臂推举
↓
动态分腿姿爆发推举
```

---

### 落地链

```text
快速下沉定姿（Snap Down）
↓
双脚落地（Drop Landing）
↓
单腿落地（Single-Leg Landing）
↓
前跳定住（Forward Hop → Stick）
↓
侧跳定住（Lateral Hop → Stick）
```

---

### 减速链

```text
台阶下蹲（Step Down）
↓
单腿跳定住
↓
5m 加速 → 急停
↓
10m 冲刺 → 急停
↓
Sprint → Stop → 45° Cut
↓
Reactive COD
```

---

# 22. 动作退阶

如果出现：

- 疼痛增加；
- 技术下降；
- 明显疲劳；
- 控制能力下降；
- Readiness 黄色；
- Deload；
- 当前动作复杂度过高；

优先沿动作链进行：

**Regression**

而不是直接：

“整个能力不练”。

例如：

```text
Depth Jump
↓
Box Jump
↓
CMJ
↓
Snap Down
```

如果仍不适合跳跃：

只保留：

- Landing；
- Mobility；
- Prehab。

---

# 23. Step 16：刺激预算（Stimulus Budget）

每次训练必须评估下肢高质量刺激数量。

刺激类型包括：

## 低冲击

- Mobility；
- 基础 Prehab；
- Technique；
- Pallof Press；
- Dead Bug。

## 中等冲击

- Pogo；
- CMJ；
- Box Jump；
- 基础 acceleration；
- 可控 Lateral Bound。

## 高冲击

- Depth Jump；
- Drop Jump；
- 高速 Sprint；
- Sprint → Stop；
- 高速 90°/180° COD；
- Reactive COD；
- 高频篮球实战。

## 高负荷力量

- Heavy Trap Bar；
- Heavy Squat；
- Heavy RDL；
- 高负荷 Bulgarian Split Squat。

---

# 24. 刺激预算原则

不得出现：

```text
高强度跳跃
+
大量冲刺
+
大量高速变向
+
大重量下肢
+
长时间高强度实战
```

全部堆在同一次训练中。

推荐必须问：

> 今天真正的主刺激是什么？

通常一天确定：

**1–2 个主要高质量目标**

即可。

例如：

### Lower Power Day

主刺激：

- Vertical Power；
- Strength。

COD 只做低量或不做。

---

### Speed/COD Day

主刺激：

- Acceleration；
- Deceleration；
- COD。

力量只作为少量维护。

---

# 25. Step 17：训练顺序

默认训练顺序升级为：

```text
① 动态热身（Dynamic Warm-up）
↓
② 活动度（Mobility）
↓
③ 防伤训练 Level 2（Prehab）
↓
④ 落地 / 制动技术（Landing / Deceleration）
↓
⑤ 速度 / 反应（Speed / Reaction）
↓
⑥ 增强式 / 爆发（Plyometric / Power）
↓
⑦ 主项力量（Primary Strength）
↓
⑧ 单腿 / 后链 / 全身力量传递
↓
⑨ 核心（Core）
↓
⑩ 篮球技能 / 专项体能
↓
⑪ 整理恢复（Cooldown）
```

但：

**每天不要求全部模块出现。**

---

# 26. 按训练槽位选择模块

## 下肢力量 + 爆发日

推荐结构：

```text
Mobility
→
Prehab
→
Landing
→
Power
→
Primary Strength
→
Single-Leg
→
Posterior Chain
→
Core
```

---

## 上肢 + 篮球日

```text
Mobility
→
Prehab
→
Upper Power
→
Push
→
Pull
→
Shoulder Health
→
Core
→
Basketball Skill
```

---

## Speed / Decel / COD 日

```text
Mobility
→
Prehab
→
Landing
→
Acceleration
→
Deceleration
→
COD
→
Reaction
→
Basketball
```

---

## 下肢 B / Conditioning 日

```text
Mobility
→
Prehab
→
Horizontal / Lateral Power
→
Hip Dominant Strength
→
Single-Leg
→
Posterior Chain
→
Core
→
Basketball Conditioning
```

---

# 27. Step 18：质量优先项目

以下模块属于：

**质量主导（Quality Dominant）**

- Sprint；
- Acceleration；
- Plyometric；
- Jump；
- Landing；
- Deceleration；
- COD；
- Reaction；
- Loaded Power；
- DB Clean；
- DB High Pull；
- DB Snatch。

核心目标：

**输出质量**

不是：

**制造疲劳**

---

# 28. Quality Stop Rule

出现以下情况时：

提前停止该模块：

- 冲刺速度明显下降；
- 跳跃高度明显下降；
- 起跳节奏变慢；
- 落地开始失控；
- 膝内扣明显增加；
- 左右差异明显变大；
- COD 动作失去控制；
- 技术明显崩坏；
- 出现新的疼痛；
- 原有疼痛明显增加。

不得为了：

“完成计划规定的组数”

牺牲质量。

---

# 29. 容量主导项目

以下项目可以主要根据：

Sets / Reps / RPE

管理：

- Strength；
- Accessory；
- Core；
- Conditioning；
- 一般肌耐力。

即使如此：

如果疼痛或动作质量明显恶化：

仍需停止或降级。

---

# 30. Step 19：动作持续与替换

同一主力动作在：

- 技术稳定；
- 没有疼痛；
- RPE 正常；
- 仍然有进步；

的情况下：

优先持续约 6–8 次相关训练暴露。

不得频繁换动作。

---

# 31. 可以提前更换动作的情况

包括：

- 疼痛；
- 技术始终无法稳定；
- 当前周期能力目标改变；
- 已经满足升级条件；
- 器材不可用；
- 与其他动作模式严重重复；
- 新动作能更直接服务当前训练目标。

---

# 32. Step 20：最少必要动作原则

训练推荐不追求动作数量。

一般正式训练：

约：

**6–10 个核心内容**

已经足够。

例如：

```text
Mobility 1–2
Prehab 2
Landing 1
Speed/Power 1–2
Primary Strength 1
Single-Leg 1
Accessory 1
Core 1
Basketball 1 个主要主题
```

不是动作库越大：

训练当天动作越多。

---

# 33. Step 21：正式推荐决策顺序

必须按照以下优先级：

```text
1. 红旗症状
↓
2. 疼痛权限
↓
3. Readiness
↓
4. 当前 12 周周期
↓
5. Deload / 测试要求
↓
6. 本周尚未完成槽位
↓
7. 最近 48–72h 刺激暴露
↓
8. 同类训练恢复间隔
↓
9. Session Load / RPE 趋势
↓
10. P1 / P2 / P3 弱点
↓
11. 今日动作模式需求
↓
12. 动作等级 L1–L4
↓
13. 动作进退阶链
↓
14. 刺激预算
↓
15. 最少必要动作
↓
16. 生成训练
↓
17. Quality Stop Rule
```

---

# 34. Step 22：黄色状态调整

黄色 Readiness：

总训练量通常减少约：

**20%–30%**

优先调整顺序：

```text
高冲击跳跃
↓
高速 COD
↓
冲刺总量
↓
辅助训练容量
↓
主力量组数
```

尽量保留：

- 动作技术；
- 基础力量；
- Mobility；
- Prehab；
- 低冲击能力训练。

例如原计划：

```text
CMJ 3×3
Sprint 5 次
5-10-5 4 次
Trap Bar 4×5
Bulgarian 3×8
```

黄色状态可以调整：

```text
CMJ 2×3
Sprint 3 次
取消高速 5-10-5
Trap Bar 3×5
Bulgarian 2×8
```

必须说明：

**具体减少了什么。**

---

# 35. Step 23：红色状态

红色状态：

不得安排：

- Plyometric；
- Depth Jump；
- 高强度 CMJ；
- Sprint；
- 高速 Deceleration；
- COD；
- Reactive Drill；
- 疼痛相关大重量下肢动作；
- 高强度篮球对抗。

可以视情况选择：

- Mobility；
- Level 1 / Level 2 Prehab；
- 无痛范围力量；
- 上肢；
- 呼吸；
- Recovery；
- 轻量 Zone 2。

如果存在红旗：

建议暂停相关训练并寻求：

运动医学 / 康复专业人员评估。

---

# 36. Step 24：训练重量规则

动作重量只能来自：

1. 12 周计划已有规定；
2. 动作库明确规则；
3. 用户历史训练；
4. 用户本次明确提供。

如果没有历史重量：

不得凭空给具体公斤数。

改为：

- RPE 6；
- 轻重量试做；
- 保留 3–4 RIR；
- 技术优先。

例如：

正确：

> 哑铃高拉（Dumbbell High Pull）3×4，RPE 5–6，新动作，从轻重量开始。

错误：

> 使用 17.5kg。

如果用户没有对应历史依据。

---

# 37. 新动作规则

用户从未训练过的动作：

必须标记：

**新动作**

并使用：

- 较低复杂度；
- 轻重量；
- 少次数；
- 技术优先；
- 不与高疲劳同时堆叠。

尤其：

- DB Clean；
- DB Snatch；
- Explosive Push Press；
- Depth Jump；
- Reactive COD。

---

# 38. Step 25：弱点匹配

推荐中必须明确：

> 本次处理哪一个现存弱点。

例如：

```text
现存弱点：
单腿爆发不足

今天通过：
保加利亚分腿蹲（Bulgarian Split Squat）
+
侧向跨步跳（Lateral Bound）

进行针对。
```

如果弱点没有纳入：

说明原因，例如：

- 今日槽位不匹配；
- 疼痛限制；
- 恢复不足；
- 当前是 Deload；
- 当前刺激预算已满。

---

# 39. Step 26：上次建议落实

检查上一次正式训练总结：

- 哪个动作建议降重；
- 哪个动作建议保持；
- 哪个动作建议进阶；
- 哪个弱点继续观察；
- 哪个疼痛需要跟踪。

不能把：

“建议改善”

当成：

“已经改善”。

只有新的正式训练证据才能改变弱点状态。

---

# 40. Step 27：生成今日训练

推荐必须按模块输出。

模板：

```markdown
## 今日训练

### 1. 动态热身（Dynamic Warm-up）
动作 / 时长

### 2. 活动度（Mobility）
动作 / 次数

### 3. 防伤训练（Prehab）
动作 / 次数

### 4. 落地 / 减速（Landing / Deceleration）
动作 / 组次

### 5. 速度 / 爆发（Speed / Power）
动作 / 组次 / 距离

### 6. 主项力量（Primary Strength）
动作 / 组次 / RPE

### 7. 单腿 / 后链 / 力量传递
动作 / 组次

### 8. 核心（Core）
动作 / 组次

### 9. 篮球技能 / 体能
内容 / 时间

### 10. 整理恢复（Cooldown）
内容
```

没有必要的模块：

可以省略。

---

# 41. Step 28：输出“为什么今天这样练？”

必须包括：

1. 当前周期；
2. 当前周目标；
3. Readiness；
4. 疼痛权限；
5. 最近 48–72h 训练暴露；
6. 恢复；
7. 本周槽位；
8. 对应弱点；
9. 动作模式；
10. 动作进退阶依据；
11. 刺激预算。

---

# 42. Step 29：输出今日技能

如果当天包含篮球训练：

明确写出：

- 运球；
- 投篮；
- 终结；
- 脚步；
- 防守；
- Transition；
- 实战；

中的实际内容。

不得自动保留上一次技能重点。

---

# 43. Step 30：同步每日 Readiness

用户五项数据齐全后：

同步：

1. `train2.0/records/YYYY-MM.md`
2. 对应月度 HTML（若存在）
3. `train2.0/dashboard.html`

三处必须一致：

- 日期；
- 睡眠；
- 疲劳；
- 酸痛；
- 疼痛；
- 疼痛部位；
- 疼痛性质；
- 训练意愿；
- Readiness；
- 权限颜色。

如果当天尚未训练：

只记录 Readiness。

不得创建虚假训练记录。

---

# 44. Step 31：同步 Dashboard 今日推荐

Dashboard 是：

**只读训练展示层**

推荐生成后同步：

- 日期；
- 周次；
- 周期阶段；
- 计划模式；
- 今日槽位；
- 今日动作；
- 组数；
- 次数；
- RPE；
- 距离；
- 时长；
- Readiness 调整；
- 弱点目标；
- todayReason；
- todaySkills。

---

# 45. Dashboard 不得记录为已完成

推荐阶段不得：

- 增加训练天数；
- 增加 Session Load；
- 写入已完成动作；
- 写入预计 Session RPE；
- 写入预计疼痛；
- 写入正式训练历史。

推荐 ≠ 实际完成。

---

# 46. Dashboard 日历规则

保留原训练日历功能。

日历需要区分：

- 计划训练；
- 已完成；
- 恢复/休息；
- 当前查看日期。

点击日期后：

显示对应日期：

- 计划槽位；
- 推荐训练；
- 已完成训练（如果已经正式记录）；
- Readiness；
- 疼痛；
- 周期位置。

训练完成状态只能来自正式记录。

不能由推荐自动标记完成。

---

# 47. 同日重新推荐

如果同一天：

Readiness 重新评估

或：

用户状态发生变化，

则：

覆盖该日 Dashboard 推荐。

不得：

- 重复追加动作；
- 保留旧剂量；
- 保留旧 todayReason；
- 保留已经取消的 todaySkills。

正式训练记录不受推荐覆盖。

---

# 48. 输出标准格式

```markdown
# 今日训练建议

## 今日 Readiness

- 日期：
- 睡眠：
- 疲劳：
- 酸痛：
- 疼痛：
- 训练意愿：
- Readiness：
- 权限：

## 周期定位

- 第 N 周
- 阶段：
- 本周目标：
- 已完成槽位：
- 今日槽位：

## 最近训练与恢复

- 最近高负荷下肢：
- 最近跳跃：
- 最近冲刺：
- 最近 COD：
- 最近篮球实战：
- Session Load 趋势：
- 疼痛趋势：

## 今日训练推荐

按实际使用模块输出。

## 本次弱点目标

- 弱点：
- 优先级：
- 对应训练：

## 为什么今天这样练？

说明：
周期、Readiness、恢复、疼痛、刺激预算、弱点、动作选择。

## 今日技能

仅列实际训练内容。

## 今日训练权限 / 注意事项

说明哪些允许：
哪些减少：
哪些取消：

## Quality Stop

列出今天最需要观察的动作质量指标。

## 训练后需要记录

- 实际动作
- 重量
- 组次
- RPE
- 训练时长
- Session RPE
- 训练后疼痛
- 次日疼痛
- 动作质量
- 篮球表现
```

---

# 49. 禁止行为

1. 禁止编造 Readiness。
2. 禁止编造疼痛。
3. 禁止编造训练重量。
4. 禁止编造 Session Load。
5. 禁止把推荐计划写成已完成训练。
6. 禁止使用旧 localStorage 作为正式历史。
7. 禁止调用 `train1.0` 补数据。
8. 禁止无视疼痛只看 Readiness 总分。
9. 禁止为了完成周计划突破疼痛限制。
10. 禁止为了补弱点堆叠额外训练量。
11. 禁止把一堆同模式动作当作训练多样性。
12. 禁止同一天无控制地堆叠跳跃、Sprint、COD、大重量和篮球对抗。
13. 禁止用疲劳状态进行高质量速度训练。
14. 禁止为了完成组数而继续质量明显下降的跳跃或冲刺。
15. 禁止动作升级仅因为“高级动作更好”。
16. 禁止频繁更换仍在正常进步的主力动作。
17. 禁止给第一次训练的新动作安排高重量。
18. 禁止给不存在于动作库中的动作生成虚构训练说明。
19. 禁止把尚未验证的弱点改善标记为“已改善”。
20. 禁止把训练建议表述为疾病诊断或治疗方案。

---

# 50. 最终训练理念

所有推荐应遵循：

```text
先决定今天需要训练什么能力
↓
再确定训练刺激
↓
再确定动作模式
↓
最后才选择具体动作
```

而不是：

```text
看到一个动作
↓
觉得很好
↓
塞进今天训练
```

训练推荐的核心不是：

**动作越多越好。**

而是：

**用最少必要动作，给当前阶段最需要的能力提供高质量刺激。**

---

# 51. 完整推荐引擎

```text
用户 AI 对话
        ↓
每日 Readiness
        ↓
疼痛 / 红旗权限
        ↓
12 周周期
        ↓
本周训练槽位
        ↓
最近 48–72h 刺激暴露
        ↓
恢复 / Session Load
        ↓
P1 / P2 / P3 弱点
        ↓
动作模式
        ↓
动作 Level
        ↓
动作进退阶链
        ↓
刺激预算
        ↓
最少必要动作
        ↓
生成训练
        ↓
Quality Stop
        ↓
Dashboard 只读展示
        ↓
训练结束
        ↓
record-training-2
        ↓
正式训练记录
        ↓
影响下一次推荐
```

这就是 `recommend-training-2.0` 的完整决策闭环。