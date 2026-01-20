import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  Conversation,
  Message,
  ToolCall,
  Skill,
  Permission,
  Settings,
  RegistrySkill,
  AvailableBrowser,
  DirectoryEntry,
  GrepResult,
  BashResult,
  BrowserResult,
  BrowserContentResult,
  BrowserScreenshotResult,
  BrowserLinksResult
} from '../shared/types'

// Re-export types for external consumers
export type {
  Conversation,
  Message,
  ToolCall,
  Skill,
  Permission,
  Settings,
  RegistrySkill,
  AvailableBrowser,
  DirectoryEntry,
  GrepResult,
  BashResult,
  BrowserResult,
  BrowserContentResult,
  BrowserScreenshotResult,
  BrowserLinksResult
}

// API interface
interface Api {
  // Database - Conversations
  getConversations: () => Promise<Conversation[]>
  getConversation: (id: string) => Promise<Conversation | null>
  createConversation: (title: string) => Promise<Conversation>
  updateConversation: (id: string, data: { title?: string; pinned?: boolean }) => Promise<Conversation>
  deleteConversation: (id: string) => Promise<void>

  // Database - Messages
  getMessages: (conversationId: string) => Promise<Message[]>
  createMessage: (data: {
    conversationId: string
    role: string
    content: string
    thinking?: string
  }) => Promise<Message>
  updateMessage: (id: string, data: { content?: string; thinking?: string }) => Promise<Message>

  // Database - Tool Calls
  createToolCall: (data: {
    messageId: string
    toolName: string
    input: string
    output?: string
    status?: string
  }) => Promise<ToolCall>
  updateToolCall: (id: string, data: { output?: string; status?: string }) => Promise<ToolCall>

  // Database - Skills
  getSkills: () => Promise<Skill[]>
  getEnabledSkills: () => Promise<Skill[]>
  createSkill: (data: {
    name: string
    description?: string
    content: string
    sourceUrl?: string
  }) => Promise<Skill>
  updateSkill: (id: string, data: { enabled?: boolean; content?: string }) => Promise<Skill>
  deleteSkill: (id: string) => Promise<void>

  // Database - Permissions
  checkPermission: (path: string, operation: string) => Promise<Permission | null>
  grantPermission: (path: string, operation: string, scope: string) => Promise<Permission>
  revokePermission: (path: string, operation: string) => Promise<void>
  listPermissions: () => Promise<Permission[]>
  clearSessionPermissions: () => Promise<void>

  // Settings
  getSettings: () => Promise<Settings>
  updateSettings: (data: {
    theme?: string
    defaultModel?: string
    analyticsOptIn?: boolean
    onboardingComplete?: boolean
    preferredBrowser?: string
    browserHeadless?: boolean
  }) => Promise<Settings>

  // Secure Storage
  getApiKey: () => Promise<string | null>
  setApiKey: (key: string) => Promise<void>
  deleteApiKey: () => Promise<void>

  // File System
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  readDirectory: (path: string) => Promise<DirectoryEntry[]>
  fileExists: (path: string) => Promise<boolean>
  glob: (pattern: string, cwd?: string) => Promise<DirectoryEntry[]>
  grep: (pattern: string, path: string, options?: { maxResults?: number }) => Promise<GrepResult[]>
  bash: (command: string, options?: { cwd?: string; timeout?: number }) => Promise<BashResult>

  // Browser
  browserGetAvailableBrowsers: () => Promise<AvailableBrowser[]>
  browserNavigate: (url: string) => Promise<BrowserResult>
  browserGetPageInfo: () => Promise<BrowserResult>
  browserGetContent: (selector?: string) => Promise<BrowserContentResult>
  browserClick: (selector: string) => Promise<BrowserResult>
  browserType: (selector: string, text: string) => Promise<BrowserResult>
  browserPress: (key: string) => Promise<BrowserResult>
  browserScreenshot: () => Promise<BrowserScreenshotResult>
  browserGetLinks: () => Promise<BrowserLinksResult>
  browserScroll: (direction: 'up' | 'down' | 'top' | 'bottom') => Promise<BrowserResult>
  browserClose: () => Promise<BrowserResult>
  browserWaitFor: (selector: string, timeout?: number) => Promise<BrowserResult>
  browserOpenForLogin: (url: string) => Promise<BrowserResult>

  // Dialog
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
  showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>

  // App
  getAppPath: () => Promise<string>
  getHomePath: () => Promise<string>
  getPlatform: () => NodeJS.Platform

  // Skill Registry
  skillRegistrySearch: (query: string) => Promise<RegistrySkill[]>
  skillRegistryGetContent: (skillId: string) => Promise<string | null>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
