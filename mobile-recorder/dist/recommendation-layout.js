/* Presentation only: keep the recommendation/draft strings unchanged. */
(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function splitOutside(value, delimiters) {
    const parts = []; let depth = 0, start = 0;
    for (let i = 0; i < value.length; i++) {
      if ('（(['.includes(value[i])) depth++;
      else if ('）)]'.includes(value[i])) depth = Math.max(0, depth - 1);
      else if (!depth && delimiters.includes(value[i])) { parts.push(value.slice(start, i).trim()); start = i + 1; }
    }
    parts.push(value.slice(start).trim());
    return parts.filter(Boolean);
  }
  function lines(value, motions = false) {
    return splitOutside(String(value ?? '').replace(/<br\s*\/?\s*>/gi, '\n'), '；;。\n').map(sentence => sentence.replace(/^[:：\s]+/, '')).filter(Boolean).flatMap(sentence => {
      if (!motions) return [sentence];
      const introduction = /^((?:以下|依次)[^：:]*[：:])([\s\S]+)$/.exec(sentence);
      const body = introduction ? introduction[2] : sentence;
      const pieces = splitOutside(body, '+＋、');
      // Commas in 8、5、3 and plus signs in arithmetic are not exercise separators.
      const quantity = text => /^(?:\d[\d.×x–\-\s]*(?:kg|lb|cm|秒|分钟|次|步|圈|组|米|%|轮)?(?:\/侧)?)$/.test(text);
      if (pieces.length < 2 || pieces.some(quantity)) return [sentence];
      // Enumeration commas are split only for explicitly named, bracketed movements.
      if (body.includes('、') && !pieces.every(piece => /[（(][^）)]+[）)]/.test(piece))) return [sentence];
      const result = introduction ? [introduction[1]] : [];
      const colon = pieces[0].indexOf('：');
      if (colon >= 0 && /以下|依次/.test(pieces[0].slice(0, colon))) {
        result.push(pieces[0].slice(0, colon + 1));
        pieces[0] = pieces[0].slice(colon + 1).trim();
      }
      // Keep explicitly shared dosage in its own line; never guess individual doses.
      const last = pieces.length - 1;
      const shared = /^(.*[）)])\s*[，,]?\s*((?:各|每个动作|每项)[\s\S]+)$/.exec(pieces[last]);
      if (shared) pieces[last] = shared[1];
      result.push(...pieces.filter(Boolean));
      if (shared) result.push(shared[2]);
      return result;
    });
  }
  function list(value, className, motions = false, omit = '') {
    const items = lines(value, motions).filter(line => line !== omit);
    return items.length ? '<ul class="' + className + '">' + items.map(item => '<li>' + escape(item) + '</li>').join('') + '</ul>' : '';
  }
  function prescription(value) {
    const shared = line => /^(?:各|每个动作|每项)/.test(line) || /^(?:以下|依次).*[:：]$/.test(line);
    const rows = lines(value).flatMap(sentence => {
      const expanded = lines(sentence, true);
      if (expanded.length > 1 && expanded.some(shared)) {
        const heading = expanded.filter(shared).map(escape).join(' ');
        const movements = expanded.filter(line => !shared(line));
        return ['<li class="prescription-group"><span class="common-dose">' + heading + '</span><ul class="motion-lines">' + movements.map(line => '<li>' + escape(line) + '</li>').join('') + '</ul></li>'];
      }
      return expanded.map(line => '<li>' + escape(line) + '</li>');
    });
    return '<ul class="prescription-lines">' + rows.join('') + '</ul>';
  }
  function reference(option, replacement) {
    return '<section class="plan-reference" aria-label="推荐参考"><div class="plan-section"><h4>推荐安排</h4><p class="plan-caption">参考目标 · 实际完成量在下方记录</p>' + prescription(option.prescription || '未提供剂量') + '</div>' + (option.notes ? '<div class="plan-section plan-cautions"><h4>动作说明与停止条件</h4>' + list(option.notes, 'guidance-lines', false, option.name) + '</div>' : '') + (replacement ? '<p class="replacement-note">此选项替换槽位 ' + escape(replacement) + '，请核对原槽位的实际完成情况。</p>' : '') + '</section>';
  }
  function overview(notes) {
    return '<details class="plan-overview" open><summary>今日安排与注意事项<span aria-hidden="true"></span></summary>' + list(notes, 'guidance-lines') + '</details>';
  }
  const api = {escape, splitOutside, lines, list, prescription, reference, overview};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RecorderLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
