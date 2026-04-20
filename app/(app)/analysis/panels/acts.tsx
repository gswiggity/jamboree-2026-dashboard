"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ActSummary } from "@/lib/analysis"

const TYPE_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#64748b",
]

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function ActsPanel({ summary }: { summary: ActSummary }) {
  if (summary.total === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No act submissions yet. Upload an acts CSV to see this dashboard
          come alive.
        </CardContent>
      </Card>
    )
  }

  const topLocations = summary.byLocation.slice(0, 10)
  const mostAvailableDay = [...summary.byDay].sort((a, b) => b.count - a.count)[0]
  const topType = summary.byType[0]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total acts" value={summary.total} />
        <Kpi
          label="Performers (est.)"
          value={summary.performerCount}
          sub="Sum of all named performers"
        />
        <Kpi
          label="States represented"
          value={summary.totalStates}
          sub={`${summary.byLocation.length} mapped cities`}
        />
        <Kpi
          label="Top act type"
          value={topType ? topType.bucket : "—"}
          sub={topType ? `${topType.count} submissions` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Act submissions over time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={summary.timeline}
                margin={{ left: -12, right: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  yAxisId="left"
                  dataKey="count"
                  name="Daily"
                  fill="#6366f1"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Act type mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.byType}
                    dataKey="count"
                    nameKey="bucket"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {summary.byType.map((_, i) => (
                      <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Group size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.byGroupSize}
                  margin={{ left: -12, right: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Derived from the Performers column by splitting on commas and
              &quot;and&quot;.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top cities</CardTitle>
          </CardHeader>
          <CardContent>
            {topLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matched cities yet.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topLocations}
                    layout="vertical"
                    margin={{ left: 8, right: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="display"
                      tick={{ fontSize: 11 }}
                      width={120}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {summary.unmatchedLocations.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {summary.unmatchedLocations.length} location{summary.unmatchedLocations.length === 1 ? "" : "s"}{" "}
                not auto-matched — see Map tab for the unmatched list.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How did you hear</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.byHowHeard}
                  layout="vertical"
                  margin={{ left: 8, right: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="bucket"
                    tick={{ fontSize: 11 }}
                    width={160}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Day availability
            {mostAvailableDay && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — {mostAvailableDay.bucket} leads with {mostAvailableDay.count}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.byDay}
                margin={{ left: -12, right: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Acts could pick multiple days, so counts can exceed total submissions.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
