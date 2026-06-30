import * as React from "react"
import { cn } from "@/lib/utils"

function GlassCard({
  className,
  asChild,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }) {
  const Comp = asChild ? "section" : "div"
  return (
    <Comp
      data-slot="glass-card"
      className={cn(
        "rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl p-5 shadow-tile transition relative",
        className,
      )}
      {...props}
    />
  )
}

function GlassCardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn("flex flex-col gap-1 mb-4", className)}
      {...props}
    />
  )
}

function GlassCardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="glass-card-title"
      className={cn(
        "font-[family-name:var(--font-serif)] text-2xl text-blue-950 leading-tight",
        className,
      )}
      {...props}
    />
  )
}

function GlassCardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="glass-card-description"
      className={cn("text-sm text-slate-600", className)}
      {...props}
    />
  )
}

function GlassCardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="glass-card-content"
      className={cn("space-y-4", className)}
      {...props}
    />
  )
}

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
}
