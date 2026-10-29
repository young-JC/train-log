"""动作库 file:// 交互、数据保真、键盘和多屏宽验证；浏览器使用临时配置。"""
import base64
import json
import os
from pathlib import Path
import time

from verify_recommendation_view_browser import ROOT, verify


def check_page(connection):
    sequence = 0
    errors = []

    def call(method, params=None):
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

    def evaluate(code):
        result = call('Runtime.evaluate', {'expression': code, 'returnByValue': True})
        assert 'exceptionDetails' not in result, result
        return result['result'].get('value')

    def key(name, shift=False):
        codes = {'Tab': 9, 'Escape': 27, 'Enter': 13}
        params = {'key': name, 'code': name, 'windowsVirtualKeyCode': codes[name],
                  'nativeVirtualKeyCode': codes[name], 'modifiers': 8 if shift else 0}
        call('Input.dispatchKeyEvent', {**params, 'type': 'keyDown', 'text': '\r' if name == 'Enter' else ''})
        call('Input.dispatchKeyEvent', {**params, 'type': 'keyUp'})

    call('Runtime.enable')
    call('Page.enable')
    call('Page.navigate', {'url': (ROOT / 'train2.0/dashboard.html').as_uri()})
    for _ in range(100):
        if evaluate("document.readyState==='complete'&&!!document.querySelector('.lib-row')"):
            break
        time.sleep(.1)
    baseline = evaluate("""({actions:JSON.stringify(ACTIONS),records:JSON.stringify(FORMAL_RECORDS),
        recommendations:JSON.stringify(RECOMMEND_FILES),stats:document.getElementById('stats').innerText,
        count:ACTIONS.length,modules:Object.keys(ACTION_MODULES).length})""")
    assert evaluate("document.querySelectorAll('.lib-row').length") == baseline['count']
    assert evaluate("document.querySelectorAll('#actionModuleList button').length") == baseline['modules'] + 1
    # 每个模块都可直接浏览，条目与名称一一对应，不过滤或改写历史别名。
    assert evaluate("""(()=>{
        for(const letter of Object.keys(ACTION_MODULES)){
            actionModuleList.querySelector('[data-module="'+letter+'"]').click();
            const rows=[...document.querySelectorAll('.lib-row')];
            const expected=ACTIONS.map((a,i)=>({a,i})).filter(({a})=>a.id.startsWith(letter));
            if(rows.length!==expected.length||!document.querySelector('.lib-category[open]'))return false;
            if(rows.some((row,i)=>+row.dataset.actionIndex!==expected[i].i||row.querySelector('strong').textContent!==expected[i].a.name))return false;
        }
        clearActionFilter('all');return true;
    })()""")
    # 多条件交集、筛选标签、清除及查询无结果的恢复路径。
    assert evaluate("""(()=>{
        actionFilterToggle.click();if(actionFilterPanel.hidden)return false;
        fLevel.value='L3';fLevel.dispatchEvent(new Event('input'));
        fImpact.value='高';fImpact.dispatchEvent(new Event('input'));
        const rows=[...document.querySelectorAll('.lib-row')];
        if(!rows.length||rows.some(row=>{const a=ACTIONS[+row.dataset.actionIndex];return a.level!=='L3'||a.impact!=='高'}))return false;
        if(actionFilterCount.textContent!=='2')return false;
        actionActiveFilters.querySelector('[data-clear-filter="fImpact"]').click();
        if(fImpact.value||!fLevel.value)return false;
        clearActionFilter('all');
        fSearch.value='cOuNtErMoVeMeNt JuMp';fSearch.dispatchEvent(new Event('input'));
        if(!document.querySelector('.lib-row')||!document.querySelector('.lib-row').innerText.includes('Countermovement Jump'))return false;
        fSearch.value='__no_such_movement__';fSearch.dispatchEvent(new Event('input'));
        if(actionLibEmpty.hidden||document.querySelector('.lib-row'))return false;
        actionClearEmpty.click();
        if(!actionLibEmpty.hidden||fSearch.value)return false;
        actionModuleList.querySelector('[data-module="A"]').click();
        fImpact.value='高';fImpact.dispatchEvent(new Event('input'));
        if(actionLibEmpty.hidden||actionClearEmpty.dataset.clearFilter!=='module')return false;
        actionClearEmpty.click();
        if(!actionLibEmpty.hidden||fImpact.value!=='高')return false;
        clearActionFilter('all');actionFilterToggle.click();
        return actionFilterPanel.hidden;
    })()""")
    # 全部详情分段还原原描述；元数据来自当前动作，而不是上次打开的动作。
    assert evaluate(r"""(()=>{
        const normalize=text=>text.replace(/\s/g,'');
        for(const [index,a] of ACTIONS.entries()){
            openActionModal(index);
            const parts=actionDescriptionParts(actionDescription(a));
            const rebuilt=parts.intro+parts.sections.map(s=>s.title+'：'+s.text).join('');
            if(normalize(rebuilt)!==normalize(actionDescription(a)))return {error:'description',index};
            if(actionModalTitle.textContent!==a.name||actionModalEnglish.textContent!==(a.en||''))return {error:'name',index};
            if(!actionModalMeta.textContent.includes(a.equipment))return {error:'equipment',index};
        }
        closeActionModal();return true;
    })()""") is True
    widths = [1536, 1365, 1024, 768, 390, 360]
    screenshots = os.environ.get('TRAIN_ACTION_LIBRARY_SCREENSHOTS')
    for width in widths:
        call('Emulation.setDeviceMetricsOverride', {
            'width': width, 'height': 900, 'deviceScaleFactor': 1, 'mobile': width <= 390})
        evaluate("clearActionFilter('all');document.querySelector('#actionLib').scrollIntoView({behavior:'instant',block:'start'})")
        assert not evaluate('document.documentElement.scrollWidth>innerWidth'), width
        if width <= 390:
            assert evaluate("getComputedStyle(actionModuleList).display==='none'")
            evaluate('actionDirectoryToggle.click()')
            assert evaluate("getComputedStyle(actionModuleList).display==='grid'&&actionDirectoryToggle.getAttribute('aria-expanded')==='true'")
            evaluate("actionModuleList.querySelector('[data-module=H]').click()")
            assert evaluate("getComputedStyle(actionModuleList).display==='none'&&actionResultsTitle.textContent.includes('上肢')")
            evaluate("clearActionFilter('all')")
        if screenshots and width in [1536, 390]:
            folder = Path(screenshots)
            folder.mkdir(parents=True, exist_ok=True)
            data = call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
            (folder / f'library-{width}.png').write_bytes(base64.b64decode(data['data']))
        # 实际键盘打开详情，焦点约束在抽屉中，并用 Esc 返回原动作、原位置。
        evaluate("document.querySelector('.lib-row').focus({preventScroll:true});window.libraryTestScroll=scrollY;window.libraryTestRow=document.activeElement")
        key('Enter')
        assert evaluate("!actionModal.hidden&&document.activeElement===actionModalClose&&document.querySelector('main').inert"), (width, evaluate("({hidden:actionModal.hidden,focus:document.activeElement.outerHTML.slice(0,300),firstOpen:document.querySelector('.lib-category').open,rowVisible:!!document.querySelector('.lib-row').getClientRects().length})"))
        box = evaluate("(()=>{const b=actionModal.querySelector('.modal-panel').getBoundingClientRect();return {left:b.left,right:b.right,width:b.width}})()")
        assert box['left'] >= 0 and box['right'] <= width + 1, (width, box)
        if width <= 390:
            assert box['width'] == width, (width, box)
        key('Tab', shift=True)
        assert evaluate('document.activeElement===actionModalDone'), width
        key('Tab')
        assert evaluate('document.activeElement===actionModalClose'), width
        if screenshots and width in [1536, 390]:
            # 用有明确剂量、进退阶和停止标签的现有条目检查详情层级。
            evaluate("openActionModal(ACTIONS.findIndex(a=>a.libraryTitle),window.libraryTestRow)")
            data = call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
            (folder / f'library-detail-{width}.png').write_bytes(base64.b64decode(data['data']))
        key('Escape')
        assert evaluate("actionModal.hidden&&!document.querySelector('main').inert&&!document.body.classList.contains('no-scroll')&&document.activeElement===window.libraryTestRow&&scrollY===window.libraryTestScroll"), (width,evaluate("({hidden:actionModal.hidden,inert:document.querySelector('main').inert,locked:document.body.classList.contains('no-scroll'),focus:document.activeElement===window.libraryTestRow,scrollY,before:window.libraryTestScroll})"))
    assert evaluate('JSON.stringify(ACTIONS)') == baseline['actions']
    assert evaluate('JSON.stringify(FORMAL_RECORDS)') == baseline['records']
    assert evaluate('JSON.stringify(RECOMMEND_FILES)') == baseline['recommendations']
    assert evaluate("document.getElementById('stats').innerText") == baseline['stats']
    call('Page.reload')
    for _ in range(100):
        if evaluate("document.readyState==='complete'&&!!document.querySelector('.lib-row')"):
            break
        time.sleep(.1)
    assert evaluate("document.querySelectorAll('.lib-row').length") == baseline['count']
    assert evaluate('recDateSelect.value===latestRecKey()')
    assert not errors, errors
    print(json.dumps({'fileProtocol': True, 'widths': widths, 'actions': baseline['count'],
                      'modules': baseline['modules'], 'allDescriptionsPreserved': True,
                      'filtersAndDirectory': 'OK', 'keyboardAndFocus': 'OK',
                      'formalDataUnchanged': True, 'jsErrors': len(errors)}, ensure_ascii=False))


if __name__ == '__main__':
    verify(check_page)
