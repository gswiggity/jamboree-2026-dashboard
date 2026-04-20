import { createClient } from "@/lib/supabase/server"
import { BudgetShell } from "./budget-shell"
import type {
  BudgetCategoryRow,
  BudgetItemRow,
  BudgetKind,
} from "./types"

export default async function BudgetPage() {
  const supabase = await createClient()

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from("budget_categories")
      .select("key, label, kind, sort_order")
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
    supabase
      .from("budget_items")
      .select(
        "id, category_key, description, planned_cents, actual_cents, incurred_at, notes, created_at",
      )
      .order("incurred_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ])

  const categoryRows: BudgetCategoryRow[] = (categories ?? []).map((c) => ({
    key: c.key,
    label: c.label,
    kind: c.kind as BudgetKind,
    sort_order: c.sort_order,
  }))

  const itemRows: BudgetItemRow[] = (items ?? []).map((i) => ({
    id: i.id,
    category_key: i.category_key,
    description: i.description,
    planned_cents: i.planned_cents,
    actual_cents: i.actual_cents,
    incurred_at: i.incurred_at,
    notes: i.notes,
    created_at: i.created_at,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Budget</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Plan festival income and expenses, then track actuals as money moves.
        </p>
      </div>

      <BudgetShell categories={categoryRows} items={itemRows} />
    </div>
  )
}
