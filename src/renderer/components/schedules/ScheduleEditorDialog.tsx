import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { useScheduleStore } from '../../stores/scheduleStore'
import { useSchedules } from '../../hooks/useSchedules'
import { ScheduleModelPicker } from './ScheduleModelPicker'
import { parseFrequencyToCron, buildScheduleTitle } from '../../services/ai/scheduling'
import { toast } from '../../hooks/use-toast'

export function ScheduleEditorDialog() {
  const { editorOpen, isEditing, draft, closeEditor, updateDraft } = useScheduleStore()
  const { createSchedule, updateSchedule, isCreating, isUpdating } = useSchedules()
  const [isParsing, setIsParsing] = useState(false)

  useEffect(() => {
    if (!draft) return
    if (!draft.title) {
      updateDraft({ title: buildScheduleTitle(draft.prompt) })
    }
  }, [draft, updateDraft])

  const handleClose = () => {
    closeEditor()
  }

  const handleParseCron = async () => {
    if (!draft?.frequencyText) return
    try {
      setIsParsing(true)
      const apiKey = await window.api.getApiKey()
      if (!apiKey) {
        toast({
          title: 'API key missing',
          description: 'Set your OpenRouter API key to convert schedules.'
        })
        return
      }
      const result = await parseFrequencyToCron(apiKey, draft.frequencyText, draft.timezone)
      updateDraft({ cron: result.cron })
    } catch (error) {
      toast({
        title: 'Schedule parsing failed',
        description: error instanceof Error ? error.message : 'Unable to parse cron expression.'
      })
    } finally {
      setIsParsing(false)
    }
  }

  const handleSave = async () => {
    if (!draft) return
    if (!draft.prompt.trim()) {
      toast({ title: 'Prompt required', description: 'Add a prompt for this schedule.' })
      return
    }
    if (!draft.frequencyText.trim()) {
      toast({ title: 'Schedule required', description: 'Describe how often this should run.' })
      return
    }

    let cronValue = draft.cron
    if (!cronValue) {
      try {
        setIsParsing(true)
        const apiKey = await window.api.getApiKey()
        if (!apiKey) {
          toast({
            title: 'API key missing',
            description: 'Set your OpenRouter API key to convert schedules.'
          })
          return
        }
        const result = await parseFrequencyToCron(apiKey, draft.frequencyText, draft.timezone)
        cronValue = result.cron
      } catch (error) {
        toast({
          title: 'Schedule parsing failed',
          description: error instanceof Error ? error.message : 'Unable to parse cron expression.'
        })
        return
      } finally {
        setIsParsing(false)
      }
    }

    const payload = {
      title: draft.title.trim() || buildScheduleTitle(draft.prompt),
      prompt: draft.prompt.trim(),
      frequencyText: draft.frequencyText.trim(),
      cron: cronValue,
      timezone: draft.timezone ?? null,
      model: draft.model,
      enabled: draft.enabled
    }

    if (isEditing && draft.id) {
      await updateSchedule({ id: draft.id, data: payload })
    } else {
      await createSchedule(payload)
    }

    closeEditor()
  }

  if (!draft) return null

  return (
    <Dialog open={editorOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Schedule' : 'Create Schedule'}</DialogTitle>
          <DialogDescription>
            Review the distilled prompt and schedule before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={draft.title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              placeholder="Daily summary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Prompt</label>
            <Textarea
              value={draft.prompt}
              onChange={(e) => updateDraft({ prompt: e.target.value })}
              rows={5}
              placeholder="Summarize my latest tweets and email me."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule (natural language)</label>
            <Input
              value={draft.frequencyText}
              onChange={(e) => updateDraft({ frequencyText: e.target.value })}
              placeholder="Every weekday at 9am"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cron</label>
            <div className="flex items-center gap-2">
              <Input
                value={draft.cron}
                onChange={(e) => updateDraft({ cron: e.target.value })}
                placeholder="0 9 * * 1-5"
              />
              <Button type="button" variant="outline" onClick={handleParseCron} disabled={isParsing}>
                {isParsing ? 'Parsing...' : 'Generate'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <ScheduleModelPicker
              value={draft.model}
              onChange={(modelId) => updateDraft({ model: modelId })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="scheduleEnabled"
              checked={draft.enabled}
              onChange={(e) => updateDraft({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="scheduleEnabled" className="text-sm text-muted-foreground">
              Enabled
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSave} disabled={isCreating || isUpdating || isParsing}>
            {isEditing ? 'Save Changes' : 'Create Schedule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
