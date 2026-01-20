import { useState } from 'react'
import { Eye, EyeOff, Trash2, Globe, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { useSettings, useApiKey, useAvailableBrowsers } from '../../hooks/useSettings'
import { cn } from '../../lib/utils'
import { BrowserSelectionDialog } from './BrowserSelectionDialog'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings()
  const { apiKey, setApiKey, deleteApiKey, isSettingKey } = useApiKey()
  const { browsers } = useAvailableBrowsers()
  const [newApiKey, setNewApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showBrowserDialog, setShowBrowserDialog] = useState(false)

  const selectedBrowser = browsers.find((b) => b.id === settings?.preferredBrowser)

  const handleSaveApiKey = () => {
    if (newApiKey.trim()) {
      setApiKey(newApiKey.trim())
      setNewApiKey('')
    }
  }

  const handleDeleteApiKey = () => {
    deleteApiKey()
    setNewApiKey('')
  }

  const handleThemeChange = (theme: string) => {
    updateSettings({ theme })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure your Open CoWork preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* API Key Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">OpenRouter API Key</label>
            {apiKey ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm">
                  {showApiKey ? apiKey : '••••••••••••••••'}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleDeleteApiKey}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  placeholder="sk-or-..."
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveApiKey} disabled={!newApiKey.trim() || isSettingKey}>
                  Save
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Get your API key from{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                openrouter.ai/keys
              </a>
            </p>
          </div>

          {/* Theme Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
            <div className="flex gap-2">
              {(['system', 'light', 'dark'] as const).map((theme) => (
                <Button
                  key={theme}
                  variant="outline"
                  size="sm"
                  className={cn(settings?.theme === theme && 'border-primary bg-primary/10')}
                  onClick={() => handleThemeChange(theme)}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Browser Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Browser for Web Tasks</label>
            <button
              onClick={() => setShowBrowserDialog(true)}
              className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span>{selectedBrowser?.name || 'Not configured'}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <p className="text-xs text-muted-foreground">
              Choose which browser profile to use for web browsing tasks. Your logins will be
              available.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="browserHeadless"
                checked={settings?.browserHeadless ?? false}
                onChange={(e) => updateSettings({ browserHeadless: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="browserHeadless" className="text-sm text-muted-foreground">
                Run browser in background (headless mode)
              </label>
            </div>
          </div>

          {/* Analytics Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Analytics</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="analytics"
                checked={settings?.analyticsOptIn ?? false}
                onChange={(e) => updateSettings({ analyticsOptIn: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="analytics" className="text-sm text-muted-foreground">
                Help improve Open CoWork by sharing anonymous usage data
              </label>
            </div>
          </div>
        </div>

        <BrowserSelectionDialog open={showBrowserDialog} onOpenChange={setShowBrowserDialog} />
      </DialogContent>
    </Dialog>
  )
}
