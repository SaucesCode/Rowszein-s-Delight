"""The owner's Orders: list, detail, confirm into a sale, decline, and the 90-day contact clean-up."""
from datetime import date, timedelta
from decimal import Decimal
from io import StringIO
from uuid import uuid4

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from accounts.session_fixtures import SessionClient
from ingredients.models import Ingredient
from products.models import AssortmentItem, BoxSize, Product
from recipes.models import Recipe, RecipeIngredient
from sales.models import Sale
from shop.models import ShopSettings

from ..models import OnlineOrder, OrderEmail
from ..owner import clear_old_contacts
from .test_place import OrderFixture

MANAGE = '/api/orders/manage/'


class OwnerFixture(OrderFixture):
    def setUp(self):
        super().setUp()
        self.owner_user = User.objects.create_user(username='orders-owner', role='admin')
        self.owner = SessionClient()
        self.owner.force_authenticate(self.owner_user)
        self.flour = Ingredient.objects.create(name='Order flour', quantity='100', unit='kg', cost_per_unit='60')
        for product in (self.glazed, self.ube):
            recipe = Recipe.objects.create(product=product, yield_quantity=1)
            RecipeIngredient.objects.create(recipe=recipe, ingredient=self.flour, quantity='1')

    def placed(self, **changes) -> OnlineOrder:
        response = self.place(**changes)
        self.assertEqual(response.status_code, 201, response.content)
        return OnlineOrder.objects.get(number=response.json()['data']['number'])

    def confirm(self, order):
        return self.owner.post(f'{MANAGE}{order.pk}/confirm/', {}, format='json')


class OwnerAccessTests(OwnerFixture, TestCase):
    def test_only_the_owner_can_manage_orders(self):
        order = self.placed()
        staff = APIClient()
        staff.force_authenticate(User.objects.create_user(username='orders-staff', role='staff'))
        for client in (staff, APIClient()):
            self.assertIn(client.get(MANAGE).status_code, (401, 403))
            self.assertIn(client.get(f'{MANAGE}{order.pk}/').status_code, (401, 403))
            self.assertIn(client.post(f'{MANAGE}{order.pk}/confirm/', {}, format='json').status_code, (401, 403))
            self.assertIn(client.post(f'{MANAGE}{order.pk}/decline/', {'message': 'No'}, format='json').status_code, (401, 403))


class ConfirmTests(OwnerFixture, TestCase):
    def test_confirm_records_the_sale_from_the_snapshot(self):
        order = self.placed()
        Product.objects.filter(pk=self.glazed.pk).update(price=Decimal('99.00'))
        BoxSize.objects.filter(pk=self.box6.pk).update(price=Decimal('999.00'))
        response = self.confirm(order)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['data']['status'], 'confirmed')
        order.refresh_from_db()
        sale = order.sale
        self.assertEqual(sale.date, date(2026, 11, 18))
        self.assertTrue(sale.notes.startswith(f'Online order {order.number}, Ana Cruz, Lucena City'))
        self.assertIn('delivery fee: to confirm', sale.notes)
        self.assertEqual(sale.total_amount, Decimal('285.00'))  # 2 x 35 + box 215, as the customer saw
        self.assertEqual(sale.current_boxes[0]['price'], '215.00')
        self.flour.refresh_from_db()
        self.assertEqual(self.flour.quantity, Decimal('92'))  # 2 + 3 glazed + 3 ube, 1 kg each
        self.assertEqual(order.decided_by, self.owner_user)

    def test_ready_made_box_changed_after_ordering_keeps_the_customers_donuts(self):
        order = self.placed(items=[], boxes=[{'assortment': self.ready.id}])
        AssortmentItem.objects.filter(assortment=self.ready).update(product=self.ube)
        self.assertEqual(self.confirm(order).status_code, 200)
        order.refresh_from_db()
        contents = order.sale.current_boxes[0]['contents']
        self.assertEqual([(c['product'], c['quantity']) for c in contents], [(self.glazed.pk, 6)])

    def test_unchanged_ready_made_box_keeps_its_name(self):
        order = self.placed(items=[], boxes=[{'assortment': self.ready.id}])
        self.assertEqual(self.confirm(order).status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.sale.current_boxes[0]['name'], 'Classic six')

    def test_confirm_refused_by_stock_keeps_the_order_waiting(self):
        order = self.placed()
        self.flour.quantity = Decimal('1')
        self.flour.save()
        response = self.confirm(order)
        self.assertIn(response.status_code, (400, 409), response.content)
        self.assertFalse(response.json()['success'])
        order.refresh_from_db()
        self.assertEqual(order.status, 'waiting')
        self.assertEqual(Sale.objects.count(), 0)

    def test_second_confirm_is_a_conflict(self):
        order = self.placed()
        self.assertEqual(self.confirm(order).status_code, 200)
        again = self.confirm(order)
        self.assertEqual(again.status_code, 409)
        self.assertEqual(again.json()['data']['status'], 'confirmed')
        self.assertEqual(Sale.objects.count(), 1)

    def test_cancelled_sale_shows_cancelled(self):
        order = self.placed()
        self.confirm(order)
        order.refresh_from_db()
        sale = order.sale
        cancelled = self.owner.delete(f'/api/sales/{sale.pk}/', {'reason': 'Customer cancelled'}, format='json',
                                      HTTP_IDEMPOTENCY_KEY=str(uuid4()), HTTP_IF_MATCH=f'"{sale.revision}"')
        self.assertEqual(cancelled.status_code, 200, cancelled.content)
        self.assertEqual(self.owner.get(f'{MANAGE}{order.pk}/').json()['data']['status'], 'cancelled')
        self.assertEqual(self.owner.get(MANAGE).json()['data']['results'][0]['status'], 'cancelled')
        self.assertEqual(self.client.get(f'/api/orders/status/{order.token}/').json()['data']['status'], 'cancelled')


class DeclineTests(OwnerFixture, TestCase):
    def test_decline_needs_a_message_and_shows_it(self):
        order = self.placed()
        blank = self.owner.post(f'{MANAGE}{order.pk}/decline/', {'message': ''}, format='json')
        self.assertEqual(blank.status_code, 400)
        self.assertIn('message', blank.json()['error'])
        response = self.owner.post(f'{MANAGE}{order.pk}/decline/', {'message': 'We are fully booked that day.'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        public = self.client.get(f'/api/orders/status/{order.token}/').json()['data']
        self.assertEqual((public['status'], public['owner_message']), ('declined', 'We are fully booked that day.'))
        self.assertEqual(self.confirm(order).status_code, 409)


class ListAndDetailTests(OwnerFixture, TestCase):
    @override_settings(ORDER_EMAIL_INLINE=True)
    def test_list_counts_waiting_and_retries_due_emails(self):
        self.placed()
        declined = self.placed()
        OnlineOrder.objects.filter(pk=declined.pk).update(status='declined')
        OrderEmail.objects.update(status='failed', last_error='TimeoutError',
                                  updated_at=timezone.now() - timedelta(minutes=10))
        ShopSettings.objects.update(order_email='owner@example.com')
        with self.captureOnCommitCallbacks(execute=True):
            response = self.owner.get(MANAGE, {'status': 'waiting'})
        data = response.json()['data']
        self.assertEqual(data['waiting_count'], 1)
        self.assertEqual(data['count'], 1)
        self.assertFalse(data['email_problem'])
        self.assertEqual(set(OrderEmail.objects.values_list('status', flat=True)), {'sent'})

    def test_list_flags_a_missing_email_address(self):
        self.assertTrue(self.owner.get(MANAGE).json()['data']['email_problem'])

    def test_detail_shows_contact_details_to_the_owner(self):
        order = self.placed(note='Ring twice')
        data = self.owner.get(f'{MANAGE}{order.pk}/').json()['data']
        self.assertEqual((data['phone'], data['address'], data['note']), ('+639171234567', '12 Rizal St, near the chapel', 'Ring twice'))
        self.assertIsNone(data['sale'])
        self.assertEqual(self.owner.get(f'{MANAGE}999999/').status_code, 404)


class ContactCleanupTests(OwnerFixture, TestCase):
    def test_old_contacts_are_cleared(self):
        old, recent = self.placed(), self.placed()
        today = date(2026, 11, 16)
        OnlineOrder.objects.filter(pk=old.pk).update(delivery_date=today - timedelta(days=91))
        OnlineOrder.objects.filter(pk=recent.pk).update(delivery_date=today - timedelta(days=89))
        self.assertEqual(clear_old_contacts(today), 1)
        old.refresh_from_db()
        recent.refresh_from_db()
        self.assertEqual((old.phone, old.address, old.note), ('', '', ''))
        self.assertIsNotNone(old.contact_cleared_at)
        self.assertEqual(old.customer_name, 'Ana Cruz')
        self.assertEqual(recent.phone, '+639171234567')

    def test_command_clears_old_contacts(self):
        order = self.placed()
        OnlineOrder.objects.filter(pk=order.pk).update(delivery_date=timezone.localdate() - timedelta(days=120))
        out = StringIO()
        call_command('clear_old_order_contacts', stdout=out)
        self.assertEqual(out.getvalue().strip(), 'Cleared contact details on 1 order(s).')

