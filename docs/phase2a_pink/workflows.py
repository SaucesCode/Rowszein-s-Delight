"""Real navigation and permission checks for the inventoried routes."""
import os
from urllib.parse import urlsplit
from uuid import UUID

from playwright.sync_api import expect

from browser import BACK, FRONT, local_only, login, visit


def nav(page):
    return page.get_by_role('navigation', name='Main navigation')


def api(page, path):
    return page.request.get(FRONT + '/api' + path)


def logout(page):
    page.get_by_role('button', name='Logout').click()
    page.wait_for_url('**/login')
    page.wait_for_load_state('networkidle')


def responsive_check(page, width, check, results):
    metrics = page.evaluate('''() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
        const main = document.querySelector('main');
        const chart = document.querySelector('.dashboard-chart').getBoundingClientRect();
        resolve({
          document: document.documentElement.scrollWidth, viewport: innerWidth,
          mainScroll: main.scrollWidth, mainWidth: main.clientWidth,
          chartWidth: Math.round(chart.width), chartRight: Math.round(chart.right),
          overflow: [...main.querySelectorAll('*')].map(el => ({
            name: typeof el.className === 'string' ? el.className : el.tagName,
            right: Math.round(el.getBoundingClientRect().right),
            width: el.scrollWidth, client: el.clientWidth,
          })).filter(el => el.right > innerWidth + 1 || (el.client > 0 && el.width - el.client > 10))
            .sort((a,b) => b.right - a.right).slice(0, 12),
        });
    })))''')
    results.setdefault('viewport_measurements', {})[width] = metrics
    check(f'{width}px dashboard and chart fit', metrics['document'] <= width + 1
          and metrics['mainScroll'] <= metrics['mainWidth'] + 1
          and metrics['chartWidth'] >= 180 and metrics['chartRight'] <= width + 1)
    check(f'{width}px has appropriate navigation',
          nav(page).is_visible() if width >= 960 else page.get_by_role('button', name='Open navigation menu').is_visible())
    if width == 320:
        page.locator('.dashboard-chart').hover(position={'x': metrics['chartWidth'] // 2, 'y': 80})
        tooltip = page.locator('.recharts-tooltip-wrapper')
        expect(tooltip).to_be_visible()
        box = tooltip.bounding_box()
        check('chart tooltip remains visible within 320px viewport', box['x'] >= 0 and box['x'] + box['width'] <= width)
        page.mouse.move(4, 4)


def public_checks(page, context, check, capture):
    products = context.request.get(FRONT + '/api/products/?is_available=true').json()['data']
    fields = set(products['results'][0])
    check('anonymous catalog has 25 public items and public-only fields',
          products['count'] == 25 and fields == {
              'id', 'name', 'description', 'price', 'image_url', 'category', 'is_available', 'is_featured',
          })
    check('anonymous API cannot read stock or sales', api(page, '/ingredients/').status == 401 and api(page, '/sales/').status == 401)
    menu = page.locator('#menu')
    page.get_by_role('button', name='Load more products', exact=True).click()
    expect(page.get_by_text('No more products.', exact=True)).to_be_visible()
    check('storefront pagination includes a later product', menu.get_by_text('Menu Donut 25', exact=True).count() == 1)
    check('hidden product excluded and featured product visible',
          page.get_by_text('Hidden Owner Donut', exact=True).count() == 0
          and page.locator('#bestsellers').get_by_text('Strawberry Cloud', exact=True).count() == 1)
    search = page.get_by_role('searchbox', name='Search menu')
    search.fill('Menu Donut 25')
    expect(menu.get_by_text('Menu Donut 25', exact=True)).to_be_visible()
    expect(menu.get_by_text('Menu Donut 24', exact=True)).not_to_be_visible()
    menu.get_by_role('button', name='Add to cart', exact=True).first.click()
    page.get_by_role('button', name='Open cart', exact=False).click()
    cart = page.get_by_role('dialog', name='Your cart')
    expect(cart.get_by_text('Menu Donut 25', exact=True).first).to_be_visible()
    check('storefront search and cart summary remain reachable', cart.get_by_role('button', name='Save Order Summary').is_visible())
    cart.get_by_role('button', name='Close cart').click()
    visit(page, '/')
    page.get_by_role('link', name='Owner Login').click()
    page.wait_for_url('**/login')
    expect(page.get_by_role('button', name='Sign in')).to_be_visible()
    check('storefront management link reaches login', True)
    visit(page, '/sales')
    page.wait_for_url('**/login')
    check('anonymous management route redirects to sign-in', True)
    visit(page, '/not-a-page')
    page.wait_for_url(FRONT + '/')
    check('unmatched routes still return to storefront', True)
    page.set_viewport_size({'width': 390, 'height': 844})
    capture(page, 'public-home-390.png')
    page.set_viewport_size({'width': 1440, 'height': 1050})


LISTS = [
    ('Dashboard', '/dashboard', 'Dashboard'),
    ('Sales', '/sales', 'Sales'),
    ('Ingredients', '/ingredients', 'Ingredients'),
    ('Products', '/products', 'Products'),
    ('Recipes', '/recipes', 'Recipes'),
    ('Expenses', '/expenses', 'Expenses'),
    ('Profit Margins', '/profit-margins', 'Profit Margins'),
]
NEW_ACTIONS = {
    '/sales': 'Record Sale',
    '/ingredients': 'Add Ingredient',
    '/products': 'Add Product',
    '/recipes': 'Add Recipe',
    '/expenses': 'Add Expense',
}


def edit_paths(fixtures):
    return [
        ('sales', 'sale', 'input[name="date"]', fixtures['today']),
        ('ingredients', 'ingredient', 'input[name="name"]', 'Dark chocolate'),
        ('products', 'product', 'input[name="name"]', 'Strawberry Cloud'),
        ('recipes', 'recipe', 'select[name="product"]', str(fixtures['product'])),
        ('expenses', 'expense', 'input[name="date"]', fixtures['today']),
    ]


def owner_checks(page, context, fixtures, check, capture, results):
    shop = page.get_by_role('banner').get_by_role('link', name='View live shop', exact=False)
    with context.expect_page() as opened:
        shop.click()
    public_tab = opened.value
    public_tab.wait_for_url(FRONT + '/')
    expect(public_tab.locator('#menu')).to_be_visible()
    check('restored desktop shop shortcut opens the original public route', public_tab.url == FRONT + '/')
    public_tab.close()

    results['contrast_ratios'] = page.evaluate('''() => {
      const linear = n => n / 255 <= .04045 ? (n / 255) / 12.92 : ((n / 255 + .055) / 1.055) ** 2.4;
      const lum = c => c.match(/[0-9]+/g).slice(0,3).map(Number).map(linear)
        .reduce((sum,n,i) => sum + n * [.2126,.7152,.0722][i],0);
      const contrast = (a,b) => Math.round((Math.max(lum(a),lum(b))+.05) /
        (Math.min(lum(a),lum(b))+.05)*100)/100;
      const s = q => getComputedStyle(document.querySelector(q));
      return {
        'active nav': contrast(s('.workspace-nav-link[aria-current]').color, s('.workspace-nav-link[aria-current]').backgroundColor),
        'rail text': contrast(s('.workspace-nav-link:not([aria-current])').color, s('.workspace-rail').backgroundColor),
        'muted copy': contrast(s('.dashboard-heading p').color, s('.workspace-shell').backgroundColor),
        'highlighted KPI': contrast(s('.stat-card--primary .workspace-number').color, s('.stat-card--primary').backgroundColor),
        'primary action': contrast(s('.workspace-button--primary').color, s('.workspace-button--primary').backgroundColor),
        'control boundary': contrast(s('.workspace-button--secondary').borderTopColor, s('.workspace-button--secondary').backgroundColor),
        'header shop link': contrast(s('.workspace-shop-link').color, s('.workspace-topbar').backgroundColor),
        'focus outline': contrast(s('.workspace').getPropertyValue('--ws-rose').trim().startsWith('#')
          ? (() => {const el = document.createElement('span');el.style.color = 'var(--ws-rose)';document.body.append(el);
              const color = getComputedStyle(el).color;el.remove();return color;})()
          : s('.workspace-shop-link').color, s('.workspace-topbar').backgroundColor),
      };
    }''')
    for name, ratio in results['contrast_ratios'].items():
        check(f'{name} passes sampled contrast', ratio >= (3 if name in ('control boundary', 'focus outline') else 4.5))

    visit(page, '/dashboard')
    page.keyboard.press('Tab')
    skip = page.get_by_role('link', name='Skip to main content')
    expect(skip).to_be_focused()
    check('keyboard skip link has visible focus', skip.evaluate('(el) => getComputedStyle(el).outlineStyle') == 'solid')
    page.keyboard.press('Enter')
    expect(page.locator('main')).to_be_focused()
    check('skip link reaches main content', True)
    check('dashboard still shows exact stock and qualified balance',
          page.get_by_text('1.250000001 kg on hand / 2 kg minimum', exact=True).count() == 1
          and page.get_by_text('Recorded net sales minus expenses', exact=True).count() == 1)
    page.get_by_text('View monthly figures', exact=True).click()
    expect(page.get_by_role('columnheader', name='Month', exact=True)).to_be_visible()
    check('chart has a keyboard-accessible table', page.get_by_role('region', name='Monthly figures table').count() == 1)

    check('owner rail has all seven management destinations', nav(page).get_by_role('link').count() == len(LISTS))
    for link, path, heading in LISTS:
        nav(page).get_by_role('link', name=link, exact=True).click()
        page.wait_for_url(FRONT + path)
        expect(page.get_by_role('heading', name=heading, exact=True)).to_be_visible()
        check(f'owner sidebar {path} sets active page', nav(page).get_by_role('link', name=link, exact=True).get_attribute('aria-current') == 'page')
        page.reload(wait_until='networkidle')
        check(f'owner refresh preserves {path}', page.get_by_role('heading', name=heading, exact=True).is_visible())
        if path in NEW_ACTIONS:
            page.get_by_role('button', name=NEW_ACTIONS[path], exact=True).click()
            page.wait_for_url(FRONT + path + '/new')
            expect(page.locator('main form')).to_be_visible()
            check(f'owner create action reaches {path}/new', True)
            page.go_back(wait_until='networkidle')

    for slug, key, selector, value in edit_paths(fixtures):
        visit(page, f'/{slug}/new')
        expect(page.locator('main form')).to_be_visible()
        check(f'owner direct /{slug}/new shows original form', True)
        path = f'/{slug}/{fixtures[key]}/edit'
        visit(page, path)
        expect(page.locator(selector)).to_have_value(value)
        page.reload(wait_until='networkidle')
        expect(page.locator(selector)).to_have_value(value)
        check(f'owner edit and refresh /{slug}/:id/edit loads original record', True)
        if slug == 'products':
            check('category lookup preserves selected category',
                  page.get_by_label('Category', exact=True).input_value() == str(fixtures['category']))
        if slug == 'recipes':
            capture(page, 'owner-recipe-edit-1440.png')
        if slug == 'sales':
            expect(page.locator('textarea[name="notes"]')).to_have_value('OWNER SALE FIXTURE')
    visit(page, '/sales')
    expect(page.get_by_text('OWNER SALE FIXTURE', exact=True)).to_be_visible()
    capture(page, 'owner-sales-1440.png')
    nav(page).get_by_role('link', name='Products', exact=True).click()
    page.wait_for_url('**/products')
    expect(page.get_by_role('heading', name='Products', exact=True)).to_be_visible()
    capture(page, 'owner-products-1440.png')
    nav(page).get_by_role('link', name='Ingredients', exact=True).click()
    page.wait_for_url('**/ingredients')
    page.go_back(wait_until='networkidle')
    expect(page.get_by_role('heading', name='Products', exact=True)).to_be_visible()
    page.go_forward(wait_until='networkidle')
    expect(page.get_by_role('heading', name='Ingredients', exact=True)).to_be_visible()
    check('browser Back and Forward restore visited management pages', True)
    expect(page.get_by_role('columnheader', name='Current Stock', exact=True)).to_be_visible()
    check('owner inventory table retains labeled stock column', True)
    capture(page, 'owner-ingredients-1440.png')

    page.get_by_role('button', name='Actions for Dark chocolate', exact=True).click()
    page.get_by_role('button', name='Update Stock', exact=True).click()
    adjustment = page.get_by_role('dialog', name='Update Stock')
    expect(adjustment).to_be_visible()
    results['legacy_stock_controls_have_labels'] = adjustment.locator('input,textarea').evaluate_all(
        '(controls) => controls.every(control => control.labels.length > 0 || control.hasAttribute("aria-label"))')
    adjustment.locator('input[type="number"]').fill('0.250000000')
    adjustment.locator('textarea').fill('Disposable adjustment')
    with page.expect_response(lambda r: r.request.method == 'POST' and r.url.endswith('/adjustments/')) as saved:
        adjustment.get_by_role('button', name='Save', exact=False).click()
    reply = saved.value
    check('existing stock form submits real adjustment with UUID and revision',
          reply.status in (200, 201) and UUID(reply.request.headers['idempotency-key']).version == 4
          and bool(reply.request.headers.get('if-match')))
    stock = api(page, f'/ingredients/{fixtures["ingredient"]}/').json()['data']
    check('stock adjustment preserves ninth decimal', stock['quantity'] == '1.500000001')
    logout(page)


def staff_checks(page, context, fixtures, check, capture):
    login(page, 'staff')
    page.get_by_text('Welcome back!', exact=True).wait_for(state='hidden')
    expect(page.get_by_text('STAFF SALE FIXTURE', exact=True)).to_be_visible()
    check('staff lands on Sales and sees only their own sale after owner logout',
          page.get_by_text('OWNER SALE FIXTURE', exact=True).count() == 0)
    check('staff sidebar contains three permitted destinations',
          nav(page).get_by_role('link').all_text_contents() == ['Sales', 'Ingredients', 'Products'])
    visit(page, '/sales/new')
    expect(page.locator('input[name="date"]')).to_have_value(fixtures['today'])
    check('staff recording uses read-only Manila business date', not page.locator('input[name="date"]').is_editable())
    visit(page, '/products')
    expect(page.get_by_role('heading', name='Catalog', exact=True)).to_be_visible()
    check('staff catalog is read-only and has price column', page.get_by_role('columnheader', name='Price', exact=True).count() == 1)
    visit(page, '/ingredients')
    expect(page.get_by_role('heading', name='Stock quantities')).to_be_visible()
    expect(page.get_by_role('columnheader', name='Quantity', exact=True)).to_be_visible()
    page.reload(wait_until='networkidle')
    check('staff stock refresh is safe and exact',
          page.get_by_text('1.500000001', exact=True).count() == 1 and page.get_by_text('OWNER-SUPPLIER-FIXTURE').count() == 0)
    capture(page, 'staff-stock-1440.png')
    check('staff API keeps safe fields and finance/recipe denials',
          set(api(page, '/ingredients/').json()['data']['results'][0]) == {'id', 'name', 'quantity', 'unit', 'is_low_stock'}
          and api(page, '/dashboard/').status == 403 and api(page, '/recipes/').status == 403)
    restricted = ['/dashboard', '/profit-margins', '/recipes', '/expenses', '/ingredients/new', '/products/new', '/recipes/new', '/expenses/new']
    restricted += [f'/{slug}/{fixtures[key]}/edit' for slug, key, _, _ in edit_paths(fixtures)]
    for path in restricted:
        visit(page, path)
        check(f'staff direct access restricted {path}', page.get_by_role('heading', name='Access restricted').is_visible())
    capture(page, 'staff-restricted-1440.png')
    page.get_by_role('link', name='Return to your workspace').click()
    page.wait_for_url('**/sales')
    page.set_viewport_size({'width': 390, 'height': 844})
    toggle = page.get_by_role('button', name='Open navigation menu')
    toggle.click()
    drawer = page.get_by_role('dialog', name='Navigation menu')
    expect(drawer.get_by_role('button', name='Close menu')).to_be_focused()
    capture(page, 'staff-navigation-390.png')
    with context.expect_page() as opened:
        drawer.get_by_role('link', name='View live shop', exact=False).click()
    public_tab = opened.value
    public_tab.wait_for_url(FRONT + '/')
    expect(public_tab.locator('#menu')).to_be_visible()
    public_tab.close()
    page.keyboard.press('Escape')
    expect(toggle).to_be_focused()
    check('mobile drawer opens storefront and restores focus on Escape', True)
    toggle.click()
    drawer.get_by_role('link', name='Products', exact=True).click()
    page.wait_for_url('**/products')
    expect(page.locator('main')).to_be_focused()
    check('mobile staff link closes menu and focuses destination', True)
    toggle.click()
    logout(page)
    visit(page, '/sales')
    page.wait_for_url('**/login')
    check('staff logout clears access to management routes', True)


def admin_checks(browser, fixtures, check):
    with browser.new_context() as context:
        context.route('**/*', local_only)
        page = context.new_page()
        page.goto(BACK + '/admin/products/category/')
        page.locator('#id_username').fill('pink-owner')
        page.locator('#id_password').fill(os.environ['ROWSZEIN_BROWSER_PASSWORD'])
        page.get_by_role('button', name='Log in', exact=True).click()
        page.wait_for_url('**/admin/products/category/')
        expect(page.get_by_role('link', name='Glazed Donuts')).to_be_visible()
        page.get_by_role('link', name='Glazed Donuts').click()
        page.wait_for_url(f'**/admin/products/category/{fixtures["category"]}/change/')
        check('category management remains in Django admin for an authorized owner', page.locator('#id_name').input_value() == 'Glazed Donuts')
