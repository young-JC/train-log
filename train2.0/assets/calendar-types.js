/* 两处月历共用的展示分类；不参与训练统计或 Readiness 判定。 */
const TRAINING_CALENDAR_TYPES = {
 lower: '下肢力量 / 爆发', upper: '上肢 / 核心', speed: '速度 / 敏捷',
 basketball: '篮球', aerobic: '有氧', recovery: '恢复 / 控制',
 assessment: '能力测试', training: '综合训练', readiness: '状态记录', rest: '休息 / 停训'
};

function trainingCalendarType(date, record, isRest) {
 if (isRest) return 'rest';
 if (!record) return '';
 if (record.status === 'readiness') return 'readiness';
 if (record.status === 'assessment') return 'assessment';
 if (record.status !== 'training') return '';
 // 旧记录的简写标签未包含类型，按已保存的月度详情标题补充展示分类。
 const historical = {
  '2026-09-21': 'lower', '2026-09-23': 'upper',
  '2026-09-28': 'lower', '2026-10-08': 'lower'
 };
 if (historical[date]) return historical[date];
 const label = record.label || '';
 if (/恢复|居家|控制/.test(label)) return 'recovery';
 if (/有氧/.test(label)) return 'aerobic';
 if (/\bD1\b|下肢/.test(label)) return 'lower';
 if (/\bD2\b|上肢|核心/.test(label)) return 'upper';
 if (/\bD3\b|速度|减速|敏捷/.test(label)) return 'speed';
 if (/篮球|实战/.test(label)) return 'basketball';
 return 'training';
}

function decorateTrainingCalendarCell(cell, date, record, isRest) {
 const type = trainingCalendarType(date, record, isRest);
 if (!type) return;
 cell.dataset.trainingType = type;
 cell.title = `${date} · ${TRAINING_CALENDAR_TYPES[type]}${record ? ' · ' + record.label : ''}`;
 const badge = document.createElement('span');
 badge.className = 'calendar-type-label';
 badge.textContent = TRAINING_CALENDAR_TYPES[type];
 cell.firstElementChild.insertBefore(badge, cell.querySelector('.monthly-status,.day-status'));
}

function renderTrainingCalendarLegend(container) {
 if (!container) return;
 container.replaceChildren(...Object.entries(TRAINING_CALENDAR_TYPES).map(([type, label]) => {
  const item = document.createElement('span');
  item.dataset.trainingType = type;
  const dot = document.createElement('i');
  dot.setAttribute('aria-hidden', 'true');
  item.append(dot, document.createTextNode(label));
  return item;
 }));
}
