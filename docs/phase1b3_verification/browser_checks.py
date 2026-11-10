"""Real Edge tabs, React service/Web Locks, Django and owned PostgreSQL only."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
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
import unittest
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=Path(os.environ['ROWSZEIN_VERIFY_RESULTS'])
FOLDER=OUTPUT.parent
RUNTIME=Path(os.environ['ROWSZEIN_VERIFY_MARKER']).parent
FRONT,BACK='http://127.0.0.1:18841','http://127.0.0.1:18842'
password=secrets.token_urlsafe(40)
env=dict(os.environ,ROWSZEIN_BROWSER_PASSWORD=password)
servers=[];logs=[]
result={'checks':{},'business_requests':[],'auth_requests':[],'screenshots':[],'external_requests_blocked':[],
    'page_errors':[],'real_tabs':True,'real_web_locks':True,'no_authenticator_mock':True}

def check(name,value):
    result['checks'][name]=bool(value)
    if not value: raise AssertionError(name)
    print('PASS '+name,flush=True)

def launch(command,cwd,port,name,child_env):
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1',port))==0: raise RuntimeError('Occupied browser verification port.')
    log=(FOLDER/(name+'.txt')).open('w',encoding='utf-8');logs.append(log)
    process=subprocess.Popen(command,cwd=cwd,env=child_env,stdout=log,stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    servers.append(process)
    end=time.monotonic()+45
    while time.monotonic()<end:
        if process.poll() is not None: raise RuntimeError(name+' exited')
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1',port))==0: return
        time.sleep(.1)
    raise RuntimeError(name+' startup timeout')

def db(action):
    from django.db import connections
    def work():
        try: return action()
        finally: connections.close_all()
    with ThreadPoolExecutor(max_workers=1) as worker: return worker.submit(work).result()

try:
    launch([sys.executable,'-B',str(Path(__file__).with_name('serve_browser_backend.py'))],ROOT,18842,'browser-backend',env)
    import django
    django.setup()
    from accounts.models import User,DeviceSession
    from accounts import session_tokens
    from accounts.session_database import database_time,lock_users
    from accounts.session_policy import ABSOLUTE,jti_digest,numeric_date
    from django.conf import settings
    from django.db import transaction
    from sales.models import Sale,InventoryOperation,StockMovement,SaleFinancialEntry
    from sales.test_verification_extended import assert_reconciled
    empty=RUNTIME/'empty-env';empty.mkdir()
    config={'root':str(ROOT/'frontend').replace('\\','/'),'envDir':str(empty).replace('\\','/'),
        'server':{'host':'127.0.0.1','port':18841,'strictPort':True,'proxy':{'/api':{'target':BACK,'changeOrigin':True}}}}
    vite=RUNTIME/'vite.verify.mjs'
    vite.write_text('import base from '+json.dumps(str(ROOT/'frontend/vite.config.ts').replace('\\','/'))+';\nexport default {...base,...'+json.dumps(config)+'};',encoding='utf-8')
    front_env={key:value for key,value in env.items() if not key.startswith(('ROWSZEIN_','DJANGO_','DATABASE','DB_','SECRET','AUTH_','CSRF_','SESSION_'))}
    launch([shutil.which('node'),str(ROOT/'frontend/node_modules/vite/bin/vite.js'),'--config',str(vite)],ROOT/'frontend',18841,'browser-frontend',front_env)
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(channel='msedge',headless=True)
        context=browser.new_context(viewport={'width':1440,'height':1000})
        lose={'sale':True,'stock':True}
        def route(request_route):
            request=request_route.request
            if not request.url.startswith((FRONT+'/',BACK+'/','data:','blob:')):
                result['external_requests_blocked'].append(request.url);request_route.abort();return
            if request.url.startswith(FRONT+'/api/') and request.method in ['POST','PATCH','DELETE','PUT']:
                path=request.url.removeprefix(FRONT)
                if '/auth/' in path:
                    result['auth_requests'].append({'path':path,'method':request.method})
                    request_route.continue_();return
                entry={'path':path,'method':request.method,'uuid':request.headers.get('idempotency-key'),
                    'revision':request.headers.get('if-match'),'body':request.post_data_json}
                response=request_route.fetch();entry.update(status=response.status,replayed=response.headers.get('idempotency-replayed'))
                result['business_requests'].append(entry)
                if lose['sale'] and path=='/api/sales/' and request.method=='POST' and response.status==201:
                    lose['sale']=False;entry['response_lost']=True;request_route.abort('connectionreset')
                elif lose['stock'] and path.endswith('/adjustments/') and response.status==200:
                    lose['stock']=False;entry['response_lost']=True;request_route.abort('connectionreset')
                else: request_route.fulfill(response=response)
            else: request_route.continue_()
        context.route('**/*',route)
        page=context.new_page()
        page.on('pageerror',lambda error:result['page_errors'].append(str(error)))
        def go(path): page.bring_to_front();page.goto(FRONT+path);page.wait_for_load_state('networkidle')
        def shot(name):
            page.bring_to_front();page.screenshot(path=str(FOLDER/(name+'.png')),full_page=True,animations='disabled');result['screenshots'].append(name+'.png')
        def login(name='owner',secret=None):
            go('/login')
            page.locator('input[name="username"]').fill('disposable-browser-'+name)
            page.locator('input[name="password"]').fill(secret or password)
            page.get_by_role('button',name='Sign in',exact=True).click()
            page.wait_for_url('**/'+('dashboard' if name=='owner' else 'sales'))
            page.wait_for_load_state('networkidle')
        def cookie(name): return next(item['value'] for item in context.cookies() if item['name']==name)
        def api(path): return context.request.get(FRONT+'/api/'+path)
        def claims(): return session_tokens.decode(cookie('access_token'),'access',allow_expired=True)
        def counts(): return db(lambda:[model.objects.count() for model in (Sale,InventoryOperation,StockMovement,SaleFinancialEntry)])
        def wait_business(total):
            end=time.monotonic()+10
            while len(result['business_requests'])<total and time.monotonic()<end:
                page.wait_for_timeout(50)  # Pump real route/response callbacks.
            if len(result['business_requests'])<total: raise AssertionError('Expected business response was not observed.')
        def fill_sale():
            go('/sales/new')
            result['sale_form_dom']=page.locator('input,select,button').evaluate_all('els=>els.map(e=>({tag:e.tagName,name:e.name,text:e.tagName==="BUTTON"?e.innerText:undefined}))')
            page.get_by_role('button',name='Add Item',exact=True).click()
            product=context.request.get(FRONT+'/api/products/').json()['data']['results'][0]
            page.locator('input[name="date"]').fill('2026-11-09')
            page.locator('select[name="sale_items.0.product"]').select_option(str(product['id']))
            page.locator('input[name="sale_items.0.quantity"]').fill('1')
            page.locator('input[name="sale_items.0.unit_price"]').fill('50.00')
        login()
        check('real_owner_cookie_login',api('auth/me/').status==200)
        first_claims=claims()
        check('access_lifetime_exactly_900_seconds',first_claims['exp']-first_claims['iat']==900)
        check('jwt_cookies_httponly',all(item['httpOnly'] for item in context.cookies() if item['name'] in ['access_token','refresh_token','device_session']))
        check('web_locks_available',page.evaluate('Boolean(navigator.locks)'))
        shot('01-owner')
        fill_sale();page.get_by_role('button',name='Record Sale',exact=True).click()
        wait_business(1)
        check('lost_committed_response_recorded',len(result['business_requests'])==1 and result['business_requests'][0].get('response_lost'))
        before=counts();check('one_sale_after_lost_response',before==[1,1,2,1])
        time.sleep(1.2)
        import jwt
        payload=claims()
        payload['exp']=int(time.time())-1
        check('expired_token_fixture_has_valid_chronology',payload['exp']>payload['iat'])
        expired=jwt.encode(payload,settings.AUTH_SESSION_SIGNING_KEY,algorithm='HS256')
        context.add_cookies([{'name':'access_token','value':expired,'domain':'127.0.0.1','path':'/','httpOnly':True,'sameSite':'Lax'}])
        auth_before=len(result['auth_requests'])
        page.get_by_role('button',name='Record Sale',exact=True).click();wait_business(2)
        check('uncertain_sale_401_has_no_automatic_refresh',not any(item['path'].endswith('/refresh/') for item in result['auth_requests'][auth_before:]))
        check('unauthorized_retry_has_zero_business_writes',counts()==before)
        go('/login');page.get_by_role('button',name='Renew an existing session',exact=True).click()
        page.wait_for_url('**/dashboard');page.wait_for_load_state('networkidle')
        fill_sale();page.get_by_role('button',name='Record Sale',exact=True).click();page.wait_for_url('**/sales');page.wait_for_load_state('networkidle')
        operations=result['business_requests']
        check('explicit_renewal_preserves_exact_pending_uuid_and_body',len(operations)==3 and len({item['uuid'] for item in operations})==1 and operations[0]['body']==operations[1]['body']==operations[2]['body'])
        check('historical_success_replayed_once',operations[-1]['replayed']=='true' and counts()==before)
        check('full_financial_inventory_reconciliation',db(lambda:assert_reconciled(unittest.TestCase())) is None)
        # Real simultaneous JS realms queue the actual app service behind an
        # actual Web Lock; no coordinator or authentication result is mocked.
        tab=context.new_page();tab.goto(FRONT+'/sales');tab.wait_for_load_state('networkidle')
        sid=claims()['sid'];generation=db(lambda:DeviceSession.objects.get(pk=sid).refresh_generation)
        page.evaluate('''() => { window.held=false; window.gate=new Promise(r=>window.release=r); navigator.locks.request("rowszein-auth-lifecycle-v2",async()=>{window.held=true;await window.gate;}); }''')
        page.wait_for_function('window.held===true')
        script='''() => { window.finished=false; window.failed=false; import('/src/services/auth.services.ts').then(m=>m.authService.refresh()).then(()=>window.finished=true).catch(()=>{window.failed=true;window.finished=true;}); }'''
        page.evaluate(script);tab.evaluate(script);page.evaluate('window.release()')
        page.wait_for_function('window.finished');tab.wait_for_function('window.finished')
        check('actual_simultaneous_tabs_rotate_without_reuse',not page.evaluate('window.failed') and not tab.evaluate('window.failed') and db(lambda:DeviceSession.objects.get(pk=sid).refresh_generation)==generation+2)
        check('family_remains_active_after_tabs',db(lambda:DeviceSession.objects.get(pk=sid).revoked_at) is None)
        tab.close();page.bring_to_front()
        def fill_stock():
            go('/ingredients')
            page.get_by_role('button',name='Actions for Verification flour',exact=True).click()
            page.get_by_role('button',name='Update Stock',exact=True).click()
            dialog=page.get_by_role('dialog',name='Update Stock')
            dialog.get_by_placeholder('0',exact=True).fill('0.000000001')
            dialog.locator('textarea').fill('Controlled session stock retry')
            return dialog
        dialog=fill_stock();dialog.get_by_role('button',name='Save',exact=True).click();wait_business(4)
        before_stock=counts();check('uncertain_stock_committed_once',before_stock==[1,2,3,1])
        payload=claims();payload['exp']=int(time.time())-1
        expired=jwt.encode(payload,settings.AUTH_SESSION_SIGNING_KEY,algorithm='HS256')
        context.add_cookies([{'name':'access_token','value':expired,'domain':'127.0.0.1','path':'/','httpOnly':True,'sameSite':'Lax'}])
        go('/login')
        page.route('**/api/auth/refresh/',lambda route:route.fulfill(status=503,content_type='application/json',body=json.dumps({'success':False,'error':{'code':'auth_unavailable','message':'Controlled refresh outage'}})))
        dispatched=len(result['business_requests'])
        page.get_by_role('button',name='Renew an existing session',exact=True).click()
        expect(page.get_by_text('Session renewal was not confirmed.',exact=False)).to_be_visible()
        check('refresh_failure_does_not_replay_uncertain_stock',len(result['business_requests'])==dispatched and counts()==before_stock)
        page.unroute('**/api/auth/refresh/')
        login();dialog=fill_stock();dialog.get_by_role('button',name='Save',exact=True).click();expect(dialog).to_be_hidden()
        adjustments=[item for item in result['business_requests'] if item['path'].endswith('/adjustments/')]
        check('stock_reauthentication_preserves_uuid_revision_and_body',len(adjustments)==2 and adjustments[0]['uuid']==adjustments[1]['uuid']
            and adjustments[0]['revision']==adjustments[1]['revision'] and adjustments[0]['body']==adjustments[1]['body'])
        check('stock_replay_does_not_repeat_adjustment',adjustments[-1]['replayed']=='true' and counts()==before_stock)
        check('stock_retry_financial_inventory_reconciliation',db(lambda:assert_reconciled(unittest.TestCase())) is None)
        shot('02-stock-retry')
        # Simulate an unavailable response at the UI boundary; real persistence
        # failure is separately exercised with PostgreSQL denied permissions.
        page.route('**/api/auth/logout/',lambda route:route.fulfill(status=503,content_type='application/json',body=json.dumps({'success':False,'error':{'code':'auth_unavailable','message':'Controlled unavailable response'}})))
        page.get_by_role('button',name='Logout',exact=True).click()
        expect(page.get_by_text('Logout not confirmed.',exact=False)).to_be_visible()
        shot('02-pending-logout')
        check('failed_logout_honest_ui_and_live_session',api('auth/me/').status==200)
        page.unroute('**/api/auth/logout/')
        copied=cookie('access_token')
        page.get_by_role('button',name='Logout',exact=True).click();page.wait_for_url('**/login');page.wait_for_load_state('networkidle')
        check('logout_copied_access_rejected',context.request.get(FRONT+'/api/auth/me/',headers={'Cookie':'access_token='+copied}).status==401)
        login('staff');go('/ingredients')
        expect(page.get_by_role('heading',name='Stock quantities',exact=True)).to_be_visible()
        expect(page.get_by_role('cell',name='Verification flour',exact=True)).to_be_visible()
        check('staff_operational_stock_page_renders',True)
        check('staff_private_navigation_hidden',page.get_by_role('link',name='Expenses',exact=True).count()==0)
        stock=api('ingredients/').json()['data']['results']
        check('staff_stock_fields_safe',all(set(item)=={'id','name','quantity','unit','is_low_stock'} for item in stock))
        shot('03-staff')
        go('/sales/new');page.get_by_role('button',name='Add Item',exact=True).click()
        check('staff_business_date_readonly',page.locator('input[name="date"]').get_attribute('readonly') is not None)
        check('staff_unit_price_readonly',page.locator('input[name="sale_items.0.unit_price"]').get_attribute('readonly') is not None)
        go('/expenses')
        expect(page.get_by_role('heading',name='Access restricted',exact=True)).to_be_visible()
        check('staff_financial_ui_access_restricted',api('expenses/').status==403)
        page.get_by_role('link',name='Return to your workspace',exact=True).click();page.wait_for_url('**/sales')
        page.get_by_role('button',name='Logout',exact=True).click();page.wait_for_url('**/login')
        login()
        db(lambda:User.objects.filter(username='disposable-browser-owner').update(role='staff'))
        check('role_downgrade_revokes_live_browser',api('auth/me/').status==401)
        go('/sales');page.wait_for_url('**/login')
        db(lambda:User.objects.filter(username='disposable-browser-owner').update(role='admin'))
        login()
        new_password=secrets.token_urlsafe(40)
        def change_password():
            user=User.objects.get(username='disposable-browser-owner');user.set_password(new_password);user.save(update_fields=['password'])
        db(change_password)
        check('password_change_revokes_browser_cookie',api('auth/me/').status==401)
        go('/sales');page.wait_for_url('**/login');login(secret=new_password)
        # Auth polling/bootstrap must not renew the current DB activity time.
        sid=claims()['sid'];activity=db(lambda:DeviceSession.objects.get(pk=sid).last_activity_at)
        api('auth/me/');api('auth/csrf/')
        check('authentication_polling_does_not_renew_idle',db(lambda:DeviceSession.objects.get(pk=sid).last_activity_at)==activity)
        def expired_family(kind):
            with transaction.atomic():
                user=User.objects.get(username='disposable-browser-owner');lock_users([user.pk]);now=database_time()
                created=now-(timedelta(minutes=31) if kind=='idle' else timedelta(hours=8,seconds=1))
                activity=created if kind=='idle' else now-timedelta(minutes=1)
                jti=secrets.token_urlsafe(32)
                row=DeviceSession.objects.create(user=user,user_epoch=user.session_epoch,created_at=created,last_activity_at=activity,
                    absolute_expires_at=created+ABSOLUTE,refresh_jti_hash=jti_digest(jti))
                return session_tokens.pair(row,created,jti)
        for kind in ['idle','absolute']:
            values=db(lambda:expired_family(kind))
            context.add_cookies([{'name':name,'value':values[key],'domain':'127.0.0.1','path':'/','httpOnly':True,'sameSite':'Lax'} for key,name in [('access','access_token'),('refresh','refresh_token'),('locator','device_session')]])
            go('/sales');page.wait_for_url('**/login')
            before=counts();page.get_by_role('button',name='Renew an existing session',exact=True).click()
            expect(page.get_by_text('Session renewal was not confirmed.',exact=False)).to_be_visible()
            check(kind+'_expiry_denies_refresh_without_business_replay',counts()==before)
        check('no_page_script_errors',not result['page_errors'])
        shot('04-expired-session')
        browser.close()
except Exception as error:
    result['failure']={'type':type(error).__name__,'message':str(error),'traceback':traceback.format_exc()}
    raise
finally:
    for process in reversed(servers):
        process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
    for log in logs: log.close()
    result['servers_stopped']=all(process.poll() is not None for process in servers)
    OUTPUT.write_text(json.dumps(result,default=str,indent=2),encoding='utf-8')
