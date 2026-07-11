import { Pencil, Trash2 } from "lucide-react";
import type { Expense } from "@/types/expense.types";
import ExpenseCategoryBadge from "@/components/ExpenseCategoryBadge";

interface ExpenseRowProps {
  expense: Expense;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ExpenseRow({ expense, onEdit, onDelete }: ExpenseRowProps) {
  return (
    <div
      className="group/row flex items-center gap-4 px-4 py-3.5 sm:px-5 transition-colors hover:bg-[#FFF8F0]"
      style={{ borderTop: "1px solid #F5EDE0" }}
    >
      {/* Category */}
      <div className="w-28 flex-shrink-0">
        <ExpenseCategoryBadge category={expense.category} label={expense.category_display} />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="font-body truncate" style={{ fontSize: 13.5, color: "#3D3A35" }}>
          {expense.description || <span style={{ color: "#D1CEC7" }}>No description</span>}
        </p>
      </div>

      {/* Amount */}
      <div
        className="flex-shrink-0 font-heading font-semibold text-right"
        style={{ fontSize: 15, color: "#6B4226", minWidth: 84 }}
      >
        ₱{Number(expense.amount).toFixed(2)}
      </div>

      {/* Quick actions — always visible on touch, hover/focus-reveal on desktop */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{ width: 32, height: 32, color: "#B8A98D" }}
          onMouseOver={e => {
            (e.currentTarget as HTMLElement).style.background = "#FFF0F7";
            (e.currentTarget as HTMLElement).style.color = "#FF6FAE";
          }}
          onMouseOut={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "#B8A98D";
          }}
          aria-label={`Edit ${expense.category_display.toLowerCase()} expense of ₱${Number(expense.amount).toFixed(2)}`}
        >
          <Pencil size={15} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{ width: 32, height: 32, color: "#B8A98D" }}
          onMouseOver={e => {
            (e.currentTarget as HTMLElement).style.background = "#FEF2F2";
            (e.currentTarget as HTMLElement).style.color = "#EF4444";
          }}
          onMouseOut={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "#B8A98D";
          }}
          aria-label={`Delete ${expense.category_display.toLowerCase()} expense of ₱${Number(expense.amount).toFixed(2)}`}
        >
          <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
