"""本机 file:// 推荐剂量回归；只读正式数据，浏览器使用临时配置。"""
import json
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request

import websocket


ROOT = Path(__file__).resolve().parents[1]


def verify() -> None:
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
            check_page(connection)
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
    for width in [1365, 390]:
        call('Emulation.setDeviceMetricsOverride', {
            'width': width, 'height': 900, 'deviceScaleFactor': 1, 'mobile': width == 390})
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
            recDateSelect.value='2026-10-24';recDateSelect.dispatchEvent(new Event('change'));
            return todayPill.innerText.includes('2026-10-24')&&!!todayReason.innerText
                &&document.querySelectorAll('.rec-shared-limits').length>0;
        })()""")
    assert evaluate('JSON.stringify(RECOMMEND_2026_10)') == baseline['source']
    assert evaluate('JSON.stringify(FORMAL_RECORDS)') == baseline['records']
    assert not errors, errors
    print(json.dumps({'fileProtocol': True, 'widths': [1365, 390], 'slotsPerWidth': 10,
                      'allCandidateDosesComplete': True, 'historySwitching': 'OK',
                      'formalStatsUnchanged': {'days': baseline['days'], 'load': baseline['load']},
                      'jsErrors': len(errors)}, ensure_ascii=False))


if __name__ == '__main__':
    verify()
