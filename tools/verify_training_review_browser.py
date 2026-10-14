"""Chrome/Edge file:// 交互检查。验证工具使用已安装的 websocket-client，非页面依赖。

样例报告只注入临时浏览器内存，不写正式记录/报告。临时配置在检查后清理。
"""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import urllib.request

import websocket
import training_review as review


def verify():
    browsers = [Path('C:/Program Files/Google/Chrome/Application/chrome.exe'),
                Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')]
    browser = next((p for p in browsers if p.exists()), None)
    if browser is None:
        raise RuntimeError('未找到本机 Chrome/Edge')
    profile = Path(tempfile.mkdtemp(prefix='train-review-browser-')).resolve()
    assert profile.parent == Path(tempfile.gettempdir()).resolve()
    process = None
    connection = None
    errors = []
    seq = 0

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
        reply = call('Runtime.evaluate', {'expression': code, 'returnByValue': True, 'awaitPromise': True})
        assert 'exceptionDetails' not in reply, reply
        return reply['result'].get('value')

    try:
        process = subprocess.Popen([str(browser), '--headless=new', '--disable-gpu', '--no-sandbox',
                                    '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + str(profile), 'about:blank'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=subprocess.CREATE_NO_WINDOW)
        port_file = profile / 'DevToolsActivePort'
        for _ in range(100):
            if port_file.exists():
                break
            time.sleep(.1)
        port = port_file.read_text().splitlines()[0]
        with urllib.request.urlopen('http://127.0.0.1:' + port + '/json/list', timeout=10) as response:
            pages = json.load(response)
        connection = websocket.create_connection(next(p['webSocketDebuggerUrl'] for p in pages if p['type'] == 'page'),
                                                 suppress_origin=True, timeout=15)
        call('Runtime.enable')
        call('Page.enable')
        call('Page.addScriptToEvaluateOnNewDocument', {'source': "localStorage.setItem('athlete_review',JSON.stringify({gain:'LEGACY_REVIEW_SHOULD_NOT_APPEAR'}));localStorage.setItem('athlete_sessions',JSON.stringify([{date:'2026-10-13',load:999999}]));"})
        call('Page.navigate', {'url': (review.ROOT / 'train2.0/dashboard.html').as_uri()})
        for _ in range(80):
            if evaluate("document.readyState==='complete' && document.getElementById('reviewDue').innerText.includes('正式周期')"):
                break
            time.sleep(.1)
        initial = evaluate("({legacy:document.body.innerText.includes('LEGACY_REVIEW_SHOULD_NOT_APPEAR'),days:Object.values(FORMAL_RECORDS).filter(r=>r.status==='training').length,load:Object.values(FORMAL_RECORDS).reduce((s,r)=>s+(r.sessionLoad||0),0),actions:document.querySelectorAll('.lib-row').length,expectedActions:ACTIONS.length,assessment:assessmentList.children.length})")
        assert not initial['legacy'] and initial['actions'] == initial['expectedActions'] and initial['assessment'] > 0, initial
        evaluate('TRAINING_REVIEWS.reports.length=0;TrainingReviewPanel.render()')
        assert evaluate("reviewReport.innerText.includes('还没有复盘报告')&&reviewSelect.disabled")
        assert evaluate("(()=>{const d=[...recDateSelect.options].map(o=>o.value);recDateSelect.value=d.at(-1);recDateSelect.dispatchEvent(new Event('change'));return todayPill.innerText.includes(d.at(-1))&&!!todayReason.innerText;})()")
        assert evaluate("(()=>{fSearch.value='CMJ';fSearch.dispatchEvent(new Event('input'));const rows=document.querySelectorAll('.lib-row');if(!rows.length||rows.length>=ACTIONS.length)return false;rows[0].click();const open=!actionModal.hidden;document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));return open&&actionModal.hidden;})()")
        assert evaluate("[...document.querySelectorAll('.monthly-day.training a')].every(a=>/records\\/\\d{4}-\\d{2}.html#detail-\\d{4}-\\d{2}-\\d{2}$/.test(a.href))")
        weekly = review.draft_report(review.ROOT, 'weekly', '2026-09-28', '2026-10-04', '2026-10-05T10:00:00+08:00')
        weekly.update(summary='浏览器隔离样例：W2 已知负荷不完整。', findings=[{'text': '核对记录', 'dates': ['2026-09-28']}], gaps=['10-04 负荷缺失'])
        progress = review.draft_report(review.ROOT, 'stage', '2026-09-21', '2026-10-18', '2026-10-13T10:00:00+08:00')
        progress['summary'] = '浏览器隔离样例：阶段进展。'
        evaluate('TRAINING_REVIEWS.reports.push(...' + json.dumps([weekly, progress], ensure_ascii=False) + ');TrainingReviewPanel.render()')
        assert evaluate("reviewSelect.options.length===2&&reviewReport.innerText.includes('进展报告')&&reviewSelect.value.includes('-stage-')")
        assert evaluate("(()=>{reviewSelect.value=" + json.dumps(weekly['id']) + ";reviewSelect.dispatchEvent(new Event('change'));return reviewReport.innerText.includes('1712')&&reviewReport.innerText.includes('已知合计（不完整）');})()")
        assert evaluate("reviewReport.querySelector('a[href=\"records/2026-09.html#detail-2026-09-28\"]')!==null")
        # 真实链接进入月度详情后再回到报告，不依赖报告显示层伪造锚点。
        assert (review.ROOT / 'train2.0/records/2026-09.html').read_text(encoding='utf-8').count('id="detail-2026-09-28"') == 1
        assert evaluate("(()=>{TRAINING_REVIEWS.currentSources['2026-09-28']='changed';TrainingReviewPanel.render();return reviewReport.innerText.includes('待刷新')&&reviewSelect.value.includes('-weekly-');})()")
        assert evaluate("(()=>{mode.value='4';mode.dispatchEvent(new Event('change'));return reviewDue.innerText.includes('3 日版')&&reviewSelect.value.includes('-weekly-');})()")
        call('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
        assert evaluate("document.getElementById('review').getBoundingClientRect().width<=390&&document.documentElement.scrollWidth<=390")
        final = evaluate("({days:Object.values(FORMAL_RECORDS).filter(r=>r.status==='training').length,load:Object.values(FORMAL_RECORDS).reduce((s,r)=>s+(r.sessionLoad||0),0)})")
        assert final['days'] == initial['days'] and final['load'] == initial['load'], final
        assert not errors, errors
        print(json.dumps({'browser': browser.name, 'fileProtocol': True, 'historyAndStates': 'OK',
                          'existingInteractions': 'OK', 'mobileWidth': 390, 'formalStatsUnchanged': final,
                          'jsErrors': len(errors)}, ensure_ascii=False))
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
                process.kill()
                process.wait(timeout=5)
        # 删除前校验解析后的目标确为本次分配的系统临时目录。
        if profile.parent == Path(tempfile.gettempdir()).resolve() and profile.name.startswith('train-review-browser-'):
            shutil.rmtree(profile, ignore_errors=True)


if __name__ == '__main__':
    verify()
