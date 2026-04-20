// Shared types for the Budget pillar. Kept separate from `actions.ts`
// because `"use server"` files only allow async function exports.

export type BudgetKind = "income" | "expense"

export type BudgetCategoryRow = {
  key: string
  label: string
  kind: BudgetKind
  sort_order: number
}

export type BudgetItemRow = {
  id: string
  category_key: string
  description: string
  planned_cents: number
  actual_cents: number | null
  incurred_at: string | null // YYYY-MM-DD
  notes: string
  created_at: string
}
