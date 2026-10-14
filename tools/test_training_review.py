"""复盘统计与持久化回归检查；报告只写入隔离的临时目录。"""
from copy import deepcopy
from pathlib import Path
import shutil
import tempfile
import unittest

import training_review as review


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        records = self.root / 'train2.0/records'
        records.mkdir(parents=True)
        for month in ('2026-09', '2026-10'):
            shutil.copyfile(review.ROOT / f'train2.0/records/{month}.md', records / f'{month}.md')
        shutil.copyfile(review.ROOT / 'train2.0/athlete-profile.md', self.root / 'train2.0/athlete-profile.md')

    def tearDown(self):
        self.temp.cleanup()

    def fixture(self):
        report = review.draft_report(self.root, 'weekly', '2026-09-28', '2026-10-04', '2026-10-05T10:00:00+08:00')
        report['summary'] = '测试：有部分完成与负荷缺项，无法判断全部目标进展。'
        for slot, status, day in zip(report['execution'], ('complete', 'partial', 'complete'), ('2026-09-28', '2026-09-30', '2026-10-04')):
            slot.update(status=status, dates=[day], note='以正式记录为证据')
        report['gaps'] = ['10-04 缺时长与负荷，不能按零计入。']
        report['findings'] = [{'text': '数据不完整，不能把历史最佳当作近期成绩。', 'dates': ['2026-10-04']}]
        return report

    def test_real_cross_month_w2(self):
        stats = review.statistics(self.root, '2026-09-28', '2026-10-04', '2026-10-13')
        self.assertEqual(stats['trainingDays'], 5)  # 含恢复和额外篮球，非槽位数。
        self.assertEqual(stats['metrics']['load']['sum'], 1712)
        self.assertEqual(stats['metrics']['load']['known'], 4)
        self.assertFalse(stats['metrics']['load']['complete'])
        self.assertEqual(stats['metrics']['load']['missingDates'], ['2026-10-04'])
        self.assertEqual(stats['metrics']['painNext']['known'], 1)
        self.assertEqual(stats['metrics']['sleep']['known'], 5)
        self.assertEqual(stats['metrics']['fatigue']['mean'], 1.2)
        self.assertEqual(stats['records'][1]['status'], '恢复日')

    def test_cancel_and_makeup_do_not_double_count(self):
        stats = review.statistics(self.root, '2026-09-21', '2026-09-27', '2026-10-13')
        self.assertEqual(stats['trainingDays'], 4)
        self.assertEqual(stats['recordDays'], 5)
        self.assertEqual(stats['metrics']['load']['sum'], 1720)
        self.assertEqual(stats['metrics']['readiness']['total'], 5)
        self.assertEqual(stats['metrics']['readinessPain']['max'], 2)  # 取消日的疼痛仍进入当日状态统计。

    def test_empty_range_and_cutoff(self):
        stats = review.statistics(self.root, '2026-11-16', '2026-12-13', '2026-12-14')
        self.assertEqual(stats['trainingDays'], 0)
        self.assertIsNone(stats['metrics']['load']['sum'])
        self.assertFalse(stats['metrics']['load']['complete'])
        stats = review.statistics(self.root, '2026-09-21', '2026-10-18', '2026-10-10')
        self.assertEqual(stats['dataThrough'], '2026-10-10')
        self.assertNotIn('2026-10-11', stats['sources'])
        self.assertEqual(stats['metrics']['duration']['approximateDates'], ['2026-10-08'])

    def test_assessment_only_and_unknown_status(self):
        block = '**训练状态**：仅测试\n\n| Session Load | 50 AU |\n'
        row = review.parse_record('2026-10-09', block)
        self.assertFalse(row['training'])
        self.assertFalse(review.parse_record('2026-10-09', '| Session Load | 50 AU |')['training'])
        self.assertIsNone(review.parse_record('2026-10-09', block)['readiness'])

    def test_inconsistent_or_unsupported_load_excluded(self):
        block = '**训练状态**：已完成\n| 训练总时长 | 10 分钟 |\n| Session RPE | 2/10 |\n| Session Load | 500 AU |\n'
        row = review.parse_record('2026-10-09', block)
        self.assertIsNone(row['load'])
        self.assertTrue(row['warnings'])
        self.assertIsNone(review.number('7–8/10', '/10', 10))
        self.assertEqual(review.pain('10-12 训练前 0/10；实战中 1/10'), 1)

    def test_duplicate_detail_is_rejected(self):
        path = self.root / 'train2.0/records/2026-10.md'
        with path.open('a', encoding='utf-8') as stream:
            stream.write('\n### 训练详情 2026-10-04\n\n**训练状态**：已完成\n')
        with self.assertRaisesRegex(ValueError, '重复'):
            review.source_blocks(self.root)

    def test_save_repeat_identity_and_facts_untouched(self):
        before = review.source_blocks(self.root)
        report = self.fixture()
        key = review.save_report(self.root, report)
        report['updatedAt'] = '2026-10-05T11:00:00+08:00'
        report['generatedAt'] = report['updatedAt']
        report['summary'] = '补充分析，保留首次生成时间。'
        self.assertEqual(review.save_report(self.root, report), key)
        reports = review.load_reports(self.root)
        self.assertEqual(len(reports), 1)
        self.assertEqual(reports[0]['generatedAt'], '2026-10-05T10:00:00+08:00')
        self.assertEqual(review.source_blocks(self.root), before)
        self.assertEqual(review.rate(reports[0]), 66.7)
        review.sync(self.root, verify=True)

    def test_correction_append_and_removal_mark_stale_without_rewriting(self):
        report = self.fixture()
        review.save_report(self.root, report)
        original = (self.root / f"train2.0/reviews/{report['id']}.md").read_bytes()
        path = self.root / 'train2.0/records/2026-10.md'
        text = path.read_text(encoding='utf-8')
        changes = [text.replace('80 分钟', '81 分钟'), text + '\n### 训练详情 2026-10-02\n\n**训练状态**：未训练\n',
                   text.replace('### 训练详情 2026-10-04', '### 移除的条目')]
        for changed in changes:
            path.write_text(changed, encoding='utf-8')
            review.sync(self.root)
            current = {d: review.digest(b) for d, b in review.source_blocks(self.root).items()}
            self.assertTrue(review.stale(report, current))
            self.assertEqual(review.applicable(self.root, '2026-10-05'), [])
            self.assertEqual((self.root / f"train2.0/reviews/{report['id']}.md").read_bytes(), original)
            review.sync(self.root, verify=True)
        path.write_text(text, encoding='utf-8')
        review.sync(self.root)
        self.assertEqual(len(review.applicable(self.root, '2026-10-05')), 1)

    def test_target_date_excludes_future_updated_expired_and_progress(self):
        report = self.fixture()
        report['updatedAt'] = '2026-10-06T12:00:00+08:00'
        review.save_report(self.root, report)
        self.assertEqual(review.applicable(self.root, '2026-10-05'), [])
        self.assertEqual(len(review.applicable(self.root, '2026-10-06')), 1)
        self.assertEqual(review.applicable(self.root, '2026-10-12'), [])
        progress = review.draft_report(self.root, 'stage', '2026-09-21', '2026-10-18', '2026-10-13T12:00:00+08:00')
        progress['summary'] = '截至今日的阶段进展。'
        self.assertIsNone(progress['applicability'])
        review.save_report(self.root, progress)
        self.assertEqual(review.applicable(self.root, '2026-10-19'), [])

    def test_due_boundaries_and_w12_no_new_cycle(self):
        self.assertEqual(review.due(self.root, '2026-09-27'), [])
        self.assertEqual(len(review.due(self.root, '2026-10-13')), 3)
        self.assertEqual(len(review.due(self.root, '2026-10-19')), 5)
        report = review.draft_report(self.root, 'stage', '2026-11-16', '2026-12-13', '2026-12-14T12:00:00+08:00')
        self.assertIsNone(report['applicability'])
        self.assertEqual(report['stats']['trainingDays'], 0)

    def test_tampering_and_unanalyzed_drafts_rejected(self):
        report = self.fixture()
        bad = deepcopy(report)
        bad['stats']['metrics']['load']['sum'] += 1
        with self.assertRaisesRegex(ValueError, '统计'):
            review.save_report(self.root, bad)
        bad = deepcopy(report)
        bad['execution'][0]['dates'] = []
        with self.assertRaisesRegex(ValueError, '证据'):
            review.save_report(self.root, bad)
        bad = deepcopy(report)
        bad['summary'] = ''
        with self.assertRaisesRegex(ValueError, '草稿'):
            review.save_report(self.root, bad)
        review.save_report(self.root, report)
        js = self.root / 'train2.0/assets/data/reviews.js'
        js.write_text('const TRAINING_REVIEWS = {};', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '同步'):
            review.sync(self.root, verify=True)


if __name__ == '__main__':
    unittest.main()
