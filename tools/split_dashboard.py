# -*- coding: utf-8 -*-
"""一次性脚本：把 train2.0/dashboard.html 拆成 HTML 外壳 + assets/。

产物：
    train2.0/assets/dashboard.css
    train2.0/assets/dashboard.js
    train2.0/assets/data/{reference,records,actions}.js
    train2.0/assets/data/recommend-2026-{09,10}.js
    train2.0/assets/data/recommend-index.js
    train2.0/dashboard.html（重写为外壳）

实现要点：
- 所有边界按**声明名**定位，不写死行号，避免文件增删行后错位；
- dashboard.js 用「扣减法」生成：从整个脚本体里移除已迁出的块，天然避免重复声明。

硬约束：页面用 file:// 双击打开，因此只能使用 <link> 与**经典** <script src>，
不得引入 fetch 或 type="module"。

用法：
    PYTHONIOENCODING=utf-8 python tools/split_dashboard.py
"""

from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "train2.0" / "dashboard.html"
ASSETS = ROOT / "train2.0" / "assets"
DATA = ASSETS / "data"

HEADER = ("// 本文件由 train2.0/dashboard.html 拆分而来，属于**只读展示层**；"
          "正式训练事实源见 CLAUDE.md。\n")
KEY_RE = re.compile(r"^\s{2}'(2026-\d{2}-\d{2})':")


def read_source():
    """读取待拆分的原始 dashboard.html。

    优先使用 git 中的版本（只读来源），这样脚本可重复运行：即使 dashboard.html
    已被上一次运行重写为外壳，也能从原始版本重新生成全部产物。
    """
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).read_text(encoding="utf-8")
    for rev in ("HEAD", "HEAD~1"):
        r = subprocess.run(["git", "show", f"{rev}:train2.0/dashboard.html"],
                           cwd=ROOT, capture_output=True)
        if r.returncode == 0:
            text = r.stdout.decode("utf-8")
            if "const FORMAL_RECORDS={" in text and "const ACTIONS=[" in text:
                print(f"源文件取自 git {rev}:train2.0/dashboard.html")
                return text
    raise SystemExit("无法从 git 取到原始 dashboard.html；请把原文件路径作为参数传入。")


def find(lines, needle, lo, hi, exact=False):
    """按去缩进后的行内容定位声明（renderToday() 内的声明带缩进）。"""
    for i in range(lo, hi):
        s = lines[i].strip()
        if (s == needle) if exact else s.startswith(needle):
            return i
    raise AssertionError(f"未找到：{needle}")


def end_of_object(lines, start, lo, hi):
    """对象/数组的结束行。必须去缩进比较：renderToday() 内的对象以 ` };` 结尾。"""
    for j in range(start + 1, hi):
        if lines[j].strip() in ("};", "];"):
            return j
    raise AssertionError(f"{lines[start][:40]} 未找到结束行")


def split_entries(block):
    """对象块 → [(日期, 文本)]；多行条目整体保留并去掉末尾逗号。"""
    chunks, cur = [], None
    for line in block[1:-1]:
        if KEY_RE.match(line):
            if cur:
                chunks.append(cur)
            cur = [line]
        elif cur is not None:
            cur.append(line)
    if cur:
        chunks.append(cur)
    out = []
    for c in chunks:
        c[-1] = c[-1].rstrip()
        if c[-1].endswith(","):
            c[-1] = c[-1][:-1]
        out.append((KEY_RE.match(c[0]).group(1), "\n".join(c)))
    return out


def build_monthly(var, comment, sections):
    parts = [HEADER, comment, f"const {var}={{"]
    for idx, (label, entries) in enumerate(sections):
        parts.append(f" {label}:{{")
        parts.append(",\n".join(t for _, t in entries))
        parts.append(" }" + ("," if idx < len(sections) - 1 else ""))
    parts.append("};")
    return "\n".join(parts) + "\n"


def main():
    lines = read_source().splitlines()
    sc_i = find(lines, "<script>", 0, len(lines), exact=True)
    sc_e = find(lines, "</script>", sc_i, len(lines), exact=True)
    body_i = find(lines, "<body>", 0, len(lines), exact=True)
    style_i = find(lines, "<style>", 0, len(lines), exact=True)
    style_e = find(lines, "</style>", style_i, len(lines), exact=True)
    DATA.mkdir(parents=True, exist_ok=True)
    excluded = set()

    def claim(a, b):
        excluded.update(range(a, b + 1))
        return lines[a:b + 1]

    # ---------- CSS ----------
    (ASSETS / "dashboard.css").write_text(
        "\n".join(lines[style_i + 1:style_e]).strip("\n") + "\n", encoding="utf-8")

    # ---------- records.js ----------
    r0 = find(lines, "const FORMAL_MONTH=", sc_i, sc_e)
    r1 = find(lines, "const ACTIONS=[", sc_i, sc_e)
    (DATA / "records.js").write_text(
        HEADER + "// 正式训练记录镜像（数据源：train2.0/records/YYYY-MM.md）。\n"
        + "\n".join(claim(r0, r1 - 1)) + "\n", encoding="utf-8")

    # ---------- actions.js ----------
    a0 = find(lines, "const ACTIONS=[", sc_i, sc_e)
    a0e = end_of_object(lines, a0, sc_i, sc_e)
    a1 = find(lines, "function actionDisplayName(", sc_i, sc_e)
    a1e = find(lines, "function actionDescription(", sc_i, sc_e)
    a2 = find(lines, "const ACTION_DESCRIPTIONS={", sc_i, sc_e)
    a2e = end_of_object(lines, a2, sc_i, sc_e)
    a3 = find(lines, "ACTIONS.forEach(a=>{a.desc=", sc_i, sc_e)
    a4 = find(lines, "const ACTION_MODULES=", sc_i, sc_e)
    act = claim(a0, a0e) + claim(a1, a1e) + claim(a2, a2e) + claim(a3, a3) + claim(a4, a4)
    (DATA / "actions.js").write_text(
        HEADER + "// 动作库镜像（数据源：train2.0/动作库/）：动作列表 + 详情说明 + 模块名。\n"
        + "\n".join(act) + "\n", encoding="utf-8")

    # ---------- reference.js ----------
    w0 = find(lines, "const WEEK_PHASES=", sc_i, sc_e)
    p0 = find(lines, "const PLAN3={", sc_i, sc_e)
    p0e = end_of_object(lines, p0, sc_i, sc_e)
    p1 = find(lines, "const PLAN4={", sc_i, sc_e)
    p1e = end_of_object(lines, p1, sc_i, sc_e)
    s0 = find(lines, "const ABILITY_ASSESSMENTS=[", sc_i, sc_e)
    s0e = end_of_object(lines, s0, sc_i, sc_e)
    k0 = find(lines, "const WEAKNESSES=[", sc_i, sc_e)
    k0e = end_of_object(lines, k0, sc_i, sc_e)
    ref = (claim(w0, w0) + ["", ""] + claim(p0, p0e)
           + claim(p1, p1e) + claim(s0, s0e) + claim(k0, k0e))
    (DATA / "reference.js").write_text(
        HEADER + "// 参考数据：周期阶段、3/4/5 日版默认计划、能力评估镜像、弱点镜像。\n"
        + "\n".join(ref) + "\n", encoding="utf-8")

    # ---------- 逐日推荐数据 ----------
    blocks = {}
    for name in ("TODAY_META", "TODAY_RECOMMENDATION", "TODAY_REASON", "TODAY_SKILLS"):
        s = find(lines, f"const {name}={{", sc_i, sc_e)
        e = end_of_object(lines, s, sc_i, sc_e)
        blocks[name] = split_entries(claim(s, e))

    sept = ["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"]
    octo = ["2026-10-01", "2026-10-04", "2026-10-06", "2026-10-08"]
    for name in ("TODAY_META", "TODAY_RECOMMENDATION", "TODAY_SKILLS"):
        assert sorted(d for d, _ in blocks[name]) == sept + octo, f"{name} 日期集合不符"
    assert sorted(d for d, _ in blocks["TODAY_REASON"]) == [
        "2026-09-27", "2026-09-28", "2026-09-29", "2026-10-04", "2026-10-06", "2026-10-08"], "TODAY_REASON 日期集合不符"

    # 折叠内联三元中的 09-30 / 10-01 推荐依据
    inline_line = next(l for l in lines[sc_i:sc_e]
                       if l.strip().startswith("document.getElementById('todayReason')"))
    m = re.search(r"recKey==='2026-10-01'\?'(.*?)'\s*:\s*recKey==='2026-09-30'\?'(.*?)'\s*:\s*", inline_line)
    assert m, "未能解析内联三元表达式中的 2026-10-01 / 2026-09-30 推荐依据"
    blocks["TODAY_REASON"].append(("2026-09-30", f"  '2026-09-30':'{m.group(2)}'"))
    blocks["TODAY_REASON"].append(("2026-10-01", f"  '2026-10-01':'{m.group(1)}'"))

    def for_month(name, month):
        return [e for e in blocks[name] if e[0][:7] == month]

    for month, var, label in (("2026-09", "RECOMMEND_2026_09", "09"), ("2026-10", "RECOMMEND_2026_10", "10")):
        sections = [("meta", for_month("TODAY_META", month)),
                    ("plans", for_month("TODAY_RECOMMENDATION", month)),
                    ("reason", for_month("TODAY_REASON", month)),
                    ("skills", for_month("TODAY_SKILLS", month))]
        (DATA / f"recommend-{month}.js").write_text(build_monthly(
            var,
            f"// 2026-{label} 月度逐日推荐数据（meta / plans / reason / skills）。\n"
            + ("// 新增当月推荐只改本文件；跨月请新建 recommend-YYYY-MM.js 并登记到 recommend-index.js。"
               if month == "2026-10" else ""),
            sections), encoding="utf-8")

    (DATA / "recommend-index.js").write_text(HEADER + """// 逐日推荐数据的汇总层：把各月度文件合并为 renderToday() 使用的全局量。
// 新增月份：新建 assets/data/recommend-YYYY-MM.js，并在 RECOMMEND_FILES 末尾登记。

const RECOMMEND_FILES=[RECOMMEND_2026_09,RECOMMEND_2026_10];
const TODAY_META=Object.assign({},...RECOMMEND_FILES.map(f=>f.meta));
const TODAY_RECOMMENDATION=Object.assign({},...RECOMMEND_FILES.map(f=>f.plans));
const TODAY_REASON=Object.assign({},...RECOMMEND_FILES.map(f=>f.reason));
const TODAY_SKILLS=Object.assign({},...RECOMMEND_FILES.map(f=>f.skills));
""", encoding="utf-8")

    # ---------- dashboard.js（扣减法） ----------
    dash = [l for i, l in enumerate(lines) if sc_i < i < sc_e and i not in excluded]
    dash = [l for l in dash if l.strip() != inline_line.strip()]
    anchor = next(i for i, l in enumerate(dash) if l.strip() == "updateRecommendation();")
    dash.insert(anchor, " document.getElementById('todayReason').innerHTML=(recKey&&TODAY_REASON[recKey])||"
                        "'<p>① 训练顺序：速度/爆发 → 主力量 → 单腿/后链 → 核心/篮球。</p>"
                        "<p>② 当前阶段：'+p.name+'；重点是 '+p.focus.join('、')+'。</p>"
                        "<p>③ 选择规则：从动作库选择“当前阶段 + 能力短板 + 可承受冲击”的最高质量动作，而不是把动作库做遍。</p>"
                        "<p>④ 今日Ready状态会进一步决定训练量；训练后请使用 /record-training-2 记录实际完成内容、Session RPE 和疼痛。</p>';")
    (ASSETS / "dashboard.js").write_text(
        HEADER + "// Dashboard 渲染逻辑与工具函数；全部数据来自 assets/data/*.js。\n"
        + "\n".join(dash).strip("\n") + "\n", encoding="utf-8")

    # ---------- 重写 dashboard.html ----------
    markup = "\n".join(lines[body_i:sc_i])
    SRC.write_text(f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>超人不会飞专属训练系统 2.0</title>
<link rel="stylesheet" href="assets/dashboard.css">
</head>
{markup}
<script src="assets/data/reference.js"></script>
<script src="assets/data/records.js"></script>
<script src="assets/data/actions.js"></script>
<script src="assets/data/recommend-2026-09.js"></script>
<script src="assets/data/recommend-2026-10.js"></script>
<script src="assets/data/recommend-index.js"></script>
<script src="assets/dashboard.js"></script>
</body>
</html>
""", encoding="utf-8")

    print("拆分完成：")
    for f in sorted(list(ASSETS.rglob("*.js")) + list(ASSETS.rglob("*.css")) + [SRC]):
        print(f"  {f.relative_to(ROOT)}  {f.stat().st_size} 字节")


if __name__ == "__main__":
    main()