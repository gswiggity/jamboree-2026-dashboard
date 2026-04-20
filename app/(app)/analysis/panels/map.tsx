"use client"

import { useMemo } from "react"
import { geoAlbersUsa, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import statesTopo from "us-atlas/states-10m.json"
import type {
  FeatureCollection,
  Feature,
  GeoJsonProperties,
  MultiPolygon,
  Polygon,
} from "geojson"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type Location = {
  key: string
  display: string
  count: number
  lat: number | null
  lon: number | null
}

type UnmatchedLocation = {
  display: string
  count: number
}

const WIDTH = 960
const HEIGHT = 600

// topojson's type overloads don't infer well through the us-atlas shape,
// so we cast the result to the geometry we know the file contains.
const topology = statesTopo as unknown as Parameters<typeof feature>[0]
const statesFC = feature(
  topology,
  (topology as unknown as { objects: { states: unknown } }).objects.states as Parameters<typeof feature>[1],
) as unknown as FeatureCollection<Polygon | MultiPolygon, GeoJsonProperties>

export function MapPanel({
  locations,
  unmatched,
}: {
  locations: Location[]
  unmatched: UnmatchedLocation[]
}) {
  const { statePaths, markers, maxCount } = useMemo(() => {
    const projection = geoAlbersUsa().fitSize([WIDTH, HEIGHT], statesFC)
    const pathGen = geoPath(projection)

    const statePaths = statesFC.features.map((f: Feature) => ({
      id: String(f.id),
      d: pathGen(f) ?? "",
    }))

    const plotted = locations
      .filter((l): l is Location & { lat: number; lon: number } =>
        l.lat !== null && l.lon !== null,
      )
      .map((l) => {
        const p = projection([l.lon, l.lat])
        return { ...l, x: p?.[0] ?? null, y: p?.[1] ?? null }
      })
      .filter((l): l is typeof l & { x: number; y: number } => l.x !== null && l.y !== null)

    const maxCount = plotted.reduce((m, l) => Math.max(m, l.count), 1)

    return { statePaths, markers: plotted, maxCount }
  }, [locations])

  const totalMapped = locations.reduce((a, b) => a + b.count, 0)
  const totalUnmatched = unmatched.reduce((a, b) => a + b.count, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Where acts are coming from
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              — {totalMapped} mapped
              {totalUnmatched > 0 ? `, ${totalUnmatched} need hand-coding` : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {markers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No mapped locations yet. Add cities to the lookup table in{" "}
              <code className="text-xs">lib/analysis.ts</code> to plot them.
            </p>
          ) : (
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full h-auto"
                role="img"
                aria-label="US map of act submission origins"
              >
                <g>
                  {statePaths.map((s) => (
                    <path
                      key={s.id}
                      d={s.d}
                      fill="#f1f5f9"
                      stroke="#cbd5e1"
                      strokeWidth={0.75}
                    />
                  ))}
                </g>
                <g>
                  {markers.map((m) => {
                    const r = 5 + 14 * Math.sqrt(m.count / maxCount)
                    return (
                      <g key={m.key}>
                        <circle
                          cx={m.x}
                          cy={m.y}
                          r={r}
                          fill="#6366f1"
                          fillOpacity={0.55}
                          stroke="#4338ca"
                          strokeWidth={1}
                        />
                        {m.count >= Math.max(3, maxCount * 0.2) && (
                          <text
                            x={m.x}
                            y={m.y + r + 10}
                            textAnchor="middle"
                            className="fill-foreground"
                            fontSize={11}
                            fontWeight={500}
                          >
                            {m.display} · {m.count}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </g>
              </svg>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mapped cities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mapped cities.</p>
            ) : (
              locations.map((l) => (
                <div
                  key={l.key}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{l.display}</span>
                  <Badge variant="secondary">{l.count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unmatched locations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unmatched.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every location matched. Nice.
              </p>
            ) : (
              <>
                {unmatched.map((u) => (
                  <div
                    key={u.display}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate pr-2">{u.display}</span>
                    <Badge variant="outline">{u.count}</Badge>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-2">
                  Add a regex + coordinates entry in{" "}
                  <code>lib/analysis.ts</code> under{" "}
                  <code>CITY_TABLE</code> to plot these.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
