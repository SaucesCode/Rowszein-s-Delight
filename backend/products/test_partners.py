from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from recipes.models import Recipe

from .models import Assortment, AssortmentItem, BoxSize, Category, Partner, PartnerPayment, Product


class PartnerFixture:
    def setUp(self):
        self.owner_user = User.objects.create_user(username='partner-owner', role='admin')
        self.category = Category.objects.create(slug='partner-test', name='Partner test')
        self.kape = Partner.objects.create(name='Kape Lokal', blurb='Muffins from Marikina',
                                           contact='0917 000 0000', notes='Delivers Fridays')
        self.owner = APIClient()
        self.owner.force_authenticate(self.owner_user)
        self.staff = APIClient()
        self.staff.force_authenticate(User.objects.create_user(username='partner-staff', role='staff'))
        self.anonymous = APIClient()

    def partner_item(self, name='Banana muffin', price='60.00', payout='50.00', **extra):
        return Product.objects.create(name=name, price=Decimal(price), category=self.category,
                                      partner=self.kape, partner_payout=Decimal(payout), **extra)


class PartnerModelTests(PartnerFixture, TestCase):
    def assert_rejected(self, **fields):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Product.objects.create(name='Rejected item', category=self.category, **fields)

    def test_partner_item_needs_a_positive_payout(self):
        self.assert_rejected(price=Decimal('60.00'), partner=self.kape, partner_payout=Decimal('0.00'))

    def test_own_item_has_no_payout(self):
        self.assert_rejected(price=Decimal('60.00'), partner=None, partner_payout=Decimal('5.00'))

    def test_patong_is_never_negative(self):
        self.assert_rejected(price=Decimal('60.00'), partner=self.kape, partner_payout=Decimal('61.00'))

    def test_zero_patong_is_allowed(self):
        item = self.partner_item(price='50.00', payout='50.00')
        self.assertEqual(item.price - item.partner_payout, Decimal('0.00'))

    def test_partner_with_items_cannot_be_deleted(self):
        self.partner_item()
        with self.assertRaises(ProtectedError):
            self.kape.delete()

    def test_payment_amount_must_be_positive(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            PartnerPayment.objects.create(partner=self.kape, date=date(2026, 11, 14), amount=Decimal('0.00'),
                                          recorded_by=self.owner_user)

    def test_voided_payment_needs_a_reason(self):
        payment = PartnerPayment.objects.create(partner=self.kape, date=date(2026, 11, 14), amount=Decimal('100.00'),
                                                recorded_by=self.owner_user)
        payment.voided_at, payment.voided_by = payment.created_at, self.owner_user
        with self.assertRaises(IntegrityError), transaction.atomic():
            payment.save()


def results(response):
    data = response.data['data']
    return data['results'] if isinstance(data, dict) and 'results' in data else data


def messages(errors, field):
    return [str(message) for message in errors[field]]


class PartnerApiTests(PartnerFixture, TestCase):
    def test_owner_creates_and_lists_partners(self):
        created = self.owner.post('/api/products/partners/', {'name': 'Cake Atelier', 'blurb': 'Whole cakes'}, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        listed = {row['name']: row for row in results(self.owner.get('/api/products/partners/'))}
        self.assertEqual(listed['Cake Atelier']['product_count'], 0)
        self.assertEqual(listed['Kape Lokal']['contact'], '0917 000 0000')

    def test_staff_sees_partner_without_contact_or_notes(self):
        row = results(self.staff.get('/api/products/partners/'))[0]
        self.assertEqual(row['name'], 'Kape Lokal')
        self.assertNotIn('contact', row)
        self.assertNotIn('notes', row)

    def test_staff_cannot_create_partner(self):
        response = self.staff.post('/api/products/partners/', {'name': 'Nope'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_deleting_partner_with_items_returns_409(self):
        self.partner_item()
        response = self.owner.delete(f'/api/products/partners/{self.kape.pk}/')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['error'], 'Kape Lokal has items. Switch the partner off instead.')


class PartnerProductTests(PartnerFixture, TestCase):
    def create_item(self, **fields):
        payload = {'name': 'Banana muffin', 'price': '60.00', 'category_id': self.category.pk,
                   'partner_id': self.kape.pk, 'partner_payout': '50.00', 'is_available': True, 'is_featured': False}
        payload.update(fields)
        return self.owner.post('/api/products/', payload, format='json')

    def test_owner_creates_partner_item_with_patong(self):
        response = self.create_item()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['data']['partner']['name'], 'Kape Lokal')
        self.assertEqual(response.data['data']['partner_payout'], '50.00')

    def test_negative_patong_rejected_with_field_message(self):
        response = self.create_item(price='50.00', partner_payout='60.00')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(messages(response.data['error'], 'partner_payout'), ["Your patong can't be less than ₱0."])

    def test_partner_item_requires_payout(self):
        response = self.create_item(partner_payout='0.00')
        self.assertEqual(response.status_code, 400)
        self.assertIn('partner_payout', response.data['error'])

    def test_own_item_cannot_have_payout(self):
        response = self.create_item(partner_id=None, partner_payout='10.00')
        self.assertEqual(response.status_code, 400)
        self.assertIn('partner_payout', response.data['error'])

    def test_partner_item_box_extra_forced_to_zero(self):
        response = self.create_item(box_extra='10.00')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Product.objects.get(name='Banana muffin').box_extra, Decimal('0.00'))

    def test_partner_item_payout_never_in_public_or_staff_product_responses(self):
        self.partner_item()
        for client in (self.anonymous, self.staff):
            rows = results(client.get(f'/api/products/?partner={self.kape.pk}'))
            self.assertEqual([row['name'] for row in rows], ['Banana muffin'])
            self.assertNotIn('partner_payout', rows[0])
            self.assertEqual(rows[0]['partner'], {'id': self.kape.pk, 'name': 'Kape Lokal',
                                                  'blurb': 'Muffins from Marikina', 'is_active': True, 'sort_order': 0})

    def test_public_listing_hides_items_of_switched_off_partner(self):
        self.partner_item()
        self.kape.is_active = False
        self.kape.save()
        self.assertEqual(results(self.anonymous.get(f'/api/products/?partner={self.kape.pk}')), [])
        owner_names = [row['name'] for row in results(self.owner.get(f'/api/products/?partner={self.kape.pk}'))]
        self.assertEqual(owner_names, ['Banana muffin'])

    def test_listing_filters_by_partner_and_none(self):
        self.partner_item()
        Product.objects.create(name='Glazed test', price=Decimal('35.00'), category=self.category)
        own = [row['name'] for row in results(self.owner.get(f'/api/products/?partner=none&category={self.category.pk}'))]
        self.assertEqual(own, ['Glazed test'])

    def test_own_item_with_recipe_cannot_become_partner_item(self):
        item = Product.objects.create(name='Glazed test', price=Decimal('35.00'), category=self.category)
        Recipe.objects.create(product=item)
        response = self.owner.patch(f'/api/products/{item.pk}/', {'partner_id': self.kape.pk, 'partner_payout': '20.00'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(messages(response.data['error'], 'partner_id'), ["This item has a recipe, so it's made here."])

    def test_item_in_a_ready_made_box_cannot_become_partner_item(self):
        item = Product.objects.create(name='Glazed test', price=Decimal('35.00'), category=self.category)
        box = Assortment.objects.create(name='Test box', box_size=BoxSize.objects.create(size=2, price=Decimal('60.00')))
        AssortmentItem.objects.create(assortment=box, product=item, quantity=2)
        response = self.owner.patch(f'/api/products/{item.pk}/', {'partner_id': self.kape.pk, 'partner_payout': '20.00'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(messages(response.data['error'], 'partner_id'), ['This item is in a ready-made box. Take it out first.'])

    def test_partner_item_can_become_own_item(self):
        item = self.partner_item()
        response = self.owner.patch(f'/api/products/{item.pk}/', {'partner_id': None, 'partner_payout': '0.00'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(Product.objects.get(pk=item.pk).partner)


class PartnerExclusionTests(PartnerFixture, TestCase):
    def test_ready_made_box_rejects_partner_item(self):
        self.partner_item()
        size = BoxSize.objects.create(size=2, price=Decimal('100.00'))
        muffin = Product.objects.get(name='Banana muffin')
        response = self.owner.post('/api/products/assortments/', {
            'name': 'Muffin box', 'box_size_id': size.pk, 'is_available': True,
            'contents': [{'product_id': muffin.pk, 'quantity': 2}]}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(messages(response.data['error'], 'contents'), ["Banana muffin is a partner item and can't go in a box."])

    def test_recipe_rejected_for_partner_item(self):
        muffin = self.partner_item()
        response = self.owner.post('/api/recipes/', {'product': muffin.pk, 'yield_quantity': 1, 'recipe_ingredients': []}, format='json')
        self.assertEqual(response.status_code, 400)
        errors = response.data.get('error', response.data)
        self.assertEqual(messages(errors, 'product'), ['Partner items are made by the partner, so they have no recipe.'])


class PartnerPaymentApiTests(PartnerFixture, TestCase):
    def pay(self, client=None, **fields):
        payload = {'date': '2026-11-10', 'amount': '100.00', 'note': 'GCash ref 1234'}
        payload.update(fields)
        return (client or self.owner).post(f'/api/products/partners/{self.kape.pk}/payments/', payload, format='json')

    def balance(self):
        rows = self.owner.get('/api/products/partners/payouts/?date_from=2026-11-01&date_to=2026-11-30').data['data']['partners']
        return next(row for row in rows if row['id'] == self.kape.pk)['still_to_pay']

    def test_owner_records_payment_and_still_to_pay_drops(self):
        self.assertEqual(self.balance(), '0.00')
        response = self.pay()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['data']['recorded_by_name'], 'partner-owner')
        self.assertEqual(self.balance(), '-100.00')
        listed = results(self.owner.get(f'/api/products/partners/{self.kape.pk}/payments/'))
        self.assertEqual([(row['amount'], row['note']) for row in listed], [('100.00', 'GCash ref 1234')])

    def test_staff_cannot_see_or_record_payments(self):
        self.assertEqual(self.pay(client=self.staff).status_code, 403)
        self.assertEqual(self.staff.get(f'/api/products/partners/{self.kape.pk}/payments/').status_code, 403)
        self.assertEqual(self.staff.get('/api/products/partners/payouts/').status_code, 403)

    def test_zero_amount_and_future_date_rejected(self):
        zero = self.pay(amount='0.00')
        self.assertEqual(zero.status_code, 400)
        self.assertEqual(messages(zero.data['error'], 'amount'), ['Enter an amount above ₱0.'])
        future = self.pay(date='2999-01-01')
        self.assertEqual(future.status_code, 400)
        self.assertEqual(messages(future.data['error'], 'date'), ["The payment date can't be in the future."])
        self.assertFalse(PartnerPayment.objects.exists())

    def test_void_needs_reason_and_happens_once(self):
        payment_id = self.pay().data['data']['id']
        url = f'/api/products/partners/{self.kape.pk}/payments/{payment_id}/void/'
        blank = self.owner.post(url, {'reason': '  '}, format='json')
        self.assertEqual(blank.status_code, 400)
        voided = self.owner.post(url, {'reason': 'Typed the wrong amount'}, format='json')
        self.assertEqual(voided.status_code, 200, voided.data)
        self.assertEqual(voided.data['data']['void_reason'], 'Typed the wrong amount')
        self.assertEqual(self.balance(), '0.00')
        again = self.owner.post(url, {'reason': 'Again'}, format='json')
        self.assertEqual(again.status_code, 409)
        self.assertEqual(again.data['error'], 'This payment is already voided.')

    def test_payments_cannot_be_edited_or_deleted(self):
        payment_id = self.pay().data['data']['id']
        url = f'/api/products/partners/{self.kape.pk}/payments/{payment_id}/void/'
        self.assertEqual(self.owner.patch(url, {'amount': '1.00'}, format='json').status_code, 403)
        self.assertEqual(self.owner.delete(url).status_code, 403)
        self.assertEqual(PartnerPayment.objects.get().amount, Decimal('100.00'))

    def test_payouts_endpoint_lists_every_partner_with_still_to_pay(self):
        Partner.objects.create(name='Cake Atelier')
        data = self.owner.get('/api/products/partners/payouts/?date_from=2026-11-01&date_to=2026-11-30').data['data']
        self.assertEqual(data['total'], '0.00')
        self.assertEqual([(row['name'], row['owed'], row['still_to_pay'], row['items']) for row in data['partners']],
                         [('Cake Atelier', '0.00', '0.00', []), ('Kape Lokal', '0.00', '0.00', [])])
