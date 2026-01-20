import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { createConversationService } from '../services/conversation.service'
import { createMessageService } from '../services/message.service'
import { createSkillService } from '../services/skill.service'
import type {
  CreateMessageInput,
  UpdateMessageInput,
  CreateToolCallInput,
  UpdateToolCallInput,
  CreateSkillInput,
  UpdateSkillInput,
  UpdateConversationInput
} from '../../shared/types'

export function registerDatabaseHandlers(): void {
  const prisma = getDatabase()
  const conversationService = createConversationService(prisma)
  const messageService = createMessageService(prisma)
  const skillService = createSkillService(prisma)

  // Conversations
  ipcMain.handle('db:conversations:list', async () => {
    return conversationService.list()
  })

  ipcMain.handle('db:conversations:get', async (_, id: string) => {
    return conversationService.get(id)
  })

  ipcMain.handle('db:conversations:create', async (_, title: string) => {
    return conversationService.create(title)
  })

  ipcMain.handle('db:conversations:update', async (_, id: string, data: UpdateConversationInput) => {
    return conversationService.update(id, data)
  })

  ipcMain.handle('db:conversations:delete', async (_, id: string) => {
    return conversationService.delete(id)
  })

  // Messages
  ipcMain.handle('db:messages:list', async (_, conversationId: string) => {
    return messageService.list(conversationId)
  })

  ipcMain.handle('db:messages:create', async (_, data: CreateMessageInput) => {
    return messageService.create(data)
  })

  ipcMain.handle('db:messages:update', async (_, id: string, data: UpdateMessageInput) => {
    return messageService.update(id, data)
  })

  // Tool Calls
  ipcMain.handle('db:toolCalls:create', async (_, data: CreateToolCallInput) => {
    return messageService.createToolCall(data)
  })

  ipcMain.handle('db:toolCalls:update', async (_, id: string, data: UpdateToolCallInput) => {
    return messageService.updateToolCall(id, data)
  })

  // Skills
  ipcMain.handle('db:skills:list', async () => {
    return skillService.list()
  })

  ipcMain.handle('db:skills:listEnabled', async () => {
    return skillService.listEnabled()
  })

  ipcMain.handle('db:skills:create', async (_, data: CreateSkillInput) => {
    return skillService.create(data)
  })

  ipcMain.handle('db:skills:update', async (_, id: string, data: UpdateSkillInput) => {
    return skillService.update(id, data)
  })

  ipcMain.handle('db:skills:delete', async (_, id: string) => {
    return skillService.delete(id)
  })
}
