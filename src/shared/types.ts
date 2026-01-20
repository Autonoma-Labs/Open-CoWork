// Shared types used across main, preload, and renderer processes

// Re-export Prisma-generated types for database entities
export type {
  Conversation,
  Message,
  ToolCall,
  Skill,
  Permission,
  Settings
} from '@prisma/client'

// Input types for service operations
export interface CreateMessageInput {
  conversationId: string
  role: string
  content: string
  thinking?: string
}

export interface UpdateMessageInput {
  content?: string
  thinking?: string
}

export interface CreateToolCallInput {
  messageId: string
  toolName: string
  input: string
  output?: string
  status?: string
}

export interface UpdateToolCallInput {
  output?: string
  status?: string
}

export interface CreateSkillInput {
  name: string
  description?: string
  content: string
  sourceUrl?: string
}

export interface UpdateSkillInput {
  enabled?: boolean
  content?: string
}

export interface UpdateConversationInput {
  title?: string
  pinned?: boolean
}

export interface UpdateSettingsInput {
  theme?: string
  defaultModel?: string
  analyticsOptIn?: boolean
  onboardingComplete?: boolean
  preferredBrowser?: string
  browserHeadless?: boolean
}

// External/UI types (not from database)
export interface RegistrySkill {
  id: string
  name: string
  description: string
  tags?: string[]
  downloadCount?: number
}

export interface AvailableBrowser {
  id: string
  name: string
  hasData: boolean
}

export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  modifiedAt?: Date
}

export interface GrepResult {
  file: string
  line: number
  content: string
  match: string
}

export interface BashResult {
  stdout: string
  stderr: string
  exitCode: number | string
}

export interface BrowserResult {
  success?: boolean
  error?: boolean
  message?: string
  url?: string
  title?: string
  screenshot?: string
}

export interface BrowserContentResult extends BrowserResult {
  content?: string
}

export interface BrowserScreenshotResult extends BrowserResult {
  image?: string
}

export interface BrowserLinksResult extends BrowserResult {
  links?: Array<{ text: string; href: string }>
  count?: number
}
