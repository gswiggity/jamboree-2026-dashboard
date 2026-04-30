import Link from "next/link"
import {
  CalendarIcon,
  ClockIcon,
  ExternalLinkIcon,
  FlagIcon,
  LinkIcon,
  MapPinIcon,
  MusicIcon,
  PlayIcon,
  TagIcon,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { looksLikeUrl, toEmbedUrl } from "@/lib/video"
import { getActMembers, getActSubmitter, isPlaceholderActName } from "@/lib/solo-act"
import {
  classify,
  TIER_BLURB,
  TIER_LABEL,
  TIER_TONE,
  type Counts,
} from "@/lib/lineup-tiers"
import { ConversationsCard } from "./conversations-card"
import {
  SubmissionImagesCard,
  type SubmissionImage,
} from "./submission-images-card"

type SubmissionRow = {
  id: string
  type: string
  name: string | null
  email: string | null
  submitted_at: string | null
  // Supabase types this as `Json`; we narrow with an `as` cast when reading.
  data: unknown
  created_at: string
  supplemental_video_url: string | null
  deleted_at: string | null
}

type TeamJudgment = {
  user_id: string
  verdict: string | null
  notes: string | null
  updated_at: string | null
  profiles: { email: string | null; full_name: string | null } | { email: string | null; full_name: string | null }[] | null
}

type MyJudgment = { verdict: string | null; notes: string | null } | null

const VERDICT_TONE: Record<string, string> = {
  yes: "bg-emerald-100 text-emerald-900 border-emerald-200",
  maybe: "bg-amber-100 text-amber-900 border-amber-200",
  no: "bg-rose-100 text-rose-900 border-rose-200",
}

const VERDICT_LABEL: Record<string, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
}

// Squarespace fields where socials sometimes hide. Order matters: we walk
// these in priority and bail on the first non-empty hit per platform.
const SOCIAL_PATTERNS: { kind: SocialKind; rx: RegExp; label: string }[] = [
  { kind: "instagram", label: "Instagram", rx: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([\w._%-]+)|@([\w._]+)\s*(?:\(|on\s+)?(?:ig|instagram)/i },
  { kind: "tiktok", label: "TikTok", rx: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w._%-]+)/i },
  { kind: "youtube", label: "YouTube", rx: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@?[\w._%-]+|channel\/[\w._-]+|c\/[\w._-]+)/i },
  { kind: "facebook", label: "Facebook", rx: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([\w._%-]+)/i },
  { kind: "twitter", label: "Twitter / X", rx: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([\w._%-]+)/i },
  { kind: "website", label: "Website", rx: /(?:https?:\/\/)[\w.-]+\.[a-z]{2,}(?:\/\S*)?/i },
]

type SocialKind = "instagram" | "tiktok" | "youtube" | "facebook" | "twitter" | "website"

type SocialHit = {
  kind: SocialKind
  label: string
  display: string
  url: string
  sourceField: string
}

// Yank a usable URL out of an arbitrary string. Adds https:// when the
// match was bare (instagram.com/foo without protocol).
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed) || /\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, "")}`
  }
  return trimmed
}

function extractSocials(data: Record<string, unknown> | null): SocialHit[] {
  if (!data) return []
  const seen = new Map<SocialKind, SocialHit>()
  for (const [field, value] of Object.entries(data)) {
    const str = typeof value === "string" ? value.trim() : ""
    if (!str) continue
    for (const pattern of SOCIAL_PATTERNS) {
      if (seen.has(pattern.kind)) continue
      const match = str.match(pattern.rx)
      if (!match) continue
      const url = normalizeUrl(match[0])
      seen.set(pattern.kind, {
        kind: pattern.kind,
        label: pattern.label,
        display: match[0].replace(/^https?:\/\/(www\.)?/i, ""),
        url,
        sourceField: field,
      })
    }
  }
  return Array.from(seen.values())
}

function getProfile(j: TeamJudgment): { email: string | null; full_name: string | null } | null {
  if (!j.profiles) return null
  return Array.isArray(j.profiles) ? j.profiles[0] ?? null : j.profiles
}

function pickString(data: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = data[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

function formatBlockTime(start: string, end: string): string {
  const fmt = (t: string) => {
    const [hh, mm] = t.split(":").map(Number)
    const period = hh < 12 ? "am" : "pm"
    const hh12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
    return mm === 0 ? `${hh12}${period}` : `${hh12}:${String(mm).padStart(2, "0")}${period}`
  }
  return `${fmt(start)} – ${fmt(end)}`
}

function formatBlockDay(day: string): string {
  // day is a YYYY-MM-DD string from a Postgres date column
  const d = new Date(`${day}T00:00:00`)
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export async function ActProfile({
  submission,
  myJudgment,
  teamJudgments,
  counts,
  submissionImages,
}: {
  submission: SubmissionRow
  myJudgment: MyJudgment
  teamJudgments: TeamJudgment[]
  counts: Counts
  submissionImages: SubmissionImage[]
}) {
  const supabase = await createClient()

  const data = (submission.data as Record<string, unknown>) ?? {}
  const groupName = submission.name?.trim() || "(no name)"
  const groupNameIsPlaceholder = isPlaceholderActName(groupName)
  const submitter = getActSubmitter({ data })
  const members = getActMembers({ data })
  const actType = pickString(data, ["GroupAct Type", "Type"]) ?? "Act"
  const location = pickString(data, ["Location", "City"]) ?? null
  const showLengthRequested = pickString(data, ["Show length", "Set length", "Show Length"]) ?? null

  const tier = classify(counts)

  // additional act-specific data
  const [
    { data: lineupCard },
    { data: blockTags },
  ] = await Promise.all([
    supabase
      .from("lineup_cards")
      .select("set_length_minutes, tags, column_id")
      .eq("submission_id", submission.id)
      .maybeSingle(),
    supabase
      .from("show_block_submissions")
      .select("block_id, position, duration_minutes")
      .eq("submission_id", submission.id),
  ])

  const blockIds = (blockTags ?? []).map((b) => b.block_id)
  const { data: blocks } = blockIds.length
    ? await supabase
        .from("show_blocks")
        .select(
          "id, draft_id, day, start_time, end_time, title, location, kind, theme, host, programming_drafts(id, name, is_published)",
        )
        .in("id", blockIds)
        .order("day", { ascending: true })
        .order("start_time", { ascending: true })
    : { data: [] as never[] }

  type BlockRow = {
    id: string
    draft_id: string
    day: string
    start_time: string
    end_time: string
    title: string | null
    location: string | null
    kind: string | null
    theme: string | null
    host: string | null
    programming_drafts:
      | { id: string; name: string; is_published: boolean }
      | { id: string; name: string; is_published: boolean }[]
      | null
  }
  function draft(b: BlockRow): { id: string; name: string; is_published: boolean } | null {
    if (!b.programming_drafts) return null
    return Array.isArray(b.programming_drafts) ? b.programming_drafts[0] ?? null : b.programming_drafts
  }
  const blockRows = ((blocks ?? []) as BlockRow[]).map((b) => ({
    ...b,
    draftMeta: draft(b),
  }))
  const publishedBlocks = blockRows.filter((b) => b.draftMeta?.is_published)
  const draftOnlyBlocks = blockRows.filter((b) => !b.draftMeta?.is_published)

  const tags = lineupCard?.tags ?? []
  const setLength = lineupCard?.set_length_minutes ?? null

  const supplementalEmbed = submission.supplemental_video_url
    ? toEmbedUrl(submission.supplemental_video_url)
    : null
  // Fall back to the first embeddable URL in the submission data if no
  // supplemental video has been added — we get a "free" hero on most acts.
  const fallbackVideo =
    !supplementalEmbed
      ? Object.values(data)
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .find((s) => looksLikeUrl(s) && toEmbedUrl(s) !== null)
      : null
  const heroVideoEmbed = supplementalEmbed ?? (fallbackVideo ? toEmbedUrl(fallbackVideo) : null)
  const heroVideoUrl = submission.supplemental_video_url ?? fallbackVideo ?? null

  const socials = extractSocials(data)

  const totalVerdicts = counts.yes_count + counts.maybe_count + counts.no_count
  const teammateRows = teamJudgments
    .map((j) => ({ ...j, profile: getProfile(j) }))
    .sort((a, b) => {
      const an = a.profile?.full_name ?? a.profile?.email ?? ""
      const bn = b.profile?.full_name ?? b.profile?.email ?? ""
      return an.localeCompare(bn)
    })

  return (
    <div className="space-y-10">
      {/* HERO BANNER */}
      <section className="relative rounded-3xl overflow-hidden border border-white/70 bg-white/65 backdrop-blur-xl shadow-[0_20px_50px_-25px_rgba(30,58,138,0.25)]">
        <div className="aspect-[16/6] bg-gradient-to-br from-blue-950 via-indigo-900 to-violet-900 relative">
          {heroVideoEmbed ? (
            <iframe
              src={heroVideoEmbed}
              title="Performance video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">
              <div className="flex items-center gap-2">
                <PlayIcon className="size-4" />
                No video on file yet
              </div>
            </div>
          )}
          {tier && (
            <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/95 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-md">
              <span className="size-1.5 rounded-full bg-white" />
              Confirmed · {TIER_LABEL[tier]}
            </div>
          )}
          {heroVideoUrl && (
            <a
              href={heroVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-md bg-black/40 backdrop-blur px-2 py-1 text-[11px] text-white hover:bg-black/60"
            >
              Open in new tab <ExternalLinkIcon className="size-3" />
            </a>
          )}
        </div>
      </section>

      {/* TITLE + SUMMARY */}
      <section className="space-y-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] font-semibold text-blue-900 flex flex-wrap items-center gap-x-2">
            <span>{actType}</span>
            {location && (
              <>
                <span className="text-blue-900/40">·</span>
                <span className="inline-flex items-center gap-1"><MapPinIcon className="size-3" />{location}</span>
              </>
            )}
          </div>
          <h1 className="font-[family-name:var(--font-serif)] text-5xl text-blue-950 leading-none mt-2">
            {groupNameIsPlaceholder && submitter ? submitter : groupName}
            {groupNameIsPlaceholder && submitter && (
              <span className="ml-3 align-middle inline-flex items-center rounded-full bg-violet-50 text-violet-900 border border-violet-100 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal">
                solo · group name was “{groupName}”
              </span>
            )}
          </h1>
          {submission.email && (
            <a
              href={`mailto:${submission.email}`}
              className="text-sm text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline mt-2 inline-block"
            >
              {submission.email}
            </a>
          )}
        </div>

        {/* tag row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.length === 0 ? (
            <span className="text-[12px] text-slate-500 italic">No tags yet — add them on the lineup board.</span>
          ) : (
            tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-900 border border-blue-100 px-2 py-0.5 text-[11px] font-medium"
              >
                <TagIcon className="size-3" /> {tag}
              </span>
            ))
          )}
        </div>

        {/* big stat strip */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Verdict tally" value={`${counts.yes_count}-${counts.maybe_count}-${counts.no_count}`} sub={`${totalVerdicts} of 3 cast`} tone="emerald" />
          <Stat label="Set length" value={setLength != null ? `${setLength}` : "—"} sub={setLength != null ? "minutes" : "not set"} tone="blue" />
          <Stat label="Booked" value={String(publishedBlocks.length)} sub={publishedBlocks.length === 1 ? "show block" : "show blocks"} tone="violet" />
          <Stat label="Members" value={String(members.length + 1)} sub={members.length === 0 ? "solo act" : "with primary"} tone="amber" />
        </dl>
      </section>

      {/* SECTION INDEX (jump links) */}
      <nav aria-label="Sections" className="rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl px-4 py-2 flex flex-wrap items-center gap-1 text-[11px] font-medium">
        <SectionLink href="#phase">Phase</SectionLink>
        <SectionLink href="#members">Members</SectionLink>
        <SectionLink href="#images">Photos</SectionLink>
        <SectionLink href="#socials">Socials</SectionLink>
        <SectionLink href="#programming">Programming</SectionLink>
        <SectionLink href="#email">Email</SectionLink>
        <SectionLink href="#notes">Notes</SectionLink>
        <SectionLink href="#judgments">Judgments</SectionLink>
        <SectionLink href="#archive">Submission archive</SectionLink>
      </nav>

      {/* PHASE TRACKER (stub) */}
      <Section id="phase" title="Lifecycle phase" kicker="Where this act sits in the pipeline">
        <ComingSoon>
          Per-act phase tracking lands in a later pass — submitted → reviewed → accepted →
          acceptance email → attendance confirmed → tech rider → performed. Today the page only
          knows the verdict tally.
        </ComingSoon>
      </Section>

      {/* MEMBERS */}
      <Section id="members" title="Members" kicker={`${members.length + 1} on stage`}>
        <div className="grid sm:grid-cols-2 gap-3">
          {/* primary contact card (always shown if we have any name) */}
          <MemberCard
            name={submitter ?? submission.email ?? "Primary contact"}
            role="Primary contact"
            email={submission.email}
            isPrimary
          />
          {members.map((m) => (
            <MemberCard key={m} name={m} role="Member" email={null} isPrimary={false} />
          ))}
        </div>
        <div className="mt-3 text-[11px] text-slate-500 italic">
          Member-level fields (phone, teaching info, individual socials) come in a later pass.
          Names are parsed from the submission’s freeform <code className="bg-slate-100 px-1 rounded">Performers</code> field.
        </div>
      </Section>

      {/* IMAGES — headshots, group photos, anything uploaded against the submission */}
      <Section id="images" title="Photos & assets" kicker={submissionImages.length === 0 ? "Drop a headshot or group photo to start" : `${submissionImages.length} on file`}>
        <SubmissionImagesCard
          submissionId={submission.id}
          initialImages={submissionImages}
        />
      </Section>

      {/* SOCIALS */}
      <Section id="socials" title="Socials" kicker="Auto-extracted from the submission — sanity-check before sharing">
        {socials.length === 0 ? (
          <ComingSoon>
            No social handles auto-detected. Once we add structured social fields to the
            submission form, they’ll show up here.
          </ComingSoon>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {socials.map((s) => (
              <a
                key={`${s.kind}-${s.url}`}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "rounded-xl border p-4 hover:shadow-md transition",
                  socialTone(s.kind),
                )}
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-semibold opacity-80">
                  {socialIcon(s.kind)}
                  <span>{s.label}</span>
                </div>
                <div className="font-semibold mt-1 truncate">{s.display}</div>
                <div className="text-[11px] opacity-60 mt-0.5 truncate">From “{s.sourceField}”</div>
              </a>
            ))}
          </div>
        )}
      </Section>

      {/* PROGRAMMING */}
      <Section id="programming" title="Programming" kicker="Show blocks this act is in">
        {publishedBlocks.length === 0 && draftOnlyBlocks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/40 px-4 py-6 text-sm text-slate-600">
            Not booked into any blocks yet. Open <Link className="text-blue-700 hover:underline" href="/production/programming">Programming</Link> to add this act to a block.
          </div>
        ) : (
          <div className="space-y-3">
            {publishedBlocks.length > 0 && (
              <ul className="space-y-2">
                {publishedBlocks.map((b) => (
                  <BlockRowDisplay key={b.id} block={b} status="published" />
                ))}
              </ul>
            )}
            {draftOnlyBlocks.length > 0 && (
              <details className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-amber-900 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <ClockIcon className="size-3.5" />
                    Also in {draftOnlyBlocks.length} draft block{draftOnlyBlocks.length === 1 ? "" : "s"} (not yet published)
                  </span>
                  <span className="text-xs">▾</span>
                </summary>
                <ul className="space-y-2 mt-2">
                  {draftOnlyBlocks.map((b) => (
                    <BlockRowDisplay key={b.id} block={b} status="draft" />
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </Section>

      {/* EMAIL */}
      <Section id="email" title="Email thread" kicker="Live from Gmail (if connected)">
        <ConversationsCard submissionEmail={submission.email} />
      </Section>

      {/* NOTES */}
      <Section id="notes" title="Team notes" kicker="Private to organisers">
        <ComingSoon>
          A per-act notes board (separate from verdict comments) is on the way. For now, see the
          <Link className="text-blue-700 hover:underline mx-1" href="#judgments">Judgments</Link>
          section for any comments teammates left with their verdict.
        </ComingSoon>
      </Section>

      {/* JUDGMENTS */}
      <Section id="judgments" title="Judgments" kicker={`${counts.yes_count}-${counts.maybe_count}-${counts.no_count} · ${tier ? TIER_LABEL[tier] : "no consensus"}`}>
        {tier && (
          <p className={cn(
            "text-[12px] inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border mb-3",
            TIER_TONE[tier],
          )}>
            <FlagIcon className="size-3" />
            {TIER_BLURB[tier]}
          </p>
        )}
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* current user's own verdict */}
          <JudgeRow
            who="You"
            verdict={myJudgment?.verdict ?? null}
            notes={myJudgment?.notes ?? ""}
            mine
          />
          {teammateRows.map((j) => (
            <JudgeRow
              key={j.user_id}
              who={j.profile?.full_name ?? j.profile?.email ?? "Teammate"}
              verdict={j.verdict}
              notes={j.notes ?? ""}
              mine={false}
            />
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-slate-500 italic">
          Edit your verdict from the original judging view if you change your mind — flipping a
          “yes” to a “no” will move the act out of confirmed status.
        </p>
      </Section>

      {/* ARCHIVE */}
      <Section id="archive" title="Submission archive" kicker={`${Object.keys(data).length} fields imported from Squarespace${submission.submitted_at ? ` on ${new Date(submission.submitted_at).toLocaleDateString()}` : ""}`}>
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-700">Show all fields</span>
            <span className="text-xs text-slate-500">▾ click to expand</span>
          </summary>
          <div className="px-4 pb-4 pt-1">
            <dl className="grid gap-3 text-sm">
              {Object.entries(data)
                .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
                .map(([key, value]) => {
                  const str = String(value).trim()
                  const isUrl = looksLikeUrl(str)
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-4"
                    >
                      <dt className="text-slate-500 font-medium">{key}</dt>
                      <dd className="min-w-0">
                        {isUrl ? (
                          <a
                            href={str}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:underline underline-offset-4 break-all"
                          >
                            {str}
                          </a>
                        ) : (
                          <p className="whitespace-pre-wrap break-words text-slate-800">{str}</p>
                        )}
                      </dd>
                    </div>
                  )
                })}
            </dl>
          </div>
        </details>
      </Section>

      {/* note about deferred features */}
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 px-5 py-4 text-[12px] text-slate-600">
        <strong className="text-slate-800">Phase 1 of the act profile.</strong> The lifecycle phase
        tracker, per-act notes, and a richer email-log view (sent / received / scheduled, with
        compose-and-schedule controls) are coming in later passes. Today this page reads from
        existing data — the verdicts you’ve already cast, the lineup card, programming blocks,
        and your Gmail thread with the contact.
      </div>
    </div>
  )
}

/* ============================================================== Sub-components */

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="px-2 py-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
    >
      {children}
    </a>
  )
}

function Section({
  id,
  title,
  kicker,
  children,
}: {
  id: string
  title: string
  kicker?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="space-y-3 scroll-mt-20">
      <header>
        {kicker && (
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500">
            {kicker}
          </div>
        )}
        <h2 className="font-[family-name:var(--font-serif)] text-3xl text-blue-950 leading-tight">
          {title}
        </h2>
      </header>
      {children}
    </section>
  )
}

function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 px-4 py-3 text-sm text-amber-900/80 leading-relaxed">
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-semibold text-amber-700 mr-2">
        <ClockIcon className="size-3" /> Coming soon
      </span>
      {children}
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: "blue" | "violet" | "emerald" | "amber"
}) {
  const tones = {
    blue: "text-blue-900 bg-blue-50/70 border-blue-100",
    violet: "text-violet-900 bg-violet-50/70 border-violet-100",
    emerald: "text-emerald-900 bg-emerald-50/70 border-emerald-100",
    amber: "text-amber-900 bg-amber-50/70 border-amber-100",
  }
  return (
    <div className={cn("rounded-2xl border px-4 py-3 backdrop-blur", tones[tone])}>
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold opacity-70">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-[family-name:var(--font-serif)] text-3xl leading-none tabular-nums">{value}</span>
        <span className="text-[11px] opacity-70">{sub}</span>
      </div>
    </div>
  )
}

function MemberCard({
  name,
  role,
  email,
  isPrimary,
}: {
  name: string
  role: string
  email: string | null
  isPrimary: boolean
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
  const tone = isPrimary
    ? "from-violet-400 to-rose-400"
    : "from-amber-400 to-emerald-400"
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex items-start gap-3">
        <div className={cn("h-12 w-12 rounded-full bg-gradient-to-br grid place-items-center text-white font-bold shrink-0", tone)}>
          {initials || "·"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-slate-900 leading-tight">{name}</h3>
            {isPrimary && (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                Primary contact
              </Badge>
            )}
          </div>
          <div className="text-xs text-slate-700 mt-0.5">{role}</div>
        </div>
      </header>
      <dl className="mt-3 grid grid-cols-[80px_1fr] gap-y-1.5 text-xs">
        <dt className="text-slate-500">Email</dt>
        <dd>
          {email ? (
            <a href={`mailto:${email}`} className="text-blue-700 hover:underline">
              {email}
            </a>
          ) : (
            <span className="text-slate-500 italic">not on file</span>
          )}
        </dd>
        <dt className="text-slate-500">Phone</dt>
        <dd className="text-slate-500 italic">collected later</dd>
        <dt className="text-slate-500">Teaches</dt>
        <dd className="text-slate-500 italic">collected later</dd>
      </dl>
    </article>
  )
}

function BlockRowDisplay({
  block,
  status,
}: {
  block: {
    id: string
    day: string
    start_time: string
    end_time: string
    title: string | null
    location: string | null
    kind: string | null
    draftMeta: { id: string; name: string; is_published: boolean } | null
  }
  status: "published" | "draft"
}) {
  const tone =
    status === "published"
      ? "border-emerald-200 bg-emerald-50/60"
      : "border-amber-300 border-dashed bg-amber-50/40"
  const badge =
    status === "published"
      ? <span className="inline-flex items-center rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Published</span>
      : <span className="inline-flex items-center rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Draft</span>
  return (
    <li className={cn("rounded-xl border px-4 py-3 flex items-center gap-3", tone)}>
      <CalendarIcon className="size-4 text-slate-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          <span className="font-semibold text-slate-900">{formatBlockDay(block.day)}</span>
          <span className="text-slate-500"> · </span>
          <span className="tabular-nums">{formatBlockTime(block.start_time, block.end_time)}</span>
          {block.title && (
            <>
              <span className="text-slate-500"> · </span>
              <span className="font-medium">{block.title}</span>
            </>
          )}
        </div>
        <div className="text-xs text-slate-600 mt-0.5">
          {block.location && (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-3" />
              {block.location}
            </span>
          )}
          {block.kind && (
            <span className="ml-2 inline-flex items-center gap-1 capitalize">
              <MusicIcon className="size-3" />
              {block.kind}
            </span>
          )}
          {block.draftMeta && (
            <span className="ml-2 text-slate-500 italic">
              · {block.draftMeta.name}
            </span>
          )}
        </div>
      </div>
      {badge}
      <Link
        href={`/production/programming/${block.id}`}
        className="text-xs text-slate-500 hover:text-slate-900 underline-offset-2 hover:underline"
      >
        Open
      </Link>
    </li>
  )
}

function JudgeRow({
  who,
  verdict,
  notes,
  mine,
}: {
  who: string
  verdict: string | null
  notes: string
  mine: boolean
}) {
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold w-14 shrink-0",
          verdict ? VERDICT_TONE[verdict] : "bg-slate-100 text-slate-500 border-slate-200",
        )}
      >
        {verdict ? VERDICT_LABEL[verdict] : "—"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-sm text-slate-900">
            {who}
            {mine && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-500 font-medium">(you)</span>
            )}
          </span>
        </div>
        {notes ? (
          <p className="text-sm text-slate-700 mt-0.5 leading-relaxed whitespace-pre-wrap">{notes}</p>
        ) : (
          <p className="text-[12px] text-slate-400 italic mt-0.5">No notes</p>
        )}
      </div>
    </li>
  )
}

function socialTone(kind: SocialKind): string {
  return {
    instagram: "bg-rose-50 border-rose-100 text-rose-900 hover:border-rose-300",
    tiktok: "bg-slate-100 border-slate-200 text-slate-800 hover:border-slate-400",
    youtube: "bg-red-50 border-red-100 text-red-900 hover:border-red-300",
    facebook: "bg-blue-50 border-blue-100 text-blue-900 hover:border-blue-300",
    twitter: "bg-sky-50 border-sky-100 text-sky-900 hover:border-sky-300",
    website: "bg-emerald-50 border-emerald-100 text-emerald-900 hover:border-emerald-300",
  }[kind]
}

function socialIcon(_kind: SocialKind): React.ReactNode {
  // Brand icons aren't in this project's lucide build, and the colored
  // backgrounds already disambiguate at-a-glance — use a single link icon
  // for now and revisit if a richer set lands.
  return <LinkIcon className="size-3.5" />
}
