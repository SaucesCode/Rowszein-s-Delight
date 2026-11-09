# SEO audit — Phase 0

Date: 2026-11-09. Scope: repository and local browser. No production crawl, Search Console, indexing inspection, Lighthouse or ranking measurement was performed.

## Relevant surfaces

| Surface | Intended treatment |
| --- | --- |
| Public `/` storefront | Truthful shop description, menu visibility, crawlable navigation, useful metadata and optimized images |
| Public cart/contact interactions | Utility features on storefront; no separate indexable checkout/order pages currently |
| `/login` and private owner routes | Exclude from search indexing where appropriate; preserve real authentication/authorization |
| `/admin/`, private APIs and exports | Access control first; no public marketing SEO |

## Findings

| Priority | Source-confirmed finding | Proposed improvement after approval |
| --- | --- | --- |
| Medium | `frontend/index.html` has only generic title, viewport and favicon. | Add descriptive storefront title/meta description; approved canonical origin and social metadata. Owner layout already updates private browser titles. |
| Medium | No robots.txt, sitemap, canonical, Open Graph or structured data found. | Add only relevant public URLs. Use noindex for utility/private document surfaces as appropriate; robots rules do not secure private information. |
| Medium | Product menu fetches first page only; featured product beyond item 20 disappears. | Repair catalog data access before SEO polish. Ensure all intended public products can be reached. |
| Medium | HTML begins with an empty React root; product text loads via JS/API. | Verify rendered crawling/indexing after deployment access is approved. No demonstrated need for SSR/prerendering yet. |
| Medium | Unknown SPA routes redirect to `/`; HTTP host fallback serves index. | Verify real HTTP 404 behavior and avoid misleading redirects/soft 404s. |
| Medium | Contact constants say replace with real info; freshness/ingredient claims are not verified. | Owner must verify business contact and marketing facts. No invented address, hours, reviews, ratings or delivery coverage. |
| Low | Product images have meaningful alt text but no native below-fold lazy loading; all routes/charts share eager entry bundle. | Optimize image loading/resizing and split public/private code based on actual performance measurements. |
| Low | Some sections are fragment navigation; Bestsellers may not render when no featured product exists. | Check anchor targets across empty/error/nonfeatured states and keep navigation meaningful. |

A public marketing section already exists; a second website is not necessary to address these findings. No new pages or schema were added. Product/LocalBusiness structured data should be considered only after business facts and product availability/prices are reliable and public.

## Validation to perform later

Confirm canonical production URL and truthful description/contact information; inspect HTTP status/redirect/robots/noindex behavior; check JS-rendered content and menu pagination; test image layout/loading; compare mobile production LCP/INP/CLS and lab Lighthouse results with an explicit device/network profile. Do not promise ranking gains.

Reference: [Google Search Central JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) explains rendering/crawling considerations. Client-rendered React alone does not prove an indexing failure. SSR is a decision requiring evidence and an approved maintenance tradeoff.
