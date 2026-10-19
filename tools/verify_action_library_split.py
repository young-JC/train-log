# -*- coding: utf-8 -*-
"""校验当前动作库索引、分册与新增标准镜像；保留旧命令入口，不读取archive。"""
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / 'train2.0' / '动作库'


def main():
    failures = []

    def check(condition, message):
        if not condition:
            failures.append(message)

    index = (LIB / '00_索引.md').read_text(encoding='utf-8')
    table = index.split('## 动作索引表', 1)[1].split('\n## ', 1)[0]
    rows = []
    for line in table.splitlines():
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if line.startswith('| ') and len(cells) == 7 and cells[1] in list('ABCDEFGHIJKLMNOPQ'):
            rows.append(cells)
    lookup = {row[0]: row for row in rows}
    check(bool(rows) and len(rows) == len(lookup), '索引为空或有重名动作')
    declared = re.search(r'## 动作索引表（(\d+) 个动作）', index)
    check(declared is not None and int(declared[1]) == len(rows), '索引动作总数标注不一致')
    modules = sorted(LIB.glob('[A-Q]_*.md'))
    check(len(modules) == 17, '应有17个模块分册')
    blocks = {}
    for path in modules:
        text = path.read_text(encoding='utf-8')
        headings = list(re.finditer(r'^#{3,4} (.+)$', text, re.M))
        for i, heading in enumerate(headings):
            title = heading[1].strip()
            end = headings[i + 1].start() if i + 1 < len(headings) else len(text)
            body = text[heading.end():end]
            if title in lookup:
                blocks.setdefault(title, []).append((path.stem[0], body))
            elif '**AI动作元数据**' in body:
                check(False, f'分册动作未进入索引：{title}')
        count = sum(row[1] == path.stem[0] for row in rows)
        declared = re.search(r'本模块共 (\d+) 个动作', text)
        check(declared is not None and int(declared[1]) == count, f'{path.name} 动作数标注不一致')
        module_row = re.search(r'\| ' + path.stem[0] + r'｜[^\n]+`' + re.escape(path.name) + r'` \| (\d+) \|', index)
        check(module_row is not None and int(module_row[1]) == count, f'{path.name} 模块一览计数不一致')
    for title, module, pattern, ability, level, impact, period in rows:
        hits = blocks.get(title, [])
        check(len(hits) == 1, f'{title} 应恰好有一条分册详情，实际{len(hits)}')
        if len(hits) != 1:
            continue
        check(hits[0][0] == module, f'{title} 模块不一致')
        if module <= 'N':
            body = hits[0][1]
            for label in ['训练模块', '动作模式', '主要能力', '等级', '机械冲击', '周期适用', '推荐剂量', '前置条件', '退阶', '进阶', 'Quality Stop', '疼痛限制']:
                check(f'**{label}：**' in body, f'{title} 缺少{label}')
            for label, expected in [('主要能力', ability), ('等级', level), ('机械冲击', impact), ('周期适用', period)]:
                match = re.search(r'\*\*' + label + r'：\*\* ([^\n]+)', body)
                actual = match[1].split(' ｜ ')[0].strip() if match else None
                check(actual == expected, f'{title} 的{label}与索引不一致')
            check('**标准动作描述：**' in body, f'{title} 缺少标准动作描述')
    # 旧展示层保留历史别名；新增libraryTitle条目校验到当前Markdown。
    script = "const fs=require('fs'),vm=require('vm');process.stdout.write(vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8')+';JSON.stringify(ACTIONS.filter(a=>a.libraryTitle))'));"
    result = subprocess.run(['node', '-e', script, str(ROOT / 'train2.0/assets/data/actions.js')], capture_output=True, encoding='utf-8', check=True)
    mirrored = json.loads(result.stdout)
    check(len({a['libraryTitle'] for a in mirrored}) == len(mirrored), 'Dashboard标准镜像重名')
    for action in mirrored:
        title = action['libraryTitle']
        check(title in lookup, f'Dashboard动作缺少事实源：{title}')
        if title not in lookup or len(blocks.get(title, [])) != 1:
            continue
        row = lookup[title]
        check(action['name'] + '（' + action['en'] + '）' == title, f'{title} 镜像名称不一致')
        check([action['ability'], action['level'], action['impact']] == [row[3], row[4], row[5]], f'{title} 镜像元数据不一致')
        body = blocks[title][0][1]
        description = re.search(r'\*\*标准动作描述：\*\* (.+)', body)
        check(description is not None and action['desc'].startswith(description[1].strip()), f'{title} 镜像描述不一致')
        for label, display in [('推荐剂量', '剂量'), ('前置条件', '准入'), ('退阶', '退阶'), ('进阶', '进阶'), ('Quality Stop', '质量停止'), ('周期适用', '周期')]:
            value = re.search(r'\*\*' + label + r'：\*\* (.+)', body)
            check(value is not None and display + '：' + value[1].strip() in action['desc'], f'{title} 镜像{label}不一致')
    print(f'分册数：{len(modules)}；索引动作：{len(rows)}；标准镜像：{len(mirrored)}')
    if failures:
        for failure in failures:
            print('  - ' + failure)
        return 2
    print('全部校验通过：当前索引与分册1:1，标准镜像一致；未读取archive。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
