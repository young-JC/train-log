"""train2.0 复盘：只读统计/到期检查，以及显式保存/同步报告。仅使用标准库。

python tools/training_review.py stats --start 2026-09-28 --end 2026-10-04
python tools/training_review.py due --as-of 2026-10-13
python tools/training_review.py save --input <AI 核对后的 JSON 文件>
python tools/training_review.py sync
python tools/training_review.py verify
"""
import argparse
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

CYCLE_START = '2026-09-21'
ROOT = Path(__file__).resolve().parents[1]
PREFIX = '// 只读复盘镜像，由 tools/training_review.py sync 生成；事实源为 reviews/*.md。\nconst TRAINING_REVIEWS = '
MARKER = re.compile(r'<!-- review-data\n(.*?)\n-->', re.S)


def iso(value):
    parsed = date.fromisoformat(value)
    if parsed.isoformat() != value:
        raise ValueError('日期必须为 YYYY-MM-DD')
    return parsed


def today():
    return datetime.now(timezone(timedelta(hours=8))).date().isoformat()


def dumps(value):
    return json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)


def digest(value):
    return hashlib.sha256(value.strip().encode('utf-8')).hexdigest()


def source_blocks(root):
    """按详情标题读取；月历/概览不参与计算。同日多详情拒绝静默合并。"""
    result = {}
    for path in sorted((root / 'train2.0/records').glob('????-??.md')):
        text = path.read_text(encoding='utf-8-sig').replace('\r\n', '\n')
        sections = re.finditer(r'^### [^\n]*?(\d{4}-\d{2}-\d{2})[^\n]*\n(.*?)(?=^### |^## |\Z)', text, re.M | re.S)
        for match in sections:
            day = match[1]
            iso(day)
            if day[:7] != path.stem:
                raise ValueError(f'{path.name}: 详情日期不属于本月 {day}')
            if day in result:
                raise ValueError(f'同日重复详情：{day}')
            result[day] = match[0].strip()
    return result


def field(block, label):
    match = re.search(r'^\|\s*' + re.escape(label) + r'\s*\|\s*([^|]*)\|', block, re.M)
    return match[1].strip() if match else None


def number(raw, unit='', maximum=None):
    if raw is None:
        return None
    match = re.match(r'^(?:约\s*)?(\d[\d,]*(?:\.\d+)?)\s*' + re.escape(unit) + r'(?:\s|[（(·]|$)', raw)
    if not match:
        return None
    value = float(match[1].replace(',', ''))
    if value < 0 or maximum is not None and value > maximum:
        return None
    return int(value) if value.is_integer() else value


def pain(raw):
    values = [float(v) for v in re.findall(r'(?<![\d.])(\d+(?:\.\d+)?)\s*/\s*10', raw or '')]
    return max(values) if values and all(0 <= v <= 10 for v in values) else None


def parse_record(day, block):
    match = re.search(r'^\*\*训练状态\*\*[：:]\s*(.*)$', block, re.M)
    state = match[1].strip() if match else '未记录'
    # 恢复日可有真实时长/负荷；仅评估、取消与未训练不计训练天。
    active = state.startswith(('已完成', '部分完成', '恢复日', '主动恢复'))
    raw = {key: field(block, label) for key, label in {
        'duration': '训练总时长', 'srpe': 'Session RPE', 'load': 'Session Load',
        'painBefore': '训练前疼痛', 'painDuring': '训练中最高疼痛',
        'painAfter': '训练后疼痛', 'painNext': '次日疼痛'}.items()}
    readiness = re.search(r'^\|\s*睡眠\s*\|[^\n]*\n\|[^\n]*\n\|([^\n]+)', block, re.M)
    ready_fields = {key: None for key in ('sleep', 'fatigue', 'soreness', 'readinessPain', 'motivation', 'readiness')}
    if readiness:
        cells = [v.strip() for v in readiness[1].split('|')]
        if len(cells) >= 7:
            for index, key in enumerate(ready_fields):
                maximum = 100 if key == 'readiness' else 10 if key == 'readinessPain' else 5
                ready_fields[key] = number(cells[index], '/' + str(maximum), maximum)
                if maximum == 5 and ready_fields[key] == 0:
                    ready_fields[key] = None
                raw[key] = cells[index]
    duration = number(raw['duration'], '分钟')
    srpe = number(raw['srpe'], '/10', 10)
    load = number(raw['load'], 'AU')
    warning = []
    if active and load is not None and (duration is None or srpe is None):
        warning.append('负荷虽有记录，但缺少可核对的时长或 Session RPE；负荷不纳入合计')
        load = None
    if active and load is not None and abs(duration * srpe - load) > 0.01:
        warning.append('Session Load 与时长×Session RPE 不一致；负荷不纳入合计')
        load = None
    return dict(date=day, status=state, training=active, duration=duration,
                durationApproximate=bool(raw['duration'] and raw['duration'].startswith('约')),
                srpe=srpe, load=load, raw=raw, warnings=warning, **ready_fields,
                source=f'records/{day[:7]}.html#detail-{day}',
                **{key: pain(raw[key]) for key in ('painBefore', 'painDuring', 'painAfter', 'painNext')})


def aggregate(rows, key):
    known = [r[key] for r in rows if r[key] is not None]
    return {'known': len(known), 'total': len(rows),
            'sum': round(sum(known), 2) if known else None,
            'mean': round(sum(known) / len(known), 2) if known else None,
            'max': max(known) if known else None,
            'complete': bool(rows) and len(known) == len(rows),
            'missingDates': [r['date'] for r in rows if r[key] is None],
            'approximateDates': [r['date'] for r in rows if key in ('duration', 'load') and r[key] is not None and r['durationApproximate']]}


def statistics(root, start, end, as_of):
    if iso(start) > iso(end):
        raise ValueError('开始日期不能晚于结束日期')
    iso(as_of)
    cutoff = min(end, as_of)
    blocks = source_blocks(root)
    selected = {d: b for d, b in blocks.items() if start <= d <= cutoff}
    rows = [parse_record(d, b) for d, b in sorted(selected.items())]
    training = [r for r in rows if r['training']]
    daily = ('readiness', 'sleep', 'fatigue', 'soreness', 'readinessPain', 'motivation')
    metrics = {key: aggregate(rows if key in daily else training, key)
               for key in ('duration', 'srpe', 'load') + daily + ('painBefore', 'painDuring', 'painAfter', 'painNext')}
    return {'start': start, 'end': end, 'dataThrough': cutoff,
            'recordDays': len(rows), 'trainingDays': len(training), 'metrics': metrics,
            'records': rows, 'sources': {d: digest(b) for d, b in sorted(selected.items())}}


def report_id(report):
    return f"{report['cycleStart']}-{report['type']}-{report['start']}-{report['end']}"


def load_reports(root):
    reports = []
    for path in sorted((root / 'train2.0/reviews').glob('*.md')):
        if path.name == '00_索引.md':
            continue
        match = MARKER.search(path.read_text(encoding='utf-8'))
        if not match:
            raise ValueError(f'{path.name}: 缺少 review-data 数据块')
        report = json.loads(match[1])
        if path.stem != report_id(report):
            raise ValueError(f'{path.name}: 报告标识与文件名不一致')
        reports.append(report)
    return sorted(reports, key=lambda r: (r['updatedAt'], r['id']), reverse=True)


def stale(report, current):
    actual = {d: h for d, h in current.items() if report['start'] <= d <= report['dataThrough']}
    return actual != report['sources']


def due(root, as_of):
    end_day = iso(as_of)
    first = iso(CYCLE_START)
    reports = load_reports(root)
    current = {d: digest(b) for d, b in source_blocks(root).items()}
    pending = []
    for week in range(1, 13):
        end = first + timedelta(days=week * 7 - 1)
        if end >= end_day:
            continue
        for kind, length in [('weekly', 7)] + ([('stage', 28)] if week % 4 == 0 else []):
            start = end - timedelta(days=length - 1)
            key = report_id({'cycleStart': CYCLE_START, 'type': kind, 'start': str(start), 'end': str(end)})
            found = next((r for r in reports if r['id'] == key), None)
            if found is None or found['status'] != 'complete' or stale(found, current):
                pending.append({'id': key, 'type': kind, 'start': str(start), 'end': str(end),
                                'week': week, 'reason': '待刷新' if found else '待复盘'})
    return pending


def applicable(root, target_date):
    iso(target_date)
    current = {d: digest(b) for d, b in source_blocks(root).items()}
    reports = load_reports(root)
    return [match for kind in ('stage', 'weekly') if (match := next((r for r in reports
            if r['type'] == kind and r['cycleStart'] == CYCLE_START and r['status'] == 'complete'
            and r['applicability'] and r['applicability']['start'] <= target_date <= r['applicability']['end']
            and r['updatedAt'][:10] <= target_date and not stale(r, current)), None))]


def draft_report(root, kind, start, end, stamp=None):
    stamp = stamp or datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')
    day = stamp[:10]
    stats = statistics(root, start, end, day)
    first, last = iso(CYCLE_START), iso(end)
    length = 7 if kind == 'weekly' else 28
    complete = end < day
    profile = root / 'train2.0/athlete-profile.md'
    match = re.search(r'档案更新时间[：:]\s*(\d{4}-\d{2}-\d{2})', profile.read_text(encoding='utf-8')) if profile.exists() else None
    report = {'cycleStart': CYCLE_START, 'type': kind, 'start': start, 'end': end,
              'dataThrough': stats['dataThrough'], 'generatedAt': stamp, 'updatedAt': stamp,
              'status': 'complete' if complete else 'progress',
              'profileUpdatedAt': match[1] if match else '未记录', 'summary': '',
              'execution': [{'week': week, 'slot': f'D{slot}', 'status': 'unknown', 'dates': [], 'note': ''}
                            for week in range((iso(start)-first).days//7+1, (last-first).days//7+2) for slot in range(1, 4)],
              'extraSessions': [], 'findings': [], 'decisions': [], 'gaps': [],
              'stats': stats, 'sources': stats['sources'], 'applicability': None}
    if complete and last < first + timedelta(days=83):
        report['applicability'] = {'start': str(last + timedelta(days=1)),
                                   'end': str(min(last + timedelta(days=length), first + timedelta(days=83)))}
    report['id'] = report_id(report)
    # 验证元数据，草稿的空总结必须在 save 前由 AI 补全。
    check = dict(report, summary='草稿元数据校验')
    validate_report(check, root)
    return report


def validate_report(report, root=None):
    required = ('cycleStart', 'type', 'start', 'end', 'dataThrough', 'generatedAt', 'updatedAt',
                'status', 'profileUpdatedAt', 'summary', 'execution', 'extraSessions',
                'findings', 'decisions', 'gaps', 'stats', 'sources', 'applicability', 'id')
    if any(key not in report for key in required):
        raise ValueError('报告缺少必要字段')
    first, start, end = (iso(report[k]) for k in ('cycleStart', 'start', 'end'))
    cutoff = iso(report['dataThrough'])
    timestamps = [datetime.fromisoformat(report[k]) for k in ('generatedAt', 'updatedAt')]
    if any(t.utcoffset() != timedelta(hours=8) for t in timestamps) or timestamps[0] > timestamps[1]:
        raise ValueError('时间戳必须带 +08:00，更新时间不能早于生成时间')
    if report['cycleStart'] != CYCLE_START or report['type'] not in ('weekly', 'stage'):
        raise ValueError('仅支持当前正式周期的 weekly/stage 报告')
    length = 7 if report['type'] == 'weekly' else 28
    if (end - start).days != length - 1 or (start - first).days % length or not first <= start <= end <= first + timedelta(days=83):
        raise ValueError('区间必须对齐当前周期的完整周或四周阶段')
    if report['status'] not in ('complete', 'progress') or not start <= cutoff <= end:
        raise ValueError('无效的报告状态或数据截止日期')
    analysis_day = timestamps[1].date()
    if cutoff > analysis_day or report['status'] != ('complete' if end < analysis_day else 'progress'):
        raise ValueError('尚未结束的区间只能生成进展报告')
    if report['status'] == 'complete' and cutoff != end:
        raise ValueError('完整报告必须核对整个区间')
    if report['id'] != report_id(report):
        raise ValueError('报告标识不一致')
    expected_app = None
    if report['status'] == 'complete' and end < first + timedelta(days=83):
        expected_app = {'start': str(end + timedelta(days=1)),
                        'end': str(min(end + timedelta(days=length), first + timedelta(days=83)))}
    if report['applicability'] != expected_app:
        raise ValueError('适用区间应为下一周/下一阶段；进展报告和 W12 后不自动生效')
    slots = report['execution']
    expected_slots = {(week, f'D{slot}') for week in range((start-first).days//7+1, (end-first).days//7+2)
                      for slot in range(1, 4)}
    if not isinstance(slots, list) or len(slots) != len(expected_slots) or {(s['week'], s['slot']) for s in slots} != expected_slots:
        raise ValueError('必须逐一核对默认 3 日版全部槽位，不得重复或遗漏')
    for slot in slots:
        if slot['status'] not in ('complete', 'partial', 'no-record', 'not-completed', 'unknown'):
            raise ValueError('无效的槽位状态')
        if slot['status'] in ('complete', 'partial', 'not-completed') and not slot['dates']:
            raise ValueError('已确认的槽位状态必须附训练记录证据')
        if any(d not in report['sources'] for d in slot['dates']):
            raise ValueError('槽位证据不在已读取正式记录中')
    for field_name in ('findings', 'decisions', 'extraSessions'):
        if not isinstance(report[field_name], list):
            raise ValueError(f'{field_name} 必须为列表')
        for item in report[field_name]:
            if not item['text'] or not isinstance(item['dates'], list) or any(d not in report['sources'] for d in item['dates']):
                raise ValueError(f'{field_name} 的证据日期无效')
    if not isinstance(report['summary'], str) or not report['summary'].strip() or not isinstance(report['gaps'], list) or any(not isinstance(g, str) for g in report['gaps']):
        raise ValueError('summary 应为非空文字，gaps 应为文字列表；不能直接保存未分析草稿')
    if root is not None:
        actual = statistics(root, report['start'], report['end'], report['dataThrough'])
        if report['stats'] != actual or report['sources'] != actual['sources']:
            raise ValueError('报告统计或来源指纹与当前正式记录不一致，请重新运行 stats')


def rate(report):
    return round(100 * sum(s['status'] == 'complete' for s in report['execution']) / len(report['execution']), 1)


def render_markdown(report):
    kind = '周复盘' if report['type'] == 'weekly' else '阶段复盘'
    lines = [f"# {report['start']} 至 {report['end']} · {kind}", '',
             f"状态：{'完整区间报告' if report['status'] == 'complete' else '阶段进展（不自动影响推荐）'}", '',
             f"数据截止：{report['dataThrough']}；生成：{report['generatedAt']}；更新：{report['updatedAt']}", '',
             f"个人档案更新时间：{report['profileUpdatedAt']}（使用当时资料；身体指标如使用须在证据中注明测量日期）", '',
             '## 总结', '', report['summary'], '', '## 计划执行', '',
             f'已确认完整完成率：{rate(report)}%（部分完成不折算；无记录不等于未训练）', '',
             '| 周 | 槽位 | 状态 | 证据日期 | 说明 |', '|---|---|---|---|---|']
    names = {'complete': '完整完成', 'partial': '部分完成', 'no-record': '无记录', 'not-completed': '明确未完成', 'unknown': '待核对'}
    clean = lambda s: str(s).replace('|', '\\|').replace('\n', ' ')
    for slot in report['execution']:
        lines.append(f"| W{slot['week']} | {slot['slot']} | {names[slot['status']]} | {', '.join(slot['dates']) or '—'} | {clean(slot['note'])} |")
    lines += ['', '## 负荷与恢复', '', f"正式训练天数：{report['stats']['trainingDays']}（含有实际训练的恢复日；额外实战不抵扣计划槽位）", '',
              '| 指标 | 有效数/训练记录数 | 已知合计 | 有效值均值 | 最高值 | 缺失日期 |', '|---|---|---|---|---|---|']
    for key, metric in report['stats']['metrics'].items():
        lines.append(f"| {key} | {metric['known']}/{metric['total']} | {metric['sum'] if key in ('duration', 'load') else '—'} | {metric['mean']} | {metric['max']} | {', '.join(metric['missingDates']) or '—'} |")
    approximate = report['stats']['metrics']['duration']['approximateDates']
    lines += ['', '只统计有效已记录值；不完整合计不是完整负荷。Readiness 及其原始项覆盖区间内正式状态记录，其余指标覆盖实际训练。疼痛最高值保留原始时点，不能据此推断恢复完全。',
              '含近似时长的训练日期：' + ('、'.join(approximate) or '无'), '']
    for title, key in [('恢复与额外训练', 'extraSessions'), ('目标、能力与恢复证据', 'findings'), ('下一步：保留 / 调整 / 暂缓', 'decisions')]:
        lines += ['## ' + title, '']
        for item in report[key]:
            evidence = '、'.join(f"[{d}](../records/{d[:7]}.html#detail-{d})" for d in item['dates'])
            lines += [f"- {item['text']}" + (f'（{evidence}）' if evidence else ''), '']
    lines += ['## 数据缺口', ''] + [f'- {gap}' for gap in report['gaps']]
    app = report['applicability']
    lines += ['', '## 推荐适用时间', '', f"{app['start']} 至 {app['end']}" if app else '不自动生效；进展报告或下一周期待确认。', '',
              '<!-- review-data', dumps(report), '-->', '']
    return '\n'.join(lines)


def mirror(root):
    reports = load_reports(root)
    for report in reports:
        validate_report(report)
    current = {d: digest(b) for d, b in sorted(source_blocks(root).items())}
    data = {'cycleStart': CYCLE_START, 'mode': '3', 'currentSources': current, 'reports': reports}
    js = PREFIX + dumps(data).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029') + ';\n'
    lines = ['# train2.0 周期复盘索引', '', '> 报告是复盘结论的事实源；训练事实仍以月度 Markdown 为准。索引和 JS 镜像由工具生成。', '',
             '| 区间 | 类型 | 状态 | 更新时间 | 报告 |', '|---|---|---|---|---|']
    for report in reports:
        status = '待刷新' if stale(report, current) else ('完整区间' if report['status'] == 'complete' else '进展')
        lines.append(f"| {report['start']} 至 {report['end']} | {report['type']} | {status} | {report['updatedAt']} | [查看]({report['id']}.md) |")
    if not reports:
        lines += ['', '暂无复盘报告。到期后在对话中说“复盘上周”或“复盘 W1–W4”；不会自动补造历史报告。']
    return js, '\n'.join(lines) + '\n'


def sync(root, verify=False):
    js, index = mirror(root)
    targets = [(root / 'train2.0/assets/data/reviews.js', js), (root / 'train2.0/reviews/00_索引.md', index)]
    if verify:
        for path, expected in targets:
            if not path.exists() or path.read_text(encoding='utf-8') != expected:
                raise ValueError(f'镜像/索引待同步：{path}')
        for report in load_reports(root):
            path = root / 'train2.0/reviews' / (report['id'] + '.md')
            if path.read_text(encoding='utf-8') != render_markdown(report):
                raise ValueError(f'报告正文与结构数据不一致：{path}')
    else:
        for path, expected in targets:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(expected, encoding='utf-8', newline='\n')


def save_report(root, incoming):
    report = dict(incoming)
    report['cycleStart'] = CYCLE_START
    report['id'] = report_id(report)
    previous = next((r for r in load_reports(root) if r['id'] == report['id']), None)
    if previous:
        report['generatedAt'] = previous['generatedAt']
        if report['updatedAt'] <= previous['updatedAt']:
            raise ValueError('重跑须使用晚于原报告的 updatedAt；保留首次 generatedAt')
    validate_report(report, root)
    # 写入前先验证已有报告，避免新报告落盘后才发现既有索引损坏。
    mirror(root)
    target = root / 'train2.0/reviews' / (report['id'] + '.md')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render_markdown(report), encoding='utf-8', newline='\n')
    sync(root)
    return report['id']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    sub = parser.add_subparsers(dest='command', required=True)
    stats = sub.add_parser('stats', help='只读区间统计；不判断槽位和能力进步')
    stats.add_argument('--start', required=True)
    stats.add_argument('--end', required=True)
    stats.add_argument('--as-of', default=today())
    check = sub.add_parser('due', help='只读列出已结束但未复盘/待刷新的周与阶段')
    check.add_argument('--as-of', default=today())
    select = sub.add_parser('applicable', help='只读选择推荐日期适用、未过期且未待刷新的报告')
    select.add_argument('--date', required=True)
    draft = sub.add_parser('draft', help='只读输出统计和待 AI 核对的报告 JSON 草稿；不保存')
    draft.add_argument('--type', choices=('weekly', 'stage'), required=True)
    draft.add_argument('--start', required=True)
    draft.add_argument('--end', required=True)
    save = sub.add_parser('save', help='显式保存 AI 已核对的 JSON 报告并同步镜像')
    save.add_argument('--input', type=Path, required=True)
    sub.add_parser('sync', help='更新来源指纹/索引/镜像；不修改报告结论')
    sub.add_parser('verify', help='只读校验报告正文、索引和镜像一致')
    args = parser.parse_args()
    try:
        if args.command == 'stats':
            result = statistics(args.root, args.start, args.end, args.as_of)
        elif args.command == 'due':
            result = due(args.root, args.as_of)
        elif args.command == 'applicable':
            result = applicable(args.root, args.date)
        elif args.command == 'draft':
            result = draft_report(args.root, args.type, args.start, args.end)
        elif args.command == 'save':
            result = {'saved': save_report(args.root, json.loads(args.input.read_text(encoding='utf-8-sig')))}
        else:
            sync(args.root, verify=args.command == 'verify')
            result = {'ok': True, 'command': args.command}
        print(dumps(result))
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print(f'复盘工具错误：{exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
