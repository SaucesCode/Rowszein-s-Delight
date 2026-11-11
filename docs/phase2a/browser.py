"""Compare the workspace in real Chromium against the disposable API."""
from datetime import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from playwright.sync_api import expect, sync_playwright

from browser_dates import BACK, FRONT, RUNTIME, start


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUTPUT = Path(os.environ['ROWSZEIN_VERIFY_RESULTS']).resolve()


def login(page, username, destination):
    page.goto(FRONT + '/login')
    page.locator('input[name="username"]').fill(username)
    page.locator('input[name="password"]').fill(os.environ['ROWSZEIN_BROWSER_PASSWORD'])
    page.get_by_role('button', name='Sign in', exact=True).click()
    page.wait_for_url('**/' + destination)
    page.wait_for_load_state('networkidle')


def local_only(route):
    if route.request.url.startswith(FRONT + '/'):
        route.continue_()
    else:
        route.abort()


def main(mode):
    if (HERE / 'evidence') not in OUTPUT.parents:
        raise RuntimeError('Unowned evidence destination.')
    servers = []
    results = {'checks': {}, 'page_errors': [], 'captures': []}
    try:
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
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='msedge', headless=True)
            context = browser.new_context(viewport={'width': 1440, 'height': 1080},
                                          timezone_id='Asia/Manila' if mode == 'before' else 'America/New_York',
                                          reduced_motion='reduce')
            context.route('**/*', local_only)
            page = context.new_page()
            page.add_init_script('''(() => {
              window.__workspaceLayoutShift = 0;
              if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
                new PerformanceObserver(list => {
                  for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__workspaceLayoutShift += entry.value;
                }).observe({type: 'layout-shift', buffered: true});
              }
            })()''')
            page.on('pageerror', lambda error: results['page_errors'].append(str(error)))
            login(page, 'rowszein', 'dashboard')
            page.clock.set_fixed_time(datetime.fromisoformat('2026-11-10T04:00:00+00:00'))
            page.reload(wait_until='networkidle')
            heading = 'Business Overview' if mode == 'before' else 'Dashboard'
            expect(page.get_by_role('heading', name=heading, exact=True)).to_be_visible()
            page.evaluate('document.fonts.ready')
            results['desktop_load_layout_shift_sum'] = round(page.evaluate('window.__workspaceLayoutShift'), 4)
            sizes = [(1440, 1080), (768, 1024), (390, 844)]
            if mode == 'after':
                sizes += [(1024, 900), (320, 750)]
            for width, height in sizes:
                page.set_viewport_size({'width': width, 'height': height})
                capture = f'dashboard-{width}.png'
                page.screenshot(path=OUTPUT.parent / capture, animations='disabled')
                results['captures'].append(capture)
            if mode == 'after':
                from workflows import verify
                verify(page, context, results, OUTPUT.parent)
            else:
                context.close()
                with browser.new_context(viewport={'width': 390, 'height': 844}, timezone_id='Asia/Manila') as staff_context:
                    staff_context.route('**/*', local_only)
                    staff_page = staff_context.new_page()
                    login(staff_page, 'counter-staff', 'sales')
                    staff_page.get_by_role('button', name='Open navigation menu').click()
                    staff_page.screenshot(path=OUTPUT.parent / 'staff-menu-390.png', animations='disabled')
                    results['captures'].append('staff-menu-390.png')
            browser.close()
        results['checks']['no uncaught page errors'] = not results['page_errors']
    except Exception as error:
        results['failure'] = str(error)
        raise
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
