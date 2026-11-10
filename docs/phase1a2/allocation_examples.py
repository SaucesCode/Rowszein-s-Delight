"""Generate prospective numeric examples from the tested UNWIRED kernel."""
from decimal import Decimal
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / "backend"))
from sales.inventory_math import Basis, Change, project_stock, quantity_text

old = Basis(Decimal("0.01"), 3, "kg")
new = Basis(Decimal("0.02"), 3, "kg")


def trace(start, steps):
    stock = Decimal(start)
    rows = []
    for name, changes in steps:
        plan = project_stock(stock, "kg", changes)
        rows.append({"operation": name, "stock_before": quantity_text(stock), "delta": format(plan.quantity_delta, ".9f"), "stock_after": quantity_text(plan.resulting_quantity)})
        stock = plan.resulting_quantity
    return rows


examples = {
    "status": "Design-kernel examples, not application endpoint behavior",
    "same_basis_lifecycle": trace("1", [
        ("Sell A=1", [Change(old, 0, 1)]), ("Sell B=1", [Change(old, 1, 2)]),
        ("Sell C=1", [Change(old, 2, 3)]), ("Update B=2", [Change(old, 3, 4)]),
        ("Cancel A=1", [Change(old, 4, 3)]), ("Cancel B=2", [Change(old, 3, 1)]),
        ("Cancel C=1", [Change(old, 1, 0)]),
    ]),
    "changed_or_removed_recipe": trace("1", [
        ("Sell A using original basis", [Change(old, 0, 1)]),
        ("Update A to different basis", [Change(old, 1, 0), Change(new, 0, 1)]),
        ("Cancel A after recipe removal", [Change(new, 1, 0)]),
    ]),
    "serialized_order_of_three_concurrent_sales": trace("0.01", [
        ("First lock winner", [Change(old, 0, 1)]), ("Second lock winner", [Change(old, 1, 2)]),
        ("Third lock winner", [Change(old, 2, 3)]),
    ]),
}
assert examples["same_basis_lifecycle"][-1]["stock_after"] == "1.000000000"
assert examples["changed_or_removed_recipe"][-1]["stock_after"] == "1.000000000"
assert examples["serialized_order_of_three_concurrent_sales"][-1]["stock_after"] == "0.000000000"
(root / "docs/phase1a2/evidence/allocation-examples.json").write_text(json.dumps(examples, indent=2) + "\n", encoding="utf-8")
print(json.dumps(examples, indent=2))
