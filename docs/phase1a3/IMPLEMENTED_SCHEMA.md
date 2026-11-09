# Exact implemented schema (generated metadata)

2026-11-09. Source: current Django model metadata, not a migrated database. All new migrations remain UNAPPLIED. See the checkpoint for behavior, preservation, risks and authorization boundaries.

Every model below has its existing/implicit BigAutoField primary key. Null means SQL NULL permitted. “No default” means required unless populated automatically by the existing model. PROTECT is Django deletion-collector behavior; SQL FK enforcement and indexes must still be verified on disposable PostgreSQL. No new CASCADE relationships are introduced.

Defaults in the tables are Django/application and migration-population defaults, not persistent SQL DEFAULT clauses. No model field requests a persistent db_default. Existing automatic timestamps are explicitly marked auto_now/auto_now_add; operation timestamps instead use timezone.now as a callable default.

Unique constraints and primary/one-to-one fields imply indexes. A field marked db_index also requests an index. Composite uniqueness deliberately supplies leading-column indexes where db_index=False avoids duplication. Conditional uniqueness uses partial indexes. The two explicit extra indexes support operation history and posting-date reports.

## sales.Sale

Existing original date/total/items remain intact. Added current_items is the current JSON projection, and operations retain earlier versions. Legacy defaults do not create consumption/postings. status/cancellation_operation retain cancellation evidence and revision rejects stale commands.

| Field | Type | Null | Default / choices | Relationship / field index |
| --- | --- | --- | --- | --- |
| id | BigAutoField | False | No default | PK |
| date | DateField | False | No default | — |
| notes | TextField | False | '' | — |
| total_amount | DecimalField(10,2) | False | 0 | — |
| created_at | DateTimeField | False | No default; auto_now_add | — |
| updated_at | DateTimeField | False | No default; auto_now | — |
| inventory_tracking | CharField(14) | False | 'legacy_unknown'; choices: legacy_unknown, tracked | — |
| financial_tracking | CharField(13) | False | 'legacy_source'; choices: legacy_source, ledger | — |
| status | CharField(9) | False | 'recorded'; choices: recorded, cancelled | — |
| revision | BigIntegerField | False | 0 | — |
| current_items | JSONField | True | None | — |
| cancellation_operation | OneToOneField | True | None | sales.InventoryOperation / PROTECT; unique; db_index |

Named constraints (exact Django expressions):

```text
<CheckConstraint: condition=(AND: ('inventory_tracking__in', ['legacy_unknown', 'tracked'])) name='sale_tracking_valid'>
<CheckConstraint: condition=(AND: ('financial_tracking__in', ['legacy_source', 'ledger'])) name='sale_financial_tracking_valid'>
<CheckConstraint: condition=(AND: ('status__in', ['recorded', 'cancelled'])) name='sale_status_valid'>
<CheckConstraint: condition=(AND: ('revision__gte', 0), (OR: (NOT (AND: ('inventory_tracking', 'tracked'))), ('revision__gte', 1))) name='sale_revision_valid'>
<CheckConstraint: condition=(OR: (AND: ('cancellation_operation__isnull', True), ('status', 'recorded')), (AND: ('cancellation_operation__isnull', False), ('status', 'cancelled'))) name='sale_cancel_link_valid'>
```

Explicit additional indexes:

```text
None; field/uniqueness indexes above still apply.
```

## ingredients.Ingredient

Existing stock balance widened to nine decimals; stock_revision orders actual nonzero changes. Nullable anchor fields are populated together with the first tracked command from the observed pre-command balance, never from reconstructed history.

| Field | Type | Null | Default / choices | Relationship / field index |
| --- | --- | --- | --- | --- |
| id | BigAutoField | False | No default | PK |
| name | CharField(100) | False | No default | unique |
| quantity | DecimalField(20,9) | False | 0 | — |
| stock_revision | BigIntegerField | False | 0 | — |
| ledger_opening_quantity | DecimalField(20,9) | True | None | — |
| ledger_started_at | DateTimeField | True | None | — |
| unit | CharField(10) | False | No default; choices: kg, g, ml, l, pcs, tbsp, tsp, cup | — |
| cost_per_unit | DecimalField(10,2) | False | No default | — |
| supplier | CharField(100) | False | '' | — |
| minimum_stock | DecimalField(10,2) | False | 0 | — |
| category | CharField(20) | False | Ingredient.Category.OTHER; choices: flour_grains, dairy, sweeteners, flavorings, packaging, other | — |
| notes | TextField | False | '' | — |
| image | FileField(100) | True | No default | — |
| created_at | DateTimeField | False | No default; auto_now_add | — |
| updated_at | DateTimeField | False | No default; auto_now | — |

Named constraints (exact Django expressions):

```text
<CheckConstraint: condition=(AND: ('quantity__gte', 0), ('stock_revision__gte', 0)) name='ing_stock_revision_valid'>
<CheckConstraint: condition=(OR: (AND: ('ledger_opening_quantity__isnull', True), ('ledger_started_at__isnull', True), ('stock_revision', 0)), (AND: ('ledger_opening_quantity__gte', 0), ('ledger_opening_quantity__isnull', False), ('ledger_started_at__isnull', False))) name='ing_anchor_valid'>
```

Explicit additional indexes:

```text
None; field/uniqueness indexes above still apply.
```

## sales.InventoryOperation

Durable actor-scoped UUID identity, canonical SHA-256 intent, audit before-state, and exact replayable result. One committed operation can own several stock/consumption rows and at most one financial posting.

| Field | Type | Null | Default / choices | Relationship / field index |
| --- | --- | --- | --- | --- |
| id | BigAutoField | False | No default | PK |
| actor | ForeignKey | False | No default | accounts.User / PROTECT |
| client_key | UUIDField(32) | False | No default | — |
| action | CharField(16) | False | No default; choices: sale_create, sale_update, sale_cancel, stock_adjust | — |
| sale | ForeignKey | True | No default | sales.Sale / PROTECT |
| ingredient | ForeignKey | True | No default | ingredients.Ingredient / PROTECT; db_index |
| request_fingerprint | CharField(64) | False | No default | — |
| reason | TextField | False | '' | — |
| schema_version | SmallIntegerField | False | 1 | — |
| before_snapshot | JSONField | False | builtins.dict | — |
| response_status | SmallIntegerField | False | No default | — |
| response_body | JSONField | False | No default | — |
| created_at | DateTimeField | False | django.utils.timezone.now | — |

Named constraints (exact Django expressions):

```text
<UniqueConstraint: fields=('actor', 'client_key') name='invop_actor_key_unique'>
<UniqueConstraint: fields=('sale',) name='invop_sale_cancel_once' condition=(AND: ('action', 'sale_cancel'))>
<CheckConstraint: condition=(AND: ('action__in', ['sale_create', 'sale_update', 'sale_cancel', 'stock_adjust'])) name='invop_action_valid'>
<CheckConstraint: condition=(OR: (AND: ('action', 'stock_adjust'), ('ingredient__isnull', False), ('sale__isnull', True)), (AND: ('action__in', ['sale_create', 'sale_update', 'sale_cancel']), ('ingredient__isnull', True), ('sale__isnull', False))) name='invop_target_valid'>
<CheckConstraint: condition=(OR: (AND: ('action', 'sale_create'), ('response_status', 201)), (AND: ('action__in', ['sale_update', 'sale_cancel', 'stock_adjust']), ('response_status', 200))) name='invop_response_valid'>
<CheckConstraint: condition=(AND: ('request_fingerprint__regex', '^[0-9a-f]{64}$')) name='invop_fingerprint_valid'>
<CheckConstraint: condition=(AND: ('schema_version', 1)) name='invop_version_valid'>
<CheckConstraint: condition=(OR: (NOT (AND: ('action__in', ['sale_cancel', 'stock_adjust']))), (NOT (AND: ('reason', '')))) name='invop_reason_required'>
```

Explicit additional indexes:

```text
<Index: fields=['sale', 'created_at', 'id'] name='invop_sale_time_idx'>
```

## sales.ConsumptionBasis

Retained product/ingredient/base-unit/batch/yield rate identity. No Recipe foreign key: deleting or changing a recipe cannot change this rate. allocated_units is a never-decreasing lifetime cursor; active_units is the sum of unreversed snapshot units.

| Field | Type | Null | Default / choices | Relationship / field index |
| --- | --- | --- | --- | --- |
| id | BigAutoField | False | No default | PK |
| product | ForeignKey | False | No default | products.Product / PROTECT |
| ingredient | ForeignKey | False | No default | ingredients.Ingredient / PROTECT; db_index |
| unit | CharField(10) | False | No default | — |
| batch_quantity | DecimalField(10,2) | False | No default | — |
| yield_quantity | IntegerField | False | No default | — |
| allocated_units | BigIntegerField | False | 0 | — |
| active_units | BigIntegerField | False | 0 | — |

Named constraints (exact Django expressions):

```text
<UniqueConstraint: fields=('product', 'ingredient', 'unit', 'batch_quantity', 'yield_quantity') name='basis_rate_unique'>
<CheckConstraint: condition=(AND: ('unit__in', ['kg', 'g', 'l', 'ml', 'pcs', 'cup', 'tbsp', 'tsp'])) name='basis_unit_valid'>
<CheckConstraint: condition=(AND: ('batch_quantity__gt', 0)) name='basis_batch_positive'>
<CheckConstraint: condition=(AND: ('yield_quantity__gte', 1)) name='basis_yield_positive'>
<CheckConstraint: condition=(AND: ('active_units__gte', 0), ('allocated_units__gte', F(active_units))) name='basis_counts_valid'>
<CheckConstraint: condition=GreaterThanOrEqual(<CombinedExpression: F(batch_quantity) * Value(Decimal('1000000000'))>, F(yield_quantity)) name='basis_min_quantum'>
```

Explicit additional indexes:

```text
None; field/uniqueness indexes above still apply.
```

## sales.SaleConsumption

Exact applied quantity for a sale revision and rate. allocation_start/units identify the consumed cursor interval. reversed_by is a one-time link to the operation that credited precisely this quantity; it never changes the stored quantity.

| Field | Type | Null | Default / choices | Relationship / field index |
| --- | --- | --- | --- | --- |
| id | BigAutoField | False | No default | PK |
| sale | ForeignKey | False | No default | sales.Sale / PROTECT |
| sale_revision | BigIntegerField | False | No default | — |
| basis | ForeignKey | False | No default | sales.ConsumptionBasis / PROTECT; db_index |
| operation | ForeignKey | False | No default | sales.InventoryOperation / PROTECT; db_index |
| allocation_start | BigIntegerField | False | No default | — |
| units | BigIntegerField | False | No default | — |
| applied_quantity | DecimalField(20,9) | False | No default | — |
| reversed_by | ForeignKey | True | No default | sales.InventoryOperation / PROTECT; db_index |

Named constraints (exact Django expressions):

```text
<UniqueConstraint: fields=('sale', 'sale_revision', 'basis') name='sc_sale_rev_basis_unique'>
<UniqueConstraint: fields=('basis', 'allocation_start') name='sc_basis_start_unique'>
<UniqueConstraint: fields=('sale', 'basis') name='sc_active_sale_basis_unique' condition=(AND: ('reversed_by__isnull', True))>
<CheckConstraint: condition=(AND: ('allocation_start__gte', 0), ('applied_quantity__gt', 0), ('sale_revision__gte', 1), ('units__gte', 1)) name='sc_values_positive'>
<CheckConstraint: condition=(AND: ('allocation_start__lte', <CombinedExpression: Value(9223372036854775807) - F(units)>)) name='sc_counter_range'>
```

Explicit additional indexes:

```text
None; field/uniqueness indexes above still apply.
```

## sales.StockMovement

One net signed inventory change per ingredient/operation, ordered by stock_revision, with the exact resulting balance. Positive adds stock; negative deducts stock. Zero-net changes have no movement row; operation/consumption history still records them.

| Field | Type | Null | Default / choices | Relationship / field index |
| --- | --- | --- | --- | --- |
| id | BigAutoField | False | No default | PK |
| operation | ForeignKey | False | No default | sales.InventoryOperation / PROTECT |
| ingredient | ForeignKey | False | No default | ingredients.Ingredient / PROTECT |
| stock_revision | BigIntegerField | False | No default | — |
| unit | CharField(10) | False | No default | — |
| quantity_delta | DecimalField(20,9) | False | No default | — |
| balance_after | DecimalField(20,9) | False | No default | — |

Named constraints (exact Django expressions):

```text
<UniqueConstraint: fields=('operation', 'ingredient') name='movement_op_ing_unique'>
<UniqueConstraint: fields=('ingredient', 'stock_revision') name='movement_ing_rev_unique'>
<CheckConstraint: condition=(AND: ('unit__in', ['kg', 'g', 'l', 'ml', 'pcs', 'cup', 'tbsp', 'tsp'])) name='movement_unit_valid'>
<CheckConstraint: condition=(NOT (AND: ('quantity_delta', 0))) name='movement_delta_nonzero'>
<CheckConstraint: condition=(AND: ('balance_after__gte', 0), ('stock_revision__gte', 1)) name='movement_balance_valid'>
```

Explicit additional indexes:

```text
None; field/uniqueness indexes above still apply.
```

## sales.SaleFinancialEntry

One nonzero signed financial posting per operation/relevant sale revision. Original positive gross on sale date, signed adjustments on edit date, and negative cancellation on cancellation date. No refund field or cash inference.

| Field | Type | Null | Default / choices | Relationship / field index |
| --- | --- | --- | --- | --- |
| id | BigAutoField | False | No default | PK |
| sale | ForeignKey | False | No default | sales.Sale / PROTECT; db_index |
| operation | OneToOneField | False | No default | sales.InventoryOperation / PROTECT; unique; db_index |
| sale_revision | BigIntegerField | False | No default | — |
| kind | CharField(16) | False | No default; choices: gross_sale, sale_adjustment, cancellation | — |
| effective_date | DateField | False | No default | — |
| amount | DecimalField(10,2) | False | No default | — |

Named constraints (exact Django expressions):

```text
<UniqueConstraint: fields=('sale', 'sale_revision') name='finance_sale_revision_unique'>
<UniqueConstraint: fields=('sale',) name='finance_gross_once' condition=(AND: ('kind', 'gross_sale'))>
<UniqueConstraint: fields=('sale',) name='finance_cancel_once' condition=(AND: ('kind', 'cancellation'))>
<CheckConstraint: condition=(OR: (AND: ('amount__gt', 0), ('kind', 'gross_sale')), (AND: ('kind', 'sale_adjustment'), (NOT (AND: ('amount', 0)))), (AND: ('amount__lt', 0), ('kind', 'cancellation'))) name='finance_sign_valid'>
<CheckConstraint: condition=(AND: ('sale_revision__gte', 1)) name='finance_revision_positive'>
```

Explicit additional indexes:

```text
<Index: fields=['effective_date', 'kind', 'id'] name='finance_date_kind_idx'>
```

## Generated migration sequences

Only additive operations and numeric widening. No RunPython, RunSQL, data backfill, record deletion, field removal, rename, squash or historical migration edit.

### backend/ingredients/migrations/0004_inventory_integrity.py

6 operations, in generated execution order:

```text
1. <AddField  model_name='ingredient', name='ledger_opening_quantity', field=<django.db.models.fields.DecimalField: ledger_opening_quantity>>
2. <AddField  model_name='ingredient', name='ledger_started_at', field=<django.db.models.fields.DateTimeField: ledger_started_at>>
3. <AddField  model_name='ingredient', name='stock_revision', field=<django.db.models.fields.BigIntegerField: stock_revision>>
4. <AlterField  model_name='ingredient', name='quantity', field=<django.db.models.fields.DecimalField: quantity>>
5. <AddConstraint  model_name='ingredient', constraint=<CheckConstraint: condition=(AND: ('quantity__gte', 0), ('stock_revision__gte', 0)) name='ing_stock_revision_valid'>>
6. <AddConstraint  model_name='ingredient', constraint=<CheckConstraint: condition=(OR: (AND: ('ledger_opening_quantity__isnull', True), ('ledger_started_at__isnull', True), ('stock_revision', 0)), (AND: ('ledger_opening_quantity__gte', 0), ('ledger_opening_quantity__isnull', False), ('ledger_started_at__isnull', False))) name='ing_anchor_valid'>>
```

### backend/sales/migrations/0003_inventory_integrity.py

55 operations, in generated execution order:

```text
1. <CreateModel  name='SaleConsumption', fields=[('id', <django.db.models.fields.BigAutoField: id>), ('sale_revision', <django.db.models.fields.BigIntegerField: sale_revision>), ('allocation_start', <django.db.models.fields.BigIntegerField: allocation_start>), ('units', <django.db.models.fields.BigIntegerField: units>), ('applied_quantity', <django.db.models.fields.DecimalField: applied_quantity>)]>
2. <CreateModel  name='SaleFinancialEntry', fields=[('id', <django.db.models.fields.BigAutoField: id>), ('sale_revision', <django.db.models.fields.BigIntegerField: sale_revision>), ('kind', <django.db.models.fields.CharField: kind>), ('effective_date', <django.db.models.fields.DateField: effective_date>), ('amount', <django.db.models.fields.DecimalField: amount>)]>
3. <CreateModel  name='StockMovement', fields=[('id', <django.db.models.fields.BigAutoField: id>), ('stock_revision', <django.db.models.fields.BigIntegerField: stock_revision>), ('unit', <django.db.models.fields.CharField: unit>), ('quantity_delta', <django.db.models.fields.DecimalField: quantity_delta>), ('balance_after', <django.db.models.fields.DecimalField: balance_after>)]>
4. <AddField  model_name='sale', name='current_items', field=<django.db.models.fields.json.JSONField: current_items>>
5. <AddField  model_name='sale', name='financial_tracking', field=<django.db.models.fields.CharField: financial_tracking>>
6. <AddField  model_name='sale', name='inventory_tracking', field=<django.db.models.fields.CharField: inventory_tracking>>
7. <AddField  model_name='sale', name='revision', field=<django.db.models.fields.BigIntegerField: revision>>
8. <AddField  model_name='sale', name='status', field=<django.db.models.fields.CharField: status>>
9. <CreateModel  name='ConsumptionBasis', fields=[('id', <django.db.models.fields.BigAutoField: id>), ('unit', <django.db.models.fields.CharField: unit>), ('batch_quantity', <django.db.models.fields.DecimalField: batch_quantity>), ('yield_quantity', <django.db.models.fields.IntegerField: yield_quantity>), ('allocated_units', <django.db.models.fields.BigIntegerField: allocated_units>), ('active_units', <django.db.models.fields.BigIntegerField: active_units>), ('ingredient', <django.db.models.fields.related.ForeignKey: ingredient>), ('product', <django.db.models.fields.related.ForeignKey: product>)]>
10. <CreateModel  name='InventoryOperation', fields=[('id', <django.db.models.fields.BigAutoField: id>), ('client_key', <django.db.models.fields.UUIDField: client_key>), ('action', <django.db.models.fields.CharField: action>), ('request_fingerprint', <django.db.models.fields.CharField: request_fingerprint>), ('reason', <django.db.models.fields.TextField: reason>), ('schema_version', <django.db.models.fields.SmallIntegerField: schema_version>), ('before_snapshot', <django.db.models.fields.json.JSONField: before_snapshot>), ('response_status', <django.db.models.fields.SmallIntegerField: response_status>), ('response_body', <django.db.models.fields.json.JSONField: response_body>), ('created_at', <django.db.models.fields.DateTimeField: created_at>), ('actor', <django.db.models.fields.related.ForeignKey: actor>), ('ingredient', <django.db.models.fields.related.ForeignKey: ingredient>), ('sale', <django.db.models.fields.related.ForeignKey: sale>)]>
11. <AddField  model_name='sale', name='cancellation_operation', field=<django.db.models.fields.related.OneToOneField: cancellation_operation>>
12. <AddConstraint  model_name='sale', constraint=<CheckConstraint: condition=(AND: ('inventory_tracking__in', ['legacy_unknown', 'tracked'])) name='sale_tracking_valid'>>
13. <AddConstraint  model_name='sale', constraint=<CheckConstraint: condition=(AND: ('financial_tracking__in', ['legacy_source', 'ledger'])) name='sale_financial_tracking_valid'>>
14. <AddConstraint  model_name='sale', constraint=<CheckConstraint: condition=(AND: ('status__in', ['recorded', 'cancelled'])) name='sale_status_valid'>>
15. <AddConstraint  model_name='sale', constraint=<CheckConstraint: condition=(AND: ('revision__gte', 0), (OR: (NOT (AND: ('inventory_tracking', 'tracked'))), ('revision__gte', 1))) name='sale_revision_valid'>>
16. <AddConstraint  model_name='sale', constraint=<CheckConstraint: condition=(OR: (AND: ('cancellation_operation__isnull', True), ('status', 'recorded')), (AND: ('cancellation_operation__isnull', False), ('status', 'cancelled'))) name='sale_cancel_link_valid'>>
17. <AddField  model_name='saleconsumption', name='basis', field=<django.db.models.fields.related.ForeignKey: basis>>
18. <AddField  model_name='saleconsumption', name='operation', field=<django.db.models.fields.related.ForeignKey: operation>>
19. <AddField  model_name='saleconsumption', name='reversed_by', field=<django.db.models.fields.related.ForeignKey: reversed_by>>
20. <AddField  model_name='saleconsumption', name='sale', field=<django.db.models.fields.related.ForeignKey: sale>>
21. <AddField  model_name='salefinancialentry', name='operation', field=<django.db.models.fields.related.OneToOneField: operation>>
22. <AddField  model_name='salefinancialentry', name='sale', field=<django.db.models.fields.related.ForeignKey: sale>>
23. <AddField  model_name='stockmovement', name='ingredient', field=<django.db.models.fields.related.ForeignKey: ingredient>>
24. <AddField  model_name='stockmovement', name='operation', field=<django.db.models.fields.related.ForeignKey: operation>>
25. <AddConstraint  model_name='consumptionbasis', constraint=<UniqueConstraint: fields=('product', 'ingredient', 'unit', 'batch_quantity', 'yield_quantity') name='basis_rate_unique'>>
26. <AddConstraint  model_name='consumptionbasis', constraint=<CheckConstraint: condition=(AND: ('unit__in', ['kg', 'g', 'l', 'ml', 'pcs', 'cup', 'tbsp', 'tsp'])) name='basis_unit_valid'>>
27. <AddConstraint  model_name='consumptionbasis', constraint=<CheckConstraint: condition=(AND: ('batch_quantity__gt', 0)) name='basis_batch_positive'>>
28. <AddConstraint  model_name='consumptionbasis', constraint=<CheckConstraint: condition=(AND: ('yield_quantity__gte', 1)) name='basis_yield_positive'>>
29. <AddConstraint  model_name='consumptionbasis', constraint=<CheckConstraint: condition=(AND: ('active_units__gte', 0), ('allocated_units__gte', F(active_units))) name='basis_counts_valid'>>
30. <AddConstraint  model_name='consumptionbasis', constraint=<CheckConstraint: condition=GreaterThanOrEqual(<CombinedExpression: F(batch_quantity) * Value(Decimal('1000000000'))>, F(yield_quantity)) name='basis_min_quantum'>>
31. <AddIndex  model_name='inventoryoperation', index=<Index: fields=['sale', 'created_at', 'id'] name='invop_sale_time_idx'>>
32. <AddConstraint  model_name='inventoryoperation', constraint=<UniqueConstraint: fields=('actor', 'client_key') name='invop_actor_key_unique'>>
33. <AddConstraint  model_name='inventoryoperation', constraint=<UniqueConstraint: fields=('sale',) name='invop_sale_cancel_once' condition=(AND: ('action', 'sale_cancel'))>>
34. <AddConstraint  model_name='inventoryoperation', constraint=<CheckConstraint: condition=(AND: ('action__in', ['sale_create', 'sale_update', 'sale_cancel', 'stock_adjust'])) name='invop_action_valid'>>
35. <AddConstraint  model_name='inventoryoperation', constraint=<CheckConstraint: condition=(OR: (AND: ('action', 'stock_adjust'), ('ingredient__isnull', False), ('sale__isnull', True)), (AND: ('action__in', ['sale_create', 'sale_update', 'sale_cancel']), ('ingredient__isnull', True), ('sale__isnull', False))) name='invop_target_valid'>>
36. <AddConstraint  model_name='inventoryoperation', constraint=<CheckConstraint: condition=(OR: (AND: ('action', 'sale_create'), ('response_status', 201)), (AND: ('action__in', ['sale_update', 'sale_cancel', 'stock_adjust']), ('response_status', 200))) name='invop_response_valid'>>
37. <AddConstraint  model_name='inventoryoperation', constraint=<CheckConstraint: condition=(AND: ('request_fingerprint__regex', '^[0-9a-f]{64}$')) name='invop_fingerprint_valid'>>
38. <AddConstraint  model_name='inventoryoperation', constraint=<CheckConstraint: condition=(AND: ('schema_version', 1)) name='invop_version_valid'>>
39. <AddConstraint  model_name='inventoryoperation', constraint=<CheckConstraint: condition=(OR: (NOT (AND: ('action__in', ['sale_cancel', 'stock_adjust']))), (NOT (AND: ('reason', '')))) name='invop_reason_required'>>
40. <AddConstraint  model_name='saleconsumption', constraint=<UniqueConstraint: fields=('sale', 'sale_revision', 'basis') name='sc_sale_rev_basis_unique'>>
41. <AddConstraint  model_name='saleconsumption', constraint=<UniqueConstraint: fields=('basis', 'allocation_start') name='sc_basis_start_unique'>>
42. <AddConstraint  model_name='saleconsumption', constraint=<UniqueConstraint: fields=('sale', 'basis') name='sc_active_sale_basis_unique' condition=(AND: ('reversed_by__isnull', True))>>
43. <AddConstraint  model_name='saleconsumption', constraint=<CheckConstraint: condition=(AND: ('allocation_start__gte', 0), ('applied_quantity__gt', 0), ('sale_revision__gte', 1), ('units__gte', 1)) name='sc_values_positive'>>
44. <AddConstraint  model_name='saleconsumption', constraint=<CheckConstraint: condition=(AND: ('allocation_start__lte', <CombinedExpression: Value(9223372036854775807) - F(units)>)) name='sc_counter_range'>>
45. <AddIndex  model_name='salefinancialentry', index=<Index: fields=['effective_date', 'kind', 'id'] name='finance_date_kind_idx'>>
46. <AddConstraint  model_name='salefinancialentry', constraint=<UniqueConstraint: fields=('sale', 'sale_revision') name='finance_sale_revision_unique'>>
47. <AddConstraint  model_name='salefinancialentry', constraint=<UniqueConstraint: fields=('sale',) name='finance_gross_once' condition=(AND: ('kind', 'gross_sale'))>>
48. <AddConstraint  model_name='salefinancialentry', constraint=<UniqueConstraint: fields=('sale',) name='finance_cancel_once' condition=(AND: ('kind', 'cancellation'))>>
49. <AddConstraint  model_name='salefinancialentry', constraint=<CheckConstraint: condition=(OR: (AND: ('amount__gt', 0), ('kind', 'gross_sale')), (AND: ('kind', 'sale_adjustment'), (NOT (AND: ('amount', 0)))), (AND: ('amount__lt', 0), ('kind', 'cancellation'))) name='finance_sign_valid'>>
50. <AddConstraint  model_name='salefinancialentry', constraint=<CheckConstraint: condition=(AND: ('sale_revision__gte', 1)) name='finance_revision_positive'>>
51. <AddConstraint  model_name='stockmovement', constraint=<UniqueConstraint: fields=('operation', 'ingredient') name='movement_op_ing_unique'>>
52. <AddConstraint  model_name='stockmovement', constraint=<UniqueConstraint: fields=('ingredient', 'stock_revision') name='movement_ing_rev_unique'>>
53. <AddConstraint  model_name='stockmovement', constraint=<CheckConstraint: condition=(AND: ('unit__in', ['kg', 'g', 'l', 'ml', 'pcs', 'cup', 'tbsp', 'tsp'])) name='movement_unit_valid'>>
54. <AddConstraint  model_name='stockmovement', constraint=<CheckConstraint: condition=(NOT (AND: ('quantity_delta', 0))) name='movement_delta_nonzero'>>
55. <AddConstraint  model_name='stockmovement', constraint=<CheckConstraint: condition=(AND: ('balance_after__gte', 0), ('stock_revision__gte', 1)) name='movement_balance_valid'>>
```
