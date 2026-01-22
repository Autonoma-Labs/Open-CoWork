import { useMemo, useState } from 'react'
import { Clock, AlertTriangle, Pencil, Trash2, Play, Pause, ChevronRight, Beaker } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { useSchedules, useScheduleRuns } from '../../hooks/useSchedules'
import { useSettings } from '../../hooks/useSettings'
import { useScheduleStore } from '../../stores/scheduleStore'
import { useUIStore } from '../../stores/uiStore'
import { buildScheduleTitle } from '../../services/ai/scheduling'

interface SchedulesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleString()
}

export function SchedulesDialog({ open, onOpenChange }: SchedulesDialogProps) {
  const { schedules, updateSchedule, deleteSchedule, runScheduleNow, isRunning } = useSchedules()
  const { settings } = useSettings()
  const [activeTab, setActiveTab] = useState<'schedules' | 'runs'>('schedules')
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | undefined>(undefined)
  const { runs } = useScheduleRuns(selectedScheduleId)
  const { openEditor } = useScheduleStore()
  const { setActiveConversation } = useUIStore()

  const scheduleOptions = useMemo(() => [
    { id: undefined, label: 'All schedules' },
    ...schedules.map((schedule) => ({ id: schedule.id, label: schedule.title }))
  ], [schedules])

  const openCreate = () => {
    openEditor({
      title: '',
      prompt: '',
      frequencyText: '',
      cron: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      model: settings?.defaultModel || 'google/gemini-3-flash-preview',
      enabled: true
    })
  }

  const openEdit = (schedule: typeof schedules[number]) => {
    openEditor({
      id: schedule.id,
      title: schedule.title || buildScheduleTitle(schedule.prompt),
      prompt: schedule.prompt,
      frequencyText: schedule.frequencyText,
      cron: schedule.cron,
      timezone: schedule.timezone,
      model: schedule.model,
      enabled: schedule.enabled
    }, true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Schedules</DialogTitle>
          <DialogDescription>Manage your automated tasks and review their runs.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('schedules')}
              className={activeTab === 'schedules'
                ? 'h-9 rounded-full bg-foreground px-4 text-sm text-background hover:bg-foreground/90'
                : 'h-9 rounded-full border border-input px-4 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'}
            >
              Schedules
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('runs')}
              className={activeTab === 'runs'
                ? 'h-9 rounded-full bg-foreground px-4 text-sm text-background hover:bg-foreground/90'
                : 'h-9 rounded-full border border-input px-4 text-sm text-muted-foreground hover:bg-muted hover:text-foreground'}
            >
              Runs
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={openCreate}
            className="h-9 rounded-full border border-input bg-foreground px-4 text-sm text-background hover:bg-foreground/90"
          >
            Add schedule
          </Button>
        </div>

        {activeTab === 'schedules' ? (
          <ScrollArea className="h-[460px] pr-4">
            {schedules.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No schedules yet. Add one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{schedule.title}</span>
                          {schedule.lastStatus === 'error' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              <AlertTriangle className="h-3 w-3" />
                              Failed
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {schedule.frequencyText}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Next run: {formatDate(schedule.nextRunAt)} · Last run: {formatDate(schedule.lastRunAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateSchedule({
                            id: schedule.id,
                            data: { enabled: !schedule.enabled }
                          })}
                          title={schedule.enabled ? 'Pause schedule' : 'Resume schedule'}
                          className="h-9 w-9 rounded-full border border-transparent hover:border-border"
                        >
                          {schedule.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => runScheduleNow(schedule.id)}
                          title="Test schedule"
                          disabled={isRunning}
                          className="h-9 w-9 rounded-full border border-transparent hover:border-border"
                        >
                          <Beaker className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(schedule)}
                          title="Edit schedule"
                          className="h-9 w-9 rounded-full border border-transparent hover:border-border"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSchedule(schedule.id)}
                          title="Delete schedule"
                          className="h-9 w-9 rounded-full border border-transparent hover:border-border"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedScheduleId(schedule.id)
                            setActiveTab('runs')
                          }}
                          title="View runs"
                          className="h-9 w-9 rounded-full border border-transparent hover:border-border"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={selectedScheduleId || ''}
                onChange={(e) => setSelectedScheduleId(e.target.value || undefined)}
                className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm"
              >
                {scheduleOptions.map((option) => (
                  <option key={option.id || 'all'} value={option.id || ''}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <ScrollArea className="h-[420px] pr-4">
              {runs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No runs yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {runs.map((run) => (
                    <div key={run.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">{run.schedule?.title || 'Scheduled task'}</div>
                          <div className="text-xs text-muted-foreground">
                            Started: {formatDate(run.startedAt)} · Finished: {formatDate(run.finishedAt)}
                          </div>
                          {run.status === 'error' && (
                            <div className="mt-2 text-xs text-destructive">{run.error || 'Run failed'}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${run.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : run.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                            {run.status}
                          </span>
                          {run.conversationId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveConversation(run.conversationId)}
                              className="h-9 rounded-full border border-input bg-foreground px-4 text-sm text-background hover:bg-foreground/90"
                            >
                              Open chat
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
