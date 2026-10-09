# -*- coding: utf-8 -*-
"""校验动作库拆分是否无损。

检查项：
1. 索引表 170 行，与原文索引表逐行一致（动作名集合相同）；
2. 每个索引动作在且仅在一个模块分册中有一条 `### 动作名` 详情；
3. 原文详情区的动作标题集合 == 分册动作标题集合（无丢失、无新增）；
4. 抽取若干动作块，逐字比对原文与分册内容；
5. 报错即退出码 2。

用法：
    PYTHONIOENCODING=utf-8 python tools/verify_action_library_split.py
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "train2.0" / "archive" / "动作库3.0-拆分前原件.md"
LIB = ROOT / "train2.0" / "动作库"

failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


def headings(lines, lo, hi, levels):
    out = {}
    for i in range(lo, min(hi, len(lines))):
        m = re.match(r"^(#{%d}) (.*)$" % levels, lines[i])
        if m:
            out.setdefault(m.group(2).strip(), []).append(i)
    return out


def main():
    src = SRC.read_text(encoding="utf-8").splitlines()

    # --- 原文索引表 ---
    start = next(i for i, l in enumerate(src) if l.startswith("| 动作 | 训练模块 | 动作模式 |"))
    i, src_rows = start + 2, []
    while i < len(src) and src[i].startswith("|"):
        src_rows.append(src[i])
        i += 1
    orig_names = [r.strip().strip("|").split("|")[0].strip() for r in src_rows]
    check(len(orig_names) == 170, f"原文索引表行数应为 170，实际 {len(orig_names)}")
    check(len(set(orig_names)) == len(orig_names), "原文索引表存在重名动作")

    # --- 分册动作标题与索引名 ---
    module_files = sorted(f for f in LIB.glob("[A-Q]_*.md"))
    check(len(module_files) == 17, f"应有 17 个模块分册，实际 {len(module_files)}")

    file_titles = {}
    for f in module_files:
        letters = set(re.findall(r"^# ([A-Q])\. ", f.read_text(encoding="utf-8"), flags=re.M))
        check(len(letters) == 1, f"{f.name} 应恰好声明 1 个模块字母，实际 {letters}")
        hs = headings(f.read_text(encoding="utf-8").splitlines(), 0, 10**9, 3)
        hs.update(headings(f.read_text(encoding="utf-8").splitlines(), 0, 10**9, 4))
        for title in hs:
            file_titles.setdefault(title, []).append(f.name)

    missing = [n for n in orig_names if n not in file_titles]
    check(not missing, "有索引动作找不到详情分册：" + ", ".join(missing[:10]))

    dupes = {t: v for t, v in file_titles.items() if len(v) > 1 and t in orig_names}
    check(not dupes, f"同一动作出现在多个分册：{dupes}")

    # --- 原文详情区动作标题集合（只针对索引中的 170 个动作）---
    detail_lo, detail_hi = 1302, 4660
    orig_detail = set(headings(src, detail_lo, detail_hi, 3)) | set(headings(src, detail_lo, detail_hi, 4))
    orig_actions = set(orig_names)
    lost = (orig_detail & orig_actions) - set(file_titles)
    check(not lost, "原文详情标题未进入分册：" + ", ".join(sorted(lost)[:10]))
    added = set(file_titles) - orig_detail - {t for t in file_titles if t in orig_actions}
    check(not (added & orig_actions), "分册出现原文详情区没有的动作标题：" + ", ".join(sorted(added & orig_actions)[:10]))

    # --- 结构性标题必须落在索引、附录或分册中，不能丢失 ---
    struct_titles = [t for t in orig_detail if t not in orig_actions]
    all_new = "\n".join(f.read_text(encoding="utf-8") for f in module_files) \
        + (LIB / "00_索引.md").read_text(encoding="utf-8") \
        + (LIB / "00_附录_等级体系与动作树.md").read_text(encoding="utf-8")
    struct_lost = [t for t in struct_titles if t not in all_new]
    check(not struct_lost, "结构性标题未保留：" + ", ".join(sorted(struct_lost)))

    # --- 逐字比对抽样 ---
    def block(lines, title):
        for i, l in enumerate(lines):
            if l.strip() in (f"### {title}", f"#### {title}"):
                j = i + 1
                while j < len(lines) and not re.match(r"^#{3,4} ", lines[j]):
                    j += 1
                return "\n".join(lines[i:j]).strip()
        return None

    for title in ["六角杠深蹲（Trap-Bar Squat）", "快速下落定住（Snap Down）",
                  "帕洛夫抗旋推（Pallof Press）", "站姿腓肠肌拉伸（Standing Gastrocnemius Stretch）",
                  "单臂哑铃抓举（Single-Arm Dumbbell Snatch）"]:
        src_block = block(src, title)
        check(src_block is not None, f"原文缺少动作块：{title}")
        hits = [f for f in module_files if f"### {title}" in f.read_text(encoding="utf-8")
                or f"#### {title}" in f.read_text(encoding="utf-8")]
        check(len(hits) == 1, f"{title} 应在恰好 1 个分册中，实际 {[h.name for h in hits]}")
        if hits and src_block:
            new_lines = hits[0].read_text(encoding="utf-8").splitlines()
            check(block(new_lines, title) == src_block, f"{title} 分册内容与原文不一致")

    # --- 体积报告 ---
    idx = LIB / "00_索引.md"
    idx_text = idx.read_text(encoding="utf-8")
    table = [l for l in idx_text.splitlines() if l.startswith("| ") and l.count("|") == 8]
    print(f"分册数: {len(module_files)}")
    print(f"索引动作数: {len(orig_names)}")
    print(f"00_索引.md: {idx.stat().st_size} 字节（其中表体 {sum(len(l.encode()) + 1 for l in table)} 字节 / {len(table)} 行）")
    print(f"原文索引表: {sum(len(l.encode()) + 1 for l in src_rows)} 字节")
    print(f"分册合计: {sum(f.stat().st_size for f in module_files)} 字节")

    if failures:
        print("\n校验失败:")
        for f in failures:
            print("  -", f)
        return 2
    print("\n全部校验通过：170 个动作 1:1 映射，抽样逐字一致。")
    return 0


if __name__ == "__main__":
    sys.exit(main())