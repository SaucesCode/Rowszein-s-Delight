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
            if r.request.method=='GET' and r.status==200 and any(path in r.url for path in ['/api/ingredients/?','/api/products/?','/api/products/categories/?']):
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
        if not BEFORE:
            from browser_scenarios import verify
            verify(page,int(os.environ['ROWSZEIN_FIXTURE_COUNT']),go=go,nav=nav,check=check,shot=shot,login=login,logout=logout,
                edit=edit,db=db,fault=fault,wait_held=wait_held,release=release,result=result)
            browser.close()
            raise SystemExit(0 if all(row['passed'] for row in result['observations'].values()) else 1)
        login()
        go('/ingredients')
        expect(page.get_by_text('Cache ingredient 01',exact=True).first).to_be_visible()
        page.get_by_role('textbox',name='Search ingredients').fill('Cache ingredient 25')
        check('off_page_management_search',page.get_by_text('Cache ingredient 25',exact=True).count()>0,True)
        shot('before-search')
        go('/recipes/25/edit')
        expect(page.locator('select[name="product"]')).to_be_visible()
        check('off_page_selected_product',page.locator('select[name="product"]').input_value(),'25')
        shot('before-selected')
        go('/sales/new')
        page.get_by_role('button',name='Add Item',exact=True).click()
        check('sale_option25_present',page.locator('select[name="sale_items.0.product"] option[value="25"]').count(),1)
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
