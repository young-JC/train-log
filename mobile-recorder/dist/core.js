/* Shared model. Suggested entries become results only after user completion confirmation. */
(function (root) {
  'use strict';
  const UNKNOWN = '未记录';
  const copy = value => JSON.parse(JSON.stringify(value));
  const text = value => typeof value === 'string' ? value.trim() : '';
  const blank = value => value === '' || value === null || value === undefined;
  const shown = value => blank(value) ? '未填（待补充）' : String(value);
  const cell = value => shown(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, '；');
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  }
  function number(value, min, max, label) {
    if (blank(value) || value === UNKNOWN) return null;
    if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(\.\d+)?$/.test(String(value))) throw new Error(label + '必须是数字');
    const result = Number(value);
    if (!Number.isFinite(result) || result < min || result > max) throw new Error(label + '范围应为 ' + min + '–' + max);
    return result;
  }
  function string(value, label, max = 5000, required = false) {
    if (value === undefined || value === null) value = '';
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(label + '格式不正确' + (required ? '或为空' : ''));
    return value.trim();
  }
  function readinessValues() { return {sleep: '', fatigue: '', soreness: '', pain: '', motivation: '', painNote: '', redFlags: ''}; }
  const readyFields = [['sleep', '睡眠', 1, 5], ['fatigue', '疲劳', 1, 5], ['soreness', '酸痛', 1, 5], ['pain', '训练前疼痛', 0, 10], ['motivation', '训练意愿', 1, 5]];
  function readinessResult(ready) {
    const values = readyFields.map(([key, label, min, max]) => number(ready[key], min, max, label));
    if (values.some(v => v === null)) return {score: null, level: '原始值不全，未计算'};
    const [sleep, fatigue, soreness, pain, motivation] = values;
    const score = Math.round(20 * (sleep / 5 + (6 - fatigue) / 5 + (6 - soreness) / 5 + (10 - pain) / 10 + motivation / 5));
    const level = ready.redFlags === true || score < 60 || pain >= 5 ? '红色' : score < 75 || pain >= 3 ? '黄色' : ready.redFlags === false ? '绿色' : '分数达绿色区，异常症状待确认';
    return {score, level};
  }
  function parseJSON(input) {
    if (typeof input !== 'string') return copy(input);
    if (input.length > 2000000) throw new Error('文件过大，请使用 2 MB 以内的记录数据');
    const trimmed = input.replace(/^\uFEFF/, '').trim();
    try { return JSON.parse(trimmed); } catch (_) { /* A complete chat reply may contain one fenced import block. */ }
    const blocks = [...trimmed.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].flatMap(match => {
      try { const data = JSON.parse(match[1]); return data.kind === 'train2.recommendation' || data.kind === 'train2.recorder-backup' ? [data] : []; } catch (_) { return []; }
    });
    if (blocks.length !== 1) throw new Error('请粘贴一段完整的推荐 JSON 导入块，或选择备份文件；不支持直接识别普通推荐文字');
    return blocks[0];
  }
  function optionDetails(option) {
    const id = string(option.id, '候选 id', 80, true);
    function clean(value) {
      let result = value, previous;
      do {
        previous = result;
        result = result.replace(/^\s*[:：]+\s*/, '');
        if (['A', 'B', 'C'].includes(id)) result = result.replace(new RegExp('^' + id + '\\s*[:：]\\s*', 'i'), '');
      } while (result !== previous);
      return result.trim();
    }
    const rawName = clean(string(option.name, '动作名称', 5000, true));
    let depth = 0, boundary = -1;
    for (let i = 0; i < rawName.length; i++) {
      if ('（(['.includes(rawName[i])) depth++;
      else if ('）)]'.includes(rawName[i])) depth = Math.max(0, depth - 1);
      else if (!depth && '；;\r\n'.includes(rawName[i])) { boundary = i; break; }
    }
    const name = string(boundary < 0 ? rawName : rawName.slice(0, boundary), '动作短名称', 300, true);
    const extra = boundary < 0 ? '' : rawName.slice(boundary + 1).trim();
    let notes = clean(string(option.notes, '动作注意事项'));
    if (extra && !notes.includes(extra)) notes = [extra, notes].filter(Boolean).join('；');
    const result = {id, name, prescription: clean(string(option.prescription, '推荐剂量')), notes};
    if (option.defaults != null) result.defaults = entryDefaults(option.defaults);
    if (option.actions != null) {
      if (!Array.isArray(option.actions) || !option.actions.length || option.actions.length > 30) throw new Error('组合需包含 1–30 个子动作');
      result.actions = option.actions.map(part => {
        if (!part || typeof part !== 'object' || part.actions != null) throw new Error('组合子动作格式无效');
        const detail = optionDetails({...part, id: 'part'});
        return {name: detail.name, prescription: detail.prescription, notes: detail.notes, ...(detail.defaults ? {defaults: detail.defaults} : {})};
      });
    }
    return result;
  }
  function restValue(value) {
    if (blank(value) || value === UNKNOWN) return value;
    const parts = String(value).split(/\s*[–—\-~～至]\s*/);
    if (parts.length > 2 || parts.some(v => number(v, 0, 86400, '休息秒数') === null) || (parts.length === 2 && Number(parts[0]) > Number(parts[1]))) throw new Error('休息应为 0–86400 秒或递增范围');
    return String(value);
  }
  function entryDefaults(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('defaults 必须为推荐预填对象');
    const allowed = ['doseMode', 'dose', 'count', 'reps', 'seconds', 'side', 'rest', 'load', 'unit', 'basis', 'rpe'], result = {};
    Object.keys(input).forEach(k => { if (!allowed.includes(k)) throw new Error('defaults 不支持字段：' + k); result[k] = string(input[k], '推荐预填 ' + k, 500); });
    if (result.doseMode && !['reps', 'time', 'free'].includes(result.doseMode)) throw new Error('推荐预填剂量模式无效');
    [['count', 1, 100], ['reps', 0, 999], ['seconds', 0, 86400]].forEach(([k, min, max]) => { const n = number(result[k], min, max, '推荐预填 ' + k); if (n !== null && k !== 'seconds' && !Number.isInteger(n)) throw new Error('推荐组数与次数必须为整数'); });
    restValue(result.rest);
    if (result.rpe) {
      if (!/^\d+(?:\.\d+)?(?:\s*[–—\-~～至]\s*\d+(?:\.\d+)?)?$/.test(result.rpe)) throw new Error('推荐 RPE 应为 0–10 数字或范围');
      const values = result.rpe.split(/\s*[–—\-~～至]\s*/).map(Number);
      if (values.some(v => v > 10) || values.length === 2 && values[0] > values[1]) throw new Error('推荐 RPE 范围无效');
    }
    if (result.side && result.side !== '每侧') throw new Error('推荐侧别口径无效');
    if (result.unit && !['kg', 'lb', '自重', '其他'].includes(result.unit)) throw new Error('推荐负荷单位无效');
    if (result.basis && !['单侧', '总重', '器械标称', '不适用', '其他'].includes(result.basis)) throw new Error('推荐重量口径无效');
    return result;
  }
  function validateRecommendation(input) {
    const data = parseJSON(input);
    if (!data || data.kind !== 'train2.recommendation' || data.schemaVersion !== 1) throw new Error('需要 train2.recommendation 格式，schemaVersion 为 1');
    if (!validDate(data.date)) throw new Error('推荐日期必须是有效的 YYYY-MM-DD');
    if (!Array.isArray(data.slots) || data.slots.length > 150) throw new Error('slots 必须是动作槽位数组，最多 150 项');
    const result = {kind: data.kind, schemaVersion: 1, date: data.date, title: string(data.title, '训练名称', 150), cycle: string(data.cycle, '周期信息', 300), notes: string(data.notes, '训练注意事项'), readiness: null, slots: []};
    if (data.guidance != null) {
      if (!data.guidance || typeof data.guidance !== 'object' || Array.isArray(data.guidance)) throw new Error('guidance 必须为分类提示对象');
      result.guidance = {};
      for (const key of ['focus', 'arrangement', 'safety']) {
        if (data.guidance[key] == null) continue;
        if (!Array.isArray(data.guidance[key]) || data.guidance[key].length > 15) throw new Error('guidance.' + key + ' 必须为最多 15 条提示');
        result.guidance[key] = data.guidance[key].map(v => string(v, '分类提示', 1000, true));
      }
    }
    if (data.readiness != null) {
      const r = data.readiness;
      if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('readiness 必须为原始值对象或 null');
      result.readiness = readinessValues();
      readyFields.forEach(([key, label, min, max]) => {
        if (r[key] != null && r[key] !== '' && (typeof r[key] !== 'number' || !Number.isInteger(r[key]))) throw new Error(label + '导入值必须为整数或 null');
        result.readiness[key] = number(r[key], min, max, label);
      });
      result.readiness.painNote = string(r.painNote, '疼痛备注');
      if (r.redFlags != null && r.redFlags !== '' && typeof r.redFlags !== 'boolean') throw new Error('redFlags 只能为 true、false 或 null');
      result.readiness.redFlags = r.redFlags === '' ? null : r.redFlags ?? null;
      const calculated = readinessResult(result.readiness);
      if (r.score != null && calculated.score !== r.score) throw new Error('Readiness 得分与五项原始值不一致，请核对推荐');
    }
    const ids = new Set();
    data.slots.forEach((slot, index) => {
      if (!slot || typeof slot !== 'object') throw new Error('槽位 ' + (index + 1) + '格式不正确');
      const id = string(slot.id, '槽位 id', 80, true);
      if (ids.has(id)) throw new Error('槽位 id 重复：' + id);
      ids.add(id);
      if (!Array.isArray(slot.options) || !slot.options.length || slot.options.length > 12) throw new Error('槽位 ' + id + '需要 1–12 个动作候选');
      const optionIds = new Set();
      const options = slot.options.map(option => {
        if (!option || typeof option !== 'object') throw new Error('候选动作必须为对象：' + id);
        const oid = string(option.id, '候选 id', 80, true);
        if (optionIds.has(oid)) throw new Error('候选 id 重复：' + id + '/' + oid);
        optionIds.add(oid);
        return optionDetails(option);
      });
      const selected = slot.selectedOptionId ?? null;
      if (selected !== null && !optionIds.has(selected)) throw new Error('槽位 ' + id + '的所选候选不存在');
      result.slots.push({id, module: string(slot.module, '模块名称', 150, true), optional: slot.optional === true, replacesSlotId: slot.replacesSlotId == null ? null : string(slot.replacesSlotId, '替换槽位', 80, true), selectedOptionId: selected, options});
    });
    result.slots.forEach(slot => {
      if (slot.replacesSlotId && (!ids.has(slot.replacesSlotId) || slot.replacesSlotId === slot.id)) throw new Error('替换关系指向不存在或自身槽位：' + slot.id);
    });
    return result;
  }
  function emptyActual() { return {dose: '', doseMode: 'reps', count: '', reps: '', seconds: '', side: '', rest: '', load: '', unit: '', basis: '', rpe: '', notes: '', mode: 'summary', sets: []}; }
  function doseText(row, grouped = false) {
    if (!row.doseMode || row.doseMode === 'free') return row.dose;
    const value = row.doseMode === 'time' ? row.seconds : row.reps;
    if (blank(value) && blank(row.count)) return '';
    return (grouped ? '' : shown(row.count) + '组 × ') + shown(value) + (row.doseMode === 'time' ? '秒' : '次') + (row.side === '每侧' ? '/侧' : '');
  }
  function newAction(slot, index) {
    const selected = slot.selectedOptionId;
    return {id: 'action-' + index + '-' + slot.id, slot: copy(slot), selectedOptionId: selected, actualName: '', status: 'pending', actual: emptyActual(), added: false};
  }
  function createSession(recommendation, date = recommendation?.date || today()) {
    if (!validDate(date)) throw new Error('训练日期格式不正确');
    const source = recommendation ? validateRecommendation(recommendation) : null;
    const ready = source?.date === date && source.readiness ? Object.fromEntries(Object.entries(source.readiness).map(([key, value]) => [key, value ?? ''])) : readinessValues();
    const session = {kind: 'train2.recorder-draft', schemaVersion: 1, date, title: source?.title || '', cycle: source?.date === date ? source.cycle : '', source, readiness: ready, readinessEdited: false, sessionStatus: '待确认', actions: source ? source.slots.map(newAction) : [], duration: '', sessionRpe: '', painDuring: '', painAfter: '', painNext: '', painDuringNote: '', painAfterNote: '', painNextNote: '', symptoms: '', completionNote: '', updatedAt: new Date().toISOString(), exportedAt: null};
    [...session.actions].forEach(a => expandSlot(session, a));
    session.actions.forEach(a => prefillRecommendation(session, a));
    return session;
  }
  function addAction(session) {
    const id = 'extra-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const action = newAction({id, module: '加练', optional: false, replacesSlotId: null, selectedOptionId: 'actual', options: [{id: 'actual', name: '自定义动作', prescription: '', notes: ''}]}, session.actions.length);
    action.added = true;
    session.actions.push(action);
    return action;
  }
  function addSlotAction(session, parent) {
    if (session.actions.length >= 200) throw new Error('一份草稿最多记录 200 个动作');
    if (!parent || parent.parentActionId || !selected(parent)) throw new Error('请先选择槽位方案');
    const action = newAction(parent.slot, session.actions.length);
    action.id = 'part-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    action.parentActionId = parent.id;
    action.selectedOptionId = parent.selectedOptionId;
    const last = session.actions.reduce((end, a, i) => a.id === parent.id || a.parentActionId === parent.id ? i : end, 0);
    session.actions.splice(last + 1, 0, action);
    return action;
  }
  function optionAction(session, parent, optionId) {
    if (!parent || parent.parentActionId || parent.added || parent.extraOptionOf) throw new Error('请从原推荐槽位选择动作');
    if (!parent.slot.options.some(o => o.id === optionId)) throw new Error('候选动作不存在');
    const existing = session.actions.find(a => (a.id === parent.id || a.extraOptionOf === parent.id) && a.selectedOptionId === optionId);
    if (existing) return existing;
    const chosenOption = parent.slot.options.find(o => o.id === optionId);
    if (session.actions.length + (parent.selectedOptionId ? 1 : 0) + (chosenOption.actions?.length || 0) > 200) throw new Error('一份草稿最多记录 200 个动作');
    if (!parent.selectedOptionId) {
      parent.selectedOptionId = optionId; expandSlot(session, parent); prefillRecommendation(session, parent); return parent;
    }
    if (session.actions.length >= 200) throw new Error('一份草稿最多记录 200 个动作');
    const option = parent.slot.options.find(o => o.id === optionId);
    const action = newAction({...parent.slot, options: [copy(option)], selectedOptionId: optionId}, session.actions.length);
    action.id = 'option-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    action.extraOptionOf = parent.id;
    const last = session.actions.reduce((end, a, i) => a.id === parent.id || a.parentActionId === parent.id || a.extraOptionOf === parent.id || session.actions.some(root => root.extraOptionOf === parent.id && a.parentActionId === root.id) ? i : end, 0);
    session.actions.splice(last + 1, 0, action);
    expandSlot(session, action); prefillRecommendation(session, action);
    return action;
  }
  function removeAction(session, action) {
    const removed = new Set([action.id]);
    let size;
    do { size = removed.size; session.actions.forEach(a => { if (removed.has(a.parentActionId) || removed.has(a.extraOptionOf)) removed.add(a.id); }); } while (removed.size !== size);
    session.actions = session.actions.filter(a => !removed.has(a.id));
  }
  function latestActual(session, action, history) {
    const name = actionName(action).normalize('NFKC').trim().toLowerCase();
    if (!name) return null;
    const matches = [];
    history.filter(s => s.date < session.date && s.sessionStatus !== '未训练').forEach(s => s.actions.forEach(a => {
      if (!['completed', 'partial'].includes(a.status) || actionName(a).normalize('NFKC').trim().toLowerCase() !== name) return;
      const rows = a.actual.mode === 'sets' ? a.actual.sets : [a.actual];
      if (rows.some(r => !blank(doseText(r, a.actual.mode === 'sets')) || !blank(r.load))) matches.push({session: s, action: a});
    }));
    matches.sort((a, b) => b.session.date.localeCompare(a.session.date) || b.session.updatedAt.localeCompare(a.session.updatedAt));
    return matches[0] || null;
  }
  function prefillActual(session, action, history) {
    if (prefillRecommendation(session, action)) return true;
    const actual = action.actual;
    if (action.prefillSource || action.prefillDate || session.actions.some(a => a.parentActionId === action.id) || action.status !== 'pending' || actual.sets.length || ['dose', 'count', 'reps', 'seconds', 'load', 'rpe', 'rest', 'notes'].some(k => !blank(actual[k]))) return false;
    const last = latestActual(session, action, history);
    if (!last) return false;
    function values(row) {
      const result = emptyActual();
      result.doseMode = row.doseMode || 'free';
      ['dose', 'count', 'reps', 'seconds', 'side', 'rest', 'load', 'unit', 'basis'].forEach(k => { result[k] = row[k] ?? ''; });
      return result;
    }
    action.actual = values(last.action.actual);
    action.actual.mode = last.action.actual.mode;
    action.actual.sets = last.action.actual.sets.map(values);
    action.prefillDate = last.session.date;
    return true;
  }
  function expandSlot(session, parent) {
    if (session.actions.some(a => a.parentActionId === parent.id)) return;
    (selected(parent)?.actions || []).forEach(part => {
      const child = addSlotAction(session, parent);
      child.actualName = part.name;
      child.partReference = {prescription: part.prescription, notes: part.notes};
      if (part.defaults) child.partReference.defaults = copy(part.defaults);
      prefillRecommendation(session, child);
    });
  }
  function recommendationRow(action, grouped = false) {
    const option = action.parentActionId ? action.partReference : selected(action), row = emptyActual();
    if (!option || action.added || text(action.actualName) && !action.parentActionId && action.actualName !== option.name) return row;
    // Legacy templates: read only a single unambiguous dose clause; never select a range endpoint.
    const clauses = String(option.prescription || '').split(/[；;。\n]/).map(v => v.trim());
    const dose = clauses.find(v => /^(?:推荐目标[：:\s]*)?\d+(?:\.\d+)?(?:\s*[–—\-~～至]\s*\d+(?:\.\d+)?)?\s*(?:[×xX*]|组|分钟|秒|次|米)/.test(v))?.replace(/^推荐目标[：:\s]*/, '').replace(/\s*[@，,]?\s*(?:目标\s*)?RPE[\s\S]*$/i, '').trim();
    if (dose) {
      const exact = /^(\d+)\s*(?:组\s*)?[×xX*]\s*(\d+(?:\.\d+)?)\s*(秒|分钟|次)?\s*(\/侧|每侧)?$/.exec(dose);
      const single = /^(\d+(?:\.\d+)?)\s*(秒|分钟)(\/侧)?$/.exec(dose);
      if (exact) {
        row.count = exact[1]; row.side = exact[4] ? '每侧' : '';
        row.doseMode = /秒|分钟/.test(exact[3]) ? 'time' : 'reps';
        row[row.doseMode === 'time' ? 'seconds' : 'reps'] = String(Number(exact[2]) * (exact[3] === '分钟' ? 60 : 1));
      } else if (single) { row.doseMode = 'time'; row.seconds = String(Number(single[1]) * (single[2] === '分钟' ? 60 : 1)); row.count = '1'; row.side = single[3] ? '每侧' : ''; }
      else { row.doseMode = 'free'; row.dose = dose; }
    }
    const rest = clauses.map(v => /^(?:组间)?休(?:息)?\s*[：:]?\s*(\d+(?:\.\d+)?(?:\s*[–—\-~～至]\s*\d+(?:\.\d+)?)?)\s*(秒|分钟)$/.exec(v)).find(Boolean);
    if (rest) row.rest = rest[1].replace(/\d+(?:\.\d+)?/g, n => String(Number(n) * (rest[2] === '分钟' ? 60 : 1)));
    const load = clauses.map(v => /^(?:负荷|重量)\s*[：:]?\s*(\d+(?:\.\d+)?(?:[–—\-~～至]\d+(?:\.\d+)?)?)\s*(kg|lb)\s*(单侧|总重|器械标称)?$/i.exec(v)).find(Boolean);
    if (load) { row.load = load[1]; row.unit = load[2].toLowerCase(); row.basis = load[3] || ''; }
    else if (clauses.some(v => /^(?:负荷[：:\s]*)?自重$/.test(v))) { row.load = '自重'; row.unit = '自重'; }
    const effort = /RPE\s*[：:]?\s*(\d+(?:\.\d+)?(?:\s*[–—\-~～至]\s*\d+(?:\.\d+)?)?)/i.exec(option.prescription || '');
    if (effort) { try { row.rpe = entryDefaults({rpe: effort[1]}).rpe; } catch (_) { /* Keep invalid source text as reference only. */ } }
    Object.assign(row, option.defaults || {});
    if (row.count && Number(row.count) < 1 || Number(row.count) > 100 || Number(row.reps) > 999 || row.reps && !Number.isInteger(Number(row.reps)) || Number(row.seconds) > 86400) { row.doseMode = 'free'; row.dose = dose || ''; row.count = ''; row.reps = ''; row.seconds = ''; }
    try { restValue(row.rest); } catch (_) { row.rest = ''; }
    if (grouped) row.count = '';
    return row;
  }
  function prefillRecommendation(session, action) {
    if (action.prefillSource || action.prefillDate || action.added || action.status !== 'pending' || session.actions.some(a => a.parentActionId === action.id)) return false;
    const actual = action.actual;
    if (actual.sets.length || ['dose', 'count', 'reps', 'seconds', 'load', 'unit', 'basis', 'side', 'rpe', 'rest', 'notes'].some(k => !blank(actual[k]))) return false;
    const row = recommendationRow(action);
    if (!['dose', 'count', 'reps', 'seconds', 'load', 'rest', 'rpe'].some(k => !blank(row[k]))) return false;
    action.actual = row; action.prefillSource = 'recommendation';
    return true;
  }
  function selected(action) { const option = action.slot.options.find(option => option.id === action.selectedOptionId); return option ? optionDetails(option) : undefined; }
  function actionName(action) { return text(action.actualName) || (action.added || action.parentActionId ? '' : selected(action)?.name) || ''; }
  function stampSession(session, type, now = new Date().toISOString()) {
    if (!Number.isFinite(Date.parse(now))) throw new Error('时间无效');
    if (type === 'start') {
      if (session.startedAt) throw new Error('已经记录开始时间');
      session.startedAt = now;
    } else if (type === 'end') {
      if (!session.startedAt) throw new Error('请先点击开始训练');
      if (session.endedAt) throw new Error('已经记录结束时间');
      const elapsed = Date.parse(now) - Date.parse(session.startedAt);
      if (elapsed <= 0 || elapsed > 86400000) throw new Error('训练起止时间需在 24 小时内，请核对');
      session.endedAt = now;
      session.duration = String(Math.max(0.01, Math.round(elapsed / 600) / 100));
    } else throw new Error('时间操作无效');
  }
  function timeText(value) {
    return value ? new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(new Date(value)) + '（北京时间）' : '';
  }
  function loadText(actual) {
    if (blank(actual.load) || actual.load === UNKNOWN) return shown(actual.load);
    return [actual.load, actual.unit, actual.basis || '重量口径未填'].filter(Boolean).join(' ');
  }
  function sessionLoad(session) {
    const duration = number(session.duration, 0.01, 1440, '总时长');
    const rpe = number(session.sessionRpe, 0, 10, 'Session RPE');
    return duration === null || rpe === null ? null : Math.round(duration * rpe * 100) / 100;
  }
  function validateSession(session) {
    if (!session || session.kind !== 'train2.recorder-draft' || session.schemaVersion !== 1 || !validDate(session.date)) throw new Error('草稿版本或日期无效');
    if (!session.readiness || typeof session.readiness !== 'object' || Array.isArray(session.readiness)) throw new Error('草稿 Readiness 无效');
    if (typeof session.updatedAt !== 'string' || !Number.isFinite(Date.parse(session.updatedAt)) || (session.exportedAt != null && (typeof session.exportedAt !== 'string' || !Number.isFinite(Date.parse(session.exportedAt))))) throw new Error('草稿保存/导出时间无效');
    if (!['待确认', '已完成', '部分完成', '恢复日', '未训练'].includes(session.sessionStatus)) throw new Error('训练状态无效');
    if (!Array.isArray(session.actions) || session.actions.length > 200) throw new Error('草稿动作列表无效');
    if (session.source) validateRecommendation(session.source);
    readinessResult(session.readiness);
    readyFields.forEach(([key, label]) => { const value = number(session.readiness[key], 0, 10, label); if (value !== null && !Number.isInteger(value)) throw new Error(label + '必须是整数量表值'); });
    if (!['', UNKNOWN, true, false].includes(session.readiness.redFlags)) throw new Error('异常症状状态无效');
    sessionLoad(session);
    ['startedAt', 'endedAt'].forEach(key => { if (session[key] != null && (typeof session[key] !== 'string' || !Number.isFinite(Date.parse(session[key])))) throw new Error('训练起止时间无效'); });
    if (session.endedAt && (!session.startedAt || Date.parse(session.endedAt) <= Date.parse(session.startedAt))) throw new Error('结束时间必须晚于开始时间');
    if (session.restTimer != null && (!session.restTimer || !Number.isFinite(session.restTimer.endsAt) || typeof session.restTimer.label !== 'string')) throw new Error('休息计时数据无效');
    [['painDuring', '训练中疼痛'], ['painAfter', '训练后疼痛'], ['painNext', '次日疼痛']].forEach(([key, label]) => number(session[key], 0, 10, label));
    const ids = new Set();
    session.actions.forEach(action => {
      if (!action || !text(action.id) || ids.has(action.id) || !['pending', 'completed', 'partial', 'skipped'].includes(action.status)) throw new Error('动作 id 或状态无效');
      ids.add(action.id);
      const slot = validateRecommendation({kind: 'train2.recommendation', schemaVersion: 1, date: session.date, slots: [{...action.slot, replacesSlotId: null}]}).slots[0];
      if (action.selectedOptionId != null && !slot.options.some(o => o.id === action.selectedOptionId)) throw new Error('动作候选选择无效');
      if (!action.actual || !['summary', 'sets'].includes(action.actual.mode) || !Array.isArray(action.actual.sets) || action.actual.sets.length > 100) throw new Error('动作实际数据格式无效');
      [action.actual, ...action.actual.sets].forEach(row => {
        if (!row || typeof row !== 'object') throw new Error('逐组数据无效');
        ['dose', 'load', 'unit', 'basis', 'rpe', 'notes'].forEach(key => string(row[key], '实际动作字段'));
        if (row.doseMode != null && !['free', 'reps', 'time'].includes(row.doseMode)) throw new Error('剂量模式无效');
        [['count', 1, 100], ['reps', 0, 999], ['seconds', 0, 86400]].forEach(([key, min, max]) => { if (row[key] != null) { string(row[key], key); const n = number(row[key], min, max, key); if (n !== null && ['count', 'reps'].includes(key) && !Number.isInteger(n)) throw new Error('组数和次数必须为整数'); } });
        if (row.rest != null) { string(row.rest, '休息秒数'); restValue(row.rest); }
        if (row.side != null && !['', '每侧'].includes(row.side)) throw new Error('侧别口径无效');
      });
      if (action.parentActionId != null && (typeof action.parentActionId !== 'string' || !session.actions.some(p => p.id === action.parentActionId && !p.parentActionId && p.slot.id === action.slot.id && p.selectedOptionId === action.selectedOptionId))) throw new Error('槽位子动作关联无效');
      if (action.partReference?.defaults != null) entryDefaults(action.partReference.defaults);
      if (action.extraOptionOf != null && (!session.actions.some(a => a.id === action.extraOptionOf && !a.extraOptionOf && !a.parentActionId && a.slot.id === action.slot.id) || action.extraOptionOf === action.id)) throw new Error('同槽加练关联无效');
      string(action.actualName, '实际动作名称', 300);
    });
    ['title', 'cycle', 'painDuringNote', 'painAfterNote', 'painNextNote', 'symptoms', 'completionNote'].forEach(key => string(session[key], key));
    string(session.readiness.painNote, '训练前疼痛备注');
    return session;
  }
  function issues(session) {
    validateSession(session);
    const errors = [], missing = [];
    if (session.sessionStatus === '待确认') errors.push('请确认本次训练状态');
    const actual = session.actions.filter(a => ['completed', 'partial'].includes(a.status));
    if (session.sessionStatus === '未训练' && actual.length) errors.push('未训练状态与已完成动作冲突，请修正');
    if (session.sessionStatus !== '未训练' && !actual.length) errors.push('至少确认一个实际完成或部分完成的动作；休息或取消请选择未训练');
    actual.forEach(a => {
      if (session.actions.some(other => other.parentActionId === a.id)) errors.push(a.slot.module + '：组合与子动作不能重复计入，请只确认子动作');
      if (!actionName(a)) errors.push(a.slot.module + '：请填写或选择实际动作');
      if (!a.selectedOptionId && !text(a.actualName)) errors.push(a.slot.module + '：候选仍待选');
      const rows = a.actual.mode === 'sets' ? a.actual.sets : [a.actual];
      if (!rows.length) errors.push(actionName(a) + '：逐组模式至少添加一组');
      rows.forEach((row, i) => {
        const label = actionName(a) + (a.actual.mode === 'sets' ? ' 第' + (i + 1) + '组' : '');
        if (blank(doseText(row, a.actual.mode === 'sets')) || (row.doseMode && row.doseMode !== 'free' && (blank(row[row.doseMode === 'time' ? 'seconds' : 'reps']) || (a.actual.mode !== 'sets' && blank(row.count))))) missing.push(label + '：实际组次/时长/距离');
        if (text(row.rpe) && row.rpe !== UNKNOWN && !/^(?:10|[0-9])(?:\.\d+)?(?:\s*[–—\-~～至]\s*(?:10|[0-9])(?:\.\d+)?)?$/.test(row.rpe)) errors.push(label + '：RPE 应为 0–10 数字或范围');
        if (text(row.rpe) && row.rpe !== UNKNOWN) {
          const values = row.rpe.split(/\s*[–—\-~～至]\s*/).map(Number);
          if (values.some(v => v > 10) || (values.length === 2 && values[0] > values[1])) errors.push(label + '：RPE 范围无效');
        }
      });
    });
    if (session.sessionStatus !== '未训练') {
      [['duration', '训练总时长'], ['sessionRpe', 'Session RPE'], ['painAfter', '训练后疼痛']].forEach(([key, label]) => { if (blank(session[key])) missing.push(label); });
    }
    readyFields.forEach(([key, label]) => { if (blank(session.readiness[key])) missing.push(label); });
    if (blank(session.readiness.redFlags)) missing.push('训练前异常症状是否存在');
    if (number(session.readiness.pain, 0, 10, '训练前疼痛') > 0 && blank(session.readiness.painNote)) missing.push('训练前疼痛部位/性质');
    [['painDuring', 'painDuringNote', '训练中疼痛部位/触发动作'], ['painAfter', 'painAfterNote', '训练后疼痛部位/性质'], ['painNext', 'painNextNote', '次日疼痛部位/性质']].forEach(([value, note, label]) => { if (number(session[value], 0, 10, label) > 0 && blank(session[note])) missing.push(label); });
    return {errors: [...new Set(errors)], missing: [...new Set(missing)]};
  }
  function exportMarkdown(session) {
    const check = issues(session);
    if (check.errors.length) throw new Error(check.errors.join('\n'));
    const ready = readinessResult(session.readiness), load = sessionLoad(session);
    const lines = ['请使用 record-training-2 记录以下用户填写的实际训练。', '', '# 手机训练记录（待正式入库）', '', '**训练日期**：' + session.date, '**训练名称**：' + shown(session.title), '**周期/槽位**：' + shown(session.cycle), '**训练状态**：' + session.sessionStatus, '**推荐来源日期**：' + (session.source?.date || '无；空白训练'), '', '> “未填（待补充）”表示尚未提供，可按 skill 规则询问；“未记录”表示用户明确记不清，不再追问。推荐剂量、备选及跳过动作不是训练事实；导出不代表已入库。', '', '## 当日 Readiness', '', '| 睡眠 /5 | 疲劳 /5 | 酸痛 /5 | 疼痛 /10 | 意愿 /5 | 得分 /100 | 等级 |', '|---|---|---|---|---|---|---|', '| ' + readyFields.map(([key]) => cell(session.readiness[key])).join(' | ') + ' | ' + (ready.score ?? '未计算') + ' | ' + ready.level + ' |', '', '训练前疼痛备注：' + shown(session.readiness.painNote), '训练前异常症状：' + (session.readiness.redFlags === true ? '有' : session.readiness.redFlags === false ? '用户明确无' : shown(session.readiness.redFlags)), 'Readiness 来源：' + (session.readinessEdited ? '用户在手机填写/调整的训练前最终值；与原推荐不同时以本次明确输入为准' : session.source?.date === session.date && session.source.readiness ? '同日推荐原始值' : '用户填写或尚未提供；未沿用其他日期状态'), '', '## 实际训练内容', '', '| 顺序 | 模块 | 实际动作 | 实际组次/距离/时长 | 实际负荷及口径 | RPE | 实际反馈 |', '|---|---|---|---|---|---|---|'];
    let order = 0;
    session.actions.filter(a => ['completed', 'partial'].includes(a.status)).forEach(a => {
      order++;
      const rows = a.actual.mode === 'sets' ? a.actual.sets : [a.actual];
      rows.forEach((row, i) => lines.push('| ' + [a.actual.mode === 'sets' ? order + '.' + (i + 1) : order, a.slot.module, actionName(a), a.actual.mode === 'sets' ? '第' + (i + 1) + '组：' + shown(doseText(row, true)) : shown(doseText(row)), loadText(row), row.rpe, [a.status === 'partial' ? '部分完成' : '完成', !blank(row.rest) ? '组间休息设定：' + shown(row.rest) + '秒（非实测）' : '', a.prefillSource === 'recommendation' ? '本次推荐预填，经用户核对并确认' : '', a.prefillDate ? '剂量/负荷参考本机 ' + a.prefillDate + '，本次由用户确认完成' : '', row.notes, a.actual.mode === 'sets' ? a.actual.notes : ''].filter(Boolean).join('；')].map(cell).join(' | ') + ' |'));
    });
    if (!order) lines.push('| — | — | 未训练，无实际动作 | — | — | — | — |');
    lines.push('', '## 训练负荷与疼痛', '', '| 项目 | 用户填写 |', '|---|---|', '| 总时长（分钟） | ' + cell(session.duration) + ' |', '| Session RPE /10 | ' + cell(session.sessionRpe) + ' |', '| Session Load | ' + (session.sessionStatus === '未训练' ? '不计负荷' : load === null ? '未计算' : load + ' AU') + ' |', '| 训练中最高疼痛 /10 | ' + cell(session.painDuring) + '；' + cell(session.painDuringNote) + ' |', '| 训练后疼痛 /10 | ' + cell(session.painAfter) + '；' + cell(session.painAfterNote) + ' |', '| 次日疼痛 /10 | ' + (blank(session.painNext) ? '待补充' : cell(session.painNext)) + '；' + cell(session.painNextNote) + ' |', '| 异常症状/其他反馈 | ' + cell(session.symptoms) + ' |', '', '## 实际完成、替换、删减与加练');
    session.actions.forEach(a => {
      if (session.actions.some(other => other.parentActionId === a.id)) { lines.push('- 组合逐项记录：' + a.slot.module + ' / ' + (selected(a)?.name || '') + '；各子动作状态见上表及下列明细'); return; }
      const original = (a.parentActionId ? actionName(a) : selected(a)?.name) || '候选待选';
      if (a.status === 'skipped') lines.push('- 跳过：' + a.slot.module + ' / ' + original + (a.actual.notes ? '；' + a.actual.notes : ''));
      else if (a.status === 'pending') lines.push('- 待记录，未确认完成：' + a.slot.module + ' / ' + original + '；不计入实际训练');
      else {
        if (a.added) lines.push('- 临时加练：' + actionName(a));
        if (a.extraOptionOf) lines.push('- 同槽加练：' + actionName(a) + '；由用户另选并确认实际完成');
        if (!a.added && !a.parentActionId && text(a.actualName) && a.actualName !== original) lines.push('- 替换动作：' + original + ' → ' + a.actualName);
        if (a.status === 'partial') lines.push('- 部分完成：' + actionName(a));
        if (a.slot.replacesSlotId) lines.push('- 推荐关系：' + actionName(a) + ' 原建议替换槽位 ' + a.slot.replacesSlotId + '；' + (session.actions.some(other => ['completed', 'partial'].includes(other.status) && other.slot.id === a.slot.replacesSlotId) ? '用户选择两者同时训练，均按实绩保留' : '实际是否替换以用户记录为准'));
      }
    });
    lines.push('- 本次补充：' + shown(session.completionNote), '', '## 待补充');
    lines.splice(lines.indexOf('## 训练负荷与疼痛') + 2, 0, '开始时间：' + shown(timeText(session.startedAt)), '结束时间：' + shown(timeText(session.endedAt)), '总时长：' + (session.startedAt && session.endedAt ? '根据按钮记录的起止时间带入，可由用户修改（含组间休息）' : '由用户填写'), '');
    lines.push(...(check.missing.length ? check.missing.map(item => '- ' + item) : ['- 无收尾必需项缺口；其他未填信息不推测。']));
    lines.push('', '请按正式训练记录与历史进行总结、弱点和能力评估，不根据推荐补写实际剂量或表现。');
    return lines.join('\n');
  }
  function backup(sessions) {
    sessions.forEach(validateSession);
    return JSON.stringify({kind: 'train2.recorder-backup', schemaVersion: 1, exportedAt: new Date().toISOString(), sessions}, null, 2);
  }
  function readBackup(input) {
    const data = parseJSON(input);
    if (!data || data.kind !== 'train2.recorder-backup' || data.schemaVersion !== 1 || !Array.isArray(data.sessions) || data.sessions.length > 1000) throw new Error('不是受支持的记录器备份');
    const dates = new Set();
    data.sessions.forEach(session => {
      validateSession(session);
      if (dates.has(session.date)) throw new Error('备份存在重复日期：' + session.date);
      dates.add(session.date);
    });
    return copy(data.sessions);
  }
  const api = {UNKNOWN, blank, shown, today, validDate, number, readyFields, readinessValues, readinessResult, parseJSON, optionDetails, entryDefaults, restValue, recommendationRow, prefillRecommendation, validateRecommendation, createSession, addAction, addSlotAction, optionAction, removeAction, expandSlot, latestActual, prefillActual, selected, actionName, emptyActual, doseText, stampSession, timeText, sessionLoad, validateSession, issues, exportMarkdown, backup, readBackup, copy};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrainingRecorder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
