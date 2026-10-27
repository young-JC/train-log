(function () {
  'use strict';
  const C = TrainingRecorder, S = RecorderStorage, L = RecorderLayout;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const labels = {pending: '待记录', completed: '完成', partial: '部分', skipped: '跳过'};
  let drafts = new Map(), current = null, imported = null, tab = 'training', writeQueue = Promise.resolve(), revision = 0, toastTimer;
  let cloudRecommendation = null, syncing = false;
  let toolRegistration = null, lastUpdateCheck = 0, applyingUpdate = false;
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
    $('welcome').hidden = true; $('workspace').hidden = false; document.body.classList.add('has-session');
    render();
    $('saveStatus').textContent = '本机草稿 · ' + savedAt(current.updatedAt);
  }
  function field(path, label, placeholder = '', options = {}) {
    const value = get(path) ?? '', unknown = value === C.UNKNOWN;
    const control = options.area ? '<textarea rows="2" data-field="' + path + '" placeholder="' + esc(placeholder) + '"' + (unknown ? ' disabled' : '') + '>' + (unknown ? '' : esc(value)) + '</textarea>' : '<input data-field="' + path + '" value="' + (unknown ? '' : esc(value)) + '" placeholder="' + esc(placeholder) + '"' + (options.numeric ? ' inputmode="decimal"' : '') + (unknown ? ' disabled' : '') + '>';
    return '<label class="field"><span>' + esc(label) + '</span><span class="field-row">' + control + (options.unknown === false ? '' : '<button type="button" class="unknown-toggle' + (unknown ? ' active' : '') + '" data-unknown="' + path + '">' + (unknown ? '已标未记录' : '未记录') + '</button>') + '</span></label>';
  }
  function selectField(path, label, choices) {
    const value = get(path);
    return '<label class="field"><span>' + esc(label) + '</span><select data-field="' + path + '">' + choices.map(([v, name]) => '<option value="' + esc(v) + '"' + (String(value) === String(v) ? ' selected' : '') + '>' + esc(name) + '</option>').join('') + '</select></label>';
  }
  function actualFields(base, grouped = false) {
    return '<div class="field-grid">' + field(base + '.dose', grouped ? '本组次数 / 时长 / 距离' : '实际组次 / 时长 / 距离', grouped ? '例：5次/侧' : '例：3×8/侧、12分钟') + field(base + '.rpe', '实际 RPE', '例：7 或 6–7') + '</div>' + field(base + '.load', '实际负荷', '例：22、自重、弹力带', {numeric: false}) + '<div class="unit-grid">' + selectField(base + '.unit', '负荷单位', [['', '未说明'], ['kg', 'kg'], ['lb', 'lb'], ['自重', '自重'], ['其他', '其他 / 见负荷描述']]) + selectField(base + '.basis', '重量口径', [['', '未说明'], ['单侧', '单侧'], ['总重', '总重'], ['器械标称', '器械标称'], ['不适用', '不适用'], ['其他', '其他 / 见备注']]) + '</div>';
  }
  function renderAction(a, index) {
    const chosen = C.selected(a), base = 'actions.' + index + '.actual';
    const options = a.added ? '' : '<div class="option-list">' + a.slot.options.map(C.optionDetails).map(o => '<button class="option-button' + (a.selectedOptionId === o.id ? ' chosen' : '') + '" data-option="' + esc(o.id) + '" data-index="' + index + '" aria-pressed="' + (a.selectedOptionId === o.id) + '"><span class="option-key">' + esc(o.id) + '</span><span class="option-content"><span class="option-name">' + L.lines(o.name, true).map(name => '<span>' + esc(name) + '</span>').join('') + '</span><span class="option-dose-preview">' + esc(L.lines(o.prescription || '', true)[0] || '查看推荐安排') + '</span></span><span class="option-check" aria-hidden="true">' + (a.selectedOptionId === o.id ? '✓' : '○') + '</span></button>').join('') + '</div>';
    let content = '<article class="action-card ' + a.status + '" data-action-card="' + index + '"><div class="card-top"><span class="action-number">' + String(index + 1).padStart(2, '0') + '</span><span class="module-label">' + esc(a.slot.module) + (a.slot.optional ? ' · 可跳过' : '') + '</span><div class="order-buttons"><button data-move="-1" data-index="' + index + '" aria-label="动作上移"' + (!index ? ' disabled' : '') + '>↑</button><button data-move="1" data-index="' + index + '" aria-label="动作下移"' + (index === current.actions.length - 1 ? ' disabled' : '') + '>↓</button>' + (a.added ? '<button data-remove="' + index + '" aria-label="移除加练动作">×</button>' : '') + '</div></div>' + (a.added ? '<h3>加练动作</h3>' : '') + options;
    if (chosen && !a.added) content += L.reference(chosen, a.slot.replacesSlotId);
    if (!chosen && a.slot.options.length > 1) content += '<p class="fine">候选未选，所有动作都还没有计入实绩。</p>';
    content += '<div class="status-picker">' + Object.entries(labels).map(([key, label]) => '<button class="' + (a.status === key ? 'active' : '') + '" data-status="' + key + '" data-index="' + index + '" aria-pressed="' + (a.status === key) + '">' + label + '</button>').join('') + '</div>';
    if (a.status === 'completed' || a.status === 'partial') {
      content += field('actions.' + index + '.actualName', a.added ? '实际动作名称' : '替换为其他动作（按需填写）', a.added ? '填写你实际做的动作' : '沿用上方已选动作名称', {unknown: false});
      if (a.actual.mode === 'summary') content += actualFields(base);
      else content += a.actual.sets.map((row, i) => '<div class="set-row"><div class="set-heading"><b>第 ' + (i + 1) + ' 组</b><button data-remove-set="' + i + '" data-index="' + index + '">删除此组</button></div>' + actualFields(base + '.sets.' + i, true) + field(base + '.sets.' + i + '.notes', '本组反馈 / 左右侧 / 测量结果', '例：左侧7、右侧6；跳高/用时', {area: true}) + '</div>').join('') + '<button class="button outline wide mode-button" data-add-set="' + index + '">＋ 添加一组（空白实际数据）</button>';
      content += '<button class="button outline mode-button" data-mode="' + index + '">' + (a.actual.mode === 'sets' ? '改为按动作汇总填写' : '各组不一样？展开逐组填写') + '</button><details class="card-details"><summary>动作反馈、休息、侧别与其他数据</summary>' + field(base + '.notes', '整体备注 / 部分完成说明', '休息、动作质量、左右差异、投篮命中/出手等', {area: true}) + '</details>';
    } else if (a.status === 'skipped') content += field(base + '.notes', '跳过原因（可选）', '例：器材不可用、时间不足', {area: true});
    return content + '</article>';
  }
  function renderTraining() {
    $('actionList').innerHTML = current.actions.length ? current.actions.map(renderAction).join('') : '<div class="form-card"><h3>从第一个动作开始</h3><p class="muted">添加你实际做过的动作，或导入一份推荐生成卡片。</p></div>';
    $('recommendationNotes').innerHTML = current.source?.notes ? L.overview(current.source.notes) : '';
    $('recommendationNotes').hidden = !current.source?.notes;
  }
  function renderFinish() {
    $('finishFields').innerHTML = '<div class="form-card"><h3>本次训练</h3>' + field('title', '训练名称', '例：下肢力量 + 核心', {unknown: false}) + field('cycle', '周期 / 槽位', '按实际确认填写', {unknown: false}) + selectField('sessionStatus', '本次训练状态', ['待确认', '已完成', '部分完成', '恢复日', '未训练'].map(v => [v, v])) + '<div class="field-grid">' + field('duration', '训练总时长 · 分钟', '不按动作时间相加推测', {numeric: true}) + field('sessionRpe', 'Session RPE · 0–10', '整堂训练的整体用力程度', {numeric: true}) + '</div><div id="loadSummary" class="reference"></div></div>' +
      '<div class="form-card"><h3>训练前 Readiness</h3><p class="muted" style="margin-bottom:18px">同日推荐的原始值会带入。状态变化时在这里填写训练前最终值。</p><div class="field-grid">' + C.readyFields.map(([key, label, min, max]) => selectField('readiness.' + key, label + ' · ' + min + '–' + max, [['', '未填'], ...Array.from({length: max - min + 1}, (_, i) => [String(min + i), String(min + i)]), [C.UNKNOWN, '未记录']])).join('') + '</div>' + field('readiness.painNote', '训练前疼痛部位 / 性质', '有疼痛时补充', {area: true}) + selectField('readiness.redFlags', '训练前是否有异常症状', [['', '未确认'], ['false', '明确无异常症状'], ['true', '有异常症状'], [C.UNKNOWN, '未记录']]) + '<div id="readySummary" class="reference"></div></div>' +
      '<div class="form-card"><h3>疼痛与身体反馈</h3>' + field('painDuring', '训练中最高疼痛 · 0–10', '没有疼痛时填 0', {numeric: true}) + field('painDuringNote', '训练中疼痛部位 / 触发动作', '按实际发生情况填写', {area: true}) + field('painAfter', '训练后疼痛 · 0–10', '没有疼痛时填 0', {numeric: true}) + field('painAfterNote', '训练后疼痛部位 / 性质', '有疼痛时补充', {area: true}) + field('painNext', '次日疼痛 · 0–10', '次日再补充；当天留空', {numeric: true}) + field('painNextNote', '次日疼痛部位 / 性质', '次日再补充', {area: true}) + field('symptoms', '异常症状 / 其他身体反馈', '按实际填写；没有时可写无', {area: true}) + '</div><div class="form-card"><h3>还有什么要留给下次？</h3>' + field('completionNote', '实际完成情况与补充', '时间不足、动作替换原因、篮球表现等', {area: true}) + '</div>';
  }
  function updateSummaries() {
    if (!current) return;
    const done = current.actions.filter(a => ['completed', 'partial'].includes(a.status)).length;
    $('progressNumber').textContent = done + '/' + current.actions.length;
    $('progressLabel').textContent = done + ' 个实际动作 · ' + current.actions.filter(a => a.status === 'skipped').length + ' 个跳过';
    $('bottomProgress').textContent = current.exportedAt ? '已导出 · 待 skill 入库' : done + ' 个动作已记录';
    $('sessionHeading').textContent = current.title || '今日训练';
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
    renderTraining(); renderFinish(); showTab(tab); updateSummaries();
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
      if (!inbox) { inboxStatus('还没有已同步推荐，生成推荐后会显示在这里'); cloudRecommendation = null; $('openCloudRecommendation').hidden = true; return; }
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
      $('openCloudRecommendation').hidden = false;
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
  document.addEventListener('change', event => {
    const path = event.target.dataset.field;
    if (!path || !current || event.target.tagName !== 'SELECT') return;
    let value = event.target.value;
    if (path === 'readiness.redFlags' && ['true', 'false'].includes(value)) value = value === 'true';
    set(path, value); markEdited(path);
  });
  document.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return;
    try {
      const d = button.dataset;
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
        if (action.selectedOptionId === d.option) return;
        if ((action.status !== 'pending' || action.actualName || JSON.stringify(action.actual) !== JSON.stringify(C.emptyActual())) && !confirm('切换候选会清空此动作已填的实绩并恢复待记录，其他动作保留。确认切换？')) return;
        action.selectedOptionId = d.option; action.actualName = ''; action.status = 'pending'; action.actual = C.emptyActual(); markEdited(); renderTraining(); updateSummaries();
      }
      if (d.status && action) { action.status = d.status; markEdited(); renderTraining(); updateSummaries(); }
      if (d.move && action) {
        const target = index + Number(d.move);
        if (target >= 0 && target < current.actions.length) { [current.actions[index], current.actions[target]] = [current.actions[target], current.actions[index]]; markEdited(); renderTraining(); }
      }
      if (d.remove !== undefined && confirm('移除此加练动作及其实际数据？')) { current.actions.splice(Number(d.remove), 1); markEdited(); renderTraining(); }
      if (d.mode !== undefined) {
        const a = current.actions[Number(d.mode)];
        if (!confirm(a.actual.mode === 'summary' ? '改为逐组填写：各组从空白开始，汇总数值不会自动分配。导出采用逐组数据。继续？' : '改为动作汇总：导出采用汇总数据，请核对实际组次。逐组输入仍保留在草稿。继续？')) return;
        a.actual.mode = a.actual.mode === 'summary' ? 'sets' : 'summary';
        if (a.actual.mode === 'sets' && !a.actual.sets.length) a.actual.sets.push(C.emptyActual());
        markEdited(); renderTraining();
      }
      if (d.addSet !== undefined) { const rows = current.actions[Number(d.addSet)].actual.sets; if (rows.length >= 100) throw new Error('一个动作最多记录 100 组'); rows.push(C.emptyActual()); markEdited(); renderTraining(); }
      if (d.removeSet !== undefined && confirm('删除这一组实际数据？')) { action.actual.sets.splice(Number(d.removeSet), 1); markEdited(); renderTraining(); }
      if (button.id === 'rebuildImported') await applyImport(true);
    } catch (error) { toast(error.message); }
  });
  $('helpButton').onclick = () => $('helpDialog').showModal();
  $('homeButton').onclick = async () => {
    if (current) await save();
    $('welcome').hidden = false; $('workspace').hidden = true;
    $('resumeSession').hidden = !current; document.body.classList.remove('has-session');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };
  $('resumeSession').onclick = () => { if (current) openSession(drafts.get(current.date) || current); };
  $('syncRecommendation').onclick = syncInbox;
  $('openCloudRecommendation').onclick = () => {
    if (!cloudRecommendation) return;
    $('importText').value = JSON.stringify(cloudRecommendation);
    openImport(); preview();
  };
  $('previewImport').onclick = preview;
  $('confirmImport').onclick = () => applyImport();
  $('importText').oninput = () => { imported = null; $('confirmImport').disabled = true; $('importPreview').hidden = true; };
  $('importFile').onchange = async event => {
    try { const file = event.target.files[0]; if (!file) return; if (file.size > 2000000) throw new Error('文件不能超过 2 MB'); $('importText').value = await file.text(); preview(); }
    catch (error) { errorMessage('importError', error); }
    event.target.value = '';
  };
  $('addAction').onclick = () => { if (current.actions.length >= 200) { toast('一份草稿最多记录 200 个动作'); return; } const action = C.addAction(current); action.status = 'completed'; markEdited(); renderTraining(); updateSummaries(); document.querySelector('[data-action-card="' + (current.actions.length - 1) + '"]').scrollIntoView({behavior: 'smooth', block: 'start'}); };
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
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncInbox(); checkForUpdates(); } });
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
