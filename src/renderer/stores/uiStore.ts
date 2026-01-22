import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ModelOption {
  id: string
  name: string
  provider: string
}

export const DEFAULT_MODELS: ModelOption[] = [
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google' },
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'Anthropic' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { id: 'z-ai/glm-4.7', name: 'GLM 4.7', provider: 'Z-AI' }
]

// Models that support online search (via :online suffix on OpenRouter)
export const SEARCH_CAPABLE_MODELS = [
  'google/gemini',
  'anthropic/claude-opus',
  'anthropic/claude-sonnet',
  'openai/gpt-4',
  'openai/o1',
  'perplexity/'
]

// Check if a model supports online search
export function modelSupportsSearch(modelId: string): boolean {
  return SEARCH_CAPABLE_MODELS.some((prefix) => modelId.startsWith(prefix))
}

interface UIState {
  sidebarOpen: boolean
  activeConversationId: string | null
  processingConversations: string[] // Conversations where AI is thinking/working
  unreadConversations: string[] // Conversations with new responses user hasn't seen
  todoPanelOpen: boolean
  settingsOpen: boolean
  marketplaceOpen: boolean
  schedulesOpen: boolean
  selectedModel: string
  customModels: ModelOption[]
  searchEnabled: boolean // Whether to use :online suffix for search-capable models
  pinnedSectionCollapsed: boolean // Whether the pinned chats section is collapsed

  // Actions
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setActiveConversation: (id: string | null) => void
  setProcessing: (id: string, processing: boolean) => void
  markAsUnread: (id: string) => void
  markAsRead: (id: string) => void
  toggleTodoPanel: () => void
  setTodoPanelOpen: (open: boolean) => void
  toggleSettings: () => void
  setSettingsOpen: (open: boolean) => void
  toggleMarketplace: () => void
  setMarketplaceOpen: (open: boolean) => void
  toggleSchedules: () => void
  setSchedulesOpen: (open: boolean) => void
  setSelectedModel: (model: string) => void
  addCustomModel: (model: ModelOption) => void
  removeCustomModel: (id: string) => void
  toggleSearch: () => void
  setSearchEnabled: (enabled: boolean) => void
  togglePinnedSection: () => void
  setPinnedSectionCollapsed: (collapsed: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      activeConversationId: null,
      processingConversations: [],
      unreadConversations: [],
      todoPanelOpen: false,
      settingsOpen: false,
      marketplaceOpen: false,
      schedulesOpen: false,
      selectedModel: 'google/gemini-3-flash-preview',
      customModels: [],
      searchEnabled: false,
      pinnedSectionCollapsed: false,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setActiveConversation: (id) =>
        set((state) => {
          // When switching to a conversation, mark it as read
          const newUnread = id
            ? state.unreadConversations.filter((c) => c !== id)
            : state.unreadConversations
          return { activeConversationId: id, unreadConversations: newUnread }
        }),

      setProcessing: (id, processing) =>
        set((state) => ({
          processingConversations: processing
            ? state.processingConversations.includes(id)
              ? state.processingConversations
              : [...state.processingConversations, id]
            : state.processingConversations.filter((c) => c !== id)
        })),

      markAsUnread: (id) =>
        set((state) => ({
          unreadConversations: state.unreadConversations.includes(id)
            ? state.unreadConversations
            : [...state.unreadConversations, id]
        })),

      markAsRead: (id) =>
        set((state) => ({
          unreadConversations: state.unreadConversations.filter((c) => c !== id)
        })),

      toggleTodoPanel: () => set((state) => ({ todoPanelOpen: !state.todoPanelOpen })),
      setTodoPanelOpen: (open) => set({ todoPanelOpen: open }),

      toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
      setSettingsOpen: (open) => set({ settingsOpen: open }),

      toggleMarketplace: () => set((state) => ({ marketplaceOpen: !state.marketplaceOpen })),
      setMarketplaceOpen: (open) => set({ marketplaceOpen: open }),

      toggleSchedules: () => set((state) => ({ schedulesOpen: !state.schedulesOpen })),
      setSchedulesOpen: (open) => set({ schedulesOpen: open }),

      setSelectedModel: (model) => set({ selectedModel: model }),

      addCustomModel: (model) =>
        set((state) => ({
          customModels: state.customModels.some((m) => m.id === model.id)
            ? state.customModels
            : [...state.customModels, model]
        })),

      removeCustomModel: (id) =>
        set((state) => ({
          customModels: state.customModels.filter((m) => m.id !== id)
        })),

      toggleSearch: () => set((state) => ({ searchEnabled: !state.searchEnabled })),
      setSearchEnabled: (enabled) => set({ searchEnabled: enabled }),

      togglePinnedSection: () => set((state) => ({ pinnedSectionCollapsed: !state.pinnedSectionCollapsed })),
      setPinnedSectionCollapsed: (collapsed) => set({ pinnedSectionCollapsed: collapsed })
    }),
    {
      name: 'open-cowork-ui',
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        customModels: state.customModels,
        sidebarOpen: state.sidebarOpen,
        todoPanelOpen: state.todoPanelOpen,
        schedulesOpen: state.schedulesOpen,
        searchEnabled: state.searchEnabled,
        pinnedSectionCollapsed: state.pinnedSectionCollapsed
      })
    }
  )
)
