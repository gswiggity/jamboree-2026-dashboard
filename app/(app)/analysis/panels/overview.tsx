"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OverviewTimelinePoint } from "@/lib/analysis"
import type { SubmissionType } from "@/lib/csv"

type TotalByType = { type: SubmissionType; label: string; count: number }
type VerdictRow = {
  type: string
  Yes: number
  Maybe: number
  No: number
  Unjudged: number
}

export function OverviewPanel({
  totalByType,
  timeline,
  verdictBreakdown,
}: {
  totalByType: TotalByType[]
  timeline: OverviewTimelinePoint[]
  verdictBreakdown: VerdictRow[]
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {totalByType.map((t) => (
          <Card key={t.type}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{t.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submissions over time</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No data yet — upload a CSV to see the timeline.
              </p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="act"
                      name="Acts"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="volunteer"
                      name="Volunteers"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="workshop"
                      name="Workshops"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verdict breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={verdictBreakdown}
                  margin={{ left: -16, right: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Yes" stackId="a" fill="#10b981" />
                  <Bar dataKey="Maybe" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="No" stackId="a" fill="#ef4444" />
                  <Bar dataKey="Unjudged" stackId="a" fill="#9ca3af" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Counts sum across all team members. &quot;Unjudged&quot; = no
              teammate has entered a verdict yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
