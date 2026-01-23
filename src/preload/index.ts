import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Database - Conversations
  getConversations: () => ipcRenderer.invoke('db:conversations:list'),
  getConversation: (id: string) => ipcRenderer.invoke('db:conversations:get', id),
  createConversation: (title: string) => ipcRenderer.invoke('db:conversations:create', title),
  updateConversation: (id: string, data: { title?: string; pinned?: boolean }) =>
    ipcRenderer.invoke('db:conversations:update', id, data),
  deleteConversation: (id: string) => ipcRenderer.invoke('db:conversations:delete', id),

  // Database - Messages
  getMessages: (conversationId: string) => ipcRenderer.invoke('db:messages:list', conversationId),
  createMessage: (data: {
    conversationId: string
    role: string
    content: string
    thinking?: string
  }) => ipcRenderer.invoke('db:messages:create', data),
  updateMessage: (id: string, data: { content?: string; thinking?: string }) =>
    ipcRenderer.invoke('db:messages:update', id, data),

  // Database - Tool Calls
  createToolCall: (data: {
    messageId: string
    toolName: string
    input: string
    output?: string
    status?: string
  }) => ipcRenderer.invoke('db:toolCalls:create', data),
  updateToolCall: (id: string, data: { output?: string; status?: string }) =>
    ipcRenderer.invoke('db:toolCalls:update', id, data),

  // Database - Skills
  getSkills: () => ipcRenderer.invoke('db:skills:list'),
  getEnabledSkills: () => ipcRenderer.invoke('db:skills:listEnabled'),
  createSkill: (data: {
    name: string
    description?: string
    content: string
    sourceUrl?: string
  }) => ipcRenderer.invoke('db:skills:create', data),
  updateSkill: (id: string, data: { enabled?: boolean; content?: string }) =>
    ipcRenderer.invoke('db:skills:update', id, data),
  deleteSkill: (id: string) => ipcRenderer.invoke('db:skills:delete', id),

  // Database - Permissions
  checkPermission: (path: string, operation: string) =>
    ipcRenderer.invoke('permissions:check', path, operation),
  grantPermission: (path: string, operation: string, scope: string) =>
    ipcRenderer.invoke('permissions:grant', path, operation, scope),
  revokePermission: (path: string, operation: string) =>
    ipcRenderer.invoke('permissions:revoke', path, operation),
  listPermissions: () => ipcRenderer.invoke('permissions:list'),
  clearSessionPermissions: () => ipcRenderer.invoke('permissions:clearSession'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (data: {
    theme?: string
    defaultModel?: string
    analyticsOptIn?: boolean
    onboardingComplete?: boolean
    browserHeadless?: boolean
  }) => ipcRenderer.invoke('settings:update', data),

  // Secure Storage (API Key)
  getApiKey: () => ipcRenderer.invoke('settings:getApiKey'),
  setApiKey: (key: string) => ipcRenderer.invoke('settings:setApiKey', key),
  deleteApiKey: () => ipcRenderer.invoke('settings:deleteApiKey'),

  // File System
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  readFileBase64: (path: string) => ipcRenderer.invoke('fs:readFileBase64', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
  fileExists: (path: string) => ipcRenderer.invoke('fs:exists', path),
  glob: (pattern: string, cwd?: string) => ipcRenderer.invoke('fs:glob', pattern, cwd),
  grep: (pattern: string, path: string, options?: { maxResults?: number }) =>
    ipcRenderer.invoke('fs:grep', pattern, path, options),
  bash: (command: string, options?: { cwd?: string; timeout?: number }) =>
    ipcRenderer.invoke('fs:bash', command, options),

  // Browser
  browserGetAvailableBrowsers: () => ipcRenderer.invoke('browser:getAvailableBrowsers'),
  browserNavigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
  browserGetPageInfo: () => ipcRenderer.invoke('browser:getPageInfo'),
  browserGetContent: (selector?: string) => ipcRenderer.invoke('browser:getContent', selector),
  browserClick: (selector: string) => ipcRenderer.invoke('browser:click', selector),
  browserType: (selector: string, text: string) => ipcRenderer.invoke('browser:type', selector, text),
  browserPress: (key: string) => ipcRenderer.invoke('browser:press', key),
  browserScreenshot: () => ipcRenderer.invoke('browser:screenshot'),
  browserGetLinks: () => ipcRenderer.invoke('browser:getLinks'),
  browserScroll: (direction: 'up' | 'down' | 'top' | 'bottom') => ipcRenderer.invoke('browser:scroll', direction),
  browserClose: () => ipcRenderer.invoke('browser:close'),
  browserWaitFor: (selector: string, timeout?: number) => ipcRenderer.invoke('browser:waitFor', selector, timeout),
  browserOpenForLogin: (url: string) => ipcRenderer.invoke('browser:openForLogin', url),

  // Dialog
  showOpenDialog: (options: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('dialog:open', options),
  showSaveDialog: (options: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke('dialog:save', options),

  // App
  getAppPath: () => ipcRenderer.invoke('app:getPath'),
  getHomePath: () => ipcRenderer.invoke('app:getHomePath'),
  getPlatform: () => process.platform,

  // Skill Registry
  skillRegistrySearch: (query: string) => ipcRenderer.invoke('skillregistry:search', query),
  skillRegistryGetContent: (skillId: string) => ipcRenderer.invoke('skillregistry:getContent', skillId),

  // Find in page
  findStart: (text: string) => ipcRenderer.send('find:start', text),
  findNext: (text: string) => ipcRenderer.send('find:next', text),
  findPrevious: (text: string) => ipcRenderer.send('find:previous', text),
  findStop: () => ipcRenderer.send('find:stop'),
  onFindResult: (callback: (result: { activeMatchOrdinal: number; matches: number }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      result: { activeMatchOrdinal: number; matches: number }
    ) => callback(result)
    ipcRenderer.on('find:result', handler)
    return () => ipcRenderer.removeListener('find:result', handler)
  },

  // Image Registry
  saveImage: (
    conversationId: string,
    base64Data: string,
    mimeType: string,
    source: 'upload' | 'screenshot' | 'viewImage',
    meta?: { url?: string; filename?: string }
  ) => ipcRenderer.invoke('image:save', conversationId, base64Data, mimeType, source, meta),
  getImage: (conversationId: string, sequenceNum: number) =>
    ipcRenderer.invoke('image:get', conversationId, sequenceNum),
  getImageMetadata: (conversationId: string, sequenceNum: number) =>
    ipcRenderer.invoke('image:getMetadata', conversationId, sequenceNum),
  updateImageDescription: (conversationId: string, sequenceNum: number, description: string) =>
    ipcRenderer.invoke('image:updateDescription', conversationId, sequenceNum, description),
  listImages: (conversationId: string) => ipcRenderer.invoke('image:list', conversationId)
}

// Expose in main world
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
