"""Isolated phone-width/browser/offline checks using fictional records only.

Uses installed Chrome/Edge and websocket-client, as the existing review verifier does.
The HTTP server and temporary browser profile are owned and cleaned up by this check.
"""
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.request

import websocket

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    inbox = None
    legacy_mode = False
    future_mode = False

    def do_GET(self):
        route = self.path.split('?')[0]
        payload = None
        content_type = 'text/html; charset=utf-8'
        if type(self).legacy_mode:
            if route in ['/', '/index.html']:
                payload = '<!doctype html><meta charset="utf-8"><h1 id="legacyApp">旧版缓存测试</h1><script src="core.js"></script><script src="storage.js"></script><script>navigator.serviceWorker.register("sw.js").then(()=>navigator.serviceWorker.ready).then(()=>document.body.dataset.ready="yes");</script>'
            elif route == '/sw.js':
                content_type = 'text/javascript; charset=utf-8'
                payload = '''const CACHE='suilian-shell-upgrade-legacy';const FILES=['index.html','core.js','storage.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url),p=u.pathname.slice(1)||'index.html';if(FILES.includes(p))e.respondWith(caches.open(CACHE).then(c=>c.match(p)));});'''
        elif type(self).future_mode:
            if route in ['/', '/index.html']:
                payload = (ROOT / 'mobile-recorder/dist/index.html').read_text(encoding='utf-8').replace('name="recorder-build" content="dev"', 'name="recorder-build" content="next-test"')
            elif route == '/sw.js':
                content_type = 'text/javascript; charset=utf-8'
                payload = (ROOT / 'mobile-recorder/dist/sw.js').read_text(encoding='utf-8').replace('suilian-shell-v4', 'suilian-shell-v4-test')
            elif route == '/version.json':
                content_type = 'application/json; charset=utf-8'
                payload = '{"version":"next-test"}'
        if payload is not None:
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(payload.encode('utf-8'))
            return
        if self.path.startswith('/api/recommendations/latest?'):
            body = json.dumps({'inbox': type(self).inbox}, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *_args):
        pass


def verify():
    browser = next((p for p in [Path('C:/Program Files/Google/Chrome/Application/chrome.exe'),
                               Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')] if p.exists()), None)
    if browser is None:
        raise RuntimeError('Chrome/Edge not available')
    profile = Path(tempfile.mkdtemp(prefix='train-recorder-browser-')).resolve()
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'mobile-recorder/dist')))
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = 'http://127.0.0.1:' + str(server.server_port) + '/'
    process = connection = None
    seq = 0
    errors = []
    screenshots = []
    extra_servers = []

    def call(method, params=None):
        nonlocal seq
        seq += 1
        connection.send(json.dumps({'id': seq, 'method': method, 'params': params or {}}))
        while True:
            message = json.loads(connection.recv())
            if message.get('method') == 'Runtime.exceptionThrown':
                errors.append(message['params'])
            if message.get('id') == seq:
                assert 'error' not in message, message
                return message.get('result', {})

    def evaluate(code):
        result = call('Runtime.evaluate', {'expression': code, 'returnByValue': True, 'awaitPromise': True})
        assert 'exceptionDetails' not in result, result
        return result.get('result', {}).get('value')

    def until(code):
        for _ in range(120):
            if evaluate(code):
                return
            time.sleep(.05)
        diagnostic = evaluate('(async()=>{const r=await navigator.serviceWorker?.getRegistration();const cachesInfo=await Promise.all((await caches.keys()).map(async key=>{const response=await(await caches.open(key)).match(new URL("index.html",location.href).href);return {key,build:response?(await response.text()).match(/recorder-build[^>]+/)?.[0]:null}}));return {url:location.href,build:document.querySelector("meta[name=recorder-build]")?.content,status:document.getElementById("status")?.innerText,update:document.getElementById("updateMessage")?.innerText,active:r?.active?.state,waiting:r?.waiting?.state,installing:r?.installing?.state,caches:cachesInfo,errors:document.body.innerText.slice(0,200)}})()')
        raise AssertionError('Timed out: ' + code + ' ' + json.dumps(diagnostic, ensure_ascii=False))

    def click(selector):
        return evaluate('document.querySelector(' + json.dumps(selector) + ').click()')

    def query(selector):
        return 'document.querySelector(' + json.dumps(selector) + ')'

    def fill(path, value):
        evaluate("(()=>{const e=document.querySelector('[data-field=\"" + path + "\"]');e.value=" + json.dumps(value) + ";e.dispatchEvent(new Event('input',{bubbles:true}));if(e.tagName==='SELECT')e.dispatchEvent(new Event('change',{bubbles:true}));})()")

    def screenshot(label):
        import os
        descriptor, destination = tempfile.mkstemp(prefix='train-recorder-' + label + '-', suffix='.png')
        os.close(descriptor)
        data = call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
        Path(destination).write_bytes(base64.b64decode(data['data']))
        screenshots.append(destination)

    fixture = {
        'kind': 'train2.recommendation', 'schemaVersion': 1, 'date': '2026-10-27',
        'title': '虚构浏览器测试 · 不入库', 'notes': '<img src=x onerror=alert(1)> 只能显示为文本',
        'readiness': {'sleep': 4, 'fatigue': 2, 'soreness': 2, 'pain': 0, 'motivation': 4, 'redFlags': False},
        'slots': [
            {'id': 'warm', 'module': '准备', 'selectedOptionId': 'A', 'options': [{'id': 'A', 'name': '：示例准备组合；保持轻松；动作不稳或疼痛即停', 'prescription': '：步行（Easy Walk）2分钟；踝背屈（Ankle）1×8/侧；前后摆腿（Front Swing）、侧向摆腿（Side Swing）各8次/侧。预演8、5、3次', 'notes': ''}]},
            {'id': 'main', 'module': '三选一', 'selectedOptionId': None, 'options': [
                {'id': 'A', 'name': '示例动作甲', 'prescription': '3×8'}, {'id': 'B', 'name': '示例动作乙', 'prescription': '2×8/侧'}, {'id': 'C', 'name': '示例动作丙', 'prescription': '2×10'}]},
            {'id': 'finish', 'module': '整理', 'selectedOptionId': 'A', 'options': [{'id': 'A', 'name': '示例整理', 'prescription': '2分钟'}]}
        ]
    }
    try:
        process = subprocess.Popen([str(browser), '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
                                    '--remote-debugging-port=0', '--user-data-dir=' + str(profile), 'about:blank'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
        port_file = profile / 'DevToolsActivePort'
        for _ in range(100):
            if port_file.exists():
                break
            time.sleep(.1)
        port = port_file.read_text().splitlines()[0]
        with urllib.request.urlopen('http://127.0.0.1:' + port + '/json/list', timeout=10) as response:
            pages = json.load(response)
        connection = websocket.create_connection(next(p['webSocketDebuggerUrl'] for p in pages if p['type'] == 'page'), suppress_origin=True, timeout=20)
        call('Runtime.enable'); call('Page.enable'); call('Network.enable')
        call('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
        call('Page.addScriptToEvaluateOnNewDocument', {'source': 'window.confirm=()=>true;'})
        call('Page.navigate', {'url': url})
        until("document.readyState==='complete'&&typeof TrainingRecorder==='object'")
        until("document.getElementById('offlineStatus').textContent.includes('离线已就绪')")
        screenshot('welcome')
        assert evaluate('document.documentElement.scrollWidth<=390')
        click('[data-command="import"]')
        evaluate('document.getElementById("importText").value=' + json.dumps(json.dumps(fixture, ensure_ascii=False)))
        click('#previewImport')
        assert evaluate('!document.getElementById("confirmImport").disabled')
        click('#confirmImport')
        until('document.querySelectorAll(".action-card").length===3')
        assert evaluate('document.querySelectorAll("#recommendationNotes img").length===0')
        assert evaluate('document.querySelector(".action-card").querySelector("h3")===null')
        assert evaluate('document.querySelector(".option-name").innerText==="示例准备组合"')
        assert evaluate('!document.querySelector(".option-dose-preview").innerText.startsWith("：")')
        assert evaluate('document.querySelector(".plan-reference").querySelectorAll(".prescription-lines>li").length===4')
        assert evaluate('document.querySelectorAll(".motion-lines>li").length===2&&document.querySelector(".common-dose").innerText==="各8次/侧"')
        assert evaluate('document.querySelectorAll(".guidance-lines>li").length>=3')
        assert evaluate('getComputedStyle(document.querySelector(".prescription-lines>li+li")).borderTopStyle==="solid"')
        assert evaluate('parseFloat(getComputedStyle(document.querySelector(".prescription-lines>li+li")).paddingTop)<=6')
        assert evaluate('document.querySelector(".plan-reference").innerText.includes("预演8、5、3次")')
        evaluate('document.getElementById("recommendationNotes").querySelector("details").open=false;document.querySelector(".plan-reference").scrollIntoView({block:"center"})')
        time.sleep(.25)
        screenshot('readable-plan')
        assert evaluate('document.querySelectorAll(' + json.dumps('[data-index="1"].option-button.chosen') + ').length===0')
        click('[data-option="B"][data-index="1"]')
        click('[data-status="completed"][data-index="1"]')
        fill('actions.1.actual.dose', '2×5/侧')
        fill('actions.1.actual.load', '22')
        fill('actions.1.actual.unit', 'kg')
        fill('actions.1.actual.basis', '单侧')
        click('[data-mode="1"]')
        fill('actions.1.actual.sets.0.dose', '5次/侧')
        fill('actions.1.actual.sets.0.load', '22')
        fill('actions.1.actual.sets.0.unit', 'kg')
        fill('actions.1.actual.sets.0.basis', '单侧')
        fill('actions.1.actual.sets.0.rpe', '6–7')
        click('[data-add-set="1"]')
        fill('actions.1.actual.sets.1.dose', '4次/侧')
        fill('actions.1.actual.sets.1.load', '50')
        fill('actions.1.actual.sets.1.unit', 'lb')
        fill('actions.1.actual.sets.1.basis', '总重')
        fill('actions.1.actual.sets.1.rpe', '8')
        click('[data-status="skipped"][data-index="0"]')
        click('[data-status="skipped"][data-index="2"]')
        click('[data-tab="finish"]')
        fill('sessionStatus', '部分完成'); fill('duration', '45'); fill('sessionRpe', '0'); fill('painAfter', '0')
        until('document.getElementById("saveStatus").textContent.includes("已存本机")')
        click('#mainExport')
        assert evaluate('document.getElementById("exportDialog").open')
        exported = evaluate('document.getElementById("exportText").value')
        assert '22 kg 单侧' in exported and '50 lb 总重' in exported and '0 AU' in exported, exported
        actual = exported.split('## 实际训练内容')[1].split('## 训练负荷与疼痛')[0]
        assert '示例动作乙' in actual and '示例动作甲' not in actual and '示例整理' not in actual
        evaluate('document.getElementById("exportDialog").close()')
        # Reimport opens the existing filled draft. Invalid imports leave the draft untouched.
        click('[data-command="import"]'); click('#previewImport'); click('#confirmImport')
        until('!document.getElementById("importDialog").open')
        assert evaluate(query('[data-field="actions.1.actual.sets.1.load"]') + '.value==="50"')
        click('[data-command="import"]')
        evaluate('document.getElementById("importText").value="{bad JSON}"')
        click('#previewImport')
        assert evaluate('!document.getElementById("importError").hidden&&document.getElementById("confirmImport").disabled')
        evaluate('document.getElementById("importDialog").close()')
        # Inject a storage failure, ensure feedback and no successful-save claim; then recover.
        evaluate('window.originalPut=RecorderStorage.put;RecorderStorage.put=()=>Promise.reject(new Error("simulated quota failure"));')
        fill('actions.1.actual.sets.0.notes', '模拟保存失败，数据还在窗口')
        until('!document.getElementById("storageError").hidden')
        assert evaluate('document.getElementById("saveStatus").textContent==="未能保存"')
        evaluate('RecorderStorage.put=window.originalPut')
        fill('actions.1.actual.sets.0.notes', '左6右7，已恢复保存')
        until('document.getElementById("saveStatus").textContent.includes("已存本机")')
        assert evaluate('document.getElementById("storageError").hidden')
        # Offline cold reload: cached shell + IndexedDB, not a page kept alive in memory.
        call('Network.emulateNetworkConditions', {'offline': True, 'latency': 0, 'downloadThroughput': 0, 'uploadThroughput': 0})
        call('Page.reload')
        until('document.readyState==="complete"&&!document.getElementById("workspace").hidden')
        assert evaluate(query('[data-field="actions.1.actual.sets.1.load"]') + '.value==="50"')
        assert evaluate('document.getElementById("connectionLabel").textContent.includes("离线")')
        assert evaluate('document.documentElement.scrollWidth<=390')
        screenshot('session')
        # Backup round-trip uses the actual IndexedDB snapshot, without writing formal files.
        assert evaluate('(async()=>{const all=await RecorderStorage.all();const restored=TrainingRecorder.readBackup(TrainingRecorder.backup(all));return restored.length===1&&restored[0].actions[1].actual.sets[1].load==="50"})()')
        call('Network.emulateNetworkConditions', {'offline': False, 'latency': 0, 'downloadThroughput': -1, 'uploadThroughput': -1})
        # A new remote template never overwrites a filled same-day draft.
        incoming = json.loads(json.dumps(fixture))
        incoming['title'] = '虚构同步新版，不覆盖实绩'
        QuietHandler.inbox = {'recommendation': incoming, 'revision': 'local-test', 'publishedAt': '2026-10-27T10:00:00Z'}
        click('#syncRecommendation')
        until('!document.getElementById("syncRecommendation").disabled')
        assert evaluate(query('[data-field="actions.1.actual.sets.1.load"]') + '.value==="50"')
        assert evaluate('document.getElementById("cloudStatus").textContent.includes("已有草稿")')
        # A fresh device receives today's recommendation into blank action cards.
        incoming['date'] = evaluate('TrainingRecorder.today()')
        call('Page.navigate', {'url': 'about:blank'})
        call('Storage.clearDataForOrigin', {'origin': url.rstrip('/'), 'storageTypes': 'indexeddb'})
        call('Page.navigate', {'url': url})
        until('document.readyState==="complete"&&!document.getElementById("workspace").hidden')
        assert evaluate('document.getElementById("cloudStatus").textContent.includes("已生成待填写卡片")')
        assert evaluate('(async()=>{const all=await RecorderStorage.all();return all.length===1&&all[0].actions.every(a=>a.status==="pending"&&a.actual.dose==="")})()')
        # file:// still uses classic scripts, basic forms and export; service worker stays disabled.
        call('Page.navigate', {'url': (ROOT / 'mobile-recorder/dist/index.html').as_uri()})
        until('document.readyState==="complete"&&typeof TrainingRecorder==="object"')
        assert evaluate('typeof TrainingRecorder.exportMarkdown==="function"&&document.documentElement.scrollWidth<=390')
        # Reproduce a cache-first legacy app with another old client left open.
        call('Page.navigate', {'url': 'about:blank'})
        legacy_server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'mobile-recorder/dist')))
        legacy_server.daemon_threads = True
        extra_servers.append(legacy_server)
        threading.Thread(target=legacy_server.serve_forever, daemon=True).start()
        url = 'http://127.0.0.1:' + str(legacy_server.server_port) + '/'
        QuietHandler.inbox = None
        QuietHandler.legacy_mode = True
        call('Page.navigate', {'url': url})
        until('document.body.dataset.ready==="yes"&&!!navigator.serviceWorker.controller')
        evaluate('(async()=>{const s=TrainingRecorder.createSession(null,"2026-10-27");s.sessionStatus="部分完成";const a=TrainingRecorder.addAction(s);a.actualName="虚构升级保留动作";a.status="completed";a.actual.dose="3×5";a.actual.load="31";a.actual.unit="kg";await RecorderStorage.put(s);})()')
        extra_page = call('Target.createTarget', {'url': url})['targetId']
        QuietHandler.legacy_mode = False
        call('Page.reload')
        until('!!document.getElementById("legacyApp")')
        # Plain reload still shows the old shell; the uncached update entry must recover it.
        call('Page.navigate', {'url': url + 'update.html'})
        until('!!document.getElementById("homeButton")&&!document.getElementById("workspace").hidden')
        assert evaluate(query('[data-field="actions.0.actual.load"]') + '.value==="31"')
        before_home = evaluate('location.href')
        click('#homeButton')
        until('!document.getElementById("welcome").hidden')
        assert evaluate('location.href') == before_home
        assert evaluate('document.getElementById("homeButton").tagName==="BUTTON"&&!document.getElementById("resumeSession").hidden')
        click('#resumeSession')
        assert evaluate(query('[data-field="actions.0.actual.load"]') + '.value==="31"')
        # Future upgrades show an actionable button and flush the last edit before reload.
        QuietHandler.future_mode = True
        evaluate('window.dispatchEvent(new Event("online"));navigator.serviceWorker.getRegistration().then(r=>r.update())')
        until('!document.getElementById("updateBanner").hidden')
        fill('actions.0.actual.load', '44')
        click('#applyUpdate')
        until('document.querySelector("meta[name=recorder-build]")?.content==="next-test"&&!document.getElementById("workspace").hidden')
        assert evaluate(query('[data-field="actions.0.actual.load"]') + '.value==="44"')
        assert evaluate('document.getElementById("appVersion").textContent.includes("next-test")')
        call('Target.closeTarget', {'targetId': extra_page})
        # The update entry also works on a device with no previous registration.
        fresh_server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'mobile-recorder/dist')))
        fresh_server.daemon_threads = True
        extra_servers.append(fresh_server)
        threading.Thread(target=fresh_server.serve_forever, daemon=True).start()
        call('Page.navigate', {'url': 'http://127.0.0.1:' + str(fresh_server.server_port) + '/update.html'})
        until('document.readyState==="complete"&&!!document.getElementById("homeButton")')
        assert not errors, errors
        print(json.dumps({'browser': browser.name, 'mobileWidth': 390, 'importSelectionAndSets': 'OK', 'zeroAndUnits': 'OK',
                          'duplicateAndInvalidImport': 'OK', 'storageFailureRecovery': 'OK', 'offlineColdReload': 'OK',
                          'backupRoundTrip': 'OK', 'cloudSyncWithoutOverwrite': 'OK', 'fileProtocol': 'OK',
                          'legacyCacheRecovery': 'OK', 'logoWithoutNavigation': 'OK', 'saveAndApplyUpdate': 'OK', 'firstInstallUpdateEntry': 'OK',
                          'jsErrors': len(errors), 'screenshots': screenshots}, ensure_ascii=False))
    finally:
        if connection:
            try:
                call('Browser.close')
            except (OSError, websocket.WebSocketException):
                pass
            connection.close()
        if process:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait(timeout=5)
        server.shutdown(); server.server_close()
        for extra_server in extra_servers:
            extra_server.shutdown(); extra_server.server_close()
        if profile.parent == Path(tempfile.gettempdir()).resolve() and profile.name.startswith('train-recorder-browser-'):
            shutil.rmtree(profile, ignore_errors=True)


if __name__ == '__main__':
    verify()
