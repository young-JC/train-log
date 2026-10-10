// 个人档案只读面板。私有作用域避免经典脚本之间的全局重名。
(function () {
  'use strict';
  const metrics = [
    {key: 'heightCm', label: '身高', unit: 'cm', color: '#49a7ff'},
    {key: 'weightKg', label: '体重', unit: 'kg', color: '#13c89a'},
    {key: 'bodyFatPct', label: '体脂率', unit: '%', color: '#ff7043'},
    {key: 'waistCm', label: '腰围', unit: 'cm', color: '#a786ff'}
  ];
  const palette = ['#ff7043', '#49a7ff', '#13c89a', '#a786ff', '#ffc44d'];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const missing = value => value === null || value === undefined || value === '';
  const shown = value => missing(value) ? '未记录' : esc(value);
  const validMetric = (record, key) => typeof record[key] === 'number' && Number.isFinite(record[key]) && (key === 'bodyFatPct' ? record[key] > 0 && record[key] < 100 : record[key] > 0);
  const measuredAt = record => record.date + (record.time ? ' ' + record.time : ' · 时间未记录');
  const method = (record, key) => (record.methods?.[key] || '').trim();
  const timestamp = record => Date.parse(record.date + 'T' + (record.time || '00:00') + ':00+08:00');

  function todayInShanghai() {
    const parts = new Intl.DateTimeFormat('en', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
    return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
  }

  function facts(rows) {
    return rows.map(([label, value]) => '<div><dt>' + esc(label) + '</dt><dd>' + shown(value) + '</dd></div>').join('');
  }

  function ageLabel(basic, today) {
    if (basic.birthDate && basic.birthDate <= today) {
      const age = Number(today.slice(0, 4)) - Number(basic.birthDate.slice(0, 4)) - (today.slice(5) < basic.birthDate.slice(5) ? 1 : 0);
      return age + ' 岁（截至 ' + today + '）';
    }
    return missing(basic.ageYears) ? null : basic.ageYears + ' 岁（对应日期：' + (basic.ageAsOf || '未记录') + '）';
  }

  function chart(metric, rows) {
    const points = rows.filter(row => validMetric(row, metric.key));
    const heading = '<h4>' + metric.label + '<span>' + metric.unit + ' · ' + points.length + ' 次测量</span></h4>';
    if (!points.length) return '<div class="athlete-chart">' + heading + '<p class="athlete-chart-empty">此范围内未记录</p></div>';
    const values = points.map(p => p[metric.key]);
    const minValue = Math.min(...values), maxValue = Math.max(...values);
    const padding = Math.max((maxValue - minValue) * .15, maxValue * .005, .1);
    const low = Math.max(0, minValue - padding), high = maxValue + padding;
    const firstTime = timestamp(points[0]), lastTime = timestamp(points[points.length - 1]);
    const x = p => firstTime === lastTime ? 206 : 50 + (timestamp(p) - firstTime) / (lastTime - firstTime) * 312;
    const y = p => 110 - (p[metric.key] - low) / (high - low) * 82;
    const groups = new Map();
    points.forEach(p => {
      // 未知方法的体脂点分别成组，不建立暗示可比性的连线。
      const key = metric.key === 'bodyFatPct' ? (method(p, metric.key) || 'unknown:' + p.id) : 'all';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    let svg = '<svg viewBox="0 0 390 146" role="img" aria-label="' + metric.label + '测量历史，单位 ' + metric.unit + '，' + points.length + ' 次测量">';
    [low, (low + high) / 2, high].forEach(value => {
      const py = 110 - (value - low) / (high - low) * 82;
      svg += '<line class="athlete-chart-grid" x1="50" x2="362" y1="' + py + '" y2="' + py + '"/><text x="44" y="' + (py + 4) + '" text-anchor="end">' + Number(value.toFixed(1)) + '</text>';
    });
    let groupIndex = 0;
    const legend = [];
    groups.forEach((group, key) => {
      const unknown = key.startsWith('unknown:');
      const color = metric.key === 'bodyFatPct' ? (unknown ? '#8292a5' : palette[groupIndex++ % palette.length]) : metric.color;
      if (group.length > 1 && !unknown) svg += '<polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + group.map(p => x(p) + ',' + y(p)).join(' ') + '"/>';
      group.forEach(p => {
        const label = measuredAt(p) + ' · ' + p[metric.key] + ' ' + metric.unit + ' · ' + (method(p, metric.key) || '方法未记录') + ' · ' + p.id;
        svg += '<circle cx="' + x(p) + '" cy="' + y(p) + '" r="4" fill="' + color + '"><title>' + esc(label) + '</title></circle>';
      });
      if (metric.key === 'bodyFatPct' && !unknown) legend.push('<span><i style="background:' + color + '"></i>' + esc(key) + '</span>');
    });
    if (metric.key === 'bodyFatPct' && points.some(p => !method(p, metric.key))) legend.push('<span><i style="background:#8292a5"></i>方法未记录（独立点）</span>');
    svg += '<text x="50" y="136">' + esc(points[0].date) + '</text><text x="362" y="136" text-anchor="end">' + esc(points[points.length - 1].date) + '</text></svg>';
    return '<div class="athlete-chart">' + heading + svg + '<div class="athlete-legend">' + legend.join('') + '</div></div>';
  }

  function render() {
    const data = ATHLETE_DATA, profile = data.profile, basic = profile.basic, conditions = profile.conditions;
    const today = todayInShanghai();
    const rows = data.measurements.filter(row => row.date <= today).slice().sort((a, b) => timestamp(a) - timestamp(b) || a.id.localeCompare(b.id));
    const latest = key => rows.filter(row => validMetric(row, key)).pop();
    const height = latest('heightCm');
    const hasProfile = Object.values(basic).some(value => !missing(value)) || Object.values(conditions).some(value => !missing(value)) || profile.goals.length > 0 || profile.restrictions.length > 0;
    const hasData = hasProfile || rows.length > 0;
    document.getElementById('athleteStatus').textContent = hasData ? '已记录 · AI 对话维护' : '尚未建档';
    document.getElementById('athleteIntro').textContent = hasData ? '需要补充资料、记录新测量或纠正历史数据时，直接告诉 AI；每次只需提供变化的部分。' : '告诉 AI 你的基础资料、目标或测量数据，即可逐步建立个人档案。所有资料均可分次补充。';
    document.getElementById('athleteBasic').innerHTML = facts([
      ['出生日期', basic.birthDate], ['年龄', ageLabel(basic, today)], ['性别', basic.sex],
      ['身高', height ? height.heightCm + ' cm（' + height.date + '）' : null],
      ['力量训练经历', basic.strengthExperience], ['篮球训练经历', basic.basketballExperience],
      ['惯用手', basic.dominantHand], ['篮球位置', basic.basketballPosition]
    ]);
    document.getElementById('athleteGoals').innerHTML = profile.goals.length ? '<ol class="athlete-goals">' + profile.goals.slice().sort((a, b) => a.priority - b.priority).map(goal => '<li><span class="pill orange">' + (goal.priority === 1 ? '主目标' : '优先级 ' + esc(goal.priority)) + '</span><strong>' + shown(goal.title) + '</strong><p>目标值：' + shown(goal.target) + ' · 目标日期：' + shown(goal.targetDate) + '</p><small>更新：' + shown(goal.updatedAt) + '</small></li>').join('') + '</ol>' : '<p class="athlete-empty">未记录。告诉 AI 你最想改善什么，以及各目标的先后顺序。</p>';
    document.getElementById('athleteConditions').innerHTML = facts([
      ['每周可训练天数', missing(conditions.weeklyDays) ? null : conditions.weeklyDays + ' 天'],
      ['单次可用时间', missing(conditions.sessionMinutes) ? null : conditions.sessionMinutes + ' 分钟'],
      ['篮球活动安排', conditions.basketballSchedule], ['可用器材', conditions.equipment], ['可用场地', conditions.venues]
    ]);
    document.getElementById('athleteRestrictions').innerHTML = '<h4>长期伤病与明确限制</h4>' + (profile.restrictions.length ? '<ul>' + profile.restrictions.map(item => '<li>' + shown(item.description) + '<small>来源：' + shown(item.source) + ' · 更新：' + shown(item.updatedAt) + '</small></li>').join('') + '</ul>' : '<p class="hint">未记录，不代表没有限制。当日疼痛与恢复仍以 Readiness 和训练记录为准。</p>');
    document.getElementById('athleteLatest').innerHTML = metrics.map(metric => {
      const row = latest(metric.key);
      return '<div class="athlete-metric"><span>' + metric.label + '</span><strong>' + (row ? esc(row[metric.key]) + ' <small>' + metric.unit + '</small>' : '未记录') + '</strong><p>' + (row ? esc(measuredAt(row)) : '测量日期：未记录') + '</p><p>方法 / 设备：' + (row ? shown(method(row, metric.key)) : '未记录') + '</p>' + (row ? '<p>来源：' + shown(row.source) + '</p>' : '') + '</div>';
    }).join('');
    const start = new Date(today + 'T00:00:00Z');
    start.setUTCDate(start.getUTCDate() - 83);
    const startDate = start.toISOString().slice(0, 10);
    const all = document.getElementById('athleteRange').value === 'all';
    const selected = rows.filter(row => all || row.date >= startDate);
    document.getElementById('athleteRangeNote').textContent = (all ? '全部历史（截至 ' + today + '）' : startDate + ' 至 ' + today) + ' · ' + selected.length + ' 条测量；最新值不受范围筛选影响。同日时间未记录时按记录 ID 排序。';
    document.getElementById('athleteCharts').innerHTML = metrics.map(metric => chart(metric, selected)).join('');
    document.getElementById('athleteHistoryLabel').textContent = '查看测量历史（' + selected.length + ' 条）';
    document.getElementById('athleteHistory').innerHTML = selected.length ? selected.slice().reverse().map(row => '<tr><td><strong>' + esc(measuredAt(row)) + '</strong><br>' + esc(row.id) + '</td>' + metrics.map(metric => '<td>' + (validMetric(row, metric.key) ? '<strong>' + esc(row[metric.key]) + '</strong><br><span class="hint">' + shown(method(row, metric.key)) + '</span>' : '未记录') + '</td>').join('') + '<td>' + shown(row.note) + '<br><span class="hint">来源：' + shown(row.source) + '</span></td><td>' + shown(row.updatedAt) + '</td></tr>').join('') : '<tr><td colspan="7">此范围内未记录测量。可切换全部历史，或告诉 AI 新的测量数据。</td></tr>';
    document.getElementById('athleteUpdated').textContent = '档案更新：' + (profile.updatedAt || '未记录') + ' · 指标更新：' + (data.metricsUpdatedAt || '未记录');
  }

  window.renderAthleteProfile = render;
  document.getElementById('athleteRange').addEventListener('change', render);
}());
