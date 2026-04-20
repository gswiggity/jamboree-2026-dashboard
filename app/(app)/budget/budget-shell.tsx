"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  createBudgetCategory,
  createBudgetItem,
  deleteBudgetCategory,
  deleteBudgetItem,
  updateBudgetCategory,
  updateBudgetItem,
} from "./actions"
import { ItemDialog } from "./item-dialog"
import type {
  BudgetCategoryRow,
  BudgetItemRow,
  BudgetKind,
} from "./types"

type ShellProps = {
  categories: BudgetCategoryRow[]
  items: BudgetItemRow[]
}

export function BudgetShell({ categories, items }: ShellProps) {
  const [editingItem, setEditingItem] = useState<BudgetItemRow | null>(null)
  const [creatingKind, setCreatingKind] = useState<BudgetKind | null>(null)
  const [creatingCategoryKey, setCreatingCategoryKey] = useState<string | null>(
    null,
  )

  const categoriesByKey = useMemo(
    () => new Map(categories.map((c) => [c.key, c])),
    [categories],
  )

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.kind === "income"),
    [categories],
  )
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === "expense"),
    [categories],
  )

  // category_key → items
  const itemsByCategory = useMemo(() => {
    const m = new Map<string, BudgetItemRow[]>()
    for (const i of items) {
      const arr = m.get(i.category_key)
      if (arr) arr.push(i)
      else m.set(i.category_key, [i])
    }
    return m
  }, [items])

  const totals = useMemo(() => {
    let plannedIncome = 0
    let plannedExpense = 0
    let actualIncome = 0
    let actualExpense = 0
    for (const i of items) {
      const cat = categoriesByKey.get(i.category_key)
      const kind = cat?.kind
      if (kind === "income") {
        plannedIncome += i.planned_cents
        if (i.actual_cents !== null) actualIncome += i.actual_cents
      } else if (kind === "expense") {
        plannedExpense += i.planned_cents
        if (i.actual_cents !== null) actualExpense += i.actual_cents
      }
    }
    return {
      plannedIncome,
      plannedExpense,
      plannedNet: plannedIncome - plannedExpense,
      actualIncome,
      actualExpense,
      actualNet: actualIncome - actualExpense,
    }
  }, [items, categoriesByKey])

  // Figure out which category the edit dialog should default to.
  const editingCategory = editingItem
    ? categoriesByKey.get(editingItem.category_key)
    : null
  const creatingCategory = creatingCategoryKey
    ? categoriesByKey.get(creatingCategoryKey)
    : null
  const dialogKind: BudgetKind | null =
    editingCategory?.kind ?? creatingCategory?.kind ?? creatingKind ?? null

  const dialogCategories = dialogKind
    ? categories.filter((c) => c.kind === dialogKind)
    : []

  return (
    <div className="space-y-5">
      <StatsBar totals={totals} />

      <Tabs defaultValue="ledger" className="gap-5">
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-6">
          <Section
            title="Income"
            kind="income"
            tone="good"
            categories={incomeCategories}
            itemsByCategory={itemsByCategory}
            onAddToCategory={(categoryKey) => {
              setCreatingCategoryKey(categoryKey)
              setCreatingKind(null)
            }}
            onAddStandalone={() => {
              setCreatingKind("income")
              setCreatingCategoryKey(null)
            }}
            onEdit={setEditingItem}
          />
          <Section
            title="Expense"
            kind="expense"
            tone="alert"
            categories={expenseCategories}
            itemsByCategory={itemsByCategory}
            onAddToCategory={(categoryKey) => {
              setCreatingCategoryKey(categoryKey)
              setCreatingKind(null)
            }}
            onAddStandalone={() => {
              setCreatingKind("expense")
              setCreatingCategoryKey(null)
            }}
            onEdit={setEditingItem}
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-5">
          <CategoriesPanel categories={categories} />
        </TabsContent>
      </Tabs>

      <ItemDialog
        mode={
          editingItem ? "edit" : creatingKind || creatingCategoryKey ? "create" : "closed"
        }
        initial={editingItem}
        defaultCategoryKey={creatingCategoryKey}
        categories={dialogCategories}
        kind={dialogKind}
        onClose={() => {
          setEditingItem(null)
          setCreatingKind(null)
          setCreatingCategoryKey(null)
        }}
        onSubmit={async (input) => {
          if (editingItem) return updateBudgetItem(editingItem.id, input)
          return createBudgetItem(input)
        }}
        onDelete={
          editingItem
            ? async () => deleteBudgetItem(editingItem.id)
            : undefined
        }
      />
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Stats bar
// ——————————————————————————————————————————————————————————

function StatsBar({
  totals,
}: {
  totals: {
    plannedIncome: number
    plannedExpense: number
    plannedNet: number
    actualIncome: number
    actualExpense: number
    actualNet: number
  }
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Stat
        label="Planned income"
        value={formatMoney(totals.plannedIncome)}
        sub={`${formatMoney(totals.actualIncome)} actual`}
        tone="good"
      />
      <Stat
        label="Planned expense"
        value={formatMoney(totals.plannedExpense)}
        sub={`${formatMoney(totals.actualExpense)} actual`}
        tone="alert"
      />
      <Stat
        label="Planned net"
        value={formatMoney(totals.plannedNet)}
        tone={
          totals.plannedNet > 0
            ? "good"
            : totals.plannedNet < 0
              ? "alert"
              : "neutral"
        }
      />
      <Stat
        label="Actual net"
        value={formatMoney(totals.actualNet)}
        tone={
          totals.actualNet > 0
            ? "good"
            : totals.actualNet < 0
              ? "alert"
              : "neutral"
        }
      />
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string
  value: number | string
  sub?: string
  tone?: "neutral" | "good" | "warn" | "alert"
}) {
  const toneClasses = {
    neutral: "text-slate-900",
    good: "text-emerald-700",
    warn: "text-amber-700",
    alert: "text-rose-700",
  }[tone]
  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl px-4 py-3 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]">
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
        <span className={cn("text-2xl font-semibold tabular-nums", toneClasses)}>
          {value}
        </span>
        {sub && (
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}

// ——————————————————————————————————————————————————————————
// Income / Expense section
// ——————————————————————————————————————————————————————————

function Section({
  title,
  kind,
  tone,
  categories,
  itemsByCategory,
  onAddToCategory,
  onAddStandalone,
  onEdit,
}: {
  title: string
  kind: BudgetKind
  tone: "good" | "alert"
  categories: BudgetCategoryRow[]
  itemsByCategory: Map<string, BudgetItemRow[]>
  onAddToCategory: (categoryKey: string) => void
  onAddStandalone: () => void
  onEdit: (item: BudgetItemRow) => void
}) {
  const sectionTotals = useMemo(() => {
    let planned = 0
    let actual = 0
    for (const c of categories) {
      const items = itemsByCategory.get(c.key) ?? []
      for (const i of items) {
        planned += i.planned_cents
        if (i.actual_cents !== null) actual += i.actual_cents
      }
    }
    return { planned, actual }
  }, [categories, itemsByCategory])

  const Icon = kind === "income" ? TrendingUp : TrendingDown
  const toneClass =
    tone === "good"
      ? "text-emerald-700 bg-emerald-50 border-emerald-100"
      : "text-rose-700 bg-rose-50 border-rose-100"

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full border",
              toneClass,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <span className="text-xs text-slate-500 tabular-nums">
            {formatMoney(sectionTotals.planned)} planned ·{" "}
            {formatMoney(sectionTotals.actual)} actual
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onAddStandalone}
          disabled={categories.length === 0}
          title={
            categories.length === 0
              ? `Create a ${kind} category first.`
              : `Add a ${kind} line item`
          }
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add {kind}
        </Button>
      </header>

      {categories.length === 0 ? (
        <EmptyState
          title={`No ${kind} categories.`}
          body={`Add one on the Categories tab to start tracking ${kind}.`}
        />
      ) : (
        <ul className="space-y-2">
          {categories.map((c) => (
            <CategoryBlock
              key={c.key}
              category={c}
              items={itemsByCategory.get(c.key) ?? []}
              onAdd={() => onAddToCategory(c.key)}
              onEdit={onEdit}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function CategoryBlock({
  category,
  items,
  onAdd,
  onEdit,
}: {
  category: BudgetCategoryRow
  items: BudgetItemRow[]
  onAdd: () => void
  onEdit: (item: BudgetItemRow) => void
}) {
  const totals = useMemo(() => {
    let planned = 0
    let actual = 0
    for (const i of items) {
      planned += i.planned_cents
      if (i.actual_cents !== null) actual += i.actual_cents
    }
    return { planned, actual }
  }, [items])

  return (
    <li className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold text-slate-900 truncate">
            {category.label}
          </span>
          <span className="text-[11px] tabular-nums text-slate-500 shrink-0">
            {formatMoney(totals.planned)}
            {totals.actual > 0 && (
              <>
                {" "}
                · <span className="text-slate-700">{formatMoney(totals.actual)} actual</span>
              </>
            )}
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onAdd}
          className="text-slate-600 shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-slate-200/60 border-t border-slate-200/60">
          {items.map((i) => (
            <ItemRow key={i.id} item={i} onClick={() => onEdit(i)} />
          ))}
        </ul>
      )}
    </li>
  )
}

function ItemRow({
  item,
  onClick,
}: {
  item: BudgetItemRow
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-50/80 transition"
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-900 truncate">
            {item.description}
          </div>
          <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2 mt-0.5">
            {item.incurred_at && <span>{formatDay(item.incurred_at)}</span>}
            {item.notes && (
              <span className="truncate max-w-[24ch]">{item.notes}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums text-slate-900">
            {formatMoney(item.planned_cents)}
          </div>
          <div
            className={cn(
              "text-[11px] tabular-nums",
              item.actual_cents === null
                ? "text-slate-400"
                : item.actual_cents === item.planned_cents
                  ? "text-emerald-700"
                  : item.actual_cents > item.planned_cents
                    ? "text-amber-700"
                    : "text-slate-600",
            )}
          >
            {item.actual_cents === null
              ? "—"
              : `${formatMoney(item.actual_cents)} actual`}
          </div>
        </div>
      </button>
    </li>
  )
}

// ——————————————————————————————————————————————————————————
// Categories panel — manage the catalog
// ——————————————————————————————————————————————————————————

function CategoriesPanel({ categories }: { categories: BudgetCategoryRow[] }) {
  const income = categories.filter((c) => c.kind === "income")
  const expense = categories.filter((c) => c.kind === "expense")
  return (
    <div className="space-y-5">
      <CategoryList kind="income" title="Income categories" categories={income} />
      <CategoryList
        kind="expense"
        title="Expense categories"
        categories={expense}
      />
    </div>
  )
}

function CategoryList({
  kind,
  title,
  categories,
}: {
  kind: BudgetKind
  title: string
  categories: BudgetCategoryRow[]
}) {
  const router = useRouter()
  const [newLabel, setNewLabel] = useState("")
  const [pending, startTransition] = useTransition()

  function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    startTransition(async () => {
      const res = await createBudgetCategory({ label, kind })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Added "${label}".`)
      setNewLabel("")
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">
        {title}
        <span className="ml-2 text-slate-400 font-normal tabular-nums">
          {categories.length}
        </span>
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleAdd()
        }}
        className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl p-3 shadow-[0_8px_28px_-18px_rgba(30,58,138,0.18)]"
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 flex-1 min-w-[220px]">
            <Label
              htmlFor={`${kind}-new-category`}
              className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500"
            >
              New {kind} category
            </Label>
            <Input
              id={`${kind}-new-category`}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={
                kind === "income" ? "e.g. Raffle proceeds" : "e.g. Insurance"
              }
              disabled={pending}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={pending || !newLabel.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {pending ? "Adding…" : "Add"}
          </Button>
        </div>
      </form>

      {categories.length === 0 ? (
        <EmptyState
          title={`No ${kind} categories yet.`}
          body={`Add one to group ${kind} line items.`}
        />
      ) : (
        <ul className="divide-y divide-slate-200/60 rounded-2xl border border-slate-200/70 overflow-hidden bg-white/40 text-sm">
          {categories.map((c, idx) => (
            <CategoryItem
              key={c.key}
              category={c}
              isFirst={idx === 0}
              isLast={idx === categories.length - 1}
              prev={categories[idx - 1]}
              next={categories[idx + 1]}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function CategoryItem({
  category,
  isFirst,
  isLast,
  prev,
  next,
}: {
  category: BudgetCategoryRow
  isFirst: boolean
  isLast: boolean
  prev: BudgetCategoryRow | undefined
  next: BudgetCategoryRow | undefined
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(category.label)
  const [pending, startTransition] = useTransition()

  // Keep the draft in sync when a re-render brings a new label in.
  if (!editing && label !== category.label) setLabel(category.label)

  function saveLabel() {
    const trimmed = label.trim()
    if (!trimmed || trimmed === category.label) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      const res = await updateBudgetCategory(category.key, { label: trimmed })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setEditing(false)
      toast.success("Category updated.")
      router.refresh()
    })
  }

  function handleDelete() {
    if (
      !confirm(
        `Delete the "${category.label}" category? Items in it will block the delete — move or delete them first.`,
      )
    )
      return
    startTransition(async () => {
      const res = await deleteBudgetCategory(category.key)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Category deleted.")
      router.refresh()
    })
  }

  function moveUp() {
    if (!prev) return
    startTransition(async () => {
      const res1 = await updateBudgetCategory(category.key, {
        sort_order: prev.sort_order,
      })
      const res2 = await updateBudgetCategory(prev.key, {
        sort_order: category.sort_order,
      })
      if (!res1.ok || !res2.ok) {
        toast.error(
          (!res1.ok && res1.error) ||
            (!res2.ok && res2.error) ||
            "Failed to reorder.",
        )
        return
      }
      router.refresh()
    })
  }

  function moveDown() {
    if (!next) return
    startTransition(async () => {
      const res1 = await updateBudgetCategory(category.key, {
        sort_order: next.sort_order,
      })
      const res2 = await updateBudgetCategory(next.key, {
        sort_order: category.sort_order,
      })
      if (!res1.ok || !res2.ok) {
        toast.error(
          (!res1.ok && res1.error) ||
            (!res2.ok && res2.error) ||
            "Failed to reorder.",
        )
        return
      }
      router.refresh()
    })
  }

  return (
    <li className="py-2.5 px-3 flex items-center gap-3 bg-white/40">
      <div className="flex flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={moveUp}
          disabled={isFirst || pending}
          title="Move up"
          className="h-5 w-5"
        >
          <ArrowUp className="h-3 w-3" />
          <span className="sr-only">Move up</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={moveDown}
          disabled={isLast || pending}
          title="Move down"
          className="h-5 w-5"
        >
          <ArrowDown className="h-3 w-3" />
          <span className="sr-only">Move down</span>
        </Button>
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                saveLabel()
              }
              if (e.key === "Escape") {
                setLabel(category.label)
                setEditing(false)
              }
            }}
            disabled={pending}
            autoFocus
            className="h-8"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-medium text-slate-900 hover:text-[#2340d9] text-left"
          >
            {category.label}
          </button>
        )}
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
          {category.key}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
        disabled={pending || editing}
        title="Rename"
      >
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">Rename</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
        title="Delete category"
        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Delete</span>
      </Button>
    </li>
  )
}

// ——————————————————————————————————————————————————————————
// Helpers & small components
// ——————————————————————————————————————————————————————————

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-8 text-center">
      <p className="text-sm text-slate-700 font-medium">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{body}</p>
    </div>
  )
}

function formatMoney(cents: number): string {
  const dollars = cents / 100
  const sign = dollars < 0 ? "-" : ""
  const abs = Math.abs(dollars)
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function formatDay(day: string): string {
  // Parse as local date to avoid UTC-shift surprises.
  const [y, m, d] = day.split("-").map((n) => parseInt(n, 10))
  if (!y || !m || !d) return day
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
