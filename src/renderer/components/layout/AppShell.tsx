import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { ChatArea } from '../chat/ChatArea'
import { TodoPanel } from '../todo/TodoPanel'
import { SettingsDialog } from '../settings/SettingsDialog'
import { SkillsMarketplace } from '../skills/SkillsMarketplace'
import { BrowserSelectionDialog } from '../settings/BrowserSelectionDialog'
import { SchedulesDialog } from '../schedules/SchedulesDialog'
import { ScheduleEditorDialog } from '../schedules/ScheduleEditorDialog'
import { ScheduleRunner } from '../schedules/ScheduleRunner'
import { useUIStore } from '../../stores/uiStore'
import { useBrowserStore } from '../../stores/browserStore'
import { cn } from '../../lib/utils'

export function AppShell() {
  const {
    sidebarOpen,
    todoPanelOpen,
    settingsOpen,
    marketplaceOpen,
    schedulesOpen,
    setSettingsOpen,
    setMarketplaceOpen,
    setSchedulesOpen
  } =
    useUIStore()
  const { showSelectionDialog, setShowSelectionDialog } = useBrowserStore()

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with animation */}
        <div
          className={cn(
            'w-64 shrink-0 border-r transition-all duration-300 ease-in-out',
            sidebarOpen ? 'translate-x-0 opacity-100' : '-ml-64 opacity-0'
          )}
        >
          <Sidebar className="h-full" />
        </div>

        {/* Chat Area in the middle */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <ChatArea className="flex-1" />
        </main>

        {/* TODO Panel on the right */}
        {todoPanelOpen && <TodoPanel className="w-72 shrink-0 border-l" />}
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <SkillsMarketplace open={marketplaceOpen} onOpenChange={setMarketplaceOpen} />
      <BrowserSelectionDialog open={showSelectionDialog} onOpenChange={setShowSelectionDialog} />
      <SchedulesDialog open={schedulesOpen} onOpenChange={setSchedulesOpen} />
      <ScheduleEditorDialog />
      <ScheduleRunner />
    </div>
  )
}
