# Catalog listing contract (Phase 1C.2B)

Existing URLs and success envelope `{success,data:{count,next,previous,results},message}` stay unchanged.
Global pagination stays 20. These four list endpoints accept `page` (default 1;
the existing DRF `last` alias is retained),
`page_size` (1–20, default 20), `search` (trimmed, maximum 100 characters),
`ordering` (one allowlisted token), and `id` (one exact positive record ID for a
bounded selected-record lookup). Blank optional values are omitted/defaulted.
Malformed/duplicate/unknown parameters return 400 (DRF's existing `format`
negotiation is unchanged); a valid page beyond the result
range returns the existing DRF 404. Empty datasets have a successful empty page 1.

| Endpoint | Additional filters | Ordering tokens (each adds PK tie-breaker) |
| --- | --- | --- |
| products | category (ID), is_available, is_featured, category_active | name (default), -name, price, -price; owner also created_at/-created_at |
| products/categories | is_active | name, -name, sort_order (default), -sort_order |
| ingredients | unit (existing enum), status (healthy/low_stock/out_of_stock); owner also category (existing enum) | name (default), -name, quantity, -quantity; owner also minimum_stock/-minimum_stock/cost_per_unit/-cost_per_unit/value/-value |
| recipes | category (product category ID) | name (default), -name, batch_cost_desc, cost_per_unit_asc, most_ingredients |

Boolean filters use true/false. Product/category search covers name/description;
ingredient search covers name and, for owners only, category/supplier; recipe
search covers product name. Recipe cost ordering uses SQL ingredient totals for
read-only ranking, never changes existing displayed cost rounding or ledgers.
Ingredient status matches the existing presentation precedence: quantity <=0 is
out of stock, positive quantity <= minimum is low, otherwise healthy.

Permissions and projections are unchanged. Anonymous products always require
availability and active category, anonymous categories require active status;
explicit filters cannot widen those constraints. Staff ingredient queries cannot
search or order by owner-only supplier/cost information. Recipes remain owner-only.
An exact-ID lookup passes through the same authorized queryset/projection.

Selectors and storefront load a page at a time, not every record in advance.
Storefront reads omit cookies even when an owner visits, using the existing
anonymous projection and a separate public cache identity. Private requests
still use the unchanged cookie/CSRF transport.
Selected related records use an exact-ID list lookup, so public category detail
permissions need not be broadened. Cached queries include actor/role and every
request parameter; changing search/filters resets page state. Sorting/filtering
precedes pagination. These are read/discovery repairs, not new business rules.

No schema/index changes are authorized. Bounded responses/prefetching avoid
Python full-table loading and N+1 queries. SQL counts, substring searches and
computed ordering can still scan matching rows with existing indexes; measured
query counts and this production-scale limitation must be reported explicitly.
