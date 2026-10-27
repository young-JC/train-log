/* Receive credentials through hidden stdin only. Never store or print them. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const C = require('../mobile-recorder/dist/core.js');
const PROJECT = 'appgprj_6ae01a8504488191b227e468a441d8a7';
function systemTransport(url, init) {
  if (process.platform !== 'win32') return fetch(url, init);
  return new Promise((resolve, reject) => {
    const child = spawn('python', [path.join(__dirname, 'recorder_http.py')], {stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: {...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8'}});
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('站点连接超时，请检查系统网络后重试')); }, 35000);
    child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.resume();
    child.on('error', () => { clearTimeout(timer); reject(new Error('站点连接失败：无法启动系统网络传输')); });
    child.on('close', code => {
      clearTimeout(timer);
      try {
        const response = JSON.parse(output);
        if (code !== 0 || !response.status) { reject(new Error('站点连接失败（' + (/^[A-Za-z]+$/.test(response.error || '') ? response.error : 'TransportError') + '），请检查系统网络后重试')); return; }
        resolve({ok: response.status >= 200 && response.status < 300, status: response.status, json: async () => JSON.parse(response.text)});
      } catch (_) { reject(new Error('站点连接失败，请检查系统网络或代理后重试')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({url: String(url), method: init.method || 'GET', headers: init.headers, body: init.body}));
  });
}
function siteAddress(site) {
  if (site?.id !== PROJECT || site.current_user_role !== 'owner') throw new Error('需要此随练站点所有者的 get_site 返回值');
  const policy = site.access_policy;
  if (policy?.access_mode !== 'custom' || policy.allowed_groups?.length || policy.allowed_workspace_group_ids?.length || policy.allowed_tenant_group_ids?.length || policy.allowed_users?.length !== 1 || policy.allowed_users[0].role !== 'owner' || site.external_visitor_count > 0) throw new Error('仅允许向本人私有站点推送；请先核对访问权限');
  const url = new URL(site.current_live_url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.chatgpt.site') || url.username || url.password) throw new Error('站点地址无效');
  if (!site.siwc_bypass_bearer_token) throw new Error('get_site 未返回服务访问凭据；不能自动推送，请保留 JSON 文件作为备用');
  return url;
}
async function publish(input, transport = fetch) {
  const site = input.site, url = siteAddress(site);
  const recommendation = C.validateRecommendation(input.recommendation);
  const response = await transport(new URL('/api/recommendations', url), {method: 'POST', redirect: 'error', headers: {'content-type': 'application/json', 'OAI-Sites-Authorization': 'Bearer ' + site.siwc_bypass_bearer_token}, body: JSON.stringify(recommendation), signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('推送未完成（HTTP ' + response.status + '），请稍后重试');
  const result = await response.json();
  if (result.ok !== true || result.date !== recommendation.date || !/^[a-f0-9]{64}$/.test(result.revision || '')) throw new Error('站点未确认接收同一份推荐');
  return {ok: true, date: result.date, revision: result.revision, publishedAt: result.publishedAt, unchanged: result.unchanged, url: url.origin};
}
async function readInbox(site, transport = fetch) {
  const url = siteAddress(site);
  const response = await transport(new URL('/api/recommendations/latest?asOf=' + C.today(), url), {redirect: 'error', headers: {'Accept': 'application/json', 'OAI-Sites-Authorization': 'Bearer ' + site.siwc_bypass_bearer_token}, signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('站点收件箱检查失败（HTTP ' + response.status + '）');
  const result = await response.json();
  if (!result.inbox) return {ok: true, empty: true};
  const recommendation = C.validateRecommendation(result.inbox.recommendation);
  return {ok: true, date: recommendation.date, slots: recommendation.slots.length, candidates: recommendation.slots.reduce((n, s) => n + s.options.length, 0), revision: result.inbox.revision};
}
async function toolStatus(site, transport = fetch) {
  const origin = siteAddress(site);
  const options = {redirect: 'error', headers: {'OAI-Sites-Authorization': 'Bearer ' + site.siwc_bypass_bearer_token}, signal: AbortSignal.timeout(30000)};
  const version = await transport(new URL('/version.json', origin), options);
  if (!version.ok) throw new Error('站点版本检查失败（HTTP ' + version.status + '）');
  const data = await version.json();
  if (!/^[a-f0-9]{12}$/.test(data.version || '')) throw new Error('站点版本响应无效');
  const update = await transport(new URL('/update.html', origin), options);
  if (!update.ok) throw new Error('站点更新入口检查失败（HTTP ' + update.status + '）');
  return {ok: true, version: data.version, updateEntryStatus: update.status};
}
if (require.main === module) {
  const filename = process.argv[2];
  if (!filename) { console.error('Usage: node tools/push_training_recommendation.js <recommendation.json>'); process.exitCode = 1; }
  else {
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    let data = '', reading = false;
    console.log('Ready for get_site JSON on stdin (input is hidden).');
    process.stdin.on('data', chunk => {
      data += chunk;
      if (reading || !/[\r\n]/.test(data)) return;
      reading = true;
      process.stdin.pause();
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      Promise.resolve().then(() => filename === '--check' ? readInbox(JSON.parse(data.trim()), systemTransport) : filename === '--tool-status' ? toolStatus(JSON.parse(data.trim()), systemTransport) : publish({site: JSON.parse(data.trim()), recommendation: fs.readFileSync(filename, 'utf8')}, systemTransport)).then(result => { console.log(JSON.stringify(result)); }).catch(error => { console.error(error.message.startsWith('推送') || error.message.startsWith('站点') || error.message.startsWith('get_site') || error.message.startsWith('仅允许') || error.message.startsWith('需要') ? error.message : '推荐推送失败，请核对文件格式和网络后重试；凭据未保存。'); process.exitCode = 1; });
    });
  }
}
module.exports = {publish, readInbox, toolStatus};
