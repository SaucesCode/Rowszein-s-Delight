"""Real React, Edge, Django, and cookie-authenticated date workflows."""
import json
from datetime import datetime
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.parse import parse_qs, urlsplit
from zoneinfo import ZoneInfo

from playwright.sync_api import expect, sync_playwright

from pdf_evidence import pdf_text

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUTPUT = Path(os.environ['ROWSZEIN_VERIFY_RESULTS']).resolve()
RUNTIME = Path(os.environ['ROWSZEIN_VERIFY_MARKER']).resolve().parent
FRONT = 'http://127.0.0.1:18841'
BACK = 'http://127.0.0.1:18842'


def listening(port):
    with socket.socket() as sock:
        return sock.connect_ex(('127.0.0.1', port)) == 0


def start(command, cwd, port, label, env, servers):
    if listening(port):
        raise RuntimeError(f'Loopback port {port} is occupied.')
    with (OUTPUT.parent / f'{label}.txt').open('w', encoding='utf-8') as log:
        child = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    servers.append(child)
    deadline = time.monotonic() + 50
    while time.monotonic() < deadline and child.poll() is None:
        if listening(port):
            return
        time.sleep(.1)
    raise RuntimeError(f'{label} did not become ready.')


def date_params(response):
    return {key: values[0] for key, values in parse_qs(urlsplit(response.url).query).items() if key.startswith('date_')}


def set_clock(page, instant):
    page.clock.set_fixed_time(datetime.fromisoformat(instant))


def login(page, role, home):
    page.goto(FRONT + '/login')
    page.wait_for_load_state('networkidle')
    page.locator('input[name="username"]').fill(f'dates-{role}')
    page.locator('input[name="password"]').fill(os.environ['ROWSZEIN_BROWSER_PASSWORD'])
    page.get_by_role('button', name='Sign in', exact=True).click()
    page.wait_for_url('**/' + home)
    page.wait_for_load_state('networkidle')


def ui_date_checks(page, visit, check, zone):
    def verify(name, actual, expected):
        check(f'{zone} {name}', actual, expected)

    def match(api, date_from, date_to):
        return lambda response: (urlsplit(response.url).path == api and response.request.method == 'GET'
                                 and date_params(response) == {'date_from': date_from, 'date_to': date_to})

    def range_for(response, start, end, name):
        verify(name, date_params(response), {'date_from': start, 'date_to': end})
        verify(name + ' status', response.status, 200)

    set_clock(page, '2024-02-29T15:59:00+00:00')
    response = visit('/sales', '/api/sales/')
    range_for(response, '2024-02-29', '2024-02-29', 'leap day at 23:59')
    verify('leap day visible', [row['date'] for row in response.json()['data']['results']], ['2024-02-29'])

    # March 10 is New York's spring-forward date. Sunday belongs to the previous Monday.
    for instant, start, end in [
        ('2024-03-10T15:59:00+00:00', '2024-03-04', '2024-03-10'),
        ('2024-03-10T16:00:00+00:00', '2024-03-11', '2024-03-11'),
    ]:
        set_clock(page, instant)
        today = visit('/sales', '/api/sales/')
        week = page.get_by_role('tab', name='This week', exact=True)
        if start == end:
            # Both presets use the same inclusive bounds on Monday. The list
            # can reuse its fresh Today response when the selected tab changes.
            week.click()
            expect(week).to_have_attribute('aria-selected', 'true')
            range_for(today, start, end, 'Monday shares the Today range')
        else:
            with page.expect_response(match('/api/sales/', start, end)) as observed:
                week.click()
            range_for(observed.value, start, end, 'week ending ' + end)

    for instant, start, end in [
        ('2023-12-31T15:59:00+00:00', '2023-01-01', '2023-12-31'),
        ('2023-12-31T16:00:00+00:00', '2024-01-01', '2024-01-01'),
    ]:
        set_clock(page, instant)
        response = visit('/dashboard', '/api/dashboard/')
        range_for(response, start, end, 'calendar year ending ' + end)
        verify('dashboard matched scope ' + end, response.json()['data']['filters'], {'date_from': start, 'date_to': end})

    set_clock(page, '2024-02-29T16:00:00+00:00')
    for resource in ('sales', 'expenses', 'dashboard'):
        api = f'/api/{resource}/'
        visit('/' + resource, api)
        role = 'radio' if resource == 'dashboard' else 'tab'
        page.get_by_role(role, name='Custom', exact=True).click()
        page.wait_for_load_state('networkidle')
        first = page.get_by_label('From', exact=True)
        last = page.get_by_label('To', exact=True)
        first.fill('2024-02-29')
        page.wait_for_load_state('networkidle')
        with page.expect_response(match(api, '2024-02-29', '2024-03-01')) as observed:
            last.fill('2024-03-01')
        response = observed.value
        range_for(response, '2024-02-29', '2024-03-01', resource + ' custom inclusive range')
        page.wait_for_load_state('networkidle')
        if resource == 'dashboard':
            verify('dashboard inclusive totals', response.json()['data']['totals']['net_sales'], '20.00')
        else:
            verify(resource + ' history records', [row['date'] for row in response.json()['data']['results']], ['2024-03-01', '2024-02-29'])
            verify(resource + ' today and yesterday labels',
                   [page.get_by_role('heading', name=label, exact=True).count() for label in ('Today', 'Yesterday')], [1, 1])
            if zone == 'America/New_York':
                for kind in ('csv', 'pdf'):
                    page.get_by_role('button', name='Export', exact=True).click()
                    with page.expect_download() as download, page.expect_response(
                        match(f'{api}export/{kind}/', '2024-02-29', '2024-03-01')
                    ) as exported:
                        page.get_by_role('menuitem', name='Export as ' + kind.upper()).click()
                    verify(f'{resource} {kind} export scope', exported.value.status, 200)
                    content = Path(download.value.path()).read_bytes()
                    if kind == 'pdf':
                        content = pdf_text(content)
                    verify(f'{resource} {kind} downloaded rows',
                           [day in content for day in (b'2024-02-28', b'2024-02-29', b'2024-03-01', b'2024-03-10')],
                           [False, True, True, False])
        requests = []

        def record(request):
            if request.method == 'GET' and urlsplit(request.url).path.startswith(api):
                requests.append(request.url)

        page.on('request', record)
        first.fill('2024-03-02')
        expect(page.get_by_role('alert')).to_have_text('The end date must be on or after the start date.')
        page.wait_for_load_state('networkidle')
        page.remove_listener('request', record)
        verify(resource + ' reversed range issues no request', requests, [])
        if resource != 'dashboard':
            verify(resource + ' reversed range disables export', page.get_by_role('button', name='Export', exact=True).is_disabled(), True)
        with page.expect_response(match(api, '2024-02-28', '2024-03-01')) as corrected:
            first.fill('2024-02-28')
        verify(resource + ' recovery from invalid filter', corrected.value.status, 200)


def staff_checks(context, check):
    page = context.new_page()
    login(page, 'staff', 'sales')
    page.goto(FRONT + '/sales/new')
    today = datetime.now(ZoneInfo('Asia/Manila')).date().isoformat()
    check('staff sale form uses actual Manila business day', page.locator('input[name="date"]').input_value(), today)
    check('staff sale date is read-only', page.locator('input[name="date"]').is_editable(), False)
    page.get_by_role('button', name='Add Item', exact=True).click()
    page.locator('select[name="sale_items.0.product"]').select_option(label='Date test cake')
    with page.expect_response(lambda response: urlsplit(response.url).path == '/api/sales/' and response.request.method == 'POST') as saved:
        page.get_by_role('button', name='Record Sale', exact=True).click()
    check('staff real sale accepted at catalog price and current Manila day',
          [saved.value.status, saved.value.json().get('data', {}).get('date'), saved.value.json().get('data', {}).get('total_amount')],
          [201, today, '12.00'])
    page.wait_for_url('**/sales')
    check('staff cannot see financial totals', page.get_by_label('Posting-date financial totals').count(), 0)


def main():
    if (HERE / 'evidence') not in OUTPUT.parents:
        raise RuntimeError('Unowned evidence destination.')
    before = os.environ['ROWSZEIN_DATE_BEFORE'] == '1'
    result = {'checks': {}, 'observations': {}, 'page_errors': []}
    servers = []

    def check(name, actual, expected):
        result['checks'][name] = actual == expected
        result['observations'][name] = {'actual': actual, 'expected': expected}
        print(f'{"PASS" if actual == expected else "FAIL"} {name}', flush=True)

    try:
        start([sys.executable, '-B', str(HERE / 'serve_browser.py')], ROOT, 18842, 'backend', dict(os.environ), servers)
        empty = RUNTIME / 'empty-env'
        empty.mkdir()
        config = RUNTIME / 'vite.verify.mjs'
        vite_options = {
            'root': (ROOT / 'frontend').as_posix(), 'envDir': empty.as_posix(),
            'server': {'host': '127.0.0.1', 'port': 18841, 'strictPort': True,
                       'proxy': {'/api': {'target': BACK, 'changeOrigin': True}}},
        }
        config.write_text(f'import base from {json.dumps((ROOT / "frontend/vite.config.ts").as_posix())};\n'
                          f'export default {{...base,...{json.dumps(vite_options)}}};', encoding='utf-8')
        front_env = {k: v for k, v in os.environ.items() if not k.startswith(
            ('ROWSZEIN_', 'DJANGO_', 'DATABASE', 'DB_', 'SECRET', 'AUTH_', 'CSRF_', 'SESSION_', 'VITE_'))}
        start([shutil.which('node'), str(ROOT / 'frontend/node_modules/vite/bin/vite.js'), '--config', str(config)],
              ROOT / 'frontend', 18841, 'frontend', front_env, servers)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='msedge', headless=True)
            zones = ['Asia/Manila'] if before else ['Asia/Manila', 'UTC', 'America/New_York']
            for zone in zones:
                context = browser.new_context(timezone_id=zone)
                context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(FRONT + '/') else route.abort())
                page = context.new_page()
                page.on('pageerror', lambda error: result['page_errors'].append(str(error)))
                login(page, 'admin', 'dashboard')

                def visit(path, api):
                    with page.expect_response(lambda response: urlsplit(response.url).path == api and response.request.method == 'GET') as observed:
                        page.goto(FRONT + path)
                    page.wait_for_load_state('networkidle')
                    return observed.value

                set_clock(page, '2024-02-29T16:00:00+00:00')
                response = visit('/sales', '/api/sales/')
                check(f'{zone} midnight sales request', date_params(response), {'date_from': '2024-03-01', 'date_to': '2024-03-01'})
                check(f'{zone} midnight sales data', [row['date'] for row in response.json()['data']['results']], ['2024-03-01'])
                response = visit('/expenses', '/api/expenses/')
                check(f'{zone} midnight expense request', date_params(response), {'date_from': '2024-03-01', 'date_to': '2024-03-01'})
                response = visit('/dashboard', '/api/dashboard/')
                check(f'{zone} dashboard year request', date_params(response), {'date_from': '2024-01-01', 'date_to': '2024-03-01'})
                check(f'{zone} dashboard year API scope', response.json()['data']['filters'], {'date_from': '2024-01-01', 'date_to': '2024-03-01'})
                page.goto(FRONT + '/expenses/new')
                check(f'{zone} expense form default', page.locator('input[name="date"]').input_value(), '2024-03-01')
                if not before:
                    ui_date_checks(page, visit, check, zone)
                context.close()
            if not before:
                with browser.new_context(timezone_id='America/New_York') as context:
                    context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(FRONT + '/') else route.abort())
                    staff_checks(context, check)
            browser.close()
        check('no browser script errors', result['page_errors'], [])
    except Exception as error:
        result['failure'] = str(error)
        raise
    finally:
        for child in reversed(servers):
            child.terminate()
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=5)
        result['servers_stopped'] = all(child.poll() is not None for child in servers)
        OUTPUT.write_text(json.dumps(result, indent=2), encoding='utf-8')
    return 0 if all(result['checks'].values()) else 1


if __name__ == '__main__':
    sys.exit(main())
