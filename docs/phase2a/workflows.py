"""Focused keyboard, responsive, and authorization checks for the redesign."""
from datetime import datetime
from urllib.parse import parse_qs, urlsplit
from uuid import UUID
from zoneinfo import ZoneInfo

from playwright.sync_api import expect

from browser import FRONT, login


def query_is(response, start, end):
    url = urlsplit(response.url)
    return (url.path == '/api/dashboard/' and response.request.method == 'GET'
            and parse_qs(url.query) == {'date_from': [start], 'date_to': [end]})


def verify(page, context, results, folder):
    expect.set_options(timeout=10000)

    def check(label, value):
        results['checks'][label] = bool(value)
        print(f'{"PASS" if value else "FAIL"} {label}', flush=True)

    def capture(name):
        page.screenshot(path=folder / name, animations='disabled')
        results['captures'].append(name)

    def visit(path):
        page.goto(FRONT + path, wait_until='networkidle')

    def menu():
        return page.get_by_role('button', name='Open navigation menu')

    def metric(name):
        return page.locator('.stat-card').filter(has=page.get_by_text(name, exact=True)).locator('dd.workspace-number')

    def preset(name):
        return page.get_by_role('radio', name=name, exact=True)

    def no_overflow():
        return page.evaluate('''() => {
          const main = document.querySelector('main');
          return document.documentElement.scrollWidth <= innerWidth + 1 &&
            main.scrollWidth <= main.clientWidth + 1;
        }''')

    nav = page.get_by_role('navigation', name='Main navigation')
    for width, height in [(320, 750), (390, 844), (768, 1024), (1024, 900), (1440, 1080)]:
        page.set_viewport_size({'width': width, 'height': height})
        expect(page.locator('.dashboard-chart svg.recharts-surface').first).to_be_visible()
        check(f'{width}px has no document or main horizontal overflow', no_overflow())
        check(f'{width}px uses the expected navigation', menu().is_visible() if width < 960 else nav.is_visible())
        check(f'{width}px retains full product name',
              page.get_by_text('Brown butter maple with toasted pecans and cinnamon sugar', exact=True).count() == 1)
        chart_width = page.locator('.dashboard-chart').bounding_box()['width']
        check(f'{width}px trend chart fits its panel', 180 <= chart_width <= width)
    check('owner sees seven authorized links', nav.get_by_role('link').count() == 7)
    page.get_by_role('region', name='Top products').screenshot(path=folder / 'dashboard-products-1440.png', animations='disabled')
    results['captures'].append('dashboard-products-1440.png')
    check('dashboard marks current nav link', nav.get_by_role('link', name='Dashboard').get_attribute('aria-current') == 'page')
    check('owner account identity and role visible',
          [page.locator(f'.workspace-account-{key}').inner_text() for key in ('name', 'role')] == ['rowszein', 'Owner'])
    contrast = page.evaluate('''() => {
      const linear = channel => {
        const fraction = channel / 255;
        return fraction <= .04045 ? fraction / 12.92 : ((fraction + .055) / 1.055) ** 2.4;
      };
      const luminance = color => {
        const [r,g,b] = color.match(/[0-9]+/g).slice(0,3).map(Number).map(linear);
        return .2126*r + .7152*g + .0722*b;
      };
      const ratio = (color, background) => {
        const a = luminance(color);
        const b = luminance(background);
        return Math.round((Math.max(a,b)+.05)/(Math.min(a,b)+.05)*100)/100;
      };
      const style = selector => getComputedStyle(document.querySelector(selector));
      return {
        'net sales text': ratio(style('.stat-card--primary .workspace-number').color, style('.stat-card--primary').backgroundColor),
        'active rail text': ratio(style('.workspace-nav-link[aria-current]').color, style('.workspace-nav-link[aria-current]').backgroundColor),
        'rail text': ratio(style('.workspace-nav-link:not([aria-current])').color, style('.workspace-rail').backgroundColor),
        'dashboard muted text': ratio(style('.dashboard-heading p').color, style('.workspace-shell').backgroundColor),
        'primary action': ratio(style('.workspace-button--primary').color, style('.workspace-button--primary').backgroundColor),
        'secondary control boundary': ratio(style('.workspace-button--secondary').borderTopColor, style('.workspace-button--secondary').backgroundColor),
      };
    }''')
    results['contrast_ratios'] = contrast
    for name, ratio in contrast.items():
        check(f'{name} passes contrast sample', ratio >= (3 if 'boundary' in name else 4.5))
    toggle = page.get_by_role('button', name='Collapse sidebar')
    toggle.click()
    check('collapsed rail preserves accessible nav names', nav.get_by_role('link', name='Dashboard').count() == 1)
    expect(page.get_by_role('button', name='Expand sidebar')).to_have_attribute('aria-expanded', 'false')
    nav.get_by_role('link', name='Dashboard').focus()
    expect(page.get_by_role('tooltip', name='Dashboard')).to_be_visible()
    check('collapsed rail shows label on keyboard focus', True)
    page.get_by_role('button', name='Expand sidebar').click()
    check('expanded sidebar restores text', nav.get_by_role('link', name='Dashboard').inner_text() == 'Dashboard')

    visit('/dashboard')
    page.keyboard.press('Tab')
    skip = page.get_by_role('link', name='Skip to main content')
    expect(skip).to_be_focused()
    check('keyboard skip link has visible focus', skip.evaluate("(el) => getComputedStyle(el).outlineStyle") == 'solid')
    page.keyboard.press('Enter')
    expect(page.locator('main')).to_be_focused()
    check('skip link moves focus to main', True)

    with page.expect_response(lambda response: query_is(response, '2026-10-01', '2026-11-10')) as quarter:
        preset('Year').focus()
        page.keyboard.press('ArrowLeft')
    check('native radio arrow changes to Manila quarter', quarter.value.status == 200 and preset('Quarter').is_checked())
    with page.expect_response(lambda response: query_is(response, '2026-11-09', '2026-11-10')) as week:
        preset('Week').check()
    check('Manila week starts Monday', week.value.status == 200)
    expect(page.get_by_role('heading', name='No movement to chart')).to_be_visible()
    check('zero net sales and expenses are explicit', metric('Net sales').inner_text() == '₱0.00' and metric('Expenses').inner_text() == '₱0.00')
    check('empty product state offers a sale action', page.get_by_role('region', name='Top products').get_by_role('link', name='Record sale').count() == 1)
    check('stock alert retains exact ninth decimal across date changes', page.get_by_text('1.250000001 kg on hand / 2 kg minimum', exact=True).count() == 1)
    with page.expect_response(lambda response: query_is(response, '2026-11-01', '2026-11-10')) as month:
        preset('Month').check()
    check('Manila month preset uses the first day', month.value.status == 200)
    page.clock.set_fixed_time(datetime.fromisoformat('2026-10-31T16:00:00+00:00'))
    with page.expect_response(lambda response: query_is(response, '2026-01-01', '2026-11-01')) as midnight:
        visit('/dashboard')
    check('New York browser at Manila midnight sends new Manila day', midnight.value.status == 200)
    page.clock.set_fixed_time(datetime.fromisoformat('2026-11-10T04:00:00+00:00'))
    visit('/dashboard')
    check('year to date shows the actual signed net sales from API', metric('Net sales').inner_text() == '₱177,569.00')
    check('difference has a qualified label and description',
          page.get_by_text('Recorded net sales minus expenses', exact=True).count() == 1
          and page.get_by_text('Net profit', exact=True).count() == 0)
    page.get_by_text('View monthly figures', exact=True).click()
    expect(page.get_by_role('table').filter(has=page.get_by_role('columnheader', name='Month', exact=True))).to_be_visible()
    check('monthly values available in semantic table', page.get_by_role('rowheader', name='Feb', exact=True).count() == 1)
    check('chart excludes December outside applied range', page.get_by_role('rowheader', name='Dec', exact=True).count() == 0)
    page.get_by_text('View monthly figures', exact=True).click()

    preset('Custom').check()
    page.wait_for_load_state('networkidle')
    date_from = page.get_by_label('From', exact=True)
    date_to = page.get_by_label('To', exact=True)
    date_from.fill('2026-02-01')
    page.wait_for_load_state('networkidle')
    with page.expect_response(lambda response: query_is(response, '2026-02-01', '2026-02-28')) as custom:
        date_to.fill('2026-02-28')
    assert custom.value.ok, custom.value.json()
    expected = custom.value.json()['data']['totals']['net_profit']
    expect(metric('Sales less expenses')).to_have_text(f'-₱{abs(expected):,.2f}')
    check('negative filtered balance agrees with API', expected < 0)
    check('period controls remain after custom filter', preset('Custom').is_checked())
    requested = []

    def record(request):
        if urlsplit(request.url).path == '/api/dashboard/':
            requested.append(request.url)

    page.on('request', record)
    date_from.fill('2026-03-01')
    expect(page.get_by_role('alert')).to_have_text('The end date must be on or after the start date.')
    page.wait_for_load_state('networkidle')
    page.remove_listener('request', record)
    check('reversed range gives actionable feedback and no request', not requested and date_to.get_attribute('aria-invalid') == 'true')
    date_from.fill('2025-07-01')
    page.wait_for_load_state('networkidle')
    with page.expect_response(lambda response: query_is(response, '2025-07-01', '2025-07-31')):
        date_to.fill('2025-07-31')
    page.set_viewport_size({'width': 320, 'height': 750})
    expect(metric('Sales less expenses')).to_have_text('-₱99,999,999.99')
    check('eight-digit peso values stay readable at 320px', no_overflow())
    capture('dashboard-large-negative-320.png')
    page.get_by_role('button', name='Clear', exact=True).click()
    expect(date_from).to_have_value('')
    expect(date_to).to_have_value('')
    check('clearing custom dates restores omitted bounds', True)

    visit('/dashboard')
    page.set_viewport_size({'width': 390, 'height': 844})
    dialog = page.get_by_role('dialog', name='Navigation menu')
    check('closed mobile menu has no focusable dialog content', dialog.count() == 0)
    menu().click()
    close = dialog.get_by_role('button', name='Close menu')
    expect(close).to_be_focused()
    dialog.get_by_role('button', name='Logout').focus()
    page.keyboard.press('Tab')
    expect(close).to_be_focused()
    check('mobile menu traps Tab', True)
    page.keyboard.press('Escape')
    expect(menu()).to_be_focused()
    check('mobile Escape closes menu and restores focus', dialog.count() == 0)
    menu().click()
    dialog.get_by_role('link', name='Sales', exact=True).click()
    page.wait_for_url('**/sales')
    expect(page.locator('main')).to_be_focused()
    check('mobile navigation focuses destination content', True)
    page.get_by_role('tab', name='This month', exact=True).click()
    cancel = page.get_by_role('button', name='Cancel sale from', exact=False).first
    cancel.click()
    confirm = page.get_by_role('alertdialog', name='Cancel sale?')
    expect(confirm.get_by_role('button', name='Cancel', exact=True)).to_be_focused()
    confirm.get_by_role('button', name='Cancel sale', exact=True).focus()
    page.keyboard.press('Tab')
    expect(confirm.get_by_role('button', name='Close dialog')).to_be_focused()
    capture('confirm-390.png')
    page.keyboard.press('Escape')
    expect(cancel).to_be_focused()
    check('confirmation traps focus and restores it on Escape', confirm.count() == 0)
    cancel.click()
    confirm.get_by_label('Cancellation reason').fill('Disposable confirmation workflow')
    with page.expect_response(lambda response: response.request.method == 'DELETE' and '/api/sales/' in response.url) as cancelled:
        confirm.get_by_role('button', name='Cancel sale', exact=True).click()
    headers = cancelled.value.request.headers
    check('confirmation submits existing revision and UUID and retains cancelled sale',
          cancelled.value.status == 200 and cancelled.value.json()['data']['status'] == 'cancelled'
          and UUID(headers['idempotency-key']).version == 4 and headers['if-match'] == '"1"')
    expect(confirm).not_to_be_visible()

    visit('/dashboard')
    page.get_by_role('link', name='Record sale', exact=True).click()
    page.wait_for_url('**/sales/new')
    notes = page.locator('textarea[name="notes"]')
    notes.fill('Unsubmitted notes survive opening navigation.')
    menu().click()
    page.keyboard.press('Escape')
    expect(notes).to_have_value('Unsubmitted notes survive opening navigation.')
    check('toggling mobile menu preserves current form work', True)
    check('header identifies nested form route', 'New record' in page.locator('.workspace-crumb').inner_text())
    check('prefers-reduced-motion is respected', page.evaluate('''() => matchMedia('(prefers-reduced-motion: reduce)').matches &&
      parseFloat(getComputedStyle(document.querySelector('.workspace-icon-button')).transitionDuration) < 0.001'''))

    visit('/dashboard')
    page.route('**/api/dashboard/?date_from=2026-10-01&date_to=2026-11-10',
               lambda route: route.fulfill(status=503, json={'success': False, 'error': 'Synthetic read outage'}))
    preset('Quarter').check()
    expect(page.get_by_role('status', name='Loading dashboard', exact=True)).to_be_visible()
    expect(page.get_by_role('heading', name='Dashboard unavailable')).to_be_visible(timeout=18000)
    check('loading and retry states keep date controls available', preset('Quarter').is_visible())
    page.unroute('**/api/dashboard/?date_from=2026-10-01&date_to=2026-11-10')
    with page.expect_response(lambda response: query_is(response, '2026-10-01', '2026-11-10') and response.status == 200):
        page.get_by_role('button', name='Try again').click()
    check('dashboard retries and recovers from API error', True)

    menu().click()
    dialog.get_by_role('button', name='Logout').click()
    page.wait_for_url('**/login')
    check('owner logs out through shell', not any(cookie['name'] == 'access_token' for cookie in context.cookies()))
    page.clock.set_fixed_time(datetime.now(ZoneInfo('Asia/Manila')))
    login(page, 'counter-staff', 'sales')
    check('staff lands in Sales without owner data after account switch', page.get_by_label('Posting-date financial totals').count() == 0)
    expect(page.get_by_text('Staff fixture', exact=True)).to_be_visible()
    check('staff sees own sale and cannot see same-day owner fixture', page.get_by_text('Owner-only same-day fixture', exact=True).count() == 0)
    check('staff identity and role visible',
          [page.locator(f'.workspace-account-{key}').inner_text() for key in ('name', 'role')] == ['counter-staff', 'Staff'])
    capture('staff-sales-390.png')
    menu().click()
    links = dialog.get_by_role('navigation', name='Main navigation').get_by_role('link').all_text_contents()
    check('staff navigation contains only Sales, Ingredients and Products', links == ['Sales', 'Ingredients', 'Products'])
    capture('staff-menu-390.png')
    dialog.get_by_role('link', name='Ingredients', exact=True).click()
    page.wait_for_url('**/ingredients')
    result = page.evaluate('''async () => {
      const stock = await (await fetch('/api/ingredients/')).json();
      const dashboard = await fetch('/api/dashboard/');
      return {fields:Object.keys(stock.data.results[0]).sort(), dashboard:dashboard.status};
    }''')
    check('staff stock keeps safe fields and dashboard API denies access',
          result == {'fields': ['id', 'is_low_stock', 'name', 'quantity', 'unit'], 'dashboard': 403})
    visit('/dashboard')
    expect(page.get_by_role('heading', name='Access restricted')).to_be_visible()
    check('staff direct dashboard route renders permission state', page.get_by_text('Monthly trends', exact=True).count() == 0)
    capture('staff-denied-390.png')
    page.get_by_role('link', name='Return to your workspace').click()
    page.wait_for_url('**/sales')
    context.clear_cookies(name='access_token')
    visit('/sales')
    page.wait_for_url('**/login')
    with page.expect_response(lambda response: urlsplit(response.url).path == '/api/auth/refresh/' and response.status == 200):
        page.get_by_role('button', name='Renew an existing session').click()
    page.wait_for_url('**/sales')
    check('access-cookie loss preserves existing staff session renewal path', True)
