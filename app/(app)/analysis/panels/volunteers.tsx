"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { VolunteerSummary } from "@/lib/analysis"

export function VolunteersPanel({ summary }: { summary: VolunteerSummary }) {
  if (summary.total === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No volunteer submissions yet. Upload the volunteer CSV to see a
          summary here.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total volunteers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distinct roles requested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.byRole.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Distinct days covered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.byDay.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roles requested</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.byRole.map((r) => (
              <div
                key={r.bucket}
                className="flex items-center justify-between text-sm"
              >
                <span>{r.bucket}</span>
                <Badge variant="secondary">{r.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Days available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.byDay.map((d) => (
              <div
                key={d.bucket}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate pr-2">{d.bucket}</span>
                <Badge variant="secondary">{d.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
