# -*- coding: utf-8 -*-
"""校验 dashboard 拆分是否无损、是否满足 file:// 约束。

比较对象：git HEAD 中的原始 train2.0/dashboard.html vs 拆分后的 dashboard.html + assets/。
校验一律基于「去空白后的文本相等」或「键集合相等」，不依赖行号。

检查项：
1. 顶层声明名跨文件唯一；
2. ACTIONS / ACTION_DESCRIPTIONS / FORMAL_* / WEEK_PHASES / PLAN3 / PLAN4 /
   ABILITY_ASSESSMENTS / WEAKNESSES / ACTION_MODULES 与原文逐字一致（忽略空白）；
3. TODAY_META / TODAY_RECOMMENDATION / TODAY_REASON / TODAY_SKILLS 的「日期 → 条目」
   映射与原文一致（推荐依据把原文内联的 09-30 / 10-01 折算进去）；
4. dashboard.html 只用 <link> 与经典 <script src>，不含 fetch / type="module" / 内联 <style>；
5. 被引用的资源文件都存在。

用法：
    PYTHONIOENCODING=utf-8 python tools/verify_dashboard_split.py
"""

from pathlib import Path
import importlib.util
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "train2.0" / "dashboard.html"
ASSETS = ROOT / "train2.0" / "assets"

spec = importlib.util.spec_from_file_location("sd", ROOT / "tools" / "split_dashboard.py")
sd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sd)

failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


def ws(text):
    return re.sub(r"\s+", "", text)


def end_of_section(lines, start, hi):
    for j in range(start + 1, hi):
        if lines[j].strip() in ("};", "];", "},", "}"):
            return j
    raise AssertionError(f"{lines[start][:40]} 未找到分节结束行")


def norm_block(text, decl):
    lines = text.splitlines()
    s = next(i for i, l in enumerate(lines) if l.strip().startswith(decl))
    e = end_of_section(lines, s, len(lines))
    return ws("\n".join(lines[s:e + 1]))


def norm_line(text, decl):
    for l in text.splitlines():
        if l.strip().startswith(decl):
            return ws(l)
    raise AssertionError(f"未找到 {decl}")


def entries(text, decl):
    lines = text.splitlines()
    s = next(i for i, l in enumerate(lines) if l.strip().startswith(decl))
    e = end_of_section(lines, s, len(lines))
    return {d: ws(t) for d, t in sd.split_entries(lines[s:e + 1])}


def main():
    r = subprocess.run(["git", "show", "HEAD:train2.0/dashboard.html"], cwd=ROOT, capture_output=True)
    assert r.returncode == 0, "无法从 git 读取原始 dashboard.html"
    orig = r.stdout.decode("utf-8")
    new_html = HTML.read_text(encoding="utf-8")
    files = {f.name: f.read_text(encoding="utf-8") for f in sorted(ASSETS.rglob("*.js"))}
    all_new = "\n".join(files.values())

    # 1. 顶层声明唯一
    per_file = {}
    for name, text in files.items():
        for n in sd.re.findall(r"^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)", text, flags=re.M):
            per_file.setdefault(n, []).append(name)
    dupes = {k: v for k, v in per_file.items() if len(v) > 1}
    check(not dupes, f"跨文件重名声明：{dupes}")

    # 2. 逐字一致（忽略空白）
    for decl, label in [("const ACTIONS=[", "ACTIONS"),
                        ("const ACTION_DESCRIPTIONS={", "ACTION_DESCRIPTIONS"),
                        ("const FORMAL_RECORDS={", "FORMAL_RECORDS"),
                        ("const PLAN3={", "PLAN3"),
                        ("const PLAN4={", "PLAN4"),
                        ("const ABILITY_ASSESSMENTS=[", "ABILITY_ASSESSMENTS"),
                        ("const WEAKNESSES=[", "WEAKNESSES")]:
        check(norm_block(orig, decl) == norm_block(all_new, decl), f"{label} 内容与原文不一致")
    for decl in ("const FORMAL_MONTH=", "const FORMAL_TODAY_READINESS=", "const FORMAL_REST_DAYS=",
                 "const WEEK_PHASES=", "const ACTION_MODULES=", "function actionDisplayName(",
                 "function moduleDisplayName(", "function actionDescription("):
        check(norm_line(orig, decl) == norm_line(all_new, decl), f"{decl} 与原文不一致")

    # 3. 逐日推荐数据
    month_files = {"2026-09": "recommend-2026-09.js", "2026-10": "recommend-2026-10.js"}
    section = {"TODAY_META": "meta", "TODAY_RECOMMENDATION": "plans",
               "TODAY_REASON": "reason", "TODAY_SKILLS": "skills"}
    for obj, sec in section.items():
        o = entries(orig, f"const {obj}={{")
        n = {}
        for text in (files[month_files["2026-09"]], files[month_files["2026-10"]]):
            n.update(entries(text, f"{sec}:{{"))
        if obj == "TODAY_REASON":
            m = re.search(r"recKey==='(2026-10-01)'\?'(.*?)'\s*:\s*recKey==='(2026-09-30)'\?'(.*?)'\s*:\s*", orig)
            check(m is not None, "未能从原文解析内联的 09-30 / 10-01 推荐依据")
            if m:
                # 新文件里条目文本含键前缀，原文侧按同样口径还原
                o[m.group(3)] = ws(f"'{m.group(3)}':'{m.group(4)}'")
                o[m.group(1)] = ws(f"'{m.group(1)}':'{m.group(2)}'")
        check(set(o) == set(n), f"{obj} 日期集合不一致：缺 {sorted(set(o) - set(n))}，多 {sorted(set(n) - set(o))}")
        diff = [d for d in sorted(set(o) & set(n)) if o[d] != n[d]]
        check(not diff, f"{obj} 条目内容不一致：{diff}")

    # 4. file:// 约束
    check('<link rel="stylesheet"' in new_html, "缺少外链样式表")
    check("<style>" not in new_html, "dashboard.html 仍含内联 <style>")
    check("fetch(" not in new_html and "fetch(" not in all_new, "出现 fetch(，file:// 下会失败")
    check('type="module"' not in new_html, '出现 type="module"，file:// 下会失败')

    # 5. 资源存在
    for m in re.finditer(r'<script src="([^"]+)"', new_html):
        check((HTML.parent / m.group(1)).exists(), f"引用的脚本不存在：{m.group(1)}")
    for m in re.finditer(r'<link rel="stylesheet" href="([^"]+)"', new_html):
        check((HTML.parent / m.group(1)).exists(), f"引用的样式不存在：{m.group(1)}")

    print(f"dashboard.html: {len(new_html.encode('utf-8'))} 字节（原 {len(orig.encode('utf-8'))} 字节）")
    for name, text in sorted(files.items()):
        print(f"  {name}: {len(text.encode('utf-8'))} 字节")
    if failures:
        print("\n校验失败:")
        for f in failures:
            print("  -", f)
        return 2
    print("\n全部校验通过：数据结构与原文一致，且满足 file:// 约束。")
    return 0


if __name__ == "__main__":
    sys.exit(main())