import { create } from 'zustand'

export interface ScheduleDraft {
  id?: string
  title: string
  prompt: string
  frequencyText: string
  cron: string
  timezone?: string | null
  model: string
  enabled: boolean
}

interface ScheduleState {
  editorOpen: boolean
  isEditing: boolean
  draft: ScheduleDraft | null
  openEditor: (draft: ScheduleDraft, isEditing?: boolean) => void
  closeEditor: () => void
  updateDraft: (updates: Partial<ScheduleDraft>) => void
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  editorOpen: false,
  isEditing: false,
  draft: null,
  openEditor: (draft, isEditing = false) => set({ editorOpen: true, draft, isEditing }),
  closeEditor: () => set({ editorOpen: false, draft: null, isEditing: false }),
  updateDraft: (updates) =>
    set((state) => ({
      draft: state.draft ? { ...state.draft, ...updates } : state.draft
    }))
}))
