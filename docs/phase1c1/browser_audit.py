"""Real browser/React/API audit with owned servers and blocked external traffic."""
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
import traceback
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=Path(os.environ['ROWSZEIN_VERIFY_RESULTS'])
FOLDER=OUTPUT.parent
RUNTIME=Path(os.environ['ROWSZEIN_VERIFY_MARKER']).parent
FRONT='http://127.0.0.1:18841'
BACK='http://127.0.0.1:18842'
password=secrets.token_urlsafe(40)
env=dict(os.environ,ROWSZEIN_BROWSER_PASSWORD=password)
servers=[]
logs=[]
result={'observations':{},'api_gets':[],'page_errors':[],'blocked_external':[],'screenshots':[]}


def launch(command,cwd,port,name,child_env):
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1',port))==0: raise RuntimeError('Audit port already in use.')
    log=(FOLDER/(name+'.txt')).open('w',encoding='utf-8')
    logs.append(log)
    process=subprocess.Popen(command,cwd=cwd,env=child_env,stdout=log,stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    servers.append(process)
    deadline=time.monotonic()+45
    while time.monotonic()<deadline:
        if process.poll() is not None: raise RuntimeError(name+' exited')
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1',port))==0: return
        time.sleep(.1)
    raise RuntimeError(name+' startup timeout')


def observe(name,actual,expected):
    result['observations'][name]={'actual':actual,'expected':expected,'desired_behavior_passed':actual==expected}
    print(name+': '+json.dumps(result['observations'][name]),flush=True)


try:
    launch([sys.executable,'-B',str(Path(__file__).with_name('serve_audit_backend.py'))],ROOT,18842,'backend',env)
    empty=RUNTIME/'empty-env'
    empty.mkdir()
    config=RUNTIME/'vite.audit.mjs'
    config.write_text('import base from '+json.dumps(str(ROOT/'frontend/vite.config.ts').replace('\\','/'))+';\nexport default {...base,...'+json.dumps({
        'root':str(ROOT/'frontend').replace('\\','/'),'envDir':str(empty).replace('\\','/'),
        'server':{'host':'127.0.0.1','port':18841,'strictPort':True,'proxy':{'/api':{'target':BACK,'changeOrigin':True}}}})+'};',encoding='utf-8')
    front_env={k:v for k,v in env.items() if not k.startswith(('ROWSZEIN_','DJANGO_','DATABASE','DB_','SECRET','AUTH_','CSRF_','SESSION_','VITE_'))}
    launch([shutil.which('node'),str(ROOT/'frontend/node_modules/vite/bin/vite.js'),'--config',str(config)],ROOT/'frontend',18841,'frontend',front_env)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='msedge',headless=True)
        context=browser.new_context(viewport={'width':1440,'height':1000},timezone_id='Asia/Manila')
        def route(r):
            if not r.request.url.startswith((FRONT+'/',BACK+'/','data:','blob:')):
                result['blocked_external'].append(r.request.url)
                r.abort()
            else: r.continue_()
        context.route('**/*',route)
        page=context.new_page()
        page.on('pageerror',lambda e:result['page_errors'].append(str(e)))
        page.on('request',lambda r:result['api_gets'].append(r.url.removeprefix(FRONT)) if r.method=='GET' and r.url.startswith(FRONT+'/api/') else None)
        def go(path):
            page.bring_to_front()
            page.goto(FRONT+path)
            page.wait_for_load_state('networkidle')
        def shot(name):
            page.screenshot(path=str(FOLDER/(name+'.png')),full_page=True,animations='disabled')
            result['screenshots'].append(name+'.png')
        def nav(path):
            page.locator(f'a[href="{path}"]:visible').first.click()
            page.wait_for_load_state('networkidle')
        go('/')
        expect(page.get_by_text('Audit product 01',exact=True).first).to_be_attached()
        result['observations']['storefront_dom_excerpt']=page.locator('body').inner_text()[-3500:]
        observe('featured_product25_visible',page.get_by_text('Audit product 25',exact=True).count()>0,True)
        shot('01-public-pagination')
        go('/login')
        observe('login_controls_associated_labels',page.locator('input').evaluate_all('(els)=>els.every(e=>e.labels?.length || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby"))'),True)
        page.locator('input[name="username"]').fill('audit-admin')
        page.locator('input[name="password"]').fill(password)
        page.get_by_role('button',name='Sign in',exact=True).click()
        page.wait_for_url('**/dashboard')
        page.wait_for_load_state('networkidle')
        expect(page.get_by_text('Net sales',exact=True)).to_be_visible()
        result['observations']['dashboard_filter_requests']=[url for url in result['api_gets'] if '/api/dashboard/?' in url]
        go('/ingredients')
        row=page.get_by_role('row').filter(has_text='Audit ingredient 01').first
        result['observations']['stock_row_text']=row.inner_text()
        observe('exact_stock_quantity_visible', '19.996666668' in row.inner_text(), True)
        page.get_by_role('textbox',name='Search ingredients').fill('Audit ingredient 25')
        observe('search_finds_off_page_ingredient25',page.get_by_text('Audit ingredient 25',exact=True).count()>0,True)
        shot('02-inventory-search')
        page.get_by_role('button',name='Clear search').click()
        page.get_by_role('button',name='Actions for Audit ingredient 01',exact=True).click()
        page.get_by_role('button',name='Delete',exact=True).click()
        observe('confirmation_exposed_to_accessibility_tree',page.get_by_role('alertdialog').count(),1)
        page.get_by_role('button',name='Cancel',exact=True).click()
        page.get_by_role('button',name='Actions for Audit ingredient 01',exact=True).click()
        page.get_by_role('button',name='Edit',exact=True).click()
        page.wait_for_url('**/ingredients/1/edit')
        page.wait_for_load_state('networkidle')
        observe('ingredient_list_detail_cache_shape',page.locator('input[name="name"]').input_value(),'Audit ingredient 01')
        result['observations']['ingredient_edit_quantity']=page.locator('input[name="quantity"]').input_value()
        shot('03-ingredient-cache-collision')
        go('/recipes/new')
        page.get_by_role('button',name='Add Row',exact=True).click()
        expect(page.locator('select[name="product"] option')).to_have_count(21)
        expect(page.locator('select[name="recipe_ingredients.0.ingredient"] option')).to_have_count(21)
        observe('recipe_product_options',page.locator('select[name="product"] option').count(),26)
        observe('recipe_ingredient_options',page.locator('select[name="recipe_ingredients.0.ingredient"] option').count(),26)
        go('/sales/new')
        page.get_by_role('button',name='Add Item',exact=True).click()
        expect(page.locator('select[name="sale_items.0.product"] option')).to_have_count(21)
        observe('sale_product_options',page.locator('select[name="sale_items.0.product"] option').count(),26)
        page.set_viewport_size({'width':390,'height':844})
        result['observations']['mobile_sale_product_width']=page.locator('select[name="sale_items.0.product"]').bounding_box()['width']
        observe('mobile_document_no_horizontal_overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'),True)
        shot('04-sale-mobile')
        page.set_viewport_size({'width':1440,'height':1000})
        go('/products/new')
        expect(page.locator('select[name="category_id"] option')).to_have_count(21)
        observe('product_category_options',page.locator('select[name="category_id"] option').count(),26)
        # Existing recipe list stays mounted in cache while editing a distinct
        # ingredient ID: real form mutation, then compare current recipe cost.
        go('/recipes')
        row2=page.get_by_role('row').filter(has_text='Audit product 02').first
        before=row2.inner_text()
        nav('/ingredients')
        page.get_by_role('button',name='Actions for Audit ingredient 02',exact=True).click()
        page.get_by_role('button',name='Edit',exact=True).click()
        page.wait_for_load_state('networkidle')
        page.locator('input[name="cost_per_unit"]').fill('10')
        page.locator('textarea[name="notes"]').fill('')
        with page.expect_response(lambda r:'/api/ingredients/2/' in r.url and r.request.method=='PUT') as saved:
            page.get_by_role('button',name='Update Ingredient',exact=True).click()
        observe('ingredient_cost_form_update_status',saved.value.status,200)
        page.wait_for_url('**/ingredients')
        page.wait_for_load_state('networkidle')
        nav('/recipes')
        after=page.get_by_role('row').filter(has_text='Audit product 02').first.inner_text()
        result['observations']['cached_recipe_cost_before_after']={'before':before,'after':after}
        current=page.evaluate('async()=> (await (await fetch("/api/ingredients/2/",{credentials:"same-origin"})).json()).data')
        observe('ingredient_notes_can_be_cleared',current['notes'],'')
        current_recipe=page.evaluate('async()=> (await (await fetch("/api/recipes/2/",{credentials:"same-origin"})).json()).data')
        result['observations']['fresh_recipe_api_cost']={'batch':current_recipe['production_cost'],'unit':current_recipe['cost_per_unit']}
        observe('ingredient_edit_invalidates_recipe_cost',before!=after,True)
        # Missing edit-detail error handling: endpoint legitimately returns 404.
        go('/ingredients/99999/edit')
        observe('missing_ingredient_shows_explicit_error',page.get_by_role('alert').count()>0,True)
        shot('05-missing-detail')
        # List/detail share ['recipes',1]; observe navigation without reload.
        go('/recipes')
        row=page.get_by_role('row').filter(has_text='Audit product 01').first
        result['observations']['recipe_row_controls']=row.locator('button').evaluate_all('(els)=>els.map(e=>({text:e.innerText,label:e.getAttribute("aria-label")}))')
        row.get_by_role('button',name='Actions for Audit product 01 recipe',exact=True).click()
        page.get_by_role('button',name='Edit',exact=True).click()
        page.wait_for_load_state('networkidle')
        observe('recipe_edit_form_survives_list_navigation',page.locator('select[name="product"]').count()>0,True)
        observe('recipe_edit_product_matches_existing',page.locator('select[name="product"]').input_value(),'1')
        shot('06-recipe-cache-collision')
        context.close()
        context=browser.new_context(viewport={'width':1440,'height':1000},timezone_id='Asia/Manila')
        context.route('**/*',route)
        page=context.new_page()
        go('/login')
        page.locator('input[name="username"]').fill('audit-staff')
        page.locator('input[name="password"]').fill(password)
        page.get_by_role('button',name='Sign in',exact=True).click()
        page.wait_for_url('**/sales')
        go('/ingredients')
        expect(page.get_by_text('Audit ingredient 01',exact=True)).to_be_visible()
        observe('staff_stock_has_exact_quantity','19.996666668' in page.locator('body').inner_text(),True)
        observe('staff_supplier_hidden',page.get_by_text('SYNTHETIC-PRIVATE',exact=True).count(),0)
        shot('07-staff-stock')
        browser.close()
except Exception as error:
    result['harness_failure']={'type':type(error).__name__,'message':str(error),'traceback':traceback.format_exc()}
    raise
finally:
    for process in reversed(servers):
        process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
    for log in logs: log.close()
    result['servers_stopped']=all(process.poll() is not None for process in servers)
    OUTPUT.write_text(json.dumps(result,indent=2),encoding='utf-8')
