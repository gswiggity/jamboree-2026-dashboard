"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Leaf = { href: string; label: string }
type Item = Leaf | { label: string; children: Leaf[] }

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Dashboard" },
  {
    label: "Talent",
    children: [
      { href: "/submissions", label: "Submissions" },
      { href: "/judge", label: "Judging" },
      { href: "/lineup", label: "Lineup" },
    ],
  },
  { href: "/analysis", label: "Analysis" },
  { href: "/production", label: "Production" },
  { href: "/documents", label: "Documents" },
  {
    label: "Ops",
    children: [
      { href: "/tasks", label: "Tasks" },
      { href: "/volunteers", label: "Volunteers" },
    ],
  },
  { href: "/settings", label: "Settings" },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

export function Nav({ email }: { email: string; role?: "admin" | "member" }) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-4 z-40 px-4">
      <div className="mx-auto max-w-6xl flex items-center gap-4 rounded-full border border-white/70 bg-white/80 backdrop-blur-xl px-4 py-2 shadow-[0_4px_20px_rgb(15,23,42,0.05)]">
        <Link
          href="/dashboard"
          className="font-[family-name:var(--font-shrikhand)] text-xl text-[#1e3aa8] tracking-wide leading-none translate-y-[1px] px-1"
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
                  isActive(pathname, item.href)
                    ? "bg-blue-950 text-white"
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
            className="text-xs font-medium text-slate-600 hover:text-slate-900 transition disabled:opacity-50 px-2 py-1 rounded-full hover:bg-slate-100/60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
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
  const childActive = item.children.some((c) => isActive(pathname, c.href))

  // Close on outside click / escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Close when the route changes (after navigating via a child link).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "px-3.5 py-1.5 rounded-full transition inline-flex items-center gap-1",
          childActive
            ? "bg-blue-950 text-white"
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
          <div className="rounded-2xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_12px_32px_-16px_rgba(15,23,42,0.25)] overflow-hidden p-1">
            {item.children.map((c, idx) => {
              const active = isActive(pathname, c.href)
              return (
                <Link
                  key={c.href}
                  href={c.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm transition",
                    active
                      ? "bg-blue-950 text-white"
                      : "text-slate-700 hover:bg-slate-100/70 hover:text-slate-950",
                  )}
                >
                  <span>{c.label}</span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.18em] font-semibold",
                      active ? "text-white/70" : "text-slate-400",
                    )}
                  >
                    {idx + 1}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
