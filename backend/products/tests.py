import shutil
import tempfile
from decimal import Decimal
from io import BytesIO
from unittest.mock import patch

import cloudinary.exceptions
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from backend.media_storage import CloudinaryMediaStorage, PhotoStorageUnavailable

from accounts.models import User

from .models import Assortment, AssortmentItem, BoxSize, Category, Product


class BoxFixture:
    def setUp(self):
        self.owner = APIClient()
        self.owner.force_authenticate(User.objects.create_user(username='box-owner', role='admin'))
        self.staff = APIClient()
        self.staff.force_authenticate(User.objects.create_user(username='box-staff', role='staff'))
        self.anonymous = APIClient()

        # Migrations seed the shop's real categories, so tests use their own.
        self.classic = Category.objects.create(slug='box-test', name='Box test')
        self.glazed = Product.objects.create(name='Glazed', price='35', category=self.classic)
        self.ube = Product.objects.create(name='Ube Cream', price='55', category=self.classic, box_extra='10')
        self.box_of_8 = BoxSize.objects.create(size=8, price='280')

    def assortment(self, contents, name='Classic eight', box=None, **extra):
        assortment = Assortment.objects.create(name=name, box_size=box or self.box_of_8, **extra)
        for product, quantity in contents:
            AssortmentItem.objects.create(assortment=assortment, product=product, quantity=quantity)
        return assortment

    def contents(self, *pairs):
        return [{'product_id': product.pk, 'quantity': quantity} for product, quantity in pairs]


class BoxSizePermissionTests(BoxFixture, TestCase):
    def test_owner_adds_a_box_size(self):
        response = self.owner.post('/api/products/box-sizes/', {'size': 12, 'price': '400.00'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['data']['size'], 12)

    def test_staff_can_read_but_not_change_box_sizes(self):
        self.assertEqual(self.staff.get('/api/products/box-sizes/').status_code, 200)
        self.assertEqual(self.staff.post('/api/products/box-sizes/', {'size': 12, 'price': '400'}, format='json').status_code, 403)
        self.assertEqual(self.staff.patch(f'/api/products/box-sizes/{self.box_of_8.pk}/', {'price': '1'}, format='json').status_code, 403)

    def test_anonymous_cannot_manage_boxes(self):
        self.assertIn(self.anonymous.get('/api/products/box-sizes/').status_code, {401, 403})
        self.assertIn(self.anonymous.post('/api/products/assortments/', {}, format='json').status_code, {401, 403})

    def test_box_price_must_be_positive_and_size_unique(self):
        self.assertEqual(self.owner.post('/api/products/box-sizes/', {'size': 12, 'price': '0'}, format='json').status_code, 400)
        self.assertEqual(self.owner.post('/api/products/box-sizes/', {'size': 8, 'price': '300'}, format='json').status_code, 400)

    def test_box_size_used_by_a_ready_made_box_cannot_be_deleted(self):
        self.assortment([(self.glazed, 8)])
        response = self.owner.delete(f'/api/products/box-sizes/{self.box_of_8.pk}/')
        self.assertEqual(response.status_code, 409)
        self.assertTrue(BoxSize.objects.filter(pk=self.box_of_8.pk).exists())


class AssortmentRuleTests(BoxFixture, TestCase):
    def post(self, *pairs, name='Mixed eight'):
        return self.owner.post('/api/products/assortments/', {
            'name': name, 'box_size_id': self.box_of_8.pk, 'contents': self.contents(*pairs),
        }, format='json')

    def test_ready_made_box_must_fill_the_box_exactly(self):
        short = self.post((self.glazed, 5))
        self.assertEqual(short.status_code, 400)
        self.assertIn('Add 3 more', str(short.data['error']['contents']))
        over = self.post((self.glazed, 9))
        self.assertEqual(over.status_code, 400)
        self.assertFalse(Assortment.objects.exists())

    def test_price_is_box_price_plus_premium_extras(self):
        response = self.post((self.glazed, 5), (self.ube, 3))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data['data']['price']), Decimal('310.00'))
        self.assertTrue(response.data['data']['is_complete'])

    def test_the_same_donut_cannot_be_listed_twice(self):
        response = self.post((self.glazed, 4), (self.glazed, 4))
        self.assertEqual(response.status_code, 400)

    def test_changing_size_keeps_contents_and_rechecks_the_fill(self):
        assortment = self.assortment([(self.glazed, 8)])
        box_of_12 = BoxSize.objects.create(size=12, price='400')
        response = self.owner.patch(f'/api/products/assortments/{assortment.pk}/', {'box_size_id': box_of_12.pk}, format='json')
        self.assertEqual(response.status_code, 400)
        assortment.refresh_from_db()
        self.assertEqual(assortment.box_size, self.box_of_8)

    def test_editing_contents_replaces_them(self):
        assortment = self.assortment([(self.glazed, 8)])
        response = self.owner.patch(f'/api/products/assortments/{assortment.pk}/', {'contents': self.contents((self.ube, 8))}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(list(assortment.items.values_list('product__name', 'quantity')), [('Ube Cream', 8)])

    def test_negative_box_extra_is_rejected(self):
        response = self.owner.patch(f'/api/products/{self.glazed.pk}/', {'box_extra': '-1'}, format='json')
        self.assertEqual(response.status_code, 400)


class PublicBoxesTests(BoxFixture, TestCase):
    def shop(self):
        response = self.anonymous.get('/api/products/boxes/')
        self.assertEqual(response.status_code, 200)
        return response.data['data']

    def test_shop_lists_sizes_on_sale_and_complete_ready_made_boxes(self):
        self.assortment([(self.glazed, 5), (self.ube, 3)])
        BoxSize.objects.create(size=24, price='750', is_available=False)
        data = self.shop()
        self.assertEqual([size['size'] for size in data['sizes']], [8])
        self.assertEqual(len(data['assortments']), 1)
        self.assertEqual(Decimal(data['assortments'][0]['price']), Decimal('310.00'))

    def test_box_with_a_donut_off_sale_is_hidden(self):
        self.assortment([(self.glazed, 5), (self.ube, 3)])
        self.ube.is_available = False
        self.ube.save()
        self.assertEqual(self.shop()['assortments'], [])

    def test_box_left_short_by_a_deleted_donut_is_hidden(self):
        self.assortment([(self.glazed, 5), (self.ube, 3)])
        self.ube.delete()
        self.assertEqual(self.shop()['assortments'], [])

    def test_box_of_a_size_off_sale_is_hidden(self):
        self.assortment([(self.glazed, 8)])
        self.box_of_8.is_available = False
        self.box_of_8.save()
        self.assertEqual(self.shop(), {'sizes': [], 'assortments': []})

    def test_public_product_listing_shows_the_box_extra(self):
        response = self.anonymous.get('/api/products/', {'search': 'Ube'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data['data']['results'][0]['box_extra']), Decimal('10.00'))


def photo(image_format='PNG', name='donut.png'):
    buffer = BytesIO()
    Image.new('RGB', (12, 12), (233, 185, 127)).save(buffer, image_format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=f'image/{image_format.lower()}')


class PhotoUploadTests(BoxFixture, TestCase):
    def setUp(self):
        super().setUp()
        self.media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)

    def upload(self, file):
        with override_settings(MEDIA_ROOT=self.media):
            return self.owner.patch(f'/api/products/{self.glazed.pk}/', {'image': file}, format='multipart')

    def test_a_small_png_is_accepted(self):
        self.assertEqual(self.upload(photo()).status_code, 200)

    def test_other_image_formats_are_rejected(self):
        response = self.upload(photo('GIF', 'donut.gif'))
        self.assertEqual(response.status_code, 400)
        self.assertIn('JPG, PNG or WEBP', str(response.data['error']['image']))

    def test_files_that_are_not_images_are_rejected(self):
        fake = SimpleUploadedFile('donut.png', b'not really a picture', content_type='image/png')
        self.assertEqual(self.upload(fake).status_code, 400)

    @override_settings(PHOTO_MAX_BYTES=50)
    def test_photos_over_the_size_limit_are_rejected(self):
        response = self.upload(photo())
        self.assertEqual(response.status_code, 400)
        self.assertIn('under 5 MB', str(response.data['error']['image']))


@override_settings(CLOUDINARY_CLOUD_NAME='demo', CLOUDINARY_API_KEY='key', CLOUDINARY_API_SECRET='secret', CLOUDINARY_FOLDER='rowszein')
class CloudinaryStorageTests(TestCase):
    def test_save_uploads_under_the_shop_folder_with_a_unique_name(self):
        storage = CloudinaryMediaStorage()
        with patch('cloudinary.uploader.upload') as upload:
            first = storage.save('products/Glazed Ring.JPG', ContentFile(b'x'))
            second = storage.save('products/Glazed Ring.JPG', ContentFile(b'x'))
        self.assertNotEqual(first, second)
        self.assertTrue(first.startswith('products/Glazed Ring-') and first.endswith('.jpg'))
        public_id = upload.call_args_list[0].kwargs['public_id']
        self.assertEqual(public_id, 'rowszein/' + first.rsplit('.', 1)[0])
        self.assertEqual(upload.call_args_list[0].kwargs['resource_type'], 'image')

    def test_long_names_fit_the_database_column(self):
        name = CloudinaryMediaStorage().get_available_name('products/' + 'a' * 200 + '.png', max_length=100)
        self.assertLessEqual(len(name), 100)

    def test_url_is_https_and_lets_cloudinary_pick_format_and_quality(self):
        url = CloudinaryMediaStorage().url('products/ring-1a2b3c4d.jpg')
        self.assertTrue(url.startswith('https://res.cloudinary.com/demo/image/upload/'))
        self.assertIn('f_auto', url)
        self.assertIn('q_auto', url)
        self.assertIn('rowszein/products/ring-1a2b3c4d', url)

    def test_cloudinary_errors_become_a_friendly_503(self):
        storage = CloudinaryMediaStorage()
        with patch('cloudinary.uploader.upload', side_effect=cloudinary.exceptions.Error('down')):
            with self.assertRaises(PhotoStorageUnavailable):
                storage.save('products/ring.png', ContentFile(b'x'))
