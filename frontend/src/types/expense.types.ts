export type ExpenseCategory =
  | "ingredient"
  | "packaging"
  | "utilities"
  | "transportation"
  | "other";

export interface Expense {
  id: number;
  category: ExpenseCategory;
  category_display: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface ExpensePayload {
  category: ExpenseCategory;
  amount: number;
  description?: string;
  date: string;
}
