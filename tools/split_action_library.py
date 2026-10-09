# -*- coding: utf-8 -*-
"""一次性脚本：把《篮球运动员版动作库 3.0.md》拆成索引 + 17 个模块分册。

设计约束：
- 只做机械搬运，不改写任何动作正文；
- 每个动作块原文保留（A–O 为元数据块，P/Q 为表格），两种 schema 并存；
- 索引表只压缩「路由」用的重复列，详情字段不在索引里复制，避免双份事实源。

用法：
    PYTHONIOENCODING=utf-8 python tools/split_action_library.py
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "train2.0" / "archive" / "动作库3.0-拆分前原件.md"
OUT = ROOT / "train2.0" / "动作库"

MODULE_TITLES = {
    "A": ("活动度", "Mobility"),
    "B": ("防伤训练", "Prehab"),
    "C": ("落地控制", "Landing"),
    "D": ("减速制动", "Deceleration"),
    "E": ("增强弹跳爆发", "Plyometric"),
    "F": ("下肢力量", "Lower Strength"),
    "G": ("单腿力量", "Single-Leg Strength"),
    "H": ("上肢力量", "Upper Strength"),
    "I": ("核心", "Core"),
    "J": ("速度", "Speed"),
    "K": ("敏捷变向", "Agility / COD"),
    "L": ("篮球技术", "Basketball Skill"),
    "M": ("篮球专项体能", "Basketball Conditioning"),
    "N": ("恢复", "Recovery"),
    "O": ("全身力量传递", "Kinetic Chain / Total-Body Power"),
    "P": ("动态热身", "Dynamic Warm-up"),
    "Q": ("训练后整理与拉伸", "Post-Training Cooldown & Stretching"),
}

# 详情区（0-based）连续区间：(起, 止不含, 归属)
DETAIL_RANGES = [
    (1302, 1588, "A"),
    (1588, 1962, "B"),
    (1962, 2050, "C"),
    (2050, 2248, "E"),
    (2248, 2424, "F"),
    (2424, 2534, "G"),
    (2534, 2798, "H"),
    (2798, 3106, "I"),
    (3106, 3260, "J"),
    (3260, 3392, "K"),
    (3392, 3876, "L"),
    (3876, 3898, "M"),
    (3898, 3963, "N"),
    (3963, 3986, "P"),   # P 分册引言
    (3986, 4042, "P"),
    (4042, 4066, "Q"),   # Q 分册引言
    (4066, 4137, "Q"),
    (4137, 4158, "O"),   # O 分册引言
    (4158, 4660, "O"),
]

# 前置区（0-based）每个模块的说明段
FRONT_RANGES = {
    "A": (125, 158), "B": (158, 205), "C": (205, 248), "D": (248, 283),
    "E": (283, 321), "F": (321, 345), "G": (345, 373), "H": (373, 410),
    "I": (410, 452), "J": (452, 482), "K": (482, 538), "L": (538, 635),
    "M": (635, 686), "N": (686, 712), "O": (712, 788), "P": (788, 844),
    "Q": (844, 876),
}

SLOT_MAP = """## 训练槽位 → 模块映射

用于决定「今天该翻哪几个分册」。模块分册**不要整读**，按候选动作 Grep 定位即可。

| 今日槽位 | 优先模块 | 通常需要读详情的动作数 |
|---|---|---|
| 下肢力量 + 爆发（D1） | F 下肢力量、G 单腿力量、E 增强弹跳爆发、C 落地控制、I 核心、B 防伤训练、P 动态热身、Q 训练后整理与拉伸 | 6–10 |
| 上肢 + 核心 + 篮球技术（D2） | H 上肢力量、I 核心、O 全身力量传递、L 篮球技术、A 活动度、P 动态热身、Q 训练后整理与拉伸 | 6–10 |
| 速度 + 减速 + 变向 + 篮球（D3） | J 速度、K 敏捷变向、C 落地控制、B 防伤训练、G 单腿力量、L 篮球技术、P 动态热身、Q 训练后整理与拉伸 | 6–10 |
| 下肢 B / 体能（4 日版） | E 增强弹跳爆发、F 下肢力量、G 单腿力量、M 篮球专项体能、I 核心、P 动态热身、Q 训练后整理与拉伸 | 6–10 |
| 篮球技术 / 实战 | L 篮球技术、M 篮球专项体能、J 速度、K 敏捷变向、P 动态热身、Q 训练后整理与拉伸 | 4–8 |
| 体能 / 恢复日 | N 恢复、M 篮球专项体能、A 活动度、B 防伤训练、Q 训练后整理与拉伸 | 3–6 |

**注意：** D「减速制动」是能力模块而非独立分册动作组——减速类动作用于 B（Step Down 等）、C（落地吸收）、E、K 中以「动作模式 = 单腿减速 / 落地吸收」标注，选择时按动作模式筛选，不要指望在 D 分册里找动作。

## 读取协议（AI 必读）

按以下顺序读取，**读完即停**：

1. **本文件（`00_索引.md`）——每次必读。** 用下方索引表按「模块 / 动作模式 / 主要能力 / 等级 / 冲击 / 周期」筛出候选动作。
2. **按需读取候选动作的详情。** 不要整读模块分册：在对应 `X_模块.md` 中定位动作标题，只取实际要安排的动作（通常 6–10 个）。每个动作块结构统一（元数据 + 标准动作描述 + 关键要点 + 常见错误），长度约 22 行。标题层级不统一：**A–N 分册用 `### 动作名`，O/P/Q 分册用 `#### 动作名`**，检索时两种都要匹配。
3. **必要时才读附录。** `00_附录_等级体系与动作树.md` 只在需要 L1–L4 定义、能力标签全景或动作树时读取。

**明确禁止：**

- 一次性读取全部 17 个模块分册；
- 用模块分册代替本索引做动作筛选；
- 在索引表里找剂量：剂量、进退阶、Quality Stop、疼痛限制以模块分册的原文为准。

## 索引表字段说明

| 字段 | 说明 |
|---|---|
| 动作 | 动作名，中文（English）；详情标题与模块分册一致 |
| 模块 | A–Q 单字母，对应 `X_模块.md` 分册 |
| 动作模式 | 选择动作的第一匹配条件（英文释义见分册原文） |
| 主要能力 | 该动作的首要训练能力 |
| 等级 | L1 基础 / L2 运动员基础 / L3 运动表现 / L4 篮球专项 |
| 冲击 | 机械冲击：低 / 中 / 高（刺激预算依据） |
| 周期 | 周期适用；未特别标注即全周期可用 |

> 索引表**不复制**「神经要求、推荐剂量、进退阶、Quality Stop、疼痛限制、标准描述」——这些字段只在模块分册原文中维护，避免出现两份事实源。需要时按动作名在分册中检索。
"""

INDEX_TAIL = """## 推荐时优先读取字段

```text
训练模块
→ 适用环节 / 覆盖区域
→ 动作模式
→ 主要能力
→ 等级
→ 机械冲击
→ 神经要求
→ 周期适用
→ 前置条件
→ 退阶/进阶
→ 推荐剂量
→ Quality Stop
→ 疼痛限制
```

> 上面前 7 项可直接从本文件索引表获得；后 5 项（前置条件、退阶/进阶、推荐剂量、Quality Stop、疼痛限制）在模块分册中按动作名检索。
"""


def main() -> None:
    lines = SRC.read_text(encoding="utf-8").splitlines()
    text = lambda a, b: "\n".join(lines[a:b]).strip("\n")

    # ---- 解析索引表 ----
    start = None
    for i, line in enumerate(lines):
        if line.startswith("| 动作 | 训练模块 | 动作模式 |"):
            start = i
            break
    assert start is not None, "未找到 AI 结构化索引表头"

    raw_rows = []
    i = start + 2
    while i < len(lines) and lines[i].startswith("|"):
        raw_rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
        i += 1
    table_end = i

    rows = []
    for r in raw_rows:
        m = re.match(r"^([A-Q])｜", r[1])
        letter = m.group(1) if m else "?"
        pattern = re.sub(r"（[^）]*）\s*$", "", r[2]).strip()
        rows.append([r[0], letter, pattern, r[3], r[4], r[5], r[7]])

    OUT.mkdir(parents=True, exist_ok=True)

    # ---- 00_索引.md ----
    index_parts = [
        text(0, 8),                                   # 标题 + 本版说明
        "## 本目录结构\n"
        "\n"
        "| 文件 | 作用 | 读取时机 |\n"
        "|---|---|---|\n"
        "| `00_索引.md`（本文件） | 使用原则、刺激预算、Quality Stop、AI 选动作过滤流程、**全部动作索引表**、槽位→模块映射、动作关系链 | **每次必读** |\n"
        "| `A_活动度.md` … `Q_训练后整理与拉伸.md` | 17 本模块分册，含动作详情（剂量、进退阶、Quality Stop、疼痛限制、标准描述） | 按槽位映射只读所需模块；**优先按动作名定位单条详情，不整读分册** |\n"
        "| `00_附录_等级体系与动作树.md` | L1–L4 定义、能力标签、动作树 | 按需 |\n"
        "\n"
        "> 本目录是 train2.0 的动作唯一事实源。拆分前的单文件原件在 `train2.0/archive/`，**不是事实源，不要读取或引用**。\n",
        text(8, 97),                                  # 0–0.4 使用原则/元数据标准/刺激预算/Quality Stop/过滤流程
        text(97, 125),                                # 一、动作库体系 + 模块总览表
        SLOT_MAP,
        "## 模块分册一览\n",
        "| 模块 | 分册文件 | 动作数 |", "|---|---|---|",
    ]
    counts = {L: 0 for L in MODULE_TITLES}
    for name, letter, *_ in rows:
        counts[letter] = counts.get(letter, 0) + 1
    for L in sorted(MODULE_TITLES):
        zh, en = MODULE_TITLES[L]
        index_parts.append(f"| {L}｜{zh}（{en}） | `{L}_{zh}.md` | {counts.get(L, 0)} |")

    index_parts += ["", "## 动作索引表（%d 个动作）" % len(rows), "",
                    "| 动作 | 模块 | 动作模式 | 主要能力 | 等级 | 冲击 | 周期 |",
                    "|---|---|---|---|---|---|---|"]
    for r in rows:
        index_parts.append("| " + " | ".join(r) + " |")

    index_parts += [
        text(876, 886),                               # 按训练槽位选择（原表）
        text(1275, 1302),                             # ## 二十三 + ### 1. 使用规则（动作描述约定）
        text(4660, 4777),                             # 动作关系链 / 进阶链 / 应用示例 / 扩展字段
        INDEX_TAIL,
        text(4795, 4818),                             # 动作内 / 动作间进阶
        text(4819, 4852),                             # Dashboard 展示分层
        text(4854, len(lines)),                       # 版本说明
    ]
    (OUT / "00_索引.md").write_text("\n\n".join(p for p in index_parts if p) + "\n", encoding="utf-8")

    # ---- 00_附录 ----
    appendix = [
        "# 动作库附录：等级体系、能力标签与动作树\n",
        "> 本文件是动作库的参考附录，**不属于每次必读**。需要 L1–L4 定义、能力标签全景或动作树时再读。\n",
        "> 动作的唯一事实源是 `00_索引.md` + 17 个模块分册；本附录只做体系性说明。\n",
        text(886, 1097),
    ]
    (OUT / "00_附录_等级体系与动作树.md").write_text("\n".join(appendix), encoding="utf-8")

    # ---- 17 个模块分册 ----
    for L in sorted(MODULE_TITLES):
        zh, en = MODULE_TITLES[L]
        fa, fb = FRONT_RANGES[L]
        body = [f"# {L}. {zh}（{en}）\n",
                f"> 动作库 `{L}` 模块分册。索引与选择依据见 [`00_索引.md`](00_索引.md)；本模块共 {counts.get(L, 0)} 个动作。",
                "> 本文件保留完整动作详情（推荐剂量、进退阶、Quality Stop、疼痛限制、标准描述）。\n",
                "## 模块说明\n", text(fa, fb)]
        detail_parts = [text(a, b) for a, b, owner in DETAIL_RANGES if owner == L and text(a, b)]
        if detail_parts:
            body += ["", "## 动作详情\n"] + detail_parts
        else:
            body += ["", "## 动作详情\n",
                     "本模块无独立动作条目：减速能力以「动作模式」形式分布在 B（单腿减速）、C（落地吸收）、E、K 分册中，" \
                     "筛选时请在 `00_索引.md` 按动作模式查找，不要把本文件当作减速动作清单。"]
        (OUT / f"{L}_{zh}.md").write_text("\n\n".join(body) + "\n", encoding="utf-8")

    # ---- 报告 ----
    print(f"索引表原始行数: {len(raw_rows)}，写入行数: {len(rows)}")
    print(f"索引表占用: {sum(len(l.encode('utf-8')) + 1 for l in lines[start:table_end])} 字节")
    total = 0
    for f in sorted(OUT.iterdir()):
        size = f.stat().st_size
        total += size
        print(f"  {f.name:34s} {size:7d} 字节")
    print(f"合计: {total} 字节")


if __name__ == "__main__":
    main()