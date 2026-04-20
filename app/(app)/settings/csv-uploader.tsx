"use client"

import { useRef, useState, useTransition } from "react"
import Papa from "papaparse"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SUBMISSION_TYPES, TYPE_LABELS, type SubmissionType } from "@/lib/csv"
import { importSubmissions } from "./import-actions"

type ParsedCsv = {
  headers: string[]
  rows: Record<string, unknown>[]
  fileName: string
}

export function CsvUploader() {
  const [type, setType] = useState<SubmissionType>("act")
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          toast.error(`Parse error: ${result.errors[0].message}`)
          return
        }
        const rows = result.data.filter((r) =>
          Object.values(r).some((v) => v !== null && v !== undefined && v !== ""),
        )
        setParsed({
          headers: result.meta.fields ?? [],
          rows,
          fileName: file.name,
        })
      },
      error: (err) => toast.error(`Parse error: ${err.message}`),
    })
  }

  function onImport() {
    if (!parsed) return
    startTransition(async () => {
      const result = await importSubmissions(type, parsed.fileName, parsed.rows)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const dupeNote =
        result.duplicatesInBatch > 0
          ? ` (${result.duplicatesInBatch} duplicate row${
              result.duplicatesInBatch === 1 ? "" : "s"
            } within file collapsed)`
          : ""
      toast.success(
        `Imported ${result.newRows} new, ${result.updatedRows} updated${dupeNote}.`,
      )
      setParsed(null)
      if (inputRef.current) inputRef.current.value = ""
    })
  }

  const preview = parsed?.rows.slice(0, 10) ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Pick a submission type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as SubmissionType)}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBMISSION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:max-w-sm">
            <Label htmlFor="file">CSV file</Label>
            <input
              id="file"
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-accent"
            />
          </div>
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle>
              2. Preview — {parsed.rows.length} row
              {parsed.rows.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {parsed.headers.map((h) => (
                      <TableHead
                        key={h}
                        className="whitespace-nowrap max-w-[200px] truncate"
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      {parsed.headers.map((h) => (
                        <TableCell
                          key={h}
                          className="max-w-[200px] truncate align-top text-xs"
                          title={String(row[h] ?? "")}
                        >
                          {String(row[h] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsed.rows.length > preview.length && (
              <p className="text-xs text-muted-foreground">
                Showing first {preview.length} of {parsed.rows.length} rows.
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={onImport} disabled={pending}>
                {pending
                  ? "Importing…"
                  : `Import ${parsed.rows.length} row${
                      parsed.rows.length === 1 ? "" : "s"
                    }`}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setParsed(null)
                  if (inputRef.current) inputRef.current.value = ""
                }}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
