"use client"

import { useState, useTransition } from "react"
import { Plus, ShieldAlert, Trash2, ChevronDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { StatusBadge } from "@/components/status-badge"
import { RowActions } from "@/components/compliance/row-actions"
import { createRiskAssessment, deleteRiskAssessment } from "@/app/actions/safety"

type Hazard = {
  id: number
  hazard: string
  whoAtRisk: string | null
  likelihood: number
  severity: number
  controls: string | null
}

type Assessment = {
  id: number
  title: string
  area: string | null
  assessor: string | null
  reviewDate: string | null
  status: string
  hazards: Hazard[]
}

type DraftHazard = {
  hazard: string
  whoAtRisk: string
  likelihood: number
  severity: number
  controls: string
}

function riskLevel(score: number): { label: string; className: string } {
  if (score >= 15) return { label: "High", className: "bg-destructive text-destructive-foreground" }
  if (score >= 8) return { label: "Medium", className: "bg-chart-4 text-foreground" }
  return { label: "Low", className: "bg-chart-2 text-foreground" }
}

function emptyHazard(): DraftHazard {
  return { hazard: "", whoAtRisk: "", likelihood: 1, severity: 1, controls: "" }
}

export function RiskAssessments({
  venueId,
  assessments,
}: {
  venueId: number
  assessments: Assessment[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [area, setArea] = useState("")
  const [assessor, setAssessor] = useState("")
  const [reviewDate, setReviewDate] = useState("")
  const [hazards, setHazards] = useState<DraftHazard[]>([emptyHazard()])
  const [isPending, startTransition] = useTransition()

  function reset() {
    setTitle("")
    setArea("")
    setAssessor("")
    setReviewDate("")
    setHazards([emptyHazard()])
  }

  function updateHazard(i: number, patch: Partial<DraftHazard>) {
    setHazards((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)))
  }

  function submit() {
    if (!title.trim()) return
    startTransition(async () => {
      await createRiskAssessment({
        venueId,
        title,
        area,
        assessor,
        reviewDate,
        hazards: hazards.filter((h) => h.hazard.trim()),
      })
      reset()
      setCreateOpen(false)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">Risk assessments</h2>
          <p className="text-sm text-muted-foreground">
            Build assessments with hazards scored by likelihood and severity.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New assessment
        </Button>
      </div>

      {assessments.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <p className="font-medium">No risk assessments yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first assessment and add hazards with control measures.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {assessments.map((a) => (
            <AssessmentCard key={a.id} assessment={a} />
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o) reset()
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogTitle>New risk assessment</DialogTitle>
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ra-title">Title</Label>
                <Input
                  id="ra-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Kitchen fire risk assessment"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ra-area">Area</Label>
                <Input
                  id="ra-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Kitchen"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ra-assessor">Assessor</Label>
                <Input
                  id="ra-assessor"
                  value={assessor}
                  onChange={(e) => setAssessor(e.target.value)}
                  placeholder="Name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ra-review">Review date</Label>
                <Input
                  id="ra-review"
                  type="date"
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Hazards</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHazards((prev) => [...prev, emptyHazard()])}
                >
                  <Plus className="size-4" />
                  Add hazard
                </Button>
              </div>

              {hazards.map((h, i) => {
                const score = h.likelihood * h.severity
                const level = riskLevel(score)
                return (
                  <Card key={i} className="flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Hazard {i + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${level.className}`}>
                          {level.label} · {score}
                        </span>
                        {hazards.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setHazards((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Remove hazard</span>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={h.hazard}
                        onChange={(e) => updateHazard(i, { hazard: e.target.value })}
                        placeholder="Hazard (e.g. Hot oil / deep fat fryer)"
                      />
                      <Input
                        value={h.whoAtRisk}
                        onChange={(e) => updateHazard(i, { whoAtRisk: e.target.value })}
                        placeholder="Who is at risk?"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">Likelihood (1–5)</Label>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={h.likelihood}
                          onChange={(e) => updateHazard(i, { likelihood: Number(e.target.value) })}
                          className="accent-primary"
                        />
                        <span className="text-xs text-muted-foreground">{h.likelihood}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">Severity (1–5)</Label>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={h.severity}
                          onChange={(e) => updateHazard(i, { severity: Number(e.target.value) })}
                          className="accent-primary"
                        />
                        <span className="text-xs text-muted-foreground">{h.severity}</span>
                      </div>
                    </div>
                    <Textarea
                      value={h.controls}
                      onChange={(e) => updateHazard(i, { controls: e.target.value })}
                      rows={2}
                      placeholder="Control measures in place"
                    />
                  </Card>
                )
              })}
            </div>

            <div className="flex justify-end gap-2">
              <DialogClose
                render={(props) => (
                  <Button {...props} type="button" variant="outline">
                    Cancel
                  </Button>
                )}
              />
              <Button onClick={submit} disabled={isPending || !title.trim()}>
                {isPending ? "Saving…" : "Save assessment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const [open, setOpen] = useState(false)
  const maxScore = assessment.hazards.reduce(
    (m, h) => Math.max(m, h.likelihood * h.severity),
    0,
  )
  const top = riskLevel(maxScore)

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{assessment.title}</h3>
            <StatusBadge status={assessment.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {assessment.area ? <span>{assessment.area}</span> : null}
            {assessment.assessor ? <span>By {assessment.assessor}</span> : null}
            {assessment.reviewDate ? <span>Review {assessment.reviewDate}</span> : null}
            <span>{assessment.hazards.length} hazards</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {assessment.hazards.length > 0 ? (
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${top.className}`}>
              Top risk: {top.label}
            </span>
          ) : null}
          <RowActions
            deleteAction={() => deleteRiskAssessment(assessment.id)}
            deleteLabel="Delete assessment"
          />
        </div>
      </div>

      {assessment.hazards.length > 0 ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "Hide hazards" : "View hazards"}
          </Button>
          {open ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Hazard</th>
                    <th className="pb-2 pr-3 font-medium">Who&apos;s at risk</th>
                    <th className="pb-2 pr-3 font-medium">Score</th>
                    <th className="pb-2 font-medium">Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {assessment.hazards.map((h) => {
                    const score = h.likelihood * h.severity
                    const level = riskLevel(score)
                    return (
                      <tr key={h.id} className="border-b border-border/50 align-top">
                        <td className="py-2 pr-3">{h.hazard}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{h.whoAtRisk || "—"}</td>
                        <td className="py-2 pr-3">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${level.className}`}>
                            {score}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">{h.controls || "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  )
}
