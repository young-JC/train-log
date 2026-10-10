# -*- coding: utf-8 -*-
"""核对个人档案 Markdown 与只读 JS 镜像。无写入、无第三方依赖。

用法：python tools/verify_athlete_profile.py [--root 工作区路径]
"""
import argparse
from datetime import date, time
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import re
import subprocess
import sys


def table(text, heading):
    section = text.split('## ' + heading + '\n', 1)[1].split('\n## ', 1)[0]
    rows = [re.split(r'(?<!\\)\|', line.strip())[1:-1]
            for line in section.splitlines() if line.startswith('|')]
    return [[cell.strip().replace('\\|', '|') for cell in row] for row in rows[2:]]


def label(value):
    return '未记录' if value is None else str(value)


def verify(root):
    athlete = root / 'train2.0'
    profile_text = (athlete / 'athlete-profile.md').read_text(encoding='utf-8')
    metrics_text = (athlete / 'body-metrics.md').read_text(encoding='utf-8')
    script = athlete / 'assets/data/athlete.js'
    result = subprocess.run([
        'node', '-e',
        "const fs=require('fs'),vm=require('vm');const c=vm.createContext({});"
        "vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);"
        "process.stdout.write(vm.runInContext('JSON.stringify(ATHLETE_DATA)',c));",
        str(script)
    ], capture_output=True, text=True, encoding='utf-8', check=True)
    data = json.loads(result.stdout)
    profile = data['profile']
    errors = []

    def check(condition, message):
        if not condition:
            errors.append(message)

    def valid_date(value, name, optional=True):
        if value is None and optional:
            return
        try:
            check(isinstance(value, str) and date.fromisoformat(value).isoformat() == value,
                  name + ' 日期格式错误')
        except (TypeError, ValueError):
            check(False, name + ' 日期格式错误')

    def compare(actual, expected, name, numeric_columns=()):
        check(len(actual) == len(expected), name + ' 行数不一致')
        for index, (row, want) in enumerate(zip(actual, expected), 1):
            check(len(row) == len(want), f'{name} 第 {index} 行列数不一致')
            for column, (cell, value) in enumerate(zip(row, want)):
                equal = cell == label(value)
                if column in numeric_columns and value is not None:
                    try:
                        equal = Decimal(cell) == Decimal(str(value))
                    except InvalidOperation:
                        equal = False
                check(equal, f'{name} 第 {index} 行第 {column + 1} 列不一致')

    basic_fields = [('出生日期', 'birthDate'), ('年龄（未提供出生日期时）', 'ageYears'),
                    ('年龄对应日期', 'ageAsOf'), ('性别（可选）', 'sex'),
                    ('力量训练经历', 'strengthExperience'), ('篮球训练经历', 'basketballExperience'),
                    ('惯用手', 'dominantHand'), ('篮球位置', 'basketballPosition')]
    condition_fields = [('每周可训练天数', 'weeklyDays'), ('单次可用时间（分钟）', 'sessionMinutes'),
                        ('篮球活动安排', 'basketballSchedule'), ('可用器材', 'equipment'), ('可用场地', 'venues')]
    compare(table(profile_text, '基础资料'), [[title, profile['basic'][key]] for title, key in basic_fields], '基础资料')
    compare(table(profile_text, '训练条件'), [[title, profile['conditions'][key]] for title, key in condition_fields], '训练条件')
    for text, prefix, value in [(profile_text, '档案更新时间', profile['updatedAt']),
                                (metrics_text, '指标更新时间', data['metricsUpdatedAt'])]:
        check(prefix + '：' + label(value) in text.splitlines(), prefix + ' 不一致')
        valid_date(value, prefix)
    for key in ['birthDate', 'ageAsOf']:
        valid_date(profile['basic'][key], key)
    age = profile['basic']['ageYears']
    check(age is None or type(age) is int and age >= 0, '年龄应为非负整数或 null')
    check(age is None or profile['basic']['ageAsOf'] is not None, '记录年龄时必须提供对应日期')
    days = profile['conditions']['weeklyDays']
    minutes = profile['conditions']['sessionMinutes']
    days_range = re.fullmatch(r'([0-7])–([0-7])', days) if isinstance(days, str) else None
    check(days is None or type(days) is int and 0 <= days <= 7 or
          days_range is not None and int(days_range[1]) <= int(days_range[2]),
          '每周天数应为 0–7 整数、升序范围文本（如 3–4）或 null')
    check(minutes is None or type(minutes) in (int, float) and minutes > 0, '单次时间应为正数或 null')
    goals = profile['goals']
    compare(table(profile_text, '目标优先级'), [[g['priority'], g['title'], g['target'], g['targetDate'], g['updatedAt']] for g in goals], '目标优先级', (0,))
    priorities = [g['priority'] for g in goals]
    check(all(type(p) is int for p in priorities) and sorted(priorities) == list(range(1, len(goals) + 1)), '目标优先级应从 1 连续且唯一')
    for goal in goals:
        check(bool(goal['title']), '目标标题不能为空')
        valid_date(goal['targetDate'], '目标日期')
        valid_date(goal['updatedAt'], '目标更新时间', False)
    compare(table(profile_text, '长期伤病与明确限制'), [[r['description'], r['source'], r['updatedAt']] for r in profile['restrictions']], '长期限制')
    for restriction in profile['restrictions']:
        check(bool(restriction['description']) and bool(restriction['source']), '长期限制需要明确内容与来源')
        valid_date(restriction['updatedAt'], '限制更新时间', False)
    compare(table(profile_text, '重要变更记录'), [[c['date'], c['detail'], c['source']] for c in profile['changes']], '档案变更')
    for change in profile['changes']:
        valid_date(change['date'], '变更日期', False)

    keys = ['heightCm', 'weightKg', 'bodyFatPct', 'waistCm']
    measurements = data['measurements']
    expected = []
    ids = set()
    for row in measurements:
        record_id = row['id']
        check(record_id not in ids, '测量记录 ID 重复：' + record_id)
        ids.add(record_id)
        check(bool(re.fullmatch(r'BM-' + row['date'].replace('-', '') + r'-\d{2,}', record_id)), '测量 ID 与日期不匹配：' + record_id)
        valid_date(row['date'], record_id + ' 测量日期', False)
        valid_date(row['updatedAt'], record_id + ' 更新时间', False)
        check(row['updatedAt'] >= row['date'], record_id + ' 更新时间早于测量日期')
        if row['time'] is not None:
            try:
                check(time.fromisoformat(row['time']).strftime('%H:%M') == row['time'], record_id + ' 时间应为 HH:mm')
            except (ValueError, TypeError):
                check(False, record_id + ' 时间格式错误')
        check(any(row[key] is not None for key in keys), record_id + ' 至少需要一个指标')
        for key in keys:
            value = row[key]
            check(value is None or type(value) in (int, float) and value > 0 and (key != 'bodyFatPct' or value < 100), record_id + ' 指标数值错误：' + key)
            check(row['methods'][key] is None or isinstance(row['methods'][key], str) and bool(row['methods'][key].strip()), record_id + ' 方法应为非空文本或 null')
        check(bool(row['source']), record_id + ' 缺少来源')
        expected.append([record_id, row['date'], row['time']] + [row[key] for key in keys] +
                        [row['methods'][key] for key in keys] + [row['note'], row['source'], row['updatedAt']])
    compare(table(metrics_text, '测量历史'), expected, '测量历史', (3, 4, 5, 6))
    compare(table(metrics_text, '纠错记录'), [[c['date'], c['recordId'], c['field'], c['previous'], c['value'], c['reason']] for c in data['corrections']], '纠错记录')
    for correction in data['corrections']:
        valid_date(correction['date'], '纠错日期', False)
        check(correction['recordId'] in ids, '纠错记录引用了不存在的测量')
    if measurements:
        check(data['metricsUpdatedAt'] == max(row['updatedAt'] for row in measurements), '指标更新时间应为测量记录最新维护日期')
    if any(profile['basic'][key] is not None for _, key in basic_fields) or any(profile['conditions'][key] is not None for _, key in condition_fields) or goals or profile['restrictions']:
        check(profile['updatedAt'] is not None, '已有档案内容时需要更新时间')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    try:
        errors = verify(args.root)
    except (OSError, KeyError, IndexError, TypeError, ValueError, subprocess.SubprocessError) as exc:
        print('FAIL: 档案结构或读取错误：' + str(exc))
        return 1
    for error in errors:
        print('FAIL: ' + error)
    if not errors:
        print('OK: 个人档案、身体指标历史与 ATHLETE_DATA 镜像一致')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
