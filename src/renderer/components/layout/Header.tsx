import { Menu, Settings, Store, ListTodo } from 'lucide-react'
import { Button } from '../ui/button'
import { useUIStore } from '../../stores/uiStore'

export function Header() {
  const { toggleSidebar, toggleSettings, toggleMarketplace, toggleTodoPanel, todoPanelOpen } =
    useUIStore()

  return (
    <header className="drag-region flex h-12 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        {/* Leave space for traffic lights on macOS */}
        <div className="w-16" />
        <Button
          variant="ghost"
          size="icon"
          className="no-drag h-8 w-8"
          onClick={toggleSidebar}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <span className="font-medium text-foreground" style={{ fontFamily: '"Space Mono", monospace' }}>open co|work</span>
        <span className="text-sm text-muted-foreground">
          by{' '}
          <a
            href="https://getautonoma.com?utm_source=opencowork&utm_campaign=app_header"
            target="_blank"
            rel="noopener noreferrer"
            className="no-drag hover:text-foreground hover:underline"
          >
            Autonoma
          </a>
        </span>
      </div>

      <div className="no-drag flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleTodoPanel}
          title="Toggle TODO Panel"
        >
          <ListTodo className={`h-4 w-4 ${todoPanelOpen ? 'text-primary' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleMarketplace}
          title="Skills Marketplace"
        >
          <Store className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleSettings}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
