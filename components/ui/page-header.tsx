import * as React from "react"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  kicker?: string
  title: React.ReactNode
  accent?: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  kicker,
  title,
  accent,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {kicker && (
          <div className="text-[11px] uppercase tracking-[0.3em] font-semibold text-blue-900 mb-2">
            {kicker}
          </div>
        )}
        <h1 className="font-[family-name:var(--font-serif)] text-4xl sm:text-5xl text-blue-950 leading-[1.05]">
          {title}
          {accent && (
            <>
              {" "}
              <span className="italic text-brand">{accent}</span>
            </>
          )}
        </h1>
        {description && (
          <p className="text-sm text-slate-700 mt-3 max-w-xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-col items-end gap-2 shrink-0">{actions}</div>
      )}
    </div>
  )
}
