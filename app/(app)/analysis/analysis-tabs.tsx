"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { OverviewPanel } from "./panels/overview"
import { ActsPanel } from "./panels/acts"
import { VolunteersPanel } from "./panels/volunteers"
import { WorkshopsPanel } from "./panels/workshops"
import type {
  ActSummary,
  OverviewTimelinePoint,
  VolunteerSummary,
  WorkshopSummary,
} from "@/lib/analysis"
import type { SubmissionType } from "@/lib/csv"

type TotalByType = { type: SubmissionType; label: string; count: number }
type VerdictRow = {
  type: string
  Yes: number
  Maybe: number
  No: number
  Unjudged: number
}

// Lazy-load the US map: ~30KB of d3-geo + topojson + us-atlas only loads
// when the user clicks the Map tab. ssr:false keeps it out of the server
// bundle so the initial page paint stays light.
const MapPanel = dynamic(() => import("./panels/map").then((m) => m.MapPanel), {
  ssr: false,
  loading: () => (
    <Card>
      <CardHeader>
        <CardTitle>Where acts are coming from</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[420px] w-full" />
      </CardContent>
    </Card>
  ),
})

type Props = {
  totalByType: TotalByType[]
  timeline: OverviewTimelinePoint[]
  verdictBreakdown: VerdictRow[]
  actSummary: ActSummary
  volunteerSummary: VolunteerSummary
  workshopSummary: WorkshopSummary
}

export function AnalysisTabs({
  totalByType,
  timeline,
  verdictBreakdown,
  actSummary,
  volunteerSummary,
  workshopSummary,
}: Props) {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="acts">Acts</TabsTrigger>
        <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
        <TabsTrigger value="workshops">Workshops</TabsTrigger>
        <TabsTrigger value="map">Map</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6 space-y-6">
        <OverviewPanel
          totalByType={totalByType}
          timeline={timeline}
          verdictBreakdown={verdictBreakdown}
        />
      </TabsContent>

      <TabsContent value="acts" className="mt-6 space-y-6">
        <ActsPanel summary={actSummary} />
      </TabsContent>

      <TabsContent value="volunteers" className="mt-6 space-y-6">
        <VolunteersPanel summary={volunteerSummary} />
      </TabsContent>

      <TabsContent value="workshops" className="mt-6 space-y-6">
        <WorkshopsPanel summary={workshopSummary} />
      </TabsContent>

      <TabsContent value="map" className="mt-6 space-y-6">
        <MapPanel
          locations={actSummary.byLocation}
          unmatched={actSummary.unmatchedLocations}
        />
      </TabsContent>
    </Tabs>
  )
}
