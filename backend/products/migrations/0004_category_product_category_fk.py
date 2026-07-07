from django.db import migrations, models
import django.db.models.deletion


INITIAL_CATEGORIES = [
    ('classic', 'Classic', 10),
    ('fruity', 'Fruity', 20),
    ('local', 'Local Favorites', 30),
    ('premium', 'Premium', 40),
    ('brownies', 'Brownies & Bars', 50),
]


def create_categories_and_assign_products(apps, schema_editor):
    Category = apps.get_model('products', 'Category')
    Product = apps.get_model('products', 'Product')

    category_by_slug = {}
    for slug, name, sort_order in INITIAL_CATEGORIES:
        category, _ = Category.objects.get_or_create(
            slug=slug,
            defaults={
                'name': name,
                'sort_order': sort_order,
                'is_active': True,
            },
        )
        category_by_slug[slug] = category

    default_category = category_by_slug['classic']
    for product in Product.objects.all():
        product.category_fk = category_by_slug.get(product.category, default_category)
        product.save(update_fields=['category_fk'])


def restore_category_strings(apps, schema_editor):
    Product = apps.get_model('products', 'Product')

    for product in Product.objects.select_related('category_fk'):
        product.category = product.category_fk.slug if product.category_fk_id else 'classic'
        product.save(update_fields=['category'])


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0003_product_category'),
    ]

    operations = [
        migrations.CreateModel(
            name='Category',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=100, unique=True)),
                ('description', models.TextField(blank=True, default='')),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name_plural': 'categories',
                'ordering': ['sort_order', 'name'],
            },
        ),
        migrations.AddField(
            model_name='product',
            name='category_fk',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='products',
                to='products.category',
            ),
        ),
        migrations.RunPython(create_categories_and_assign_products, restore_category_strings),
        migrations.RemoveField(
            model_name='product',
            name='category',
        ),
        migrations.RenameField(
            model_name='product',
            old_name='category_fk',
            new_name='category',
        ),
        migrations.AlterField(
            model_name='product',
            name='category',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='products',
                to='products.category',
            ),
        ),
    ]
