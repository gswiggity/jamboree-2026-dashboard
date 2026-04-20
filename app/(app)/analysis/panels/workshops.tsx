"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WorkshopSummary } from "@/lib/analysis"

export function WorkshopsPanel({ summary }: { summary: WorkshopSummary }) {
  if (summary.total === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No workshop submissions yet. Upload the workshops CSV to see a
          summary here.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total workshops
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique titles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{summary.byTitle.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workshops</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {summary.byTitle.map((w) => (
            <div
              key={w.title}
              className="flex items-center justify-between text-sm"
            >
              <span className="truncate pr-2">{w.title}</span>
              {w.count > 1 && <Badge variant="secondary">{w.count}</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
