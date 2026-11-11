"""Capture the before/after shell and run the revised route inventory in Edge."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

from browser_dates import BACK, FRONT, RUNTIME, start


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUTPUT = Path(os.environ['ROWSZEIN_VERIFY_RESULTS']).resolve()


def visit(page, path):
    page.goto(FRONT + path, wait_until='networkidle')


def local_only(route):
    if route.request.url.startswith((FRONT + '/', BACK + '/')):
        route.continue_()
    else:
        route.abort()


def login(page, role):
    visit(page, '/login')
    page.locator('input[name="username"]').fill('pink-' + role)
    page.locator('input[name="password"]').fill(os.environ['ROWSZEIN_BROWSER_PASSWORD'])
    with page.expect_response(lambda response: urlsplit(response.url).path == '/api/auth/login/'
                              and response.request.method == 'POST') as response:
        page.get_by_role('button', name='Sign in', exact=True).click()
    assert response.value.status == 200
    page.wait_for_url('**/' + ('dashboard' if role == 'owner' else 'sales'))
    page.wait_for_load_state('networkidle')


def launch(servers):
    start([sys.executable, '-B', str(HERE / 'serve_fixture.py')], ROOT, 18842, 'backend', dict(os.environ), servers)
    empty = RUNTIME / 'empty-env'
    empty.mkdir()
    config = RUNTIME / 'vite.verify.mjs'
    options = {'root': (ROOT / 'frontend').as_posix(), 'envDir': empty.as_posix(),
               'server': {'host': '127.0.0.1', 'port': 18841, 'strictPort': True,
                          'proxy': {'/api': {'target': BACK, 'changeOrigin': True}}}}
    config.write_text(f'import base from {json.dumps((ROOT / "frontend/vite.config.ts").as_posix())};\n'
                      f'export default {{...base,...{json.dumps(options)}}};', encoding='utf-8')
    frontend_env = {k: v for k, v in os.environ.items() if not k.startswith(
        ('ROWSZEIN_', 'DJANGO_', 'DATABASE', 'DB_', 'SECRET', 'AUTH_', 'CSRF_', 'SESSION_', 'VITE_'))}
    start([shutil.which('node'), str(ROOT / 'frontend/node_modules/vite/bin/vite.js'), '--config', str(config)],
          ROOT / 'frontend', 18841, 'frontend', frontend_env, servers)


def main(mode):
    if (HERE / 'evidence') not in OUTPUT.parents:
        raise RuntimeError('Unowned evidence destination.')
    servers = []
    results = {'checks': {}, 'page_errors': [], 'captures': []}

    def check(label, condition):
        results['checks'][label] = bool(condition)
        print(f'{"PASS" if condition else "FAIL"} {label}', flush=True)

    def capture(page, name):
        page.screenshot(path=OUTPUT.parent / name, animations='disabled')
        results['captures'].append(name)

    try:
        launch(servers)
        fixtures = json.loads((RUNTIME / 'fixtures.json').read_text())
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='msedge', headless=True)
            context = browser.new_context(viewport={'width': 1440, 'height': 1050},
                                          timezone_id='America/New_York', reduced_motion='reduce')
            context.route('**/*', local_only)
            page = context.new_page()
            page.on('pageerror', lambda error: results['page_errors'].append(str(error)))
            visit(page, '/')
            expect(page.locator('#bestsellers').get_by_text('Strawberry Cloud', exact=True)).to_be_visible()
            capture(page, 'public-home-1440.png')
            if mode == 'after':
                from workflows import public_checks
                public_checks(page, context, check, capture)
            login(page, 'owner')
            expect(page.get_by_role('heading', name='Dashboard', exact=True)).to_be_visible()
            expect(page.locator('.dashboard-chart svg.recharts-surface').first).to_be_visible()
            page.mouse.move(4, 4)
            page.get_by_text('Welcome back!', exact=True).wait_for(state='hidden')
            header_links = page.get_by_role('banner').get_by_role('link', name='View live shop', exact=False).count()
            results['topbar_shop_links'] = header_links
            check('expected location of storefront shortcut', header_links == (1 if mode == 'after' else 0))
            for width, height in [(1440, 1050), (1024, 900), (768, 1024), (390, 844), (320, 750)]:
                page.set_viewport_size({'width': width, 'height': height})
                capture(page, f'owner-dashboard-{width}.png')
                if mode == 'after':
                    from workflows import responsive_check
                    responsive_check(page, width, check, results)
            page.set_viewport_size({'width': 1440, 'height': 1050})
            if mode == 'before':
                visit(page, '/products')
                capture(page, 'owner-products-1440.png')
                page.get_by_role('button', name='Logout').click()
                page.wait_for_url('**/login')
                login(page, 'staff')
                page.set_viewport_size({'width': 390, 'height': 844})
                page.get_by_role('button', name='Open navigation menu').click()
                capture(page, 'staff-navigation-390.png')
            else:
                from workflows import owner_checks, staff_checks, admin_checks
                owner_checks(page, context, fixtures, check, capture, results)
                staff_checks(page, context, fixtures, check, capture)
                admin_checks(browser, fixtures, check)
            browser.close()
        check('no uncaught page errors', not results['page_errors'])
    except Exception as error:
        results['failure'] = str(error).replace(os.environ['ROWSZEIN_BROWSER_PASSWORD'], '[REDACTED]')
        raise RuntimeError(results['failure']) from None
    finally:
        for child in reversed(servers):
            child.terminate()
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=5)
        results['servers_stopped'] = all(child.poll() is not None for child in servers)
        OUTPUT.write_text(json.dumps(results, indent=2), encoding='utf-8')
    return 0 if all(results['checks'].values()) else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
