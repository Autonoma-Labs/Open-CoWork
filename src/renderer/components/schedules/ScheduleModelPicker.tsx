import { useState } from 'react'
import { ChevronDown, Plus, X, ExternalLink } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { DEFAULT_MODELS, useUIStore } from '../../stores/uiStore'
import { cn } from '../../lib/utils'

interface ScheduleModelPickerProps {
  value: string
  onChange: (modelId: string) => void
}

export function ScheduleModelPicker({ value, onChange }: ScheduleModelPickerProps) {
  const { customModels, addCustomModel, removeCustomModel } = useUIStore()
  const [isOpen, setIsOpen] = useState(false)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [customModelId, setCustomModelId] = useState('')

  const allModels = [...DEFAULT_MODELS, ...customModels]
  const currentModel = allModels.find((m) => m.id === value) || {
    id: value,
    name: value.split('/').pop() || value,
    provider: value.split('/')[0] || 'Custom'
  }

  const handleAddCustomModel = () => {
    if (!customModelId.trim()) return
    const parts = customModelId.trim().split('/')
    const provider = parts[0] || 'Custom'
    const name = parts.slice(1).join('/') || customModelId
    addCustomModel({
      id: customModelId.trim(),
      name,
      provider
    })
    onChange(customModelId.trim())
    setCustomModelId('')
    setShowAddCustom(false)
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{currentModel.name}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border bg-popover p-2 shadow-lg">
            <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">Select Model</div>

            <div className="max-h-64 space-y-1 overflow-y-auto">
              {allModels.map((model) => (
                <div
                  key={model.id}
                  className={cn(
                    'flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent',
                    value === model.id && 'bg-accent'
                  )}
                  onClick={() => {
                    onChange(model.id)
                    setIsOpen(false)
                  }}
                >
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-xs text-muted-foreground">{model.provider}</div>
                  </div>
                  {customModels.some((m) => m.id === model.id) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeCustomModel(model.id)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-2 border-t pt-2">
              {showAddCustom ? (
                <div className="space-y-2">
                  <Input
                    placeholder="e.g. openai/gpt-4o"
                    value={customModelId}
                    onChange={(event) => setCustomModelId(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleAddCustomModel()
                      if (event.key === 'Escape') setShowAddCustom(false)
                    }}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="h-7 flex-1 text-xs" onClick={handleAddCustomModel}>
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setShowAddCustom(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-xs"
                  onClick={() => setShowAddCustom(true)}
                >
                  <Plus className="h-3 w-3" />
                  Add custom model
                </Button>
              )}

              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                Browse models on OpenRouter
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
