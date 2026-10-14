// 周期复盘只读展示。无需网络、模块加载或 localStorage。
const TrainingReviewPanel = (() => {
  'use strict';
  const DAY = 86400000;
  const names = {weekly: '周复盘', stage: '阶段复盘', complete: '完整完成', partial: '部分完成',
    'no-record': '无记录', 'not-completed': '明确未完成', unknown: '待核对'};
  const metricNames = {duration: '训练时长（分钟）', load: 'Session Load（AU）', srpe: 'Session RPE',
    readiness: 'Readiness', sleep: '睡眠（1–5）', fatigue: '疲劳（1–5）', soreness: '酸痛（1–5）',
    readinessPain: '当日状态疼痛（0–10）', motivation: '训练意愿（1–5）',
    painBefore: '训练前疼痛', painDuring: '训练中疼痛', painAfter: '训练后疼痛', painNext: '次日疼痛'};
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const shift = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
  const dateToday = () => {
    const parts = new Intl.DateTimeFormat('en', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
    return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
  };
  function isStale(report, sources) {
    const current = Object.keys(sources).filter(d => d >= report.start && d <= report.dataThrough).sort();
    const saved = Object.keys(report.sources).sort();
    return current.length !== saved.length || current.some((d, i) => d !== saved[i] || sources[d] !== report.sources[d]);
  }
  function pending(data, today) {
    const result = [];
    for (let week = 1; week <= 12; week++) {
      const end = shift(data.cycleStart, week * 7 - 1);
      if (end >= today) continue;
      const types = week % 4 === 0 ? ['weekly', 'stage'] : ['weekly'];
      for (const type of types) {
        const start = shift(end, type === 'weekly' ? -6 : -27);
        const report = data.reports.find(r => r.cycleStart === data.cycleStart && r.type === type && r.start === start && r.end === end);
        if (!report || report.status !== 'complete' || isStale(report, data.currentSources)) {
          result.push({type, start, end, week, reason: report ? '待刷新' : '待复盘'});
        }
      }
    }
    return result;
  }
  // 与技能选择规则一致：排除未来才生成/更新、过期、进展和待刷新报告。
  function applicable(data, date) {
    return ['stage', 'weekly'].map(type => data.reports.filter(r => r.type === type && r.status === 'complete' &&
      r.cycleStart === data.cycleStart && r.applicability && r.applicability.start <= date && date <= r.applicability.end &&
      r.updatedAt.slice(0, 10) <= date && !isStale(r, data.currentSources))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))[0]).filter(Boolean);
  }
  function evidence(dates) {
    return dates.map(d => '<a href="records/' + esc(d.slice(0, 7)) + '.html#detail-' + esc(d) + '">' + esc(d) + '</a>').join(' · ');
  }
  function items(title, values) {
    return '<article class="review-note"><h3>' + esc(title) + '</h3>' + (values.length ? '<ul>' + values.map(item =>
      '<li>' + esc(item.text) + (item.dates.length ? '<div class="review-evidence">' + evidence(item.dates) + '</div>' : '') + '</li>').join('') + '</ul>' : '<p class="muted">未记录</p>') + '</article>';
  }
  function renderReport(report, data, today) {
    const stale = isStale(report, data.currentSources);
    const complete = report.execution.filter(s => s.status === 'complete').length;
    const rate = (100 * complete / report.execution.length).toFixed(1);
    const metrics = Object.entries(report.stats.metrics).map(([key, metric]) => {
      const value = key === 'load' || key === 'duration' ? metric.sum : metric.mean;
      return '<tr><td>' + esc(metricNames[key] || key) + '</td><td>' + (value === null ? '未记录' : esc(value)) +
        (key === 'load' || key === 'duration' ? (metric.complete ? ' · 合计' : ' · 已知合计（不完整）') : ' · 有效均值') +
        (metric.approximateDates?.length ? ' · 含近似记录' : '') +
        '</td><td>' + metric.known + '/' + metric.total + '</td><td>' + (metric.max === null ? '—' : esc(metric.max)) +
        '</td><td>' + (metric.missingDates.map(esc).join('、') || '—') + '</td></tr>';
    }).join('');
    const applied = applicable(data, today).some(r => r.id === report.id);
    return '<div class="review-report-head"><div><h3>' + esc(report.start + ' → ' + report.end) + ' · ' + names[report.type] + '</h3>' +
      '<p class="muted">数据截止 ' + esc(report.dataThrough) + ' · 档案更新 ' + esc(report.profileUpdatedAt) + '</p></div>' +
      '<a class="btn small" href="reviews/' + esc(report.id) + '.md">完整 Markdown 报告</a></div>' +
      '<p class="review-state ' + (stale ? 'yellow' : 'blue') + '">' + (stale ? '待刷新：正式记录已变化，本报告暂停作为推荐依据。' :
        report.status === 'progress' ? (report.end >= today ? '区间尚未结束：这是进展报告，不自动影响推荐。' : '进展报告：区间现已结束，请生成完整复盘；不自动影响推荐。') : applied ? '完整区间报告 · 当前可供推荐使用' : '完整区间报告 · 仅在适用时间内供推荐使用') + '</p>' +
      '<p>' + esc(report.summary) + '</p><div class="review-summary"><span>已确认完整完成率 <strong>' + rate + '%</strong>（' + complete + '/' + report.execution.length + ' 槽位）</span>' +
      '<span>正式训练 <strong>' + report.stats.trainingDays + ' 天</strong>（含实际恢复训练）</span></div>' +
      '<p class="muted">部分完成不折算；无记录不等于未训练。恢复与额外实战不抵扣计划槽位。</p>' +
      '<details open><summary>计划槽位执行</summary><div class="table-wrap"><table><thead><tr><th>周 / 槽位</th><th>状态</th><th>证据</th><th>说明</th></tr></thead><tbody>' +
      report.execution.map(s => '<tr><td>W' + s.week + ' ' + esc(s.slot) + '</td><td>' + esc(names[s.status]) + '</td><td>' + evidence(s.dates) + '</td><td>' + esc(s.note) + '</td></tr>').join('') +
      '</tbody></table></div></details><details open><summary>负荷、状态与疼痛</summary><div class="table-wrap"><table><thead><tr><th>指标</th><th>有效值统计</th><th>覆盖率</th><th>最高值</th><th>缺失日期</th></tr></thead><tbody>' + metrics +
      '</tbody></table></div><p class="muted">Readiness 及其原始项覆盖区间内正式状态记录，其余指标覆盖实际训练。均值仅代表已记录样本；疼痛保留原始时点，不据此推断恢复完全。</p></details>' +
      '<div class="review-notes">' + items('恢复与额外训练', report.extraSessions) + items('目标、能力与恢复证据', report.findings) +
      items('下一步：保留 / 调整 / 暂缓', report.decisions) + '</div>' +
      '<div class="review-note"><h3>数据缺口</h3><ul>' + report.gaps.map(g => '<li>' + esc(g) + '</li>').join('') + '</ul></div>' +
      '<p class="muted">推荐适用：' + (report.applicability ? esc(report.applicability.start + ' 至 ' + report.applicability.end) : '不自动生效；进展报告或下一周期待确认') +
      '<br>首次生成 ' + esc(report.generatedAt) + ' · 最近更新 ' + esc(report.updatedAt) + '</p>';
  }
  function render() {
    const data = TRAINING_REVIEWS;
    const today = dateToday();
    const notice = document.getElementById('reviewDue');
    const select = document.getElementById('reviewSelect');
    const body = document.getElementById('reviewReport');
    const pendingItems = pending(data, today);
    const upcoming = [4, 8, 12].map(w => ({week: w, end: shift(data.cycleStart, w * 7 - 1)})).find(s => s.end >= today);
    notice.innerHTML = '<strong>到期提示 · 正式周期 ' + esc(data.cycleStart) + ' · ' + data.mode + ' 日版</strong>' +
      (pendingItems.length ? '<ul>' + pendingItems.map(p => '<li>' + esc(p.start + ' 至 ' + p.end) + ' · ' + names[p.type] + ' · ' + p.reason + '</li>').join('') + '</ul>' : '<p>已结束区间暂无待复盘项。</p>') +
      (upcoming ? '<p>下一阶段复盘：W' + upcoming.week + '，区间截至 ' + upcoming.end + '；' + shift(upcoming.end, 1) + ' 起可生成完整报告。</p>' : '<p>12 周区间已结束，下一周期需在对话中确认。</p>') +
      '<p class="muted">在对话中说“复盘上周”或“复盘 W1–W4”。提前复盘会标为进展；此页面展示提示，AI 分析在对话中运行。页面顶部的临时周期和模式切换不改变正式复盘口径。</p>';
    const previous = select.value;
    const reports = [...data.reports].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
    select.replaceChildren(...reports.map(r => new Option(r.start + ' 至 ' + r.end + ' · ' + names[r.type] +
      (isStale(r, data.currentSources) ? ' · 待刷新' : r.status === 'progress' ? ' · 进展' : ''), r.id)));
    select.disabled = !reports.length;
    if (reports.some(r => r.id === previous)) select.value = previous;
    const show = () => {
      const report = reports.find(r => r.id === select.value);
      body.innerHTML = report ? renderReport(report, data, today) : '<div class="review-empty"><h3>还没有复盘报告</h3><p>到期后调用 review-training-2，AI 会核对正式记录、保存复盘，并在这里展示结果。</p><p class="muted">初次上线不自动生成历史报告。无需手填完成率或进步结论。</p></div>';
    };
    select.onchange = show;
    show();
  }
  return {render, pending, applicable, isStale};
})();
