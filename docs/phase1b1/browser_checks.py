"""Real React/HTTP/Django/PostgreSQL workflows; external requests blocked."""
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time
import traceback
from uuid import uuid4
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(os.environ['ROWSZEIN_VERIFY_RESULTS'])
FOLDER = OUTPUT.parent
RUNTIME = Path(os.environ['ROWSZEIN_VERIFY_MARKER']).parent
FRONT, BACK, HOSTILE = 'http://127.0.0.1:18841', 'http://127.0.0.1:18842', 'http://127.0.0.1:18843'
password = secrets.token_urlsafe(40)
env = dict(os.environ, ROWSZEIN_BROWSER_PASSWORD=password)
servers, logs = [], []
result = {'checks': {}, 'mutations': [], 'screenshots': [], 'page_errors': [], 'console_errors': [], 'external_requests_blocked': [], 'real_http_api': True}


def check(name, condition, detail=True):
    result['checks'][name] = {'passed': bool(condition), 'detail': detail}
    if not condition:
        raise AssertionError(name + ': ' + str(detail))
    print('PASS: ' + name, flush=True)


def launch(command, cwd, port, name, child_env):
    with socket.socket() as sock:
        sock.settimeout(1)
        if sock.connect_ex(('127.0.0.1', port)) == 0:
            raise RuntimeError('Refusing occupied verification port ' + str(port))
    log = (FOLDER/(name + '.txt')).open('w', encoding='utf-8')
    logs.append(log)
    process = subprocess.Popen(command, cwd=cwd, env=child_env, stdout=log, stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    servers.append(process)
    deadline = time.monotonic() + 45
    while True:
        if process.poll() is not None:
            raise RuntimeError(name + ' exited; see its dedicated log')
        with socket.socket() as sock:
            sock.settimeout(1)
            if sock.connect_ex(('127.0.0.1', port)) == 0:
                return
        if time.monotonic() > deadline:
            raise RuntimeError(name + ' startup timeout')
        time.sleep(.2)


try:
    launch([sys.executable, '-B', str(ROOT/'docs/phase1a3_verification/serve_browser_backend.py')], ROOT, 18842, 'browser-backend', env)
    import django
    django.setup()
    from django.conf import settings
    from django.utils import timezone
    from accounts.models import User
    from ingredients.models import Ingredient
    from expenses.models import Expense
    from sales.models import Sale, SaleItem, InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry
    from rest_framework_simplejwt.tokens import AccessToken
    def db(call):
        # Playwright's sync API runs an event loop in its greenlet. Keep ORM
        # work on an owned synchronous thread, without disabling Django guards.
        from django.db import connections
        def work():
            try:
                return call()
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=1) as worker:
            return worker.submit(work).result()
    def business_snapshot():
        return db(lambda: {model.__name__: list(model.objects.order_by('pk').values()) for model in
            [Sale, SaleItem, Ingredient, Expense, InventoryOperation, ConsumptionBasis, SaleConsumption, StockMovement, SaleFinancialEntry]})
    attacker = RUNTIME/'hostile'
    attacker.mkdir()
    (attacker/'index.html').write_text('<!doctype html><title>Isolated hostile-origin verification</title>', encoding='utf-8')
    hostile_env = {key:value for key,value in os.environ.items() if key.upper() in ['SYSTEMROOT', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'PATHEXT']}
    launch([sys.executable, '-B', '-m', 'http.server', '18843', '--bind', '127.0.0.1', '--directory', str(attacker)], ROOT, 18843, 'browser-hostile-origin', hostile_env)
    (RUNTIME/'empty-env').mkdir()
    config = {'root': str(ROOT/'frontend').replace('\\', '/'), 'envDir': str(RUNTIME/'empty-env').replace('\\', '/'),
        'server': {'host': '127.0.0.1', 'port': 18841, 'strictPort': True,
                   'proxy': {'/api': {'target': BACK, 'changeOrigin': True}}}}
    vite_config = RUNTIME/'vite.verify.mjs'
    vite_config.write_text('import base from ' + json.dumps(str(ROOT/'frontend/vite.config.ts').replace('\\', '/')) + ';\nexport default {...base,...' + json.dumps(config) + '};\n', encoding='utf-8')
    front_env = {key: value for key, value in env.items() if not key.startswith(('ROWSZEIN_', 'DJANGO_', 'DATABASE', 'DB_', 'SECRET'))}
    launch([shutil.which('node'), str(ROOT/'frontend/node_modules/vite/bin/vite.js'), '--config', str(vite_config)], ROOT/'frontend', 18841, 'browser-frontend', front_env)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='msedge', headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        drop_next_create = {'enabled': True}
        corrupt_next_csrf = {'enabled': True}

        def route_local(route):
            request = route.request
            if not request.url.startswith((FRONT + '/', BACK + '/', HOSTILE + '/', 'data:', 'blob:')):
                result['external_requests_blocked'].append(request.url)
                route.abort()
                return
            if (request.url.startswith(FRONT + '/api/') and request.method in ['POST', 'PUT', 'PATCH', 'DELETE']
                    and '/auth/' not in request.url and request.headers.get('content-type', '').startswith('application/json')):
                entry = {'method': request.method, 'path': request.url.removeprefix(FRONT),
                    'identity': request.headers.get('idempotency-key'), 'revision': request.headers.get('if-match'), 'payload': request.post_data_json}
                result['mutations'].append(entry)
                before_rejection = business_snapshot()
                corrupt = corrupt_next_csrf['enabled'] and request.method == 'POST' and entry['path'] == '/api/sales/'
                if corrupt:
                    corrupt_next_csrf['enabled'] = False
                    response = route.fetch(headers={**request.headers, 'x-csrftoken': 'X' * 64})
                    check('browser_stale_csrf_rejected_before_write', response.status == 403 and response.json()['error'] ==
                        {'code': 'csrf_failed', 'message': 'Request verification failed. Reload and try again.', 'retryable': True}
                        and business_snapshot() == before_rejection)
                else:
                    response = route.fetch()
                entry['status'] = response.status
                entry['replayed'] = response.headers.get('idempotency-replayed')
                if drop_next_create['enabled'] and request.method == 'POST' and entry['path'] == '/api/sales/' and response.status == 201:
                    drop_next_create['enabled'] = False
                    entry['response_lost_after_server_commit'] = True
                    route.abort('connectionreset')
                else:
                    route.fulfill(response=response)
            else:
                route.continue_()

        context.route('**/*', route_local)
        page = context.new_page()
        page.on('pageerror', lambda error: result['page_errors'].append(str(error)))
        page.on('console', lambda message: result['console_errors'].append(message.text) if message.type == 'error' else None)

        def go(path):
            page.goto(FRONT + path)
            page.wait_for_load_state('networkidle')

        def shot(name):
            page.screenshot(path=str(FOLDER/(name + '.png')), full_page=True)
            result['screenshots'].append(name + '.png')

        def api(path):
            response = context.request.get(BACK + path)
            assert response.status == 200, (path, response.status)
            return response.json()['data']

        def stock():
            return {row['name']: row for row in api('/api/ingredients/')['results']}

        def csrf_headers():
            response = context.request.get(FRONT + '/api/auth/csrf/')
            assert response.status == 200
            return {'X-CSRFToken': response.json()['data']['csrf_token'], 'Origin': FRONT}

        def expire_access():
            token = AccessToken.for_user(db(lambda: User.objects.get(username='disposable-browser-owner')))
            token['exp'] = int(timezone.now().timestamp()) - 60
            context.add_cookies([{'name':settings.SIMPLE_JWT['AUTH_COOKIE'], 'value':str(token), 'url':FRONT, 'httpOnly':True, 'sameSite':'Lax'}])

        def login():
            page.locator('input[name="username"]').fill('disposable-browser-owner')
            page.locator('input[name="password"]').fill(password)
            page.get_by_role('button', name=re.compile('sign in|log in|login', re.I)).click()
            page.wait_for_url('**/dashboard')
            page.wait_for_load_state('networkidle')

        def fill_sale(quantity='1'):
            page.get_by_role('button', name='Add Item', exact=True).click()
            page.locator('input[name="date"]').fill('2026-11-09')
            page.locator('select[name="sale_items.0.product"]').select_option(str(product['id']))
            page.locator('input[name="sale_items.0.quantity"]').fill(quantity)
            page.locator('input[name="sale_items.0.unit_price"]').fill('50.00')

        go('/login')
        result['login_dom'] = page.locator('input').evaluate_all('els => els.map(el => ({name:el.name,type:el.type}))')
        page.locator('input[name="username"]').fill('disposable-browser-owner')
        page.locator('input[name="password"]').fill(password)
        page.get_by_role('button', name=re.compile('sign in|log in|login', re.I)).click()
        page.wait_for_url('**/dashboard')
        page.wait_for_load_state('networkidle')
        check('real_cookie_login', api('/api/auth/me/')['username'] == 'disposable-browser-owner')
        before = business_snapshot()
        denied = context.request.post(FRONT + '/api/expenses/', data={'date':'2026-11-09', 'category':'other', 'amount':'1.00', 'description':'Must not be written'}, headers={'Origin':FRONT})
        check('browser_cookie_missing_token_403_zero_business_writes', denied.status == 403 and denied.json()['error']['code'] == 'csrf_failed' and business_snapshot() == before)
        auth_before = {cookie['name']:cookie['value'] for cookie in context.cookies() if cookie['name'] in ['access_token', 'refresh_token']}
        token = csrf_headers()['X-CSRFToken']
        hostile_page = context.new_page()
        hostile_page.goto(HOSTILE)
        with hostile_page.expect_response(lambda response: response.url == FRONT + '/api/auth/logout/' and response.request.method == 'POST') as hostile:
            hostile_page.evaluate('''({target, token}) => { const form=document.createElement('form'); form.method='POST'; form.action=target;
                const input=document.createElement('input'); input.name='csrfmiddlewaretoken'; input.value=token; form.append(input); document.body.append(form); form.submit(); }''', {'target':FRONT+'/api/auth/logout/', 'token':token})
        check('hostile_browser_form_valid_token_403_no_cookie_clear_or_business_writes', settings.SIMPLE_JWT['AUTH_COOKIE'] + '=' in hostile.value.request.all_headers().get('cookie', '')
            and hostile.value.status == 403 and hostile.value.json()['error']['retryable'] is False
            and business_snapshot() == before and auth_before == {cookie['name']:cookie['value'] for cookie in context.cookies() if cookie['name'] in ['access_token', 'refresh_token']})
        hostile_page.goto(HOSTILE)
        with hostile_page.expect_response(lambda response: response.url == FRONT + '/api/expenses/' and response.request.method == 'POST') as hostile_write:
            hostile_page.evaluate('''({target, token}) => { const form=document.createElement('form'); form.method='POST'; form.action=target;
                for(const [name,value] of Object.entries({csrfmiddlewaretoken:token, date:'2026-11-09', category:'other', amount:'1.00', description:'Hostile write must never commit'})) {
                    const input=document.createElement('input'); input.name=name; input.value=value; form.append(input); }
                document.body.append(form); form.submit(); }''', {'target':FRONT+'/api/expenses/', 'token':token})
        check('hostile_browser_business_form_with_cookie_and_valid_token_403_zero_writes', settings.SIMPLE_JWT['AUTH_COOKIE'] + '=' in hostile_write.value.request.all_headers().get('cookie', '')
            and hostile_write.value.status == 403 and 'csrf_failed' in hostile_write.value.text() and business_snapshot() == before)
        hostile_page.close()
        go('/sales/new')
        result['sale_form_dom'] = page.locator('input,select,button').evaluate_all('els => els.map(el => ({tag:el.tagName,name:el.name,type:el.type,text:el.tagName==="BUTTON"?el.innerText:undefined}))')
        page.get_by_role('button', name='Add Item', exact=True).click()
        product = api('/api/products/')['results'][0]
        page.locator('input[name="date"]').fill('2026-11-09')
        page.locator('select[name="sale_items.0.product"]').select_option(str(product['id']))
        page.locator('input[name="sale_items.0.quantity"]').fill('1')
        page.locator('input[name="sale_items.0.unit_price"]').fill('50.00')
        page.get_by_role('button', name='Record Sale', exact=True).click()
        expect(page.get_by_text('Failed to record sale.', exact=True)).to_be_visible()
        check('unknown_create_committed_once', api('/api/sales/')['count'] == 1)
        check('browser_csrf_recovery_preserves_exact_intent', result['mutations'][0]['status'] == 403 and result['mutations'][1]['status'] == 201
            and result['mutations'][0]['identity'] == result['mutations'][1]['identity'] and result['mutations'][0]['payload'] == result['mutations'][1]['payload'])
        first = api('/api/sales/')['results'][0]
        uncertain = page.evaluate('Object.keys(sessionStorage).filter(key=>key.startsWith("rowszein_operation:")).map(key=>({key,value:JSON.parse(sessionStorage.getItem(key))}))')
        check('unknown_outcome_retains_identity', len(uncertain) == 1, uncertain)
        shot('browser-uncertain-create')
        page.reload()
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Add Item', exact=True).click()
        page.locator('input[name="date"]').fill('2026-11-09')
        page.locator('select[name="sale_items.0.product"]').select_option(str(product['id']))
        page.locator('input[name="sale_items.0.quantity"]').fill('2')
        page.locator('input[name="sale_items.0.unit_price"]').fill('50.00')
        with page.expect_response(lambda response: response.url == FRONT + '/api/sales/' and response.request.method == 'POST') as conflict:
            page.get_by_role('button', name='Record Sale', exact=True).click()
        check('unknown_payload_conflict_after_reload_is_rejected', conflict.value.status == 409 and api('/api/sales/')['count'] == 1)
        retained = page.evaluate('Object.keys(sessionStorage).filter(key=>key.startsWith("rowszein_operation:")).map(key=>JSON.parse(sessionStorage.getItem(key)))')
        check('conflict_retains_original_durable_identity', retained[0]['key'] == uncertain[0]['value']['key'])
        page.locator('input[name="sale_items.0.quantity"]').fill('1')
        page.locator('input[name="sale_items.0.unit_price"]').fill('50.001')
        with page.expect_response(lambda response: response.url == FRONT + '/api/sales/' and response.request.method == 'POST') as validation:
            page.get_by_role('button', name='Record Sale', exact=True).click()
        expect(page.get_by_role('button', name='Record Sale', exact=True)).to_be_enabled()
        check('invalid_retry_rejected_without_mutation', validation.value.status == 400 and api('/api/sales/')['count'] == 1)
        after_invalid = page.evaluate('Object.keys(sessionStorage).filter(key=>key.startsWith("rowszein_operation:")).map(key=>JSON.parse(sessionStorage.getItem(key)))')
        result['identity_after_uncertain_validation'] = after_invalid
        page.locator('input[name="sale_items.0.unit_price"]').fill('50.00')
        page.get_by_role('button', name='Record Sale', exact=True).click()
        page.wait_for_url('**/sales')
        page.wait_for_load_state('networkidle')
        check('validation_retry_does_not_create_duplicate', api('/api/sales/')['count'] == 1, api('/api/sales/')['count'])
        check('unknown_identity_survives_later_validation_error', len(after_invalid) == 1 and after_invalid[0]['key'] == uncertain[0]['value']['key'])
        check('retry_uses_same_identity', len({row['identity'] for row in result['mutations']}) == 1)
        check('retry_replays_without_duplicate', result['mutations'][-1]['replayed'] == 'true' and api('/api/sales/')['count'] == 1)
        check('identity_cleared_only_after_success', page.evaluate('Object.keys(sessionStorage).filter(key=>key.startsWith("rowszein_operation:")).length') == 0)
        check('single_fractional_deduction', stock()['Browser verification flour']['quantity'] == '19.996666667')

        pk = first['id']
        page.get_by_role('button', name=re.compile('Edit sale from')).click()
        page.wait_for_load_state('networkidle')
        expect(page.locator('input[name="sale_items.0.quantity"]')).to_have_value('1')
        page.locator('input[name="sale_items.0.quantity"]').fill('2')
        page.locator('input[name="sale_items.0.unit_price"]').fill('45.25')
        page.get_by_role('button', name='Update Sale', exact=True).click()
        page.wait_for_url('**/sales')
        page.wait_for_load_state('networkidle')
        edited = api(f'/api/sales/{pk}/')
        check('edit_retains_original_value', edited['total_amount'] == '90.50' and edited['original_total_amount'] == '50.00' and edited['revision'] == '2', edited)
        check('exact_edit_allocation', stock()['Browser verification flour']['quantity'] == '19.993333333')

        page.get_by_role('button', name=re.compile('Edit sale from')).click()
        page.wait_for_load_state('networkidle')
        expect(page.locator('input[name="sale_items.0.quantity"]')).to_have_value('2')
        concurrent = context.request.patch(BACK + f'/api/sales/{pk}/', data={'notes': 'Independent concurrent operator correction'}, headers={**csrf_headers(), 'Idempotency-Key': str(uuid4()), 'If-Match': '"2"'})
        check('independent_edit_commits', concurrent.status == 200)
        before = stock()
        page.locator('input[name="sale_items.0.quantity"]').fill('3')
        page.get_by_role('button', name='Update Sale', exact=True).click()
        expect(page.get_by_text('Failed to update sale.', exact=True)).to_be_visible()
        expect(page.locator('input[name="sale_items.0.quantity"]')).to_have_value('2')
        check('stale_edit_rejected_and_refreshed', result['mutations'][-1]['status'] == 409 and stock() == before)
        shot('browser-stale-conflict')

        go('/sales')
        page.get_by_role('button', name=re.compile('Cancel sale from')).click()
        expect(page.get_by_role('alertdialog', name='Cancel sale?', exact=True)).to_be_visible()
        check('cancellation_dialog_exposed_to_accessibility_tree', page.get_by_role('alertdialog').count() == 1)
        page.get_by_label('Cancellation reason', exact=True).fill('Disposable browser cancellation verification')
        page.get_by_role('button', name='Cancel sale', exact=True).click()
        expect(page.get_by_text('Cancelled · retained', exact=True)).to_be_visible()
        check('cancellation_retains_sale', api('/api/sales/')['count'] == 1 and api(f'/api/sales/{pk}/')['status'] == 'cancelled')
        check('cancellation_restores_exact_snapshot', stock()['Browser verification flour']['quantity'] == '20.000000000')
        report = api('/api/sales/financial-summary/?date_from=2026-01-01&date_to=2026-12-31')
        check('financial_no_double_subtraction_or_refund', report['totals']['net_sales'] == '0.00' and report['totals']['gross_sales'] == '50.00' and report['totals']['sales_adjustments'] == '40.50' and report['totals']['signed_cancellations'] == '-90.50' and report['refund_status'] == 'not_tracked', report)
        shot('browser-cancelled-history')

        go('/ingredients')
        page.get_by_role('button', name='Actions for Browser verification flour', exact=True).click()
        page.get_by_role('button', name='Update Stock', exact=True).click()
        dialog = page.get_by_role('dialog')
        expect(dialog).to_be_visible()
        check('stock_dialog_exposed_to_accessibility_tree', dialog.count() == 1)
        result['stock_dialog_dom'] = dialog.locator('input,textarea,button').evaluate_all('els=>els.map(el=>({tag:el.tagName,type:el.type,placeholder:el.getAttribute("placeholder"),text:el.tagName==="BUTTON"?el.innerText:undefined}))')
        dialog.locator('input[type="number"]').fill('0.000000001')
        dialog.locator('textarea').fill('Observed count correction, not a refund')
        dialog.get_by_role('button', name=re.compile('save|update stock', re.I)).click()
        expect(dialog).not_to_be_visible()
        check('exact_stock_adjustment_string', stock()['Browser verification flour']['quantity'] == '20.000000001')
        page.get_by_role('button', name='Actions for Browser verification flour', exact=True).click()
        page.get_by_role('button', name='Update Stock', exact=True).click()
        expect(page.get_by_role('dialog').locator('input[type="number"]')).to_have_value('')
        expect(page.get_by_role('dialog').locator('textarea')).to_have_value('')
        check('stock_dialog_reopens_with_fresh_fields', True)
        page.get_by_role('button', name='Close dialog', exact=True).click()
        shot('browser-inventory-after-adjustment')

        go('/sales/new')
        page.get_by_role('button', name='Add Item', exact=True).click()
        page.locator('input[name="date"]').fill('2026-11-09')
        page.locator('select[name="sale_items.0.product"]').select_option(str(product['id']))
        page.locator('input[name="sale_items.0.quantity"]').fill('100000')
        page.locator('input[name="sale_items.0.unit_price"]').fill('50')
        before = stock()
        page.get_by_role('button', name='Record Sale', exact=True).click()
        expect(page.get_by_text('Failed to record sale.', exact=True)).to_be_visible()
        check('insufficient_validation_preserves_state', result['mutations'][-1]['status'] == 400 and api('/api/sales/')['count'] == 1 and stock() == before)
        check('known_validation_failure_clears_identity', page.evaluate('Object.keys(sessionStorage).filter(key=>key.startsWith("rowszein_operation:")).length') == 0)
        go('/dashboard')
        expect(page.get_by_text('Net sales', exact=False).first).to_be_visible()
        dashboard = api('/api/dashboard/?date_from=2026-01-01&date_to=2026-12-31')
        check('dashboard_matches_financial_report', dashboard['totals']['net_sales'] == '0.00' and dashboard['refund_status'] == 'not_tracked', dashboard['totals'])
        shot('browser-dashboard-reconciled')
        check('original_line_retained_after_browser_edit_cancel', db(lambda: SaleItem.objects.get().quantity == 1 and SaleItem.objects.get().unit_price == Decimal('50')))

        # A first-attempt 401 retains the intent, then a real re-login retries the
        # exact UUID. Nothing is replayed automatically across authentication.
        go('/sales/new')
        fill_sale()
        expire_access()
        before = business_snapshot()
        with page.expect_response(lambda response: response.url == FRONT + '/api/sales/' and response.request.method == 'POST') as expired:
            page.get_by_role('button', name='Record Sale', exact=True).click()
        expect(page.get_by_role('button', name='Record Sale', exact=True)).to_be_enabled()
        pending = page.evaluate('Object.keys(sessionStorage).filter(key=>key.startsWith("rowszein_operation:")).map(key=>JSON.parse(sessionStorage.getItem(key)))')
        check('expired_access_sale_401_no_write_retains_first_identity', expired.value.status == 401 and business_snapshot() == before and len(pending) == 1)
        attempted = len(result['mutations'])
        go('/login')
        login()
        check('real_login_works_with_expired_access_cookie', api('/api/auth/me/')['username'] == 'disposable-browser-owner')
        check('reauthentication_does_not_automatically_replay_sale', len(result['mutations']) == attempted and business_snapshot() == before)
        go('/sales/new')
        fill_sale()
        page.get_by_role('button', name='Record Sale', exact=True).click()
        page.wait_for_url('**/sales')
        page.wait_for_load_state('networkidle')
        check('same_owner_reauth_reuses_original_sale_uuid_once', result['mutations'][-1]['identity'] == pending[0]['key'] and db(lambda: Sale.objects.count()) == 2)
        second = db(lambda: Sale.objects.exclude(pk=pk).get())
        cancelled = context.request.delete(FRONT + f'/api/sales/{second.pk}/', data={'reason':'Disposable auth-recovery reconciliation'},
            headers={**csrf_headers(), 'Idempotency-Key':str(uuid4()), 'If-Match':str(second.revision)})
        check('auth_recovery_sale_exact_cancellation', cancelled.status == 200 and stock()['Browser verification flour']['quantity'] == '20.000000001')

        go('/dashboard')
        csrf_before = next(cookie['value'] for cookie in context.cookies() if cookie['name'] == 'csrftoken')
        expire_access()
        page.get_by_role('button', name='Logout', exact=True).click()
        page.wait_for_url('**/login')
        page.wait_for_load_state('networkidle')
        cookies = {cookie['name']:cookie['value'] for cookie in context.cookies()}
        check('real_logout_expired_access_clears_both_jwt_cookies', settings.SIMPLE_JWT['AUTH_COOKIE'] not in cookies and settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'] not in cookies)
        check('logout_rotates_csrf_secret', cookies['csrftoken'] != csrf_before)
        context.add_cookies([{'name':settings.SIMPLE_JWT['AUTH_COOKIE'], 'value':'malformed.jwt.cookie', 'url':FRONT, 'httpOnly':True, 'sameSite':'Lax'}])
        csrf_before = cookies['csrftoken']
        login()
        check('real_login_ignores_malformed_access_and_rotates_csrf', api('/api/auth/me/')['username'] == 'disposable-browser-owner' and next(cookie['value'] for cookie in context.cookies() if cookie['name'] == 'csrftoken') != csrf_before)
        page.get_by_role('button', name='Logout', exact=True).click()
        page.wait_for_url('**/login')
        check('real_logout_valid_access_succeeds', not {cookie['name'] for cookie in context.cookies()}.intersection([settings.SIMPLE_JWT['AUTH_COOKIE'], settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']]))
        check('final_browser_financial_and_inventory_conservation', db(lambda: Sale.objects.count() == 2 and not Sale.objects.exclude(status='cancelled').exists()
            and Ingredient.objects.get(name='Browser verification flour').quantity == Decimal('20.000000001')))
        check('no_uncaught_browser_errors', not result['page_errors'], result['page_errors'])
        browser.close()

    import django
    django.setup()
    import unittest
    from sales.test_verification_extended import assert_reconciled
    from sales.models import Sale, SaleItem, InventoryOperation, SaleConsumption, StockMovement, SaleFinancialEntry
    assert_reconciled(unittest.TestCase())
    result['database_reconciliation'] = {'sales': list(Sale.objects.values()), 'original_items': list(SaleItem.objects.values()),
        'operations': InventoryOperation.objects.count(), 'consumptions': list(SaleConsumption.objects.values()),
        'movements': list(StockMovement.objects.values()), 'postings': list(SaleFinancialEntry.objects.values())}
    check('original_line_still_retained_after_auth_recovery', SaleItem.objects.filter(sale_id=pk).get().quantity == 1 and SaleItem.objects.filter(sale_id=pk).get().unit_price == Decimal('50'))
    result['passed'] = True
except Exception:
    result['passed'] = False
    result['exception'] = traceback.format_exc().replace(password, '[REDACTED]')
    print(result['exception'], flush=True)
finally:
    for process in reversed(servers):
        if process.poll() is None:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
            else:
                process.terminate()
            process.wait(timeout=10)
    for log in logs:
        log.close()
    OUTPUT.write_text(json.dumps(result, indent=2, default=str), encoding='utf-8')
sys.exit(0 if result['passed'] else 1)
