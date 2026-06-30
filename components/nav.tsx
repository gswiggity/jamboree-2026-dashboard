"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, Menu, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Leaf = { href: string; label: string; exact?: boolean }
type Item = Leaf | { label: string; children: Leaf[] }

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Dashboard" },
  {
    label: "Talent",
    children: [
      { href: "/lineup", label: "Lineup" },
      { href: "/performers", label: "Performers" },
      { href: "/submissions", label: "Submissions" },
      { href: "/judge", label: "Judging" },
    ],
  },
  { href: "/analysis", label: "Analysis" },
  {
    label: "Production",
    children: [
      { href: "/production", label: "Schedule", exact: true },
      { href: "/production/programming", label: "Programming" },
    ],
  },
  { href: "/documents", label: "Documents" },
  {
    label: "Ops",
    children: [
      { href: "/tasks", label: "Tasks" },
      { href: "/volunteers", label: "Volunteers" },
      { href: "/budget", label: "Budget" },
      { href: "/tickets", label: "Tickets" },
      { href: "/marketing", label: "Marketing" },
    ],
  },
  { href: "/settings", label: "Settings" },
]

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80"

function isActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + "/")
}

export function Nav({ email }: { email: string; role?: "admin" | "member" }) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile menu on route change.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Lock scroll while open.
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  async function signOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-4 z-40 px-4">
      <div className="mx-auto max-w-6xl flex items-center gap-4 rounded-full border border-white/70 bg-white/80 backdrop-blur-xl px-4 py-2 shadow-nav">
        <Link
          href="/dashboard"
          className={cn(
            "font-[family-name:var(--font-shrikhand)] text-xl text-brand-deep tracking-wide leading-none translate-y-[1px] px-1 rounded-full",
            FOCUS_RING,
          )}
        >
          Jamboree
        </Link>
        <nav className="hidden md:flex items-center gap-0.5 text-sm font-medium">
          {ITEMS.map((item) =>
            "href" in item ? (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3.5 py-1.5 rounded-full transition",
                  FOCUS_RING,
                  isActive(pathname, item.href)
                    ? "bg-brand-deep text-white"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/60",
                )}
              >
                {item.label}
              </Link>
            ) : (
              <GroupMenu key={item.label} item={item} pathname={pathname} />
            ),
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-xs font-medium text-slate-600">
            {email}
          </span>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className={cn(
              "hidden sm:inline-flex text-xs font-medium text-slate-600 hover:text-slate-900 transition disabled:opacity-50 px-2 py-1 rounded-full hover:bg-slate-100/60",
              FOCUS_RING,
            )}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((v) => !v)}
            className={cn(
              "md:hidden inline-flex items-center justify-center h-9 w-9 rounded-full text-slate-700 hover:bg-slate-100/60",
              FOCUS_RING,
            )}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <MobileMenu
          email={email}
          pathname={pathname}
          onClose={() => setMobileOpen(false)}
          onSignOut={signOut}
          signingOut={signingOut}
        />
      )}
    </header>
  )
}

function MobileMenu({
  email,
  pathname,
  onClose,
  onSignOut,
  signingOut,
}: {
  email: string
  pathname: string
  onClose: () => void
  onSignOut: () => void
  signingOut: boolean
}) {
  return (
    <div className="md:hidden fixed inset-0 z-50 pt-20">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
      />
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        className="relative mx-4 rounded-3xl border border-white/70 bg-white/95 backdrop-blur-xl shadow-pop p-3 max-h-[80vh] overflow-y-auto"
      >
        <nav className="space-y-1 text-sm">
          {ITEMS.flatMap((item) =>
            "href" in item ? [item] : item.children,
          ).map((leaf) => {
            const active = isActive(pathname, leaf.href, "exact" in leaf ? leaf.exact : false)
            return (
              <Link
                key={leaf.href}
                href={leaf.href}
                onClick={onClose}
                className={cn(
                  "block px-4 py-3 rounded-2xl text-base font-medium transition",
                  FOCUS_RING,
                  active
                    ? "bg-brand-deep text-white"
                    : "text-slate-800 hover:bg-slate-100",
                )}
              >
                {leaf.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-slate-200/70 mt-2 pt-3 px-4 pb-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-600 truncate">{email}</span>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className={cn(
              "text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-2 rounded-full hover:bg-slate-100/70 disabled:opacity-50",
              FOCUS_RING,
            )}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupMenu({
  item,
  pathname,
}: {
  item: { label: string; children: Leaf[] }
  pathname: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const childActive = item.children.some((c) => isActive(pathname, c.href, c.exact))

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setOpen(true)
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "px-3.5 py-1.5 rounded-full transition inline-flex items-center gap-1",
          FOCUS_RING,
          childActive
            ? "bg-brand-deep text-white"
            : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/60",
        )}
      >
        {item.label}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-180",
            childActive ? "opacity-80" : "opacity-60",
          )}
        />
      </button>
      {open && (
        <div
          role="menu"
          onMouseLeave={() => setOpen(false)}
          className="absolute left-0 top-full pt-2 min-w-[180px] z-50"
        >
          <div className="rounded-2xl border border-white/70 bg-white/95 backdrop-blur-xl shadow-pop overflow-hidden p-1">
            {item.children.map((c) => {
              const active = isActive(pathname, c.href, c.exact)
              return (
                <Link
                  key={c.href}
                  href={c.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-xl text-sm transition",
                    FOCUS_RING,
                    active
                      ? "bg-brand-deep text-white"
                      : "text-slate-700 hover:bg-slate-100/70 hover:text-slate-950",
                  )}
                >
                  {c.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
