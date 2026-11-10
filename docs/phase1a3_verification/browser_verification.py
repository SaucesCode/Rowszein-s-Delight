"""Real React/HTTP/Django/PostgreSQL workflows; external requests blocked."""
from decimal import Decimal
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
FRONT, BACK = 'http://127.0.0.1:18841', 'http://127.0.0.1:18842'
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
    launch([sys.executable, '-B', str(Path(__file__).with_name('serve_browser_backend.py'))], ROOT, 18842, 'browser-backend', env)
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

        def route_local(route):
            request = route.request
            if not request.url.startswith((FRONT + '/', BACK + '/', 'data:', 'blob:')):
                result['external_requests_blocked'].append(request.url)
                route.abort()
                return
            if request.url.startswith(FRONT + '/api/') and request.method in ['POST', 'PUT', 'PATCH', 'DELETE'] and '/auth/' not in request.url:
                entry = {'method': request.method, 'path': request.url.removeprefix(FRONT),
                    'identity': request.headers.get('idempotency-key'), 'revision': request.headers.get('if-match'), 'payload': request.post_data_json}
                result['mutations'].append(entry)
                response = route.fetch()
                entry['status'] = response.status
                entry['replayed'] = response.headers.get('idempotency-replayed')
                if drop_next_create['enabled'] and request.method == 'POST' and entry['path'] == '/api/sales/':
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

        go('/login')
        result['login_dom'] = page.locator('input').evaluate_all('els => els.map(el => ({name:el.name,type:el.type}))')
        page.locator('input[name="username"]').fill('disposable-browser-owner')
        page.locator('input[name="password"]').fill(password)
        page.get_by_role('button', name=re.compile('sign in|log in|login', re.I)).click()
        page.wait_for_url('**/dashboard')
        page.wait_for_load_state('networkidle')
        check('real_cookie_login', api('/api/auth/me/')['username'] == 'disposable-browser-owner')
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
        concurrent = context.request.patch(BACK + f'/api/sales/{pk}/', data={'notes': 'Independent concurrent operator correction'}, headers={'Idempotency-Key': str(uuid4()), 'If-Match': '"2"'})
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
    check('original_line_retained_after_browser_edit_cancel', SaleItem.objects.get().quantity == 1 and SaleItem.objects.get().unit_price == Decimal('50'))
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
