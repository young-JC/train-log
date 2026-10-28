(function () {
  'use strict';
  const C = TrainingRecorder, S = RecorderStorage, L = RecorderLayout;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const labels = {pending: '待记录', completed: '完成', partial: '部分', skipped: '跳过'};
  let drafts = new Map(), current = null, imported = null, tab = 'training', writeQueue = Promise.resolve(), revision = 0, toastTimer;
  let cloudRecommendation = null, viewedRecommendation = null, syncing = false;
  let toolRegistration = null, lastUpdateCheck = 0, applyingUpdate = false;
  let pickerPath = null;
  const toolBuild = document.querySelector('meta[name="recorder-build"]')?.content || 'dev';
  $('appVersion').textContent = toolBuild === 'dev' ? '本地预览' : '版本 ' + toolBuild;
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500); }
  function errorMessage(id, error) { $(id).textContent = error.message || String(error); $(id).hidden = false; }
  function get(path) { return path.split('.').reduce((object, key) => object?.[key], current); }
  function set(path, value) { const parts = path.split('.'), key = parts.pop(); parts.reduce((object, part) => object[part], current)[key] = value; }
  function savedAt(value) { return value ? new Date(value).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) : ''; }
  function save() {
    if (!current) return Promise.resolve();
    current.updatedAt = new Date().toISOString();
    const snapshot = C.copy(current), version = ++revision;
    drafts.set(current.date, snapshot);
    $('saveStatus').textContent = '正在保存…';
    writeQueue = writeQueue.catch(() => {}).then(() => S.put(snapshot)).then(() => {
      if (version === revision) { $('saveStatus').textContent = '已存本机 · ' + savedAt(snapshot.updatedAt); $('storageError').hidden = true; }
    }).catch(error => {
      if (version === revision) { $('saveStatus').textContent = '未能保存'; errorMessage('storageError', new Error('本地保存失败：' + error.message + '。请先到“草稿”导出 JSON 备份，当前窗口仍保留输入。')); }
    });
    return writeQueue;
  }
  function markEdited(path) {
    current.exportedAt = null;
    if (path?.startsWith('readiness.')) current.readinessEdited = true;
    save(); updateSummaries();
  }
  function openSession(session) {
    current = C.copy(session); tab = 'training';
    const filled = current.actions.map(a => C.prefillActual(current, a, [...drafts.values()])).some(Boolean);
    $('welcome').hidden = true; $('workspace').hidden = false; document.body.classList.add('has-session');
    $('workspaceInbox').append(document.querySelector('.cloud-inbox'));
    render();
    $('saveStatus').textContent = '本机草稿 · ' + savedAt(current.updatedAt);
    if (filled) save();
  }
  function field(path, label, placeholder = '', options = {}) {
    const value = get(path) ?? '', unknown = value === C.UNKNOWN;
    const controlId = 'field-' + path.replace(/\./g, '-');
    const attributes = ' id="' + controlId + '" data-field="' + path + '" placeholder="' + esc(placeholder) + '"' + (unknown ? ' disabled' : '');
    const control = options.area ? '<textarea rows="2"' + attributes + '>' + (unknown ? '' : esc(value)) + '</textarea>' : '<input' + attributes + ' value="' + (unknown ? '' : esc(value)) + '"' + (options.numeric ? ' readonly data-wheel="' + path + '" data-label="' + esc(label) + '" aria-haspopup="dialog"' : '') + '>' + (options.wheel ? '<button type="button" class="wheel-trigger" data-wheel="' + path + '" data-label="' + esc(label) + '" aria-label="滚轮选择' + esc(label) + '"' + (unknown ? ' disabled' : '') + '>选数</button>' : '') + (options.numeric ? '<span class="number-affordance" aria-hidden="true">⌃⌄</span>' : '');
    return '<div class="field' + (unknown ? ' is-unknown' : '') + '"><div class="field-label"><label for="' + controlId + '">' + esc(label) + '</label>' + (options.unknown === false ? '' : '<button type="button" class="unknown-toggle' + (unknown ? ' active' : '') + '" data-unknown="' + path + '" aria-pressed="' + unknown + '" aria-label="' + esc(label) + '：' + (unknown ? '取消未记录' : '标记未记录') + '">未记录' + (unknown ? ' ✓' : '') + '</button>') + '</div><div class="field-row">' + control + '</div></div>';
  }
  function selectField(path, label, choices) {
    const value = get(path) ?? (path.endsWith('.doseMode') ? 'free' : '');
    return '<label class="field"><span>' + esc(label) + '</span><select data-field="' + path + '">' + choices.map(([v, name]) => '<option value="' + esc(v) + '"' + (String(value) === String(v) ? ' selected' : '') + '>' + esc(name) + '</option>').join('') + '</select></label>';
  }
  function actualFields(base, grouped = false) {
    const mode = get(base + '.doseMode') || 'free';
    return '<div class="actual-fields"><div class="entry-heading"><span>实际表现</span><small>' + (grouped ? '本组实绩' : '按动作汇总') + '</small></div>' + selectField(base + '.doseMode', '记录方式', [['reps', '组数 × 次数'], ['time', '组数 × 时间（不记次数）'], ['free', '自由填写 / 距离 / 旧记录']]) +
      (mode === 'free' ? field(base + '.dose', grouped ? '本组次数 / 时长 / 距离' : '实际组次 / 时长 / 距离', '按实际填写') : '<div class="field-grid">' + (grouped ? '' : field(base + '.count', '组数', '选择组数', {numeric: true})) + (mode === 'time' ? field(base + '.seconds', '每组时间 · 秒', '选择时长', {numeric: true}) : field(base + '.reps', '每组次数', '选择次数', {numeric: true})) + '</div>' + selectField(base + '.side', '侧别', [['', '整体 / 不区分'], ['每侧', '每侧']])) +
      '<div class="field-grid">' + field(base + '.rpe', '实际 RPE', '例：7 或 6–7', {wheel: true}) + field(base + '.load', '实际负荷', '数值 / 自重', {wheel: true}) + '</div><div class="unit-grid">' + selectField(base + '.unit', '负荷单位', [['', '未说明'], ['kg', 'kg'], ['lb', 'lb'], ['自重', '自重'], ['其他', '其他 / 见负荷描述']]) + selectField(base + '.basis', '重量口径', [['', '未说明'], ['单侧', '单侧'], ['总重', '总重'], ['器械标称', '器械标称'], ['不适用', '不适用'], ['其他', '其他 / 见备注']]) + '</div><div class="rest-entry">' + field(base + '.rest', grouped ? '本组后休息 · 秒' : '组间休息 · 秒', '选择休息秒数', {numeric: true}) + '<button class="button outline rest-start" data-rest="' + base + '" aria-label="开始休息倒计时">开始休息 ↻</button></div></div>';
  }
  function pickerSpec(path) {
    const key = path.split('.').pop();
    if (key === 'count') return {min: 1, max: 100, digits: 3};
    if (key === 'reps') return {min: 0, max: 999, digits: 3};
    if (['seconds', 'rest'].includes(key)) return {min: 0, max: 86400, digits: 5};
    if (key === 'duration') return {min: 0.01, max: 1440, digits: 4, decimal: true};
    if (key === 'load') return {min: 0, max: 9999.9, digits: 4, decimal: true};
    return {min: 0, max: 10, digits: 2, decimal: true};
  }
  function openPicker(path, label) {
    pickerPath = path;
    const spec = pickerSpec(path), raw = Number(get(path));
    const value = Number.isFinite(raw) ? Math.min(spec.max, Math.max(spec.min, raw)) : spec.min;
    const digits = Math.floor(value).toString().padStart(spec.digits, '0').split('');
    if (spec.decimal) digits.push(String(Math.round((value % 1) * 10) % 10));
    $('numberTitle').textContent = label;
    $('numberHint').textContent = '上下滚动选择各位数字 · 范围 ' + spec.min + '–' + spec.max;
    const names = ['个位', '十位', '百位', '千位', '万位'];
    $('numberWheels').innerHTML = digits.map((digit, i) => (spec.decimal && i === spec.digits ? '<span class="decimal-point">.</span>' : '') + '<div class="wheel-column"><span class="wheel-label">' + (i === spec.digits ? '小数' : names[spec.digits - i - 1]) + '</span><div class="digit-wheel" role="listbox" aria-label="' + (i === spec.digits ? '小数' : names[spec.digits - i - 1]) + '" tabindex="0">' + Array.from({length: 10}, (_, n) => '<div class="digit" role="option" aria-selected="' + (n === Number(digit)) + '" data-digit="' + n + '">' + n + '</div>').join('') + '</div></div>').join('');
    $('numberError').hidden = true;
    $('numberDialog').showModal();
    $('numberWheels').querySelectorAll('.digit-wheel').forEach((wheel, i) => {
      wheel.scrollTop = Number(digits[i]) * 44;
      wheel.addEventListener('scroll', () => {
        const selected = Math.round(wheel.scrollTop / 44);
        wheel.querySelectorAll('.digit').forEach((digit, n) => digit.setAttribute('aria-selected', String(n === selected)));
      });
      wheel.addEventListener('keydown', e => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const n = e.key === 'Home' ? 0 : e.key === 'End' ? 9 : Math.max(0, Math.min(9, Math.round(wheel.scrollTop / 44) + (e.key === 'ArrowUp' ? -1 : 1)));
        wheel.scrollTo({top: n * 44, behavior: 'smooth'});
      });
      wheel.addEventListener('click', e => { const digit = e.target.closest('[data-digit]'); if (digit) wheel.scrollTo({top: Number(digit.dataset.digit) * 44, behavior: 'smooth'}); });
    });
  }
  $('confirmNumber').onclick = () => {
    if (!current || !pickerPath) return;
    const spec = pickerSpec(pickerPath);
    const digits = [...$('numberWheels').querySelectorAll('.digit-wheel')].map(w => String(Math.round(w.scrollTop / 44)));
    const value = Number(digits.slice(0, spec.digits).join('') + (spec.decimal ? '.' + digits[spec.digits] : ''));
    if (value < spec.min || value > spec.max) { errorMessage('numberError', new Error('请选择 ' + spec.min + '–' + spec.max + ' 范围内的数值')); return; }
    set(pickerPath, String(value)); markEdited(pickerPath); $('numberDialog').close(); renderTraining(); renderFinish(); updateSummaries();
  };
  $('clearNumber').onclick = () => { if (current && pickerPath) { set(pickerPath, ''); markEdited(pickerPath); $('numberDialog').close(); renderTraining(); renderFinish(); updateSummaries(); } };
  function startRest(base) {
    if (/[–—\-~～至]/.test(String(get(base + '.rest')))) { toast('推荐休息为范围，请先点选本次具体秒数再计时'); return; }
    const seconds = C.number(get(base + '.rest'), 0, 86400, '休息秒数');
    if (!seconds) { toast('请先选择大于 0 的休息秒数'); return; }
    const action = current.actions[Number(base.split('.')[1])];
    if (current.restTimer && current.restTimer.endsAt > Date.now() && !confirm('替换当前正在运行的休息倒计时？')) return;
    current.restTimer = {endsAt: Date.now() + seconds * 1000, label: (C.actionName(action) || action.slot.module) + (base.includes('.sets.') ? ' · 第' + (Number(base.split('.').pop()) + 1) + '组后' : '')};
    markEdited(); updateClocks();
  }
  function clockText(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }
  function updateClocks() {
    if (!current) return;
    $('startTraining').disabled = !!current.startedAt;
    $('startTraining').textContent = current.endedAt ? '已结束' : current.startedAt ? '训练中' : '开始训练';
    $('endTraining').disabled = !current.startedAt || !!current.endedAt;
    $('endTraining').hidden = !!current.endedAt;
    $('reviewTraining').hidden = !!current.startedAt && !current.endedAt;
    $('reviewTraining').textContent = current.endedAt ? '前往收尾反馈 ↘' : '未使用计时？直接填写反馈 ↘';
    $('endHint').textContent = current.endedAt ? '结束时间已保存，仍可修改动作实绩和收尾反馈。' : '结束计时后，补充整体用力与身体反馈。';
    $('startTime').textContent = current.startedAt ? C.timeText(current.startedAt) : '尚未开始';
    $('endTime').textContent = current.endedAt ? C.timeText(current.endedAt) : '尚未结束';
    $('elapsedTime').textContent = current.startedAt ? (current.endedAt ? '本次用时 ' : '已进行 ') + clockText(Date.parse(current.endedAt || new Date().toISOString()) - Date.parse(current.startedAt)) : '点击开始，自动记录当前时间';
    $('restPanel').hidden = !current.restTimer;
    if (!current.restTimer) return;
    const left = current.restTimer.endsAt - Date.now();
    $('restLabel').textContent = current.restTimer.label;
    $('restRemaining').textContent = left > 0 ? clockText(left) : '休息结束';
    $('restPanel').classList.toggle('finished', left <= 0);
    if (left <= 0 && !current.restTimer.notified) {
      current.restTimer.notified = true; save(); toast('组间休息结束');
      if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
    }
  }
  $('startTraining').onclick = () => {
    try {
      if (current.date !== C.today()) { toast('请先将训练日期切换为今天，再记录当前时间'); return; }
      C.stampSession(current, 'start'); markEdited();
    } catch (error) { toast(error.message); }
  };
  $('endTraining').onclick = () => {
    try {
      if (!C.blank(current.duration) && !confirm('结束将按起止时间更新总时长（原为 ' + current.duration + ' 分钟），之后仍可修改。继续？')) return;
      C.stampSession(current, 'end'); markEdited(); renderFinish(); showTab('finish'); $('finishTab').scrollIntoView({behavior: 'smooth', block: 'start'}); toast('已记录结束时间，请补充收尾反馈');
    } catch (error) { toast(error.message); }
  };
  $('reviewTraining').onclick = () => { showTab('finish'); $('finishTab').scrollIntoView({behavior: 'smooth', block: 'start'}); };
  $('stopRest').onclick = () => { delete current.restTimer; markEdited(); };
  setInterval(updateClocks, 500);
  function renderAction(a, index) {
    const chosen = C.selected(a), base = 'actions.' + index + '.actual';
    const options = a.added || a.parentActionId || a.extraOptionOf ? '' : '<div class="option-list">' + a.slot.options.map(C.optionDetails).map(o => {
      const recorded = current.actions.find(other => (other.id === a.id || other.extraOptionOf === a.id) && other.selectedOptionId === o.id);
      return '<button class="option-button' + (recorded ? ' chosen' : '') + '" data-option="' + esc(o.id) + '" data-index="' + index + '" aria-pressed="' + !!recorded + '"><span class="option-key">' + esc(o.id) + '</span><span class="option-content"><span class="option-name">' + L.lines(o.name, true).map(name => '<span>' + esc(name) + '</span>').join('') + '</span><span class="option-dose-preview">' + (recorded?.extraOptionOf ? '已加入加练 · 点此定位' : esc(L.lines(o.prescription || '', true)[0] || '查看推荐安排')) + '</span></span><span class="option-check" aria-hidden="true">' + (recorded ? '✓' : '＋') + '</span></button>';
    }).join('') + '</div>' + (a.slot.options.length > 1 ? '<p class="selection-hint">可选择多个动作，另选动作会生成独立记录，已有实绩保留。</p>' : '');
    let content = '<article class="action-card ' + a.status + '" data-action-card="' + index + '"><div class="card-top"><span class="action-number">' + String(index + 1).padStart(2, '0') + '</span><span class="module-label">' + esc(a.slot.module.replace(/三选一|3选1/g, '可多选')) + (a.slot.optional ? ' · 可跳过' : '') + '</span><div class="order-buttons"><button data-move="-1" data-index="' + index + '" aria-label="动作上移"' + (!index ? ' disabled' : '') + '>↑</button><button data-move="1" data-index="' + index + '" aria-label="动作下移"' + (index === current.actions.length - 1 ? ' disabled' : '') + '>↓</button>' + (a.added || a.parentActionId || a.extraOptionOf ? '<button data-remove="' + index + '" aria-label="移除动作记录">×</button>' : '') + '</div></div>' + (a.added ? '<h3>加练动作</h3>' : '') + options;
    if (a.extraOptionOf) content += '<h3>' + esc(chosen?.name || '同槽加练') + '</h3><p class="selection-hint">同槽加练 · 剂量、完成状态独立记录</p>';
    if (chosen && !a.added && !a.parentActionId) content += L.reference(chosen, a.slot.replacesSlotId);
    if (!chosen && a.slot.options.length > 1) content += '<p class="fine">候选未选，所有动作都还没有计入实绩。</p>';
    const parts = current.actions.filter(other => other.parentActionId === a.id);
    if (a.parentActionId) content += '<h3>' + esc(a.actualName || '槽位内动作') + '</h3>' + (a.partReference ? L.reference({name: a.actualName, ...a.partReference}) : '');
    if (chosen && !a.added && !a.parentActionId) content += '<button class="button outline wide mode-button" data-add-part="' + index + '">＋ 逐个记录槽位动作（热身 / 防伤 / 整理）</button>';
    if (parts.length) return content + '<p class="reference">已拆为 ' + parts.length + ' 个独立动作，请在下方逐个填写和确认完成。组合不重复计入。</p></article>';
    content += '<div class="status-picker">' + Object.entries(labels).map(([key, label]) => '<button class="' + (a.status === key ? 'active' : '') + '" data-status="' + key + '" data-index="' + index + '" aria-pressed="' + (a.status === key) + '">' + label + '</button>').join('') + '</div>';
    if (a.status !== 'skipped' && (chosen || a.added || a.parentActionId)) {
      content += field('actions.' + index + '.actualName', a.added || a.parentActionId ? '实际动作名称' : '替换为其他动作（按需填写）', a.added || a.parentActionId ? '填写你实际做的动作' : '沿用上方已选动作名称', {unknown: false});
      if (a.prefillDate) content += '<p class="reference history-note">已带入本机 ' + esc(a.prefillDate) + ' 的剂量、负荷与休息设定。请核对本次数据，再点完成；RPE、反馈重新填写。</p>';
      if (a.prefillSource === 'recommendation') content += '<p class="reference prefill-note">已预填本次推荐（含明确的目标 RPE）。请核对或改成实际数据，再点“完成”或“部分”；身体反馈另填。</p>';
      if (a.actual.mode === 'summary') content += actualFields(base);
      else content += a.actual.sets.map((row, i) => '<div class="set-row"><div class="set-heading"><b>第 ' + (i + 1) + ' 组</b><button data-remove-set="' + i + '" data-index="' + index + '">删除此组</button></div>' + actualFields(base + '.sets.' + i, true) + field(base + '.sets.' + i + '.notes', '本组反馈 / 左右侧 / 测量结果', '例：左侧7、右侧6；跳高/用时', {area: true}) + '</div>').join('') + '<button class="button outline wide mode-button" data-add-set="' + index + '">＋ 添加一组（带入推荐，按实际修改）</button>';
      content += '<button class="button outline mode-button" data-mode="' + index + '">' + (a.actual.mode === 'sets' ? '改为按动作汇总填写' : '各组不一样？展开逐组填写') + '</button><details class="card-details"><summary>动作反馈、侧别与其他数据</summary>' + field(base + '.notes', '整体备注 / 部分完成说明', '动作质量、左右差异、投篮命中/出手等', {area: true}) + '</details>';
    } else if (a.status === 'skipped') content += field(base + '.notes', '跳过原因（可选）', '例：器材不可用、时间不足', {area: true});
    return content + '</article>';
  }
  function renderTraining() {
    const visible = !document.getElementById('trainingTab').hidden;
    const anchor = visible ? [...$('actionList').children].find(e => e.getBoundingClientRect().bottom > 60) : null;
    const id = anchor?.dataset.actionId, top = anchor?.getBoundingClientRect().top;
    const overviewOpen = $('recommendationNotes').querySelector('details')?.open;
    const opened = new Set([...$('actionList').querySelectorAll('.card-details[open]')].map(e => e.closest('[data-action-id]')?.dataset.actionId));
    $('actionList').innerHTML = current.actions.length ? current.actions.map(renderAction).join('') : '<div class="form-card"><h3>从第一个动作开始</h3><p class="muted">添加你实际做过的动作，或导入一份推荐生成卡片。</p></div>';
    [...$('actionList').children].forEach((e, i) => { if (!current.actions[i]) return; e.dataset.actionId = current.actions[i].id; if (opened.has(e.dataset.actionId)) { const details = e.querySelector('.card-details'); if (details) details.open = true; } });
    $('recommendationNotes').innerHTML = L.overview(current.source?.notes, current.source?.guidance);
    $('recommendationNotes').hidden = !$('recommendationNotes').innerHTML;
    if (overviewOpen !== undefined && $('recommendationNotes').querySelector('details')) $('recommendationNotes').querySelector('details').open = overviewOpen;
    const next = [...$('actionList').children].find(e => e.dataset.actionId === id);
    if (next && visible) window.scrollBy(0, next.getBoundingClientRect().top - top);
    renderTimeline();
  }
  function renderTimeline() {
    if (!current) return;
    $('timelineList').innerHTML = current.actions.map((a, i) => '<button class="timeline-item ' + a.status + (a.parentActionId ? ' timeline-child' : '') + '" data-jump-action="' + esc(a.id) + '"><span class="timeline-dot">' + (['completed', 'partial'].includes(a.status) ? '✓' : String(i + 1).padStart(2, '0')) + '</span><span><strong>' + esc(C.actionName(a) || a.slot.module) + '</strong><small>' + esc(a.parentActionId ? '组合内动作' : a.slot.module) + '</small></span><em>' + (current.actions.some(child => child.parentActionId === a.id) ? '组合' : labels[a.status]) + '</em></button>').join('');
    $('timelineCount').textContent = current.actions.length + ' 项 · 按实际顺序';
  }
  function jumpAction(id) {
    showTab('training');
    const target = [...$('actionList').children].find(e => e.dataset.actionId === id);
    if (!target) return;
    target.scrollIntoView({block: 'start', behavior: 'auto'});
    target.setAttribute('tabindex', '-1'); target.focus({preventScroll: true});
    target.classList.remove('located'); void target.offsetWidth; target.classList.add('located');
  }
  function renderFinish() {
    $('finishFields').innerHTML = '<div class="form-card"><h3>本次训练</h3>' + field('title', '训练名称', '例：下肢力量 + 核心', {unknown: false}) + field('cycle', '周期 / 槽位', '按实际确认填写', {unknown: false}) + selectField('sessionStatus', '本次训练状态', ['待确认', '已完成', '部分完成', '恢复日', '未训练'].map(v => [v, v])) + '<div class="field-grid">' + field('duration', '训练总时长 · 分钟', '不按动作时间相加推测', {numeric: true}) + field('sessionRpe', 'Session RPE · 0–10', '整堂训练的整体用力程度', {numeric: true}) + '</div><div id="loadSummary" class="reference"></div></div>' +
      '<div class="form-card"><h3>训练前 Readiness</h3><p class="muted" style="margin-bottom:18px">同日推荐的原始值会带入。状态变化时在这里填写训练前最终值。</p><div class="field-grid">' + C.readyFields.map(([key, label, min, max]) => selectField('readiness.' + key, label + ' · ' + min + '–' + max, [['', '未填'], ...Array.from({length: max - min + 1}, (_, i) => [String(min + i), String(min + i)]), [C.UNKNOWN, '未记录']])).join('') + '</div>' + field('readiness.painNote', '训练前疼痛部位 / 性质', '有疼痛时补充', {area: true}) + selectField('readiness.redFlags', '训练前是否有异常症状', [['', '未确认'], ['false', '明确无异常症状'], ['true', '有异常症状'], [C.UNKNOWN, '未记录']]) + '<div id="readySummary" class="reference"></div></div>' +
      '<div class="form-card"><h3>疼痛与身体反馈</h3>' + field('painDuring', '训练中最高疼痛 · 0–10', '没有疼痛时填 0', {numeric: true}) + field('painDuringNote', '训练中疼痛部位 / 触发动作', '按实际发生情况填写', {area: true}) + field('painAfter', '训练后疼痛 · 0–10', '没有疼痛时填 0', {numeric: true}) + field('painAfterNote', '训练后疼痛部位 / 性质', '有疼痛时补充', {area: true}) + field('painNext', '次日疼痛 · 0–10', '次日再补充；当天留空', {numeric: true}) + field('painNextNote', '次日疼痛部位 / 性质', '次日再补充', {area: true}) + field('symptoms', '异常症状 / 其他身体反馈', '按实际填写；没有时可写无', {area: true}) + '</div><div class="form-card"><h3>还有什么要留给下次？</h3>' + field('completionNote', '实际完成情况与补充', '时间不足、动作替换原因、篮球表现等', {area: true}) + '</div>';
  }
  function updateSummaries() {
    if (!current) return;
    const done = current.actions.filter(a => ['completed', 'partial'].includes(a.status)).length;
    $('progressNumber').textContent = done + '/' + current.actions.filter(a => !current.actions.some(other => other.parentActionId === a.id)).length;
    $('progressLabel').textContent = done + ' 个实际动作 · ' + current.actions.filter(a => a.status === 'skipped').length + ' 个跳过';
    $('bottomProgress').textContent = current.exportedAt ? '已导出 · 待 skill 入库' : done + ' 个动作已记录';
    renderTimeline();
    $('sessionHeading').textContent = current.title || '今日训练';
    updateClocks();
    try {
      const load = C.sessionLoad(current);
      if ($('loadSummary')) $('loadSummary').textContent = current.sessionStatus === '未训练' ? '未训练，不计 Session Load' : 'Session Load：' + (load === null ? '待填写实际总时长和 Session RPE' : load + ' AU');
    } catch (error) { if ($('loadSummary')) $('loadSummary').textContent = error.message; }
    try {
      const ready = C.readinessResult(current.readiness);
      if ($('readySummary')) $('readySummary').textContent = 'Readiness：' + (ready.score === null ? '未计算' : ready.score + '/100') + ' · ' + ready.level;
    } catch (error) { if ($('readySummary')) $('readySummary').textContent = error.message; }
  }
  function renderDrafts() {
    $('draftList').innerHTML = [...drafts.values()].sort((a, b) => b.date.localeCompare(a.date)).map(draft => '<article class="draft-card"><div><h3>' + esc(draft.date) + '</h3><p>' + esc(draft.title || '空白训练') + '<br>' + draft.actions.filter(a => ['completed', 'partial'].includes(a.status)).length + ' 个实际动作 · ' + (draft.exportedAt ? '已导出，未确认入库' : '草稿') + '</p></div><button class="button small" data-open-date="' + draft.date + '">继续填写 ↗</button></article>').join('') || '<p class="muted">暂无草稿。</p>';
  }
  function showTab(value) {
    tab = value;
    document.querySelectorAll('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === value));
    ['training', 'finish', 'drafts'].forEach(name => { $(name + 'Tab').hidden = name !== value; });
    if (value === 'drafts') renderDrafts();
    updateSummaries();
  }
  function render() {
    $('sessionDate').value = current.date;
    $('sourceNote').textContent = current.source ? '推荐 ' + current.source.date + (current.source.date !== current.date ? ' · 跨日期模板，Readiness 已独立填写' : ' · 推荐与实绩分开保留') : '空白训练 · 只记录你明确填写的实绩';
    renderTraining(); renderFinish(); showTab(tab); updateSummaries(); updateClocks();
  }
  function openImport() {
    imported = null; $('importPreview').hidden = true; $('importError').hidden = true; $('confirmImport').disabled = true;
    $('importDialog').showModal();
  }
  function inboxStatus(message, danger = false) {
    $('cloudStatus').textContent = message;
    $('cloudStatus').classList.toggle('danger', danger);
  }
  function requestInbox() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'api/recommendations/latest?asOf=' + C.today() + '&_=' + Date.now());
      xhr.timeout = 15000;
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.onload = () => {
        if (xhr.status === 401 || xhr.status === 403 || !xhr.getResponseHeader('Content-Type')?.includes('application/json')) { reject(new Error('同步需要联网登录；请在 Safari 打开本站并登录后重试')); return; }
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status !== 200) throw new Error(data.error || '推荐同步暂不可用');
          if (!Object.prototype.hasOwnProperty.call(data, 'inbox')) throw new Error('推荐收件箱响应无效');
          resolve(data.inbox);
        } catch (error) { reject(error); }
      };
      xhr.onerror = () => reject(new Error('暂时连不上推荐收件箱，已存草稿可以继续记录'));
      xhr.ontimeout = () => reject(new Error('同步超时，稍后点“同步推荐”重试'));
      xhr.send();
    });
  }
  async function syncInbox() {
    if (syncing) return;
    if (!['https:', 'http:'].includes(location.protocol)) { inboxStatus('本地文件模式请手动导入，网址内可直接同步'); return; }
    if (!navigator.onLine) { inboxStatus('离线中，联网后可同步新推荐；草稿仍可继续'); return; }
    syncing = true; $('syncRecommendation').disabled = true;
    inboxStatus('正在获取推荐…');
    try {
      const inbox = await requestInbox();
      if (!inbox) { inboxStatus('还没有已同步推荐，生成推荐后会显示在这里'); cloudRecommendation = null; $('openCloudRecommendation').disabled = true; return; }
      const source = C.validateRecommendation(inbox.recommendation);
      if (source.date > C.today()) throw new Error('站点返回了未来日期推荐，请稍后重试');
      cloudRecommendation = source;
      const existing = drafts.get(source.date);
      if (source.date === C.today() && !existing && !document.querySelector('dialog[open]') && (!current || current.date < source.date)) {
        openSession(C.createSession(source)); await save();
        inboxStatus(source.date + ' 推荐已送达，已生成待填写卡片');
      } else if (existing && JSON.stringify(C.validateRecommendation(existing.source || {kind: 'train2.recommendation', schemaVersion: 1, date: existing.date, slots: []})) === JSON.stringify(source)) {
        inboxStatus(source.date + ' 推荐已同步，已有实绩保留');
      } else inboxStatus(source.date + (source.date !== C.today() ? ' 非今日推荐，请核对训练日期；已有草稿保留' : ' 有推荐可查看，已有草稿不会自动覆盖'));
      $('openCloudRecommendation').disabled = false;
    } catch (error) { inboxStatus(error.message, true); }
    finally { syncing = false; $('syncRecommendation').disabled = false; }
  }
  function preview() {
    $('importError').hidden = true; $('confirmImport').disabled = true; imported = null;
    try {
      const data = C.parseJSON($('importText').value);
      if (data.kind === 'train2.recorder-backup') {
        const sessions = C.readBackup(data), collisions = sessions.filter(s => drafts.has(s.date));
        imported = {type: 'backup', sessions};
        $('importPreview').innerHTML = '<h3 class="preview-title">恢复 ' + sessions.length + ' 份训练草稿</h3><p class="muted">' + esc(sessions.map(s => s.date).join('、')) + '</p>' + (collisions.length ? '<div class="notice warning">其中 ' + collisions.length + ' 个日期已有草稿，恢复前会再次确认替换。</div>' : '');
        $('confirmImport').textContent = '恢复备份';
      } else {
        const source = C.validateRecommendation(data);
        imported = {type: 'recommendation', source};
        const ready = source.readiness && C.readinessResult(source.readiness);
        $('importPreview').innerHTML = '<h3 class="preview-title">' + esc(source.title || '训练推荐') + '</h3><p class="muted">' + source.date + ' · ' + esc(source.cycle || '周期未提供') + '<br>Readiness：' + (ready?.score ?? '未计算') + (ready ? ' · ' + esc(ready.level) : '') + '</p><ul class="preview-actions">' + source.slots.map(slot => '<li>' + esc(slot.module) + '：' + esc(slot.options.map(o => o.name).join(' / ')) + (slot.selectedOptionId ? '（已选 ' + esc(slot.selectedOptionId) + '）' : '（待选）') + '</li>').join('') + '</ul>' + (drafts.has(source.date) ? '<div class="notice warning">此日已有草稿。“继续原草稿”保留全部实绩；只有主动重建才会替换。</div><button class="text-button" id="rebuildImported">主动重建此日草稿</button>' : '') + (source.date > C.today() ? '<div class="notice warning">这是未来日期的推荐，正式导出时仍需确认实际训练日期。</div>' : '');
        const slotList = $('importPreview').querySelector('.preview-actions');
        slotList.innerHTML = source.slots.map(slot => '<li class="preview-slot"><strong>' + esc(slot.module) + (slot.selectedOptionId ? ' · 已选 ' + esc(slot.selectedOptionId) : ' · 待选') + '</strong><ul>' + slot.options.map(option => '<li><b>' + esc(option.id) + '</b> ' + esc(option.name) + '</li>').join('') + '</ul></li>').join('');
        $('confirmImport').textContent = drafts.has(source.date) ? '继续原草稿' : '开始记录 ↗';
      }
      $('importPreview').hidden = false; $('confirmImport').disabled = false;
    } catch (error) { errorMessage('importError', error); $('importPreview').hidden = true; }
  }
  async function applyImport(rebuild = false) {
    if (!imported) return;
    try {
      if (imported.type === 'backup') {
        const collisions = imported.sessions.filter(s => drafts.has(s.date));
        if (collisions.length && !confirm('恢复将替换以下日期的草稿：' + collisions.map(s => s.date).join('、') + '。建议先备份当前数据。确认恢复？')) return;
        await writeQueue; await S.putMany(imported.sessions);
        imported.sessions.forEach(s => drafts.set(s.date, C.copy(s)));
        const latest = [...imported.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
        if (latest) openSession(latest);
        toast('备份已恢复至本机');
      } else {
        const source = imported.source, existing = drafts.get(source.date);
        if (existing && !rebuild) { openSession(existing); toast('已打开原草稿，实绩未被覆盖'); }
        else {
          if (existing && !confirm('主动重建会清空此日原有实绩，改用这份推荐。需要保留原数据时请先取消并备份。确认重建？')) return;
          openSession(C.createSession(source)); await save();
        }
      }
      $('importDialog').close();
      return true;
    } catch (error) { errorMessage('importError', error); }
  }
  function download(filename, content, type) {
    const blob = new Blob([content], {type}), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function backup(all = false) {
    const sessions = all ? [...drafts.values()] : [current];
    download('train2-backup-' + (all ? C.today() : current.date) + '.json', C.backup(sessions), 'application/json;charset=utf-8');
    toast('已生成 JSON 备份，请确认文件已保存');
  }
  function prepareExport() {
    try {
      const check = C.issues(current);
      if (check.errors.length) { toast(check.errors[0]); showTab('finish'); $('finishTab').scrollIntoView({behavior: 'smooth', block: 'start'}); return false; }
      if (current.date > C.today() || current.date < '2026-09-21') {
        if (!confirm('实际训练日期为 ' + current.date + '，' + (current.date > C.today() ? '晚于今天' : '早于 2.0 周期起点') + '。确认这是要提交给 skill 核对的日期？')) return false;
      }
      $('exportText').value = C.exportMarkdown(current);
      $('exportCheck').innerHTML = check.missing.length ? '<div class="notice warning">还有 ' + check.missing.length + ' 项未填。可以返回补齐，或导出后由 skill 按规则询问。记不清的项目可在表单中明确标记“未记录”。<ul>' + check.missing.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul></div>' : '<div class="notice">收尾必需项已填写。其他未提供的信息保持未填。</div>';
      $('exportState').textContent = '粘贴到 AI 对话中，由 record-training-2 正式入库。';
      return true;
    } catch (error) { toast(error.message); return false; }
  }
  async function markExported(message) { current.exportedAt = new Date().toISOString(); await save(); updateSummaries(); $('exportState').textContent = message + '。尚未正式入库，请交给 record-training-2。'; }
  async function copyExport() {
    try { await navigator.clipboard.writeText($('exportText').value); await markExported('已复制完整训练记录'); toast('已复制，粘贴给记录 skill 即可'); }
    catch (_) { $('exportText').focus(); $('exportText').select(); $('exportText').setSelectionRange(0, $('exportText').value.length); $('exportState').textContent = '自动复制受限。请长按上方完整记录，选择全选并复制；也可以保存文件。'; }
  }
  document.addEventListener('input', event => {
    const path = event.target.dataset.field;
    if (!path || !current || event.target.tagName === 'SELECT') return;
    set(path, event.target.value); markEdited(path);
  });
  document.addEventListener('keydown', event => {
    if (event.target.matches('input[data-wheel]') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); openPicker(event.target.dataset.wheel, event.target.dataset.label); }
  });
  document.addEventListener('change', event => {
    const path = event.target.dataset.field;
    if (!path || !current) return;
    if (path.endsWith('.actualName')) { const action = current.actions[Number(path.split('.')[1])]; if (C.prefillActual(current, action, [...drafts.values()])) { markEdited(); renderTraining(); } return; }
    if (event.target.tagName !== 'SELECT') return;
    let value = event.target.value;
    if (path === 'readiness.redFlags' && ['true', 'false'].includes(value)) value = value === 'true';
    set(path, value); markEdited(path);
    if (path.endsWith('.doseMode')) renderTraining();
  });
  document.addEventListener('click', async event => {
    const wheel = event.target.closest('[data-wheel]');
    if (wheel && !wheel.disabled) { openPicker(wheel.dataset.wheel, wheel.dataset.label); return; }
    const button = event.target.closest('button'); if (!button) return;
    try {
      const d = button.dataset;
      if (d.jumpAction) { $('timelineDialog').close(); jumpAction(d.jumpAction); return; }
      if (d.command === 'import') openImport();
      if (d.command === 'blank') {
        const date = prompt('新建训练日期（YYYY-MM-DD）', C.today()); if (!date) return;
        if (!C.validDate(date)) throw new Error('请输入有效的 YYYY-MM-DD 日期');
        openSession(drafts.get(date) || C.createSession(null, date)); await save();
      }
      if (d.tab) showTab(d.tab);
      if (d.openDate) openSession(drafts.get(d.openDate));
      if (d.unknown) { set(d.unknown, get(d.unknown) === C.UNKNOWN ? '' : C.UNKNOWN); markEdited(d.unknown); render(); }
      const index = Number(d.index), action = current?.actions[index];
      if (d.option && action) {
        const existing = current.actions.find(other => (other.id === action.id || other.extraOptionOf === action.id) && other.selectedOptionId === d.option);
        if (existing) { if (existing.id !== action.id) jumpAction(existing.id); return; }
        const selected = C.optionAction(current, action, d.option);
        [selected, ...current.actions.filter(a => a.parentActionId === selected.id)].forEach(a => C.prefillActual(current, a, [...drafts.values()]));
        markEdited(); renderTraining(); updateSummaries(); if (selected.id !== action.id) jumpAction(selected.id);
      }
      if (d.status && action) { if (d.status === 'completed' || d.status === 'partial') C.prefillActual(current, action, [...drafts.values()]); action.status = d.status; markEdited(); renderTraining(); updateSummaries(); }
      if (d.addPart !== undefined) {
        const parent = current.actions[Number(d.addPart)];
        if (['completed', 'partial'].includes(parent.status) && !confirm('改为逐个记录后，组合本身恢复待记录，已填数据保留。请在子动作中核对本次实绩。继续？')) return;
        const added = C.addSlotAction(current, parent); parent.status = 'pending'; markEdited(); renderTraining(); updateSummaries(); jumpAction(added.id);
      }
      if (d.rest) startRest(d.rest);
      if (d.move && action) {
        const target = index + Number(d.move);
        if (target >= 0 && target < current.actions.length) { [current.actions[index], current.actions[target]] = [current.actions[target], current.actions[index]]; markEdited(); renderTraining(); }
      }
      if (d.remove !== undefined && confirm('移除此动作及其子动作实际数据？')) { C.removeAction(current, current.actions[Number(d.remove)]); markEdited(); renderTraining(); updateSummaries(); }
      if (d.mode !== undefined) {
        const a = current.actions[Number(d.mode)];
        if (!confirm(a.actual.mode === 'summary' ? '改为逐组填写：按本次推荐生成待核对数据，原汇总输入保留。请逐组修改为实际数据。继续？' : '改为动作汇总：导出采用汇总数据，请核对实际组次。逐组输入仍保留在草稿。继续？')) return;
        a.actual.mode = a.actual.mode === 'summary' ? 'sets' : 'summary';
        if (a.actual.mode === 'sets' && !a.actual.sets.length) { const suggested = C.recommendationRow(a); a.actual.sets = Array.from({length: Math.min(100, Math.max(1, Number(suggested.count) || 1))}, () => C.recommendationRow(a, true)); a.status = 'pending'; }
        markEdited(); renderTraining();
      }
      if (d.addSet !== undefined) { const a = current.actions[Number(d.addSet)], rows = a.actual.sets; if (rows.length >= 100) throw new Error('一个动作最多记录 100 组'); rows.push(C.recommendationRow(a, true)); a.status = 'pending'; markEdited(); renderTraining(); }
      if (d.removeSet !== undefined && confirm('删除这一组实际数据？')) { action.actual.sets.splice(Number(d.removeSet), 1); markEdited(); renderTraining(); }
      if (button.id === 'rebuildImported') await applyImport(true);
    } catch (error) { toast(error.message); }
  });
  $('helpButton').onclick = () => $('helpDialog').showModal();
  $('openTimeline').onclick = () => { renderTimeline(); $('timelineDialog').showModal(); };
  $('homeButton').onclick = async () => {
    if (current) await save();
    $('welcome').hidden = false; $('workspace').hidden = true;
    $('welcomeInbox').append(document.querySelector('.cloud-inbox'));
    $('resumeSession').hidden = !current; document.body.classList.remove('has-session');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };
  $('resumeSession').onclick = () => { if (current) openSession(drafts.get(current.date) || current); };
  $('syncRecommendation').onclick = syncInbox;
  $('openCloudRecommendation').onclick = () => {
    if (!cloudRecommendation) return;
    viewedRecommendation = C.copy(cloudRecommendation);
    const source = viewedRecommendation, existing = drafts.get(source.date), ready = source.readiness && C.readinessResult(source.readiness);
    $('recommendationContent').innerHTML = '<h3 class="reader-title">' + esc(source.title || '训练推荐') + '</h3><p class="reader-meta">' + source.date + (source.cycle ? ' · ' + esc(source.cycle) : '') + '<br>Readiness：' + (ready?.score ?? '未提供完整原始值') + (ready ? ' · ' + esc(ready.level) : '') + '</p>' + L.overview(source.notes, source.guidance) + source.slots.map((slot, i) => '<section class="reader-slot"><h3><span>' + String(i + 1).padStart(2, '0') + '</span>' + esc(slot.module) + '</h3>' + (slot.replacesSlotId ? '<p class="selection-hint">原建议替换 ' + esc(slot.replacesSlotId) + '，也可按当天状态另作加练。</p>' : '') + slot.options.map(o => '<details class="reader-option"' + (o.id === slot.selectedOptionId || slot.options.length === 1 ? ' open' : '') + '><summary>' + esc(o.id) + ' · ' + esc(o.name) + '</summary>' + L.prescription(o.prescription || '未提供剂量') + L.list(o.notes, 'guidance-lines') + (o.actions?.length ? '<ul class="reader-parts">' + o.actions.map(part => '<li><strong>' + esc(part.name) + '</strong>' + L.prescription(part.prescription || '未提供剂量') + L.list(part.notes, 'guidance-lines') + '</li>').join('') + '</ul>' : '') + '</details>').join('') + '</section>').join('');
    $('readerDraftNote').textContent = existing ? '此日已有草稿，继续记录会保留所有实绩。' : '开始记录后生成待核对卡片，可按状态多选或加练。';
    $('useRecommendation').textContent = existing ? '继续已有草稿 ↗' : '开始记录 ↗';
    $('rebuildRecommendation').hidden = !existing || JSON.stringify(existing.source) === JSON.stringify(source);
    $('readerError').hidden = true; $('recommendationDialog').showModal(); $('recommendationDialog').scrollTop = 0;
  };
  async function useViewedRecommendation(rebuild = false) {
    if (!viewedRecommendation) return;
    $('importError').hidden = true;
    imported = {type: 'recommendation', source: C.copy(viewedRecommendation)};
    if (await applyImport(rebuild)) $('recommendationDialog').close();
    else if (!$('importError').hidden) errorMessage('readerError', new Error($('importError').textContent));
  }
  $('useRecommendation').onclick = () => useViewedRecommendation();
  $('rebuildRecommendation').onclick = () => useViewedRecommendation(true);
  $('previewImport').onclick = preview;
  $('confirmImport').onclick = () => applyImport();
  $('importText').oninput = () => { imported = null; $('confirmImport').disabled = true; $('importPreview').hidden = true; };
  $('importFile').onchange = async event => {
    try { const file = event.target.files[0]; if (!file) return; if (file.size > 2000000) throw new Error('文件不能超过 2 MB'); $('importText').value = await file.text(); preview(); }
    catch (error) { errorMessage('importError', error); }
    event.target.value = '';
  };
  $('addAction').onclick = () => { if (current.actions.length >= 200) { toast('一份草稿最多记录 200 个动作'); return; } const action = C.addAction(current); action.status = 'pending'; markEdited(); renderTraining(); updateSummaries(); document.querySelector('[data-action-card="' + (current.actions.length - 1) + '"]').scrollIntoView({behavior: 'smooth', block: 'start'}); };
  $('sessionDate').onchange = async event => {
    const date = event.target.value;
    if (!C.validDate(date)) { event.target.value = current.date; return; }
    if (date === current.date) return;
    if (!confirm('切换到 ' + date + '：有草稿则继续原草稿；没有则用当前推荐新建空白实绩。原日期草稿保留，其他日期的 Readiness 不复制。继续？')) { event.target.value = current.date; return; }
    openSession(drafts.get(date) || C.createSession(current.source, date)); await save();
  };
  $('mainExport').onclick = () => { if (prepareExport()) { $('exportDialog').showModal(); if (!C.issues(current).missing.length) copyExport(); } };
  $('copyExport').onclick = copyExport;
  $('shareExport').onclick = async () => {
    try {
      if (!navigator.share) { $('exportState').textContent = '此浏览器不支持系统分享，请复制记录或保存文件。'; return; }
      await navigator.share({title: current.date + ' 训练记录', text: $('exportText').value}); await markExported('已打开系统分享');
    } catch (error) { if (error.name !== 'AbortError') $('exportState').textContent = '分享未完成，请复制记录或保存文件。'; }
  };
  $('downloadMarkdown').onclick = async () => { download('train2-record-' + current.date + '.md', $('exportText').value, 'text/markdown;charset=utf-8'); await markExported('已生成 Markdown 文件，请确认保存完成'); };
  $('backupCurrent').onclick = () => { try { backup(); } catch (error) { toast(error.message); } };
  $('backupAll').onclick = () => { try { backup(true); } catch (error) { toast(error.message); } };
  $('demoButton').onclick = () => {
    const source = C.validateRecommendation({kind: 'train2.recommendation', schemaVersion: 1, date: C.today(), title: '虚构示例 · 请勿正式入库', cycle: '演示槽位', notes: '这是虚构示例，用来体验操作；不是真实推荐或训练记录。', readiness: null, slots: [{id: 'warmup', module: '准备', selectedOptionId: 'A', options: [{id: 'A', name: '轻松步行', prescription: '示例目标：2 分钟', notes: ''}]}, {id: 'main', module: '主训练 · 三选一', selectedOptionId: null, options: [{id: 'A', name: '哑铃深蹲', prescription: '示例目标：3×8；仅作界面示例', notes: ''}, {id: 'B', name: '台阶踏上', prescription: '示例目标：2×8/侧', notes: ''}, {id: 'C', name: '徒手深蹲', prescription: '示例目标：2×10', notes: ''}]}]});
    $('importText').value = JSON.stringify(source, null, 2); openImport(); preview();
  };
  function connection() { $('connectionLabel').textContent = navigator.onLine ? '本机记录' : '正在离线记录'; $('connectionLabel').parentElement.classList.toggle('offline', !navigator.onLine); }
  window.addEventListener('online', () => { connection(); syncInbox(); checkForUpdates(); }); window.addEventListener('offline', connection); connection();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { updateClocks(); syncInbox(); checkForUpdates(); } });
  function showToolUpdate(message = '保存草稿后即可更新，无需清缓存。') {
    $('updateMessage').textContent = message;
    $('updateBanner').hidden = false;
  }
  async function checkForUpdates(force = false) {
    if (!toolRegistration || !navigator.onLine || (!force && Date.now() - lastUpdateCheck < 60000)) return;
    lastUpdateCheck = Date.now();
    try {
      await toolRegistration.update();
      if (toolRegistration.waiting) showToolUpdate();
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'version.json?_=' + Date.now()); xhr.timeout = 8000;
      xhr.onload = () => {
        if (xhr.status !== 200) return;
        try { const latest = JSON.parse(xhr.responseText).version; if (latest && latest !== toolBuild) showToolUpdate('检测到新版，点“保存并更新”即可切换。'); } catch (_) { /* Login pages are not version responses. */ }
      };
      xhr.send();
    } catch (_) { /* Keep the current offline tool usable when update checks fail. */ }
  }
  $('applyUpdate').onclick = async () => {
    if (applyingUpdate) return;
    applyingUpdate = true; $('applyUpdate').disabled = true;
    if (current) await save(); else await writeQueue;
    if (!$('storageError').hidden) { toast('草稿尚未保存，请先导出 JSON 备份后再更新'); applyingUpdate = false; $('applyUpdate').disabled = false; return; }
    await checkForUpdates(true);
    if (!toolRegistration?.waiting) { location.assign(new URL('update.html', location.href).href); return; }
    $('updateMessage').textContent = '草稿已保存，正在切换新版…';
    const reload = async () => { await writeQueue; if ($('storageError').hidden) location.reload(); else { applyingUpdate = false; $('applyUpdate').disabled = false; toast('保存尚未完成，请先备份再更新'); } };
    navigator.serviceWorker.addEventListener('controllerchange', reload, {once: true});
    toolRegistration.waiting.postMessage({type: 'ACTIVATE_UPDATE'});
  };
  async function offline() {
    if (!('serviceWorker' in navigator) || !['https:', 'http:'].includes(location.protocol) || (!isSecureContext)) return;
    try {
      const registration = await navigator.serviceWorker.register('sw.js', {scope: './', updateViaCache: 'none'});
      toolRegistration = registration;
      const ready = await navigator.serviceWorker.ready;
      if (ready.active) { $('offlineStatus').textContent = '离线已就绪 · 本机草稿持续保存'; $('offlineStatus').hidden = false; }
      const waiting = worker => {
        if (!worker) return;
        const changed = () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) showToolUpdate(); };
        worker.addEventListener('statechange', changed); changed();
      };
      registration.addEventListener('updatefound', () => waiting(registration.installing));
      waiting(registration.installing);
      if (registration.waiting) showToolUpdate();
      checkForUpdates();
    } catch (_) { $('offlineStatus').textContent = '离线缓存尚未就绪，请保持联网打开；本机草稿仍单独保存。'; $('offlineStatus').hidden = false; }
  }
  async function start() {
    try {
      const saved = await S.all();
      saved.forEach(draft => { C.validateSession(draft); drafts.set(draft.date, draft); });
      const latest = drafts.get(C.today()) || [...drafts.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (latest) openSession(latest);
    } catch (error) { toast('本地草稿暂不可读：' + error.message + '。可新建记录并导出备份。'); }
    offline();
    syncInbox();
  }
  start();
})();
