"""本机 file:// 推荐剂量回归；只读正式数据，浏览器使用临时配置。"""
import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request

import websocket


ROOT = Path(__file__).resolve().parents[1]


def verify(checker=None) -> None:
    browsers = [Path('C:/Program Files/Google/Chrome/Application/chrome.exe'),
                Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')]
    browser = next((path for path in browsers if path.exists()), None)
    if browser is None:
        raise RuntimeError('未找到本机 Chrome/Edge')
    with tempfile.TemporaryDirectory(prefix='train-recommendation-view-') as folder:
        process = subprocess.Popen(
            [str(browser), '--headless=new', '--disable-gpu', '--no-first-run',
             '--remote-debugging-port=0', '--user-data-dir=' + folder, 'about:blank'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW)
        connection = None
        try:
            port_file = Path(folder) / 'DevToolsActivePort'
            for _ in range(100):
                if port_file.exists():
                    break
                time.sleep(.1)
            port = port_file.read_text().splitlines()[0]
            with urllib.request.urlopen('http://127.0.0.1:' + port + '/json/list', timeout=10) as response:
                pages = json.load(response)
            connection = websocket.create_connection(
                next(page['webSocketDebuggerUrl'] for page in pages if page['type'] == 'page'),
                suppress_origin=True, timeout=15)
            (checker or check_page)(connection)
        finally:
            if connection:
                try:
                    connection.send(json.dumps({'id': 0, 'method': 'Browser.close'}))
                except (OSError, websocket.WebSocketException):
                    process.terminate()
                finally:
                    connection.close()
            else:
                process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


def check_page(connection: websocket.WebSocket) -> None:
    sequence = 0
    errors = []

    def call(method: str, params: dict | None = None) -> dict:
        nonlocal sequence
        sequence += 1
        connection.send(json.dumps({'id': sequence, 'method': method, 'params': params or {}}))
        while True:
            message = json.loads(connection.recv())
            if message.get('method') == 'Runtime.exceptionThrown':
                errors.append(message['params'])
            if message.get('id') == sequence:
                assert 'error' not in message, message
                return message.get('result', {})

    def evaluate(code: str) -> object:
        result = call('Runtime.evaluate', {'expression': code, 'returnByValue': True})
        assert 'exceptionDetails' not in result, result
        return result['result'].get('value')

    call('Runtime.enable')
    call('Page.enable')
    call('Page.addScriptToEvaluateOnNewDocument', {'source': """
        localStorage.setItem('athlete_sessions',JSON.stringify([{date:'2026-10-27',load:999999}]));
    """})
    call('Page.navigate', {'url': (ROOT / 'train2.0/dashboard.html').as_uri()})
    for _ in range(100):
        if evaluate("document.readyState==='complete'&&!!document.querySelector('#sessionSlots .rec-candidate')"):
            break
        time.sleep(.1)
    baseline = evaluate("""({
        source:JSON.stringify(RECOMMEND_2026_10),
        records:JSON.stringify(FORMAL_RECORDS),
        days:Object.values(FORMAL_RECORDS).filter(record=>record.status==='training').length,
        load:Object.values(FORMAL_RECORDS).reduce((sum,record)=>sum+(record.sessionLoad||0),0)
    })""")
    assert evaluate("recDateSelect.value===latestRecKey()")
    assert evaluate("""(()=>{
        const month=Object.entries(FORMAL_RECORDS).filter(([date,record])=>date.startsWith('2026-10-')&&record.status==='training');
        const values=[...document.querySelectorAll('#stats .stat .v')];
        return Number(values[2].textContent)===month.length
            &&Number(values[3].textContent)===month.reduce((sum,[,record])=>sum+(record.sessionLoad||0),0);
    })()""")
    screenshot_folder = os.environ.get('TRAIN_RECOMMENDATION_SCREENSHOTS')
    widths = [1536, 1365, 768, 390, 360]
    readiness_panel = evaluate("document.querySelector('#readiness').innerText")
    for width in widths:
        call('Emulation.setDeviceMetricsOverride', {
            'width': width, 'height': 900, 'deviceScaleFactor': 1, 'mobile': width <= 390})
        if screenshot_folder and width in [1536, 390]:
            evaluate("renderToday();document.querySelector('#today').scrollIntoView({behavior:'instant',block:'start'})")
            folder = Path(screenshot_folder)
            folder.mkdir(parents=True, exist_ok=True)
            result = call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
            (folder / ('recommendation-' + str(width) + '.png')).write_bytes(base64.b64decode(result['data']))
            evaluate("document.querySelector('#sessionSlots details[open]').scrollIntoView({behavior:'instant',block:'start'})")
            result = call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
            (folder / ('recommendation-options-' + str(width) + '.png')).write_bytes(base64.b64decode(result['data']))
        result = evaluate(r"""(()=>{
            recDateSelect.value='2026-10-27';recDateSelect.dispatchEvent(new Event('change'));
            const slots=[...document.querySelectorAll('#sessionSlots .rec-slot')];
            let checked=0;
            for(const [index,source] of TODAY_RECOMMENDATION['2026-10-27'].entries()){
                const blocks=String(source[2]).split(/<br\s*\/?\s*>/i);
                if(blocks.length!==3)continue;
                const slot=slots[index];slot.open=true;
                const cards=[...slot.querySelectorAll('.rec-candidate')];
                if(cards.length!==3)return {error:'候选数量',index};
                for(const [choice,block] of blocks.entries()){
                    const expected=block.replace(/^[ABC][：:]\s*/,'');
                    const card=cards[choice],dose=card.querySelector('.rec-prescription');
                    if(!dose)return {error:'剂量缺失',index,choice};
                    const lines=recViewDoseLines(expected).map(line=>line.replace(/[，,；;。]+$/,'')).filter(Boolean);
                    const actual=dose.textContent;
                    if(!lines.every(line=>actual.includes(line)))return {error:'剂量截断',index,choice};
                    const box=dose.getBoundingClientRect();
                    if(box.width<=0||box.left<0||box.right>innerWidth+1)return {error:'剂量不可见或溢出',index,choice};
                }
                if(slot.querySelector('.rec-shared-limits'))return {error:'专属剂量进入共同区',index};
                checked++;
            }
            return {checked,overflow:document.documentElement.scrollWidth>innerWidth};
        })()""")
        assert result == {'checked': 10, 'overflow': False}, (width, result)
        assert evaluate("""(()=>{
            recCollapseAll.click();
            const rules=document.querySelector('[data-rec-pinned]');
            return !document.querySelector('#sessionSlots details[open]')
                &&rules.getBoundingClientRect().height>100
                &&!rules.closest('details')
                &&document.querySelectorAll('#recRoute a').length===4
                &&!!document.querySelector('.rec-slot-optional .rec-optional-tag')
                &&!document.querySelector('#todayReason details');
        })()"""), width
        assert evaluate("""(()=>{
            recPrevious.click();const previous=recDateSelect.value;
            recNext.click();
            if(previous>='2026-10-27'||recDateSelect.value!=='2026-10-27')return false;
            recPrevious.click();recLatest.click();
            return recDateSelect.value===latestRecKey()&&recLatest.disabled&&recNext.disabled;
        })()"""), width
        assert evaluate("""(()=>{
            recDateSelect.value='2026-10-24';recDateSelect.dispatchEvent(new Event('change'));
            return todayPill.innerText.includes('2026-10-24')&&!!todayReason.innerText
                &&document.querySelectorAll('.rec-shared-limits').length>0;
        })()""")
        assert evaluate("document.querySelector('#readiness').innerText") == readiness_panel
        assert evaluate("""(()=>{
            const values=recReadinessValues.innerText,r=TODAY_READINESS[recDateSelect.value];
            return ['sleep','fatigue','soreness','pain','motivation'].every(key=>values.includes(String(r[key])));
        })()"""), width
    # 全部历史均可阅读；不重写事实源，不补造旧推荐缺失的原始状态。
    assert evaluate("""(()=>{
        for(const date of recommendationDates()){
            renderToday(date);
            if(sessionSlots.querySelectorAll('.rec-slot').length!==TODAY_RECOMMENDATION[date].length)return false;
            if(!!TODAY_SKILLS[date]?.length===recSkillsCard.hidden)return false;
            const source=document.createElement('div');source.innerHTML=TODAY_REASON[date]||'';
            if(todayReason.textContent.replace(/\\s/g,'')!==source.textContent.replace(/\\s/g,''))return false;
            if(!TODAY_READINESS[date]&&!recReadinessValues.textContent.includes('未保留'))return false;
        }
        return true;
    })()""")
    assert evaluate("""(()=>{
        renderToday();
        return !document.querySelector('#today input')&&recDateSelect.value===latestRecKey();
    })()""")
    assert evaluate("""(()=>{
        const original=latestRecKey();
        renderRecommendationSlots([]);
        const empty=!!sessionSlots.querySelector('.rec-empty')&&!recRoute.children.length;
        renderRecommendationReason('');
        const noReason=document.querySelector('.rec-reason-card').hidden;
        renderToday(original);
        return empty&&noReason;
    })()""")
    # Dashboard 相邻模块仍能筛选、打开详情和定位月度正式记录。
    assert evaluate("""(()=>{
        fLevel.value='L1';fLevel.dispatchEvent(new Event('input'));
        const rows=[...document.querySelectorAll('.lib-row')];
        if(!rows.length||rows.some(row=>!row.querySelector('.lvl-pill.l1')))return false;
        rows[0].click();
        const opened=!actionModal.hidden&&!!actionModalTitle.textContent;
        actionModalClose.click();
        fLevel.value='';fLevel.dispatchEvent(new Event('input'));
        const links=[...document.querySelectorAll('.monthly-day.training a')];
        return opened&&actionModal.hidden&&links.length>0
            &&links.every(link=>/records\\/\\d{4}-\\d{2}\\.html#detail-\\d{4}-\\d{2}-\\d{2}$/.test(link.getAttribute('href')));
    })()""")
    # 刷新仍显示最近推荐，旧 localStorage 不参与训练统计。
    call('Page.reload')
    for _ in range(100):
        if evaluate("document.readyState==='complete'&&!!document.querySelector('#sessionSlots .rec-candidate')"):
            break
        time.sleep(.1)
    assert evaluate("recDateSelect.value===latestRecKey()")
    assert evaluate('JSON.stringify(RECOMMEND_2026_10)') == baseline['source']
    assert evaluate('JSON.stringify(FORMAL_RECORDS)') == baseline['records']
    assert not errors, errors
    print(json.dumps({'fileProtocol': True, 'widths': widths, 'slotsPerWidth': 10,
                      'allCandidateDosesComplete': True, 'historySwitching': 'OK',
                      'formalStatsUnchanged': {'days': baseline['days'], 'load': baseline['load']},
                      'jsErrors': len(errors)}, ensure_ascii=False))


if __name__ == '__main__':
    verify()
