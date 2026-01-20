import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb } from '../helpers/test-db'
import { createConversationService } from '../../src/main/services/conversation.service'
import type { PrismaClient } from '@prisma/client'

describe('ConversationService', () => {
  let prisma: PrismaClient
  let cleanup: () => Promise<void>
  let conversationService: ReturnType<typeof createConversationService>

  beforeAll(async () => {
    const ctx = await createTestDb()
    prisma = ctx.prisma
    cleanup = ctx.cleanup
    conversationService = createConversationService(prisma)
  })

  afterAll(async () => {
    await cleanup()
  })

  beforeEach(async () => {
    // Clean up conversations before each test
    await prisma.conversation.deleteMany()
  })

  describe('create', () => {
    it('should create a new conversation with the given title', async () => {
      const conversation = await conversationService.create('Test Conversation')

      expect(conversation).toBeDefined()
      expect(conversation.id).toBeDefined()
      expect(conversation.title).toBe('Test Conversation')
      expect(conversation.pinned).toBe(false)
      expect(conversation.createdAt).toBeInstanceOf(Date)
      expect(conversation.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('list', () => {
    it('should return an empty array when no conversations exist', async () => {
      const conversations = await conversationService.list()
      expect(conversations).toEqual([])
    })

    it('should return all conversations ordered by updatedAt desc', async () => {
      await conversationService.create('First')
      await conversationService.create('Second')
      await conversationService.create('Third')

      const conversations = await conversationService.list()

      expect(conversations).toHaveLength(3)
      expect(conversations[0].title).toBe('Third')
      expect(conversations[1].title).toBe('Second')
      expect(conversations[2].title).toBe('First')
    })
  })

  describe('get', () => {
    it('should return null for non-existent conversation', async () => {
      const conversation = await conversationService.get('non-existent-id')
      expect(conversation).toBeNull()
    })

    it('should return the conversation with messages included', async () => {
      const created = await conversationService.create('Test')

      // Add a message to the conversation
      await prisma.message.create({
        data: {
          conversationId: created.id,
          role: 'user',
          content: 'Hello'
        }
      })

      const conversation = await conversationService.get(created.id)

      expect(conversation).toBeDefined()
      expect(conversation!.id).toBe(created.id)
      expect(conversation!.messages).toHaveLength(1)
      expect(conversation!.messages[0].content).toBe('Hello')
    })
  })

  describe('update', () => {
    it('should update conversation title', async () => {
      const created = await conversationService.create('Original Title')

      const updated = await conversationService.update(created.id, {
        title: 'Updated Title'
      })

      expect(updated.title).toBe('Updated Title')
    })

    it('should update conversation pinned status', async () => {
      const created = await conversationService.create('Test')
      expect(created.pinned).toBe(false)

      const updated = await conversationService.update(created.id, {
        pinned: true
      })

      expect(updated.pinned).toBe(true)
    })

    it('should update multiple fields at once', async () => {
      const created = await conversationService.create('Original')

      const updated = await conversationService.update(created.id, {
        title: 'New Title',
        pinned: true
      })

      expect(updated.title).toBe('New Title')
      expect(updated.pinned).toBe(true)
    })
  })

  describe('delete', () => {
    it('should delete an existing conversation', async () => {
      const created = await conversationService.create('To Delete')

      await conversationService.delete(created.id)

      const found = await conversationService.get(created.id)
      expect(found).toBeNull()
    })

    it('should cascade delete associated messages', async () => {
      const created = await conversationService.create('With Messages')

      await prisma.message.create({
        data: {
          conversationId: created.id,
          role: 'user',
          content: 'Hello'
        }
      })

      await conversationService.delete(created.id)

      const messages = await prisma.message.findMany({
        where: { conversationId: created.id }
      })
      expect(messages).toHaveLength(0)
    })
  })
})
