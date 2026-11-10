"""Render the reviewed metadata manifest; no Django imports or database access."""
import json
from pathlib import Path

folder = Path(__file__).resolve().parent
manifest = json.loads((folder/'evidence/implemented-models.json').read_text())
operations = json.loads((folder/'evidence/migration-operations.json').read_text())
purposes = {
    'sales.InventoryOperation': 'Durable actor-scoped UUID identity, canonical SHA-256 intent, audit before-state, and exact replayable result. One committed operation can own several stock/consumption rows and at most one financial posting.',
    'sales.ConsumptionBasis': 'Retained product/ingredient/base-unit/batch/yield rate identity. No Recipe foreign key: deleting or changing a recipe cannot change this rate. allocated_units is a never-decreasing lifetime cursor; active_units is the sum of unreversed snapshot units.',
    'sales.SaleConsumption': 'Exact applied quantity for a sale revision and rate. allocation_start/units identify the consumed cursor interval. reversed_by is a one-time link to the operation that credited precisely this quantity; it never changes the stored quantity.',
    'sales.StockMovement': 'One net signed inventory change per ingredient/operation, ordered by stock_revision, with the exact resulting balance. Positive adds stock; negative deducts stock. Zero-net changes have no movement row; operation/consumption history still records them.',
    'sales.SaleFinancialEntry': 'One nonzero signed financial posting per operation/relevant sale revision. Original positive gross on sale date, signed adjustments on edit date, and negative cancellation on cancellation date. No refund field or cash inference.',
    'sales.Sale': 'Existing original date/total/items remain intact. Added current_items is the current JSON projection, and operations retain earlier versions. Legacy defaults do not create consumption/postings. status/cancellation_operation retain cancellation evidence and revision rejects stale commands.',
    'ingredients.Ingredient': 'Existing stock balance widened to nine decimals; stock_revision orders actual nonzero changes. Nullable anchor fields are populated together with the first tracked command from the observed pre-command balance, never from reconstructed history.',
}
lines = ['# Exact implemented schema (generated metadata)', '',
         '2026-11-09. Source: current Django model metadata, not a migrated database. All new migrations remain UNAPPLIED. See the checkpoint for behavior, preservation, risks and authorization boundaries.', '',
         'Every model below has its existing/implicit BigAutoField primary key. Null means SQL NULL permitted. “No default” means required unless populated automatically by the existing model. PROTECT is Django deletion-collector behavior; SQL FK enforcement and indexes must still be verified on disposable PostgreSQL. No new CASCADE relationships are introduced.', '',
         'Defaults in the tables are Django/application and migration-population defaults, not persistent SQL DEFAULT clauses. No model field requests a persistent db_default. Existing automatic timestamps are explicitly marked auto_now/auto_now_add; operation timestamps instead use timezone.now as a callable default.', '',
         'Unique constraints and primary/one-to-one fields imply indexes. A field marked db_index also requests an index. Composite uniqueness deliberately supplies leading-column indexes where db_index=False avoids duplication. Conditional uniqueness uses partial indexes. The two explicit extra indexes support operation history and posting-date reports.', '']
for label, data in manifest.items():
    lines.extend([f'## {label}', '', purposes[label], '', '| Field | Type | Null | Default / choices | Relationship / field index |', '| --- | --- | --- | --- | --- |'])
    for field in data['fields']:
        kind = field['type']
        if field['max_digits'] is not None:
            kind += f"({field['max_digits']},{field['decimal_places']})"
        elif field['max_length'] is not None:
            kind += f"({field['max_length']})"
        default = field['default'].replace('django.db.models.fields.NOT_PROVIDED', 'No default')
        if field.get('auto_now'): default += '; auto_now'
        if field.get('auto_now_add'): default += '; auto_now_add'
        if field.get('choices'):
            default += '; choices: ' + ', '.join(str(x[0]) for x in field['choices'])
        flags = []
        if field['relation']:
            flags.append(f"{field['relation']} / {field['on_delete']}")
        if field['primary_key']: flags.append('PK')
        elif field['unique']: flags.append('unique')
        if field['db_index']: flags.append('db_index')
        lines.append(f"| {field['name']} | {kind} | {field['null']} | {default} | {'; '.join(flags) or '—'} |")
    lines.extend(['', 'Named constraints (exact Django expressions):', '', '```text', *data['constraints'], '```', '', 'Explicit additional indexes:', '', '```text', *(data['indexes'] or ['None; field/uniqueness indexes above still apply.']), '```', ''])
lines.extend(['## Generated migration sequences', '', 'Only additive operations and numeric widening. No RunPython, RunSQL, data backfill, record deletion, field removal, rename, squash or historical migration edit.', ''])
for path, ops in operations.items():
    lines.extend([f'### {path}', '', f'{len(ops)} operations, in generated execution order:', '', '```text'])
    lines.extend(f'{n}. {op}' for n, op in enumerate(ops, 1))
    lines.extend(['```', ''])
(folder/'IMPLEMENTED_SCHEMA.md').write_text('\n'.join(lines), encoding='utf-8')
