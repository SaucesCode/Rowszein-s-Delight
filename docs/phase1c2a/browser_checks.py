"""Real React/Edge navigation, actual cookies/CSRF/API, never auth mocks."""
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
from concurrent.futures import ThreadPoolExecutor
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=Path(os.environ['ROWSZEIN_VERIFY_RESULTS'])
FOLDER=OUTPUT.parent
RUNTIME=Path(os.environ['ROWSZEIN_VERIFY_MARKER']).parent
BEFORE=os.environ['ROWSZEIN_CACHE_BEFORE']=='1'
FRONT='http://127.0.0.1:18841'
BACK='http://127.0.0.1:18842'
password=secrets.token_urlsafe(40)
env=dict(os.environ,ROWSZEIN_BROWSER_PASSWORD=password)
servers=[]
logs=[]
result={'observations':{},'requests':[],'screenshots':[],'page_errors':[],'blocked_external':[],'baseline':BEFORE}
fault={'path':None,'mode':None,'held':[]}

def db(action):
    from django.db import connections
    def work():
        try: return action()
        finally: connections.close_all()
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(work).result()

def check(name,actual,expected):
    passed=actual==expected
    result['observations'][name]={'actual':actual,'expected':expected,'passed':passed}
    print(('PASS ' if passed else 'FAIL ')+name,flush=True)

def launch(command,cwd,port,name,child_env):
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1',port))==0: raise RuntimeError('Occupied verification port.')
    log=(FOLDER/(name+'.txt')).open('w',encoding='utf-8')
    logs.append(log)
    child=subprocess.Popen(command,cwd=cwd,env=child_env,stdout=log,stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    servers.append(child)
    end=time.monotonic()+45
    while time.monotonic()<end:
        if child.poll() is not None: raise RuntimeError(name+' exited')
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1',port))==0: return
        time.sleep(.1)
    raise RuntimeError(name+' startup timeout')

try:
    launch([sys.executable,'-B',str(Path(__file__).with_name('serve_backend.py'))],ROOT,18842,'backend',env)
    import django
    django.setup()
    from accounts.models import User
    from session_api_contracts import BUSINESS_MODELS
    def business_state():
        return db(lambda: [list(model.objects.order_by('pk').values()) for model in BUSINESS_MODELS])
    empty=RUNTIME/'empty-env'
    empty.mkdir()
    config=RUNTIME/'vite.verify.mjs'
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
            elif fault['path'] and r.request.url==FRONT+fault['path'] and r.request.method=='GET':
                mode=fault['mode']
                fault['path']=None
                response=r.fetch()
                result.setdefault('fault_injections',[]).append({'path':r.request.url.removeprefix(FRONT),'mode':mode,'actual_api_status':response.status})
                if mode=='hold': fault['held'].append((r,response))
                elif mode=='error': r.fulfill(status=503,json={'success':False,'error':'Synthetic response failure'})
                elif mode=='wrong-id':
                    body=response.json()
                    body['data']['id']=99998
                    r.fulfill(response=response,json=body)
            else: r.continue_()
        context.route('**/*',route)
        page=context.new_page()
        page.on('pageerror',lambda e:result['page_errors'].append(str(e)))
        def response(r):
            if not r.url.startswith(FRONT+'/api/'): return
            entry={'path':r.url.removeprefix(FRONT),'method':r.request.method,'status':r.status}
            if r.request.method=='GET' and r.status==200 and '/api/ingredients/?' in r.url:
                rows=r.json()['data']['results']
                entry['fields']=sorted(rows[0]) if rows else []
            result['requests'].append(entry)
        page.on('response',response)
        def go(path):
            page.bring_to_front()
            page.goto(FRONT+path)
            page.wait_for_load_state('networkidle')
        def nav(path):
            page.locator(f'a[href="{path}"]:visible').first.click()
            page.wait_for_load_state('networkidle')
        def shot(name):
            page.screenshot(path=str(FOLDER/(name+'.png')),full_page=True,animations='disabled')
            result['screenshots'].append(name+'.png')
        def edit(name):
            page.get_by_role('button',name='Actions for '+name,exact=True).click()
            page.get_by_role('button',name='Edit',exact=True).click()
            page.wait_for_load_state('networkidle')
        def login(name='owner',role='admin',direct=True):
            if direct: go('/login')
            page.locator('input[name="username"]').fill('cache-'+name)
            page.locator('input[name="password"]').fill(password)
            page.get_by_role('button',name='Sign in',exact=True).click()
            page.wait_for_url('**/'+('sales' if role=='staff' else 'dashboard'))
            page.wait_for_load_state('networkidle')
        def spa(path):
            # Browser history changes exercise record-to-record route reuse;
            # list/detail entry paths above use the application's actual buttons.
            page.evaluate('path=>{history.pushState({...history.state,idx:(history.state?.idx??0)+1},"",path);dispatchEvent(new PopStateEvent("popstate",{state:history.state}));}',path)
        def release():
            for request,response in fault['held']:
                request.fulfill(response=response)
            fault['held'].clear()
        def wait_held():
            end=time.monotonic()+10
            while not fault['held'] and time.monotonic()<end: page.wait_for_timeout(50)
            if not fault['held']: raise AssertionError('Expected real upstream response was not held.')
        def logout():
            page.get_by_role('button',name='Logout',exact=True).click()
            page.wait_for_url('**/login')
        def detail_gets(resource,pk):
            return sum(row['path']==f'/api/{resource}/{pk}/' and row['method']=='GET' for row in result['requests'])
        login()
        go('/ingredients')
        expect(page.get_by_text('Cache ingredient 01',exact=True).first).to_be_visible()
        edit('Cache ingredient 01')
        if not BEFORE: expect(page.locator('input[name="name"]')).to_have_value('Cache ingredient 01')
        check('ingredient_page1_to_id1',page.locator('input[name="name"]').input_value(),'Cache ingredient 01')
        shot('01-ingredient-id1')
        nav('/ingredients')
        expect(page.get_by_text('Cache ingredient 01',exact=True).first).to_be_visible()
        check('ingredient_detail_to_list',page.get_by_role('row').count(),21)
        page.get_by_role('button',name='Next page',exact=True).click()
        expect(page.get_by_text('Z Cache ingredient 02',exact=True).first).to_be_visible()
        edit('Z Cache ingredient 02')
        if not BEFORE: expect(page.locator('input[name="name"]')).to_have_value('Z Cache ingredient 02')
        check('ingredient_page2_to_id2',page.locator('input[name="name"]').input_value(),'Z Cache ingredient 02')
        shot('02-ingredient-id2')
        go('/recipes')
        expect(page.get_by_text('Cache product 01',exact=True).first).to_be_visible()
        edit('Cache product 01 recipe')
        if not BEFORE: expect(page.locator('select[name="product"]')).to_have_value('1')
        check('recipe_page1_to_id1',page.locator('select[name="product"]').input_value(),'1')
        shot('03-recipe-id1')
        if not BEFORE:
            check('recipe_detail_yield_matches',page.locator('input[name="yield_quantity"]').input_value(),'3')
            nav('/recipes')
            expect(page.get_by_text('Cache product 01',exact=True).first).to_be_visible()
            check('recipe_detail_to_list',page.get_by_role('row').count(),21)
            edit('Cache product 01 recipe')
            expect(page.locator('select[name="product"]')).to_have_value('1')
            check('recipe_cached_revisit_keeps_correct_id',page.locator('select[name="product"]').input_value(),'1')
            page.locator('textarea[name="notes"]').fill('UNSAVED-FROM-ONE')
            fault.update(path='/api/recipes/3/',mode='hold')
            spa('/recipes/3/edit')
            wait_held()
            check('record_switch_loading_hides_previous_form',page.locator('form').count(),0)
            check('record_switch_loading_hides_unsaved_text','UNSAVED-FROM-ONE' in page.locator('body').inner_text(),False)
            release()
            expect(page.locator('select[name="product"]')).to_have_value('3')
            check('recipe_switch_1_to_3_matches_requested_id',page.locator('select[name="product"]').input_value(),'3')
            spa('/recipes/1/edit')
            expect(page.locator('select[name="product"]')).to_have_value('1')
            check('recipe_cached_switch_discards_previous_unsaved_form',page.locator('textarea[name="notes"]').input_value(),'')
            fault.update(path='/api/products/?page=1',mode='hold')
            page.reload(wait_until='domcontentloaded')
            wait_held()
            check('reload_waits_for_existing_lookup_options',page.locator('form').count(),0)
            release()
            page.wait_for_load_state('networkidle')
            expect(page.locator('select[name="product"]')).to_have_value('1')
            check('recipe_reload',page.locator('select[name="product"]').input_value(),'1')
            go('/ingredients/1/edit')
            expect(page.locator('input[name="name"]')).to_have_value('Cache ingredient 01')
            check('ingredient_direct_edit',page.locator('input[name="name"]').input_value(),'Cache ingredient 01')
            check('ingredient_stock_remains_readonly',page.locator('input[name="quantity"]').get_attribute('readonly') is not None,True)
            page.locator('input[name="supplier"]').fill('UNSAVED-SUPPLIER')
            spa('/ingredients/2/edit')
            expect(page.locator('input[name="name"]')).to_have_value('Z Cache ingredient 02')
            check('ingredient_switch_1_to_2',page.locator('input[name="supplier"]').input_value(),'PRIVATE-SUPPLIER-02')
            spa('/ingredients/1/edit')
            expect(page.locator('input[name="name"]')).to_have_value('Cache ingredient 01')
            check('ingredient_cached_revisit_discards_unsaved_fields',page.locator('input[name="supplier"]').input_value(),'PRIVATE-SUPPLIER-01')
            before=detail_gets('ingredients',1)
            page.locator('input[name="name"]').fill('Cache ingredient 01 edited')
            with page.expect_response(lambda r:'/api/ingredients/1/' in r.url and r.request.method=='PUT') as saved:
                page.get_by_role('button',name='Update Ingredient',exact=True).click()
            check('ingredient_edit_success',saved.value.status,200)
            page.wait_for_url('**/ingredients')
            expect(page.get_by_text('Cache ingredient 01 edited',exact=True).first).to_be_visible()
            edit('Cache ingredient 01 edited')
            expect(page.locator('input[name="name"]')).to_have_value('Cache ingredient 01 edited')
            check('ingredient_update_invalidates_detail',detail_gets('ingredients',1)>before,True)
            check('ingredient_update_revisit_value',page.locator('input[name="name"]').input_value(),'Cache ingredient 01 edited')
            page.reload();page.wait_for_load_state('networkidle')
            expect(page.locator('input[name="name"]')).to_have_value('Cache ingredient 01 edited')
            check('ingredient_reload_after_save',page.locator('input[name="name"]').input_value(),'Cache ingredient 01 edited')
            go('/recipes/1/edit')
            expect(page.locator('select[name="product"]')).to_have_value('1')
            before=detail_gets('recipes',1)
            page.locator('input[name="yield_quantity"]').fill('6')
            page.locator('textarea[name="notes"]').fill('RECIPE-EDITED')
            with page.expect_response(lambda r:'/api/recipes/1/' in r.url and r.request.method=='PUT') as saved:
                page.get_by_role('button',name='Update Recipe',exact=True).click()
            check('recipe_edit_success',saved.value.status,200)
            page.wait_for_url('**/recipes')
            expect(page.get_by_role('row').filter(has_text='Cache product 01').first).to_contain_text('6 units')
            edit('Cache product 01 recipe')
            expect(page.locator('textarea[name="notes"]')).to_have_value('RECIPE-EDITED')
            check('recipe_update_invalidates_detail',detail_gets('recipes',1)>before,True)
            check('recipe_update_revisit_yield',page.locator('input[name="yield_quantity"]').input_value(),'6')
            # Missing records, invalid IDs and data/query faults: real server
            # authorization still runs; only selected GET responses are delayed
            # or faulted, never an authentication/permission implementation.
            for resource in ['ingredients','recipes']:
                go(f'/{resource}/99999/edit')
                expect(page.get_by_role('alert')).to_contain_text('not found')
                check(resource+'_missing_record_no_form',page.locator('form').count(),0)
                shot('missing-'+resource)
                before=detail_gets(resource,0)
                go(f'/{resource}/0/edit')
                expect(page.get_by_role('alert')).to_contain_text('Invalid')
                check(resource+'_invalid_id_no_fetch',detail_gets(resource,0),before)
                check(resource+'_invalid_id_no_form',page.locator('form').count(),0)
                go(f'/{resource}/9007199254740992/edit')
                expect(page.get_by_role('alert')).to_contain_text('Invalid')
                check(resource+'_unsafe_integer_id_no_form',page.locator('form').count(),0)
                fault.update(path=f'/api/{resource}/3/',mode='error')
                go(f'/{resource}/3/edit')
                expect(page.get_by_role('alert')).to_contain_text('Unable to load')
                check(resource+'_query_error_no_form',page.locator('form').count(),0)
                page.get_by_role('button',name='Retry loading',exact=True).click()
                expect(page.locator('form')).to_be_visible()
                check(resource+'_retry_recovers_requested_record',page.locator('input[name="name"]' if resource=='ingredients' else 'select[name="product"]').input_value(), 'Cache ingredient 03' if resource=='ingredients' else '3')
                fault.update(path=f'/api/{resource}/4/',mode='wrong-id')
                go(f'/{resource}/4/edit')
                expect(page.get_by_role('alert')).to_contain_text('Unable to load')
                check(resource+'_wrong_response_id_no_form',page.locator('form').count(),0)
            # Create/delete invalidate the new root-compatible query families.
            go('/ingredients/new')
            page.locator('input[name="name"]').fill('A Fresh cache ingredient')
            page.locator('input[name="quantity"]').fill('0')
            page.locator('select[name="unit"]').select_option('kg')
            page.locator('input[name="cost_per_unit"]').fill('1')
            page.locator('input[name="minimum_stock"]').fill('0')
            with page.expect_response(lambda r:r.url==FRONT+'/api/ingredients/' and r.request.method=='POST') as saved:
                page.get_by_role('button',name='Add Ingredient',exact=True).click()
            check('ingredient_create_success',saved.value.status,201)
            created=saved.value.json()['data']['id']
            page.wait_for_url('**/ingredients')
            expect(page.get_by_text('A Fresh cache ingredient',exact=True).first).to_be_visible()
            check('ingredient_create_refreshes_list',page.get_by_text('A Fresh cache ingredient',exact=True).count()>0,True)
            edit('A Fresh cache ingredient')
            expect(page.locator('input[name="name"]')).to_have_value('A Fresh cache ingredient')
            nav('/ingredients')
            page.get_by_role('button',name='Actions for A Fresh cache ingredient',exact=True).click()
            page.get_by_role('button',name='Delete',exact=True).click()
            with page.expect_response(lambda r:r.url==FRONT+f'/api/ingredients/{created}/' and r.request.method=='DELETE') as saved:
                page.get_by_role('alertdialog').get_by_role('button',name='Delete',exact=True).click()
            check('ingredient_delete_success',saved.value.status,200)
            expect(page.get_by_text('A Fresh cache ingredient',exact=True)).to_have_count(0)
            spa(f'/ingredients/{created}/edit')
            expect(page.get_by_role('alert')).to_contain_text('not found')
            check('ingredient_deleted_cached_detail_not_displayed',page.locator('form').count(),0)
            go('/recipes')
            edit('Cache product 03 recipe')
            expect(page.locator('select[name="product"]')).to_have_value('3')
            nav('/recipes')
            page.get_by_role('button',name='Actions for Cache product 03 recipe',exact=True).click()
            page.get_by_role('button',name='Delete',exact=True).click()
            with page.expect_response(lambda r:r.url==FRONT+'/api/recipes/3/' and r.request.method=='DELETE') as saved:
                page.get_by_role('alertdialog').get_by_role('button',name='Delete',exact=True).click()
            check('recipe_delete_success',saved.value.status,200)
            expect(page.get_by_role('row').filter(has_text='Cache product 03')).to_have_count(0)
            spa('/recipes/3/edit')
            expect(page.get_by_role('alert')).to_contain_text('not found')
            check('recipe_deleted_cached_detail_not_displayed',page.locator('form').count(),0)
            go('/recipes/new')
            page.locator('select[name="product"]').select_option('3')
            page.locator('input[name="yield_quantity"]').fill('3')
            page.get_by_role('button',name='Add Row',exact=True).click()
            page.locator('select[name="recipe_ingredients.0.ingredient"]').select_option('3')
            page.locator('input[name="recipe_ingredients.0.quantity"]').fill('.01')
            with page.expect_response(lambda r:r.url==FRONT+'/api/recipes/' and r.request.method=='POST') as saved:
                page.get_by_role('button',name='Add Recipe',exact=True).click()
            check('recipe_create_success',saved.value.status,201)
            page.wait_for_url('**/recipes')
            page.wait_for_load_state('networkidle')
            expect(page.get_by_role('button',name='Next page',exact=True)).to_be_visible()
            # Recipe ordering is an existing, separately tracked F02 risk.
            # Verify the created row across normal pages, not a guessed page.
            if page.get_by_role('row').filter(has_text='Cache product 03').count()==0:
                page.get_by_role('button',name='Next page',exact=True).click()
            expect(page.get_by_role('row').filter(has_text='Cache product 03')).to_be_visible()
            check('recipe_create_refreshes_list',page.get_by_role('row').filter(has_text='Cache product 03').count(),1)
            # Hold an actually authorized owner response across logout/login.
            go('/ingredients')
            fault.update(path='/api/ingredients/5/',mode='hold')
            page.get_by_role('button',name='Actions for Cache ingredient 05',exact=True).click()
            page.get_by_role('button',name='Edit',exact=True).click()
            wait_held()
            logout()
            check('logout_hides_private_form_while_owner_response_pending',page.locator('input[name="supplier"]').count(),0)
            release()
            staff_start=len(result['requests'])
            login('staff','staff',direct=False)
            nav('/ingredients')
            expect(page.get_by_text('Cache ingredient 01 edited',exact=True)).to_be_visible()
            staff_lists=[row for row in result['requests'][staff_start:] if row['path']=='/api/ingredients/?page=1' and row['status']==200]
            check('staff_fetches_fresh_role_safe_projection',bool(staff_lists) and all('supplier' not in row.get('fields',[]) and 'cost_per_unit' not in row.get('fields',[]) for row in staff_lists),True)
            check('staff_has_no_owner_suppliers','PRIVATE-SUPPLIER' in page.locator('body').inner_text(),False)
            check('staff_has_no_owner_edit_buttons',page.get_by_role('button',name='Actions for Cache ingredient 05',exact=True).count(),0)
            before=business_state()
            denial=page.evaluate('''async()=>{const b=await (await fetch('/api/auth/csrf/',{credentials:'same-origin'})).json();return (await fetch('/api/ingredients/1/',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':b.data.csrf_token},body:JSON.stringify({supplier:'UNAUTHORIZED'})})).status}''')
            check('staff_write_denied_with_real_csrf',denial,403)
            check('staff_denial_zero_business_mutations',business_state()==before,True)
            spa('/recipes/1/edit')
            expect(page.get_by_role('alert')).to_contain_text('Access restricted')
            check('staff_cannot_render_cached_recipe_edit',page.locator('form').count(),0)
            shot('04-staff-restricted')
            page.get_by_role('link',name='Return to your workspace',exact=True).click()
            page.wait_for_url('**/sales')
            logout()
            spa('/ingredients/1/edit')
            page.wait_for_url('**/login')
            check('anonymous_cannot_render_cached_owner_fields',page.locator('input[name="supplier"]').count(),0)
            login('other-owner',direct=False)
            spa('/ingredients/1/edit')
            expect(page.locator('input[name="supplier"]')).to_have_value('PRIVATE-SUPPLIER-01')
            check('other_owner_loads_authorized_detail',page.locator('input[name="name"]').input_value(),'Cache ingredient 01 edited')
            logout();login(direct=False)
            nav('/ingredients')
            expect(page.get_by_text('PRIVATE-SUPPLIER-01',exact=True).first).to_be_visible()
            db(lambda:User.objects.filter(username='cache-owner').update(role='staff'))
            with page.expect_response(lambda r:'/api/auth/me/' in r.url and r.status==401):
                page.evaluate('window.dispatchEvent(new Event("visibilitychange"))')
            page.wait_for_url('**/login')
            check('role_demotion_authority_recheck_hides_owner_data','PRIVATE-SUPPLIER' in page.locator('body').inner_text(),False)
            login('owner','staff',direct=False)
            nav('/ingredients')
            expect(page.get_by_text('Cache ingredient 01 edited',exact=True)).to_be_visible()
            check('same_actor_new_staff_role_no_owner_data','PRIVATE-SUPPLIER' in page.locator('body').inner_text(),False)
            shot('05-demoted-owner-stock')
            check('no_page_script_errors',result['page_errors'],[])
        browser.close()
except Exception as error:
    result['harness_failure']={'type':type(error).__name__,'message':str(error),'traceback':traceback.format_exc()}
    raise
finally:
    for child in reversed(servers):
        child.terminate()
        try: child.wait(timeout=10)
        except subprocess.TimeoutExpired: child.kill();child.wait(timeout=5)
    for log in logs: log.close()
    result['servers_stopped']=all(child.poll() is not None for child in servers)
    OUTPUT.write_text(json.dumps(result,indent=2),encoding='utf-8')
if not BEFORE and any(not row['passed'] for row in result['observations'].values()):
    raise SystemExit(1)
