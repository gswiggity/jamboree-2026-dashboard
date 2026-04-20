import Link from "next/link"
import { Shrikhand, Instrument_Serif } from "next/font/google"
import { ArrowUpRight, Sparkles, Sun, Moon, Feather, Newspaper, LayoutGrid } from "lucide-react"

const shrikhand = Shrikhand({ weight: "400", subsets: ["latin"], variable: "--font-shrikhand" })
const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-serif" })

type Variant = {
  slug: string
  name: string
  tagline: string
  description: string
  palette: string[]
  vibe: string
  Icon: typeof Sparkles
  accent: string
}

const ORIGINALS: Variant[] = [
  {
    slug: "dashboard",
    name: "Cobalt",
    tagline: "Swear Jar brand-forward",
    description:
      "Deep navy → cobalt gradient hero, Shrikhand wordmark, black nav. The baseline that matches the festival's existing website.",
    palette: ["#0b1437", "#1e3a8a", "#2563eb", "#38bdf8", "#f8fafc"],
    vibe: "Brand canonical · Bold · Warm type",
    Icon: Sparkles,
    accent: "from-blue-600 to-indigo-500",
  },
  {
    slug: "dashboard-cockpit",
    name: "Dark Cockpit",
    tagline: "Morning Alex-inspired command deck",
    description:
      "Slate-950 with ambient blue glows, icon sidebar, week strip, 6-pillar grid with gradient accents, today's agenda. Operator energy.",
    palette: ["#020617", "#0f172a", "#1e293b", "#3b82f6", "#22d3ee"],
    vibe: "Dark · Dense · Operator",
    Icon: Moon,
    accent: "from-cyan-400 to-blue-500",
  },
]

const AIRY_FAMILY: Variant[] = [
  {
    slug: "dashboard-airy",
    name: "Airy · Base",
    tagline: "Original light editorial",
    description:
      "Powder-blue gradient, glass pill nav, centered editorial hero with Instrument Serif italic accents. The original reference.",
    palette: ["#e0f2fe", "#ffffff", "#bae6fd", "#1e40af", "#0f172a"],
    vibe: "Glass · Centered · Reference",
    Icon: Sun,
    accent: "from-sky-400 to-blue-500",
  },
  {
    slug: "dashboard-airy-polish",
    name: "Airy · Polish",
    tagline: "Readability tune-up",
    description:
      "Same skeleton, stronger body contrast, tighter type rhythm, clearer countdown, colour-coded verdict dots, larger section headings.",
    palette: ["#e0f2fe", "#ffffff", "#cbd5e1", "#1e3aa8", "#0f172a"],
    vibe: "Minor changes · Accessible · Scannable",
    Icon: Feather,
    accent: "from-sky-400 to-blue-500",
  },
  {
    slug: "dashboard-airy-editorial",
    name: "Airy · Editorial",
    tagline: "Magazine masthead treatment",
    description:
      "Masthead header, asymmetric split hero, numbered sections with roman numerals, pull quotes, editorial pillar table with progress bars, byline colophon.",
    palette: ["#f0f9ff", "#ffffff", "#94a3b8", "#1e3aa8", "#0b1437"],
    vibe: "Editorial · Considered · Newsprint",
    Icon: Newspaper,
    accent: "from-blue-400 to-indigo-500",
  },
  {
    slug: "dashboard-airy-bento",
    name: "Airy · Bento",
    tagline: "Dimensional grid with data viz",
    description:
      "12-col bento grid with varied tile sizes, countdown progress ring, submissions sparkline, budget bar, deep-navy ticket-goal tile as visual anchor.",
    palette: ["#e0f2fe", "#ffffff", "#bae6fd", "#2340d9", "#0b1437"],
    vibe: "Bento · Data-rich · Dynamic",
    Icon: LayoutGrid,
    accent: "from-blue-500 to-cyan-400",
  },
]

export default function PreviewIndex() {
  return (
    <div className={`${shrikhand.variable} ${serif.variable} min-h-screen bg-slate-950 text-slate-100 relative`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute top-1/2 right-0 h-96 w-96 rounded-full bg-cyan-400/10 blur-[120px]" />
      </div>

      <main className="relative mx-auto max-w-6xl px-6 py-16">
        <header className="mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-300 backdrop-blur">
            <Sparkles className="h-3 w-3" />
            Design preview
          </div>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            <span className="text-slate-100">Pick a dashboard direction for </span>
            <span className="font-[family-name:var(--font-shrikhand)] text-sky-300">Jamboree</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-400">
            Four airy iterations on top, two alternate directions below. Click any card to see it live.
          </p>
        </header>

        {/* AIRY FAMILY — featured */}
        <section className="mb-16">
          <div className="mb-5 flex items-baseline justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-white">Airy family</h2>
              <span className="text-xs font-medium uppercase tracking-wider text-sky-300">Focus direction</span>
            </div>
            <span className="text-xs text-slate-500">Base + 3 iterations</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {AIRY_FAMILY.map((variant) => (
              <VariantCard key={variant.slug} variant={variant} featured />
            ))}
          </div>
        </section>

        {/* ALTERNATES */}
        <section>
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold text-white">Alternate directions</h2>
            <span className="text-xs text-slate-500">For reference</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {ORIGINALS.map((variant) => (
              <VariantCard key={variant.slug} variant={variant} />
            ))}
          </div>
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-slate-500">
          <div>
            Mock data — not wired to Supabase. Real <code className="rounded bg-white/5 px-1.5 py-0.5">/dashboard</code> still
            uses the original layout.
          </div>
        </footer>
      </main>
    </div>
  )
}

function VariantCard({ variant, featured }: { variant: Variant; featured?: boolean }) {
  return (
    <Link
      href={`/preview/${variant.slug}`}
      className={`group relative overflow-hidden rounded-3xl border p-6 transition ${
        featured
          ? "border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] hover:border-sky-400/40"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.08]"
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${variant.accent} opacity-70 transition group-hover:opacity-100`} />
      <div className="mb-5 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <variant.Icon className="h-5 w-5 text-slate-200" />
        </div>
        <ArrowUpRight className="h-5 w-5 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
      </div>

      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">{variant.vibe}</div>
      <h3 className="mb-1 text-xl font-semibold text-white">{variant.name}</h3>
      <p className="mb-3 text-sm italic text-slate-400 font-[family-name:var(--font-serif)]">{variant.tagline}</p>
      <p className="mb-5 text-sm leading-relaxed text-slate-300">{variant.description}</p>

      <div className="flex gap-1.5">
        {variant.palette.map((color) => (
          <div
            key={color}
            className="h-6 w-6 rounded-md border border-white/10"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </Link>
  )
}
