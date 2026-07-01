"use client"

import { useState, useTransition } from "react"
import {
  GraduationCap,
  PlayCircle,
  FileText,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  Clock,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toggleLesson, type MyTrainingModule } from "@/app/actions/training"

export function StaffTrainingView({
  modules,
  name,
}: {
  modules: MyTrainingModule[]
  name: string
}) {
  const totalLessons = modules.reduce((s, m) => s + m.totalCount, 0)
  const doneLessons = modules.reduce((s, m) => s + m.completedCount, 0)
  const overall = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My training"
        description="Work through the videos and documents assigned to you, and mark each one complete as you go."
      />

      {modules.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <GraduationCap className="size-9 text-muted-foreground" />
          <p className="font-medium">Nothing assigned yet</p>
          <p className="text-sm text-muted-foreground">
            When your manager assigns training, it will appear here for you to complete.
          </p>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Overall progress</p>
                <p className="text-sm text-muted-foreground">
                  {doneLessons} of {totalLessons} lessons complete
                </p>
              </div>
              <span className="text-2xl font-semibold">{overall}%</span>
            </div>
            <Progress value={overall} />
          </Card>

          <div className="flex flex-col gap-4">
            {modules.map((m) => (
              <ModuleCard key={m.id} module={m} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ModuleCard({ module }: { module: MyTrainingModule }) {
  const [open, setOpen] = useState(true)
  const pct = module.totalCount ? Math.round((module.completedCount / module.totalCount) * 100) : 0
  const complete = module.totalCount > 0 && module.completedCount === module.totalCount

  return (
    <Card className="flex flex-col gap-4 p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-start justify-between gap-3 text-left"
      >
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-balance">{module.title}</h3>
            <Badge variant="secondary">{module.category}</Badge>
            {complete ? (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                Complete
              </span>
            ) : null}
          </div>
          {module.description ? (
            <p className="text-sm text-muted-foreground">{module.description}</p>
          ) : null}
          {module.dueDate ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              Due {module.dueDate}
            </span>
          ) : null}
        </div>
        <ChevronDown
          className={cn("mt-1 size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      <div className="flex items-center gap-3">
        <Progress value={pct} className="flex-1" />
        <span className="text-xs font-medium text-muted-foreground">
          {module.completedCount}/{module.totalCount}
        </span>
      </div>

      {open ? (
        <ul className="flex flex-col gap-2">
          {module.lessons.map((l) => (
            <LessonRow key={l.id} lesson={l} moduleId={module.id} />
          ))}
        </ul>
      ) : null}
    </Card>
  )
}

function LessonRow({
  lesson,
  moduleId,
}: {
  lesson: MyTrainingModule["lessons"][number]
  moduleId: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleToggle(next: boolean) {
    startTransition(async () => {
      await toggleLesson(lesson.id, moduleId, next)
    })
  }

  return (
    <li className="rounded-md border border-border">
      <div className="flex items-center gap-3 p-3">
        <Checkbox
          checked={lesson.completed}
          disabled={isPending}
          onCheckedChange={(v) => handleToggle(v === true)}
          aria-label={`Mark ${lesson.title} complete`}
        />
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {lesson.type === "video" ? (
            <PlayCircle className="size-4" />
          ) : (
            <FileText className="size-4" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "truncate text-sm font-medium",
              lesson.completed && "text-muted-foreground line-through",
            )}
          >
            {lesson.title}
          </span>
          <span className="text-xs capitalize text-muted-foreground">
            {lesson.type}
            {lesson.durationMin ? ` · ${lesson.durationMin} min` : ""}
          </span>
        </div>

        {lesson.type === "video" && lesson.url ? (
          <Button
            variant="outline"
            size="sm"
            render={
              <a href={lesson.url} target="_blank" rel="noopener noreferrer">
                <PlayCircle className="size-4" />
                Watch
              </a>
            }
          />
        ) : lesson.content ? (
          <Button variant="outline" size="sm" onClick={() => setExpanded((e) => !e)}>
            <FileText className="size-4" />
            {expanded ? "Hide" : "Read"}
          </Button>
        ) : lesson.url ? (
          <Button
            variant="outline"
            size="sm"
            render={
              <a href={lesson.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Open
              </a>
            }
          />
        ) : null}
      </div>

      {expanded && lesson.content ? (
        <div className="border-t border-border p-3">
          {lesson.url ? (
            <a
              href={lesson.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="size-4" />
              Open attached document
            </a>
          ) : null}
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{lesson.content}</p>
        </div>
      ) : null}
    </li>
  )
}
