import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveCurrentPhase, type Phase } from "@/lib/phases"
import { RoleToggle } from "./role-toggle"
import { PublishToggle } from "./publish-toggle"
import { CsvUploader } from "./csv-uploader"
import { PhaseSelector } from "./phase-selector"
import { PhaseManager } from "./phase-manager"
import { AllowlistManager } from "./allowlist-manager"
import { GmailIntegrationCard } from "./gmail-card"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role, verdicts_published")
    .eq("id", user!.id)
    .single()

  const isAdmin = myProfile?.role === "admin"

  const [
    { data: phaseRow },
    { data: phases },
    { data: allowed },
    { data: profiles },
    { data: gmailRow },
  ] = await Promise.all([
    supabase
      .from("festival_settings")
      .select("phase, updated_at, profiles:updated_by(email, full_name)")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("phases")
      .select("*")
      .order("sort_order", { ascending: true }),
    isAdmin
      ? supabase
          .from("allowed_emails")
          .select("email, invited_at")
          .order("invited_at", { ascending: true })
      : Promise.resolve({ data: null }),
    isAdmin
      ? supabase
          .from("profiles")
          .select("id, email, full_name, role, created_at")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: null }),
    isAdmin
      ? supabase
          .from("gmail_integration")
          .select(
            "account_email, refresh_token, connected_at, last_used_at",
          )
          .eq("id", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const phaseList: Phase[] = phases ?? []
  const currentPhase = resolveCurrentPhase(phaseList, phaseRow?.phase)
  const phaseActorRaw = phaseRow?.profiles as
    | { email?: string; full_name?: string | null }
    | Array<{ email?: string; full_name?: string | null }>
    | null
    | undefined
  const phaseActor = Array.isArray(phaseActorRaw) ? phaseActorRaw[0] : phaseActorRaw
  const phaseActorLabel =
    phaseActor?.full_name ?? phaseActor?.email ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set the festival phase, import submissions, manage your verdict
          visibility, and administer the team.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Festival phase</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Currently in{" "}
              <span className="font-semibold text-foreground">
                {currentPhase.label}
              </span>
              {phaseRow?.updated_at && (
                <>
                  {" "}
                  · last changed{" "}
                  {new Date(phaseRow.updated_at).toLocaleDateString()}
                  {phaseActorLabel && <> by {phaseActorLabel}</>}
                </>
              )}
              .
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <PhaseSelector current={currentPhase.key} phases={phaseList} />

          <div className="space-y-3 border-t border-slate-200/70 pt-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Edit phases
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rename, reorder, or add phases for your festival&apos;s lifecycle.
                Changes roll out to every team member immediately.
              </p>
            </div>
            <PhaseManager phases={phaseList} currentKey={currentPhase.key} />
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Import submissions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Bring in Squarespace CSVs. Re-uploading the same file updates
            existing rows in place — judgments stay attached.
          </p>
        </div>
        <CsvUploader />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>My verdicts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <p className="text-sm">
                Control whether your teammates can see the verdicts and notes
                you&apos;ve left on submissions.
              </p>
              <p className="text-xs text-muted-foreground">
                When hidden, teammates won&apos;t see your picks or any counts
                that include them. You can flip this back on at any time.
              </p>
            </div>
            <PublishToggle
              published={myProfile?.verdicts_published ?? false}
            />
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <GmailIntegrationCard
            connected={!!gmailRow?.refresh_token}
            accountEmail={gmailRow?.account_email ?? null}
            connectedAt={gmailRow?.connected_at ?? null}
            lastUsedAt={gmailRow?.last_used_at ?? null}
          />

          <Card>
            <CardHeader>
              <CardTitle>Team members</CardTitle>
            </CardHeader>
            <CardContent>
              {(profiles ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {profiles!.map((p) => {
                    const isSelf = p.id === user!.id
                    const normalizedRole: "admin" | "member" =
                      p.role === "admin" ? "admin" : "member"
                    return (
                      <li
                        key={p.id}
                        className="py-3 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-medium">
                            {p.full_name ?? p.email}
                            {isSelf && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.email}
                          </div>
                        </div>
                        <RoleToggle
                          userId={p.id}
                          role={normalizedRole}
                          disabled={isSelf && normalizedRole === "admin"}
                          disabledReason={
                            isSelf ? "You can't demote yourself." : undefined
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invite allowlist</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Only emails on this list can sign up. Existing sessions are
                unaffected by removals.
              </p>
            </CardHeader>
            <CardContent>
              <AllowlistManager
                allowed={allowed ?? []}
                currentUserEmail={user!.email ?? ""}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
