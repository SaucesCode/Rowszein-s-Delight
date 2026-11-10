"""NOT RUN. Versioned original 13 security + 13 role + 26 CSRF assertions.

Original evidence files stay unchanged. Only session fixtures and transaction
isolation change here: real V2 cookies instead of legacy UID tokens, and
TransactionTestCase so the shared limiter can commit independent debit writes.
No automatic-CSRF business adapter is used in these security suites.
"""
from datetime import timedelta
from types import FunctionType
import jwt
from django.conf import settings
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from security_cases import CookieFixture
import security_cases
import csrf_regressions
from accounts.models import User
from accounts import session_tokens
from accounts.session_policy import numeric_date
from products.models import Category, Product
from ingredients.models import Ingredient
from recipes.models import Recipe, RecipeIngredient
from session_api_contracts import TEST_AUTH, bind_fixture, cookie_client


class V2CookieFixture(CookieFixture):
    def setUp(self):
        self.password='isolated-security-fixture-only'
        self.owner=User.objects.create_user(username='audit-owner',password=self.password,role='admin')
        self.staff=User.objects.create_user(username='audit-staff',password=self.password,role='staff')
        _,tokens=bind_fixture(self.owner)
        self.owner_cookie=tokens['access']
        self.owner_client=self.cookie_client(token=self.owner_cookie)
        self.staff_client=self.cookie_client(self.staff)
        category=Category.objects.create(name='Security fixture',slug='security-fixture')
        self.product=Product.objects.create(name='Security fixture product',category=category,price='50')
        self.ingredient=Ingredient.objects.create(name='Security fixture ingredient',quantity='100',unit='kg',cost_per_unit='1')
        self.recipe=Recipe.objects.create(product=self.product,yield_quantity=1)
        RecipeIngredient.objects.create(recipe=self.recipe,ingredient=self.ingredient,quantity='1')
        from uuid import uuid4
        response=self.owner_client.post('/api/sales/',self.sale_payload(),format='json',secure=True,HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(response.status_code,201,'Trusted owner control must succeed before testing denials.')
        self.sale_id=response.data['data']['id']

    def cookie_client(self,user=None,token=None,csrf=True,origin='https://testserver'):
        tokens=None
        if user is not None:
            _,tokens=bind_fixture(user)
        client=cookie_client(tokens,csrf=csrf,origin=origin)
        if token is not None: client.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]=token
        return client

    def expired_client(self):
        _,tokens=bind_fixture(self.owner)
        claims=session_tokens.decode(tokens['access'],'access',allow_expired=True)
        claims['iat']=numeric_date(timezone.now()-timedelta(hours=2))
        claims['exp']=claims['iat']+60
        tokens['access']=jwt.encode(claims,settings.AUTH_SESSION_SIGNING_KEY,algorithm='HS256')
        return cookie_client(tokens)


def version(original,name):
    methods={key:value for key,value in original.__dict__.items() if isinstance(value,FunctionType)}
    methods['__module__']=__name__
    return override_settings(**TEST_AUTH)(type(name,(V2CookieFixture,TransactionTestCase),methods))


OriginalSecurity13=version(security_cases.DesiredSecurityContracts,'OriginalSecurity13')
OriginalRoles13=version(security_cases.ProposedRoleContracts,'OriginalRoles13')
CSRFRegression24=version(csrf_regressions.CSRFRegressionTests,'CSRFRegression24')
SecurityTransportUnitTests=csrf_regressions.SecurityTransportUnitTests
