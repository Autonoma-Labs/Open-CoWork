/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'

// Database types
interface Conversation {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  messages?: Message[]
}

interface Message {
  id: string
  conversationId: string
  role: string
  content: string
  thinking?: string | null
  toolCalls?: ToolCall[]
  createdAt: Date
}

interface ToolCall {
  id: string
  messageId: string
  toolName: string
  input: string
  output?: string | null
  status: string
  createdAt: Date
}

interface Skill {
  id: string
  name: string
  description?: string | null
  content: string
  sourceUrl?: string | null
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

interface Permission {
  id: string
  path: string
  operation: string
  scope: string
  createdAt: Date
}

interface Settings {
  id: string
  theme: string
  defaultModel: string
  analyticsOptIn: boolean | null
  onboardingComplete: boolean
  preferredBrowser: string | null
  browserHeadless: boolean
  updatedAt: Date
}

interface RegistrySkill {
  id: string
  name: string
  description: string
  tags?: string[]
  downloadCount?: number
}

interface AvailableBrowser {
  id: string
  name: string
  hasData: boolean
}

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  modifiedAt?: Date
}

interface GrepResult {
  file: string
  line: number
  content: string
  match: string
}

interface BashResult {
  stdout: string
  stderr: string
  exitCode: number | string
}

interface BrowserResult {
  success?: boolean
  error?: boolean
  message?: string
  url?: string
  title?: string
}

interface BrowserContentResult extends BrowserResult {
  content?: string
}

interface BrowserScreenshotResult extends BrowserResult {
  image?: string
}

interface BrowserLinksResult extends BrowserResult {
  links?: Array<{ text: string; href: string }>
  count?: number
}

// API interface
interface Api {
  // Database - Conversations
  getConversations: () => Promise<Conversation[]>
  getConversation: (id: string) => Promise<Conversation | null>
  createConversation: (title: string) => Promise<Conversation>
  updateConversation: (id: string, data: { title?: string }) => Promise<Conversation>
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
  getSettings: () => Promise<Settings | null>
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
  readFileBase64: (path: string) => Promise<{ base64: string; mimeType: string; dataUrl: string }>
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

export {}
