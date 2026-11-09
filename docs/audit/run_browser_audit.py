"""Browser evidence against local fixture data only. No production requests."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path(__file__).resolve().parent / "evidence"
out.mkdir(exist_ok=True)
results = {"data": "25 synthetic products/ingredients/recipes in ephemeral SQLite; no production data", "screens": [], "console_errors": [], "page_errors": [], "checks": {}}

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    # Ensure that product and font assets cannot contact production or third parties.
    def local_only(route):
        if route.request.url.startswith("http://127.0.0.1:18731/api/"):
            response = route.fetch(url=route.request.url.replace(":18731/api/", ":18732/api/"))
            route.fulfill(response=response)
        elif route.request.url.startswith(("http://127.0.0.1:", "http://localhost:", "data:", "blob:")):
            route.continue_()
        else:
            route.abort()
    context.route("**/*", local_only)
    page = context.new_page()
    page.on("console", lambda msg: results["console_errors"].append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda error: results["page_errors"].append(str(error)))
    def shot(name):
        page.screenshot(path=str(out / f"{name}.png"), full_page=True)
        results["screens"].append(f"{name}.png")
    def go(path):
        page.goto("http://127.0.0.1:18731" + path)
        page.wait_for_load_state("networkidle")
    go("/")
    shot("storefront-desktop")
    results["checks"]["storefront_product_25_visible"] = page.get_by_text("Audit donut 25", exact=True).count()
    results["checks"]["storefront_navigation_ms"] = page.evaluate("performance.getEntriesByType('navigation')[0].duration")
    results["checks"]["storefront_headings"] = page.locator("h1,h2").all_text_contents()
    page.set_viewport_size({"width": 390, "height": 844})
    shot("storefront-mobile")
    results["checks"]["storefront_mobile_overflow"] = page.evaluate("document.documentElement.scrollWidth > innerWidth")
    go("/login")
    shot("login-mobile")
    results["checks"]["login_unlabelled_controls"] = page.locator("input").evaluate_all("els => els.filter(e => !e.labels.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).map(e => e.name)")
    # Establish a real local cookie session, then use the actual owner routes.
    login = context.request.post("http://127.0.0.1:18732/api/auth/login/", data={"username": "local-audit", "password": os.environ["AUDIT_PASSWORD"]})
    results["checks"]["local_login_status"] = login.status
    assert login.status == 200, f"Local fixture login failed: {login.status}"
    go("/dashboard")
    shot("dashboard-mobile")
    page.set_viewport_size({"width": 1440, "height": 1000})
    shot("dashboard-desktop")
    go("/recipes/new")
    shot("recipe-form-desktop")
    results["checks"]["recipe_product_options"] = page.locator("select").first.locator("option").count()
    page.get_by_role("button", name="Add Row", exact=True).click()
    results["checks"]["recipe_ingredient_options"] = page.get_by_role("combobox", name="Ingredient 1", exact=True).locator("option").count()
    page.set_viewport_size({"width": 390, "height": 844})
    shot("recipe-form-mobile")
    go("/sales/new")
    page.get_by_role("button", name="Add Item", exact=True).click()
    shot("sale-form-mobile")
    results["checks"]["sale_form_mobile_overflow"] = page.evaluate("document.documentElement.scrollWidth > innerWidth")
    results["checks"]["sale_form_min_product_width"] = page.get_by_role("combobox").first.evaluate("el => el.getBoundingClientRect().width")
    page.set_viewport_size({"width": 1440, "height": 1000})
    go("/ingredients")
    shot("ingredients-desktop")
    # Existing search applies to current page, despite 25-record backend count.
    search = page.get_by_role("textbox", name="Search ingredients")
    search.fill("Audit ingredient 25")
    results["checks"]["search_record_25_visible"] = page.get_by_text("Audit ingredient 25", exact=True).count()
    shot("ingredients-page-search")
    browser.close()
(out / "browser-results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print(json.dumps(results, indent=2))
