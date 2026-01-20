import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb } from '../helpers/test-db'
import { createMessageService } from '../../src/main/services/message.service'
import type { PrismaClient } from '@prisma/client'

describe('MessageService', () => {
  let prisma: PrismaClient
  let cleanup: () => Promise<void>
  let messageService: ReturnType<typeof createMessageService>
  let testConversationId: string

  beforeAll(async () => {
    const ctx = await createTestDb()
    prisma = ctx.prisma
    cleanup = ctx.cleanup
    messageService = createMessageService(prisma)
  })

  afterAll(async () => {
    await cleanup()
  })

  beforeEach(async () => {
    // Clean up and create a fresh conversation for each test
    await prisma.message.deleteMany()
    await prisma.conversation.deleteMany()

    const conversation = await prisma.conversation.create({
      data: { title: 'Test Conversation' }
    })
    testConversationId = conversation.id
  })

  describe('create', () => {
    it('should create a new message', async () => {
      const message = await messageService.create({
        conversationId: testConversationId,
        role: 'user',
        content: 'Hello, world!'
      })

      expect(message).toBeDefined()
      expect(message.id).toBeDefined()
      expect(message.conversationId).toBe(testConversationId)
      expect(message.role).toBe('user')
      expect(message.content).toBe('Hello, world!')
      expect(message.createdAt).toBeInstanceOf(Date)
    })

    it('should create a message with thinking content', async () => {
      const message = await messageService.create({
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Here is my response',
        thinking: 'Let me think about this...'
      })

      expect(message.thinking).toBe('Let me think about this...')
    })

    it('should update the conversation updatedAt timestamp', async () => {
      const convBefore = await prisma.conversation.findUnique({
        where: { id: testConversationId }
      })

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 50))

      await messageService.create({
        conversationId: testConversationId,
        role: 'user',
        content: 'Test message'
      })

      const convAfter = await prisma.conversation.findUnique({
        where: { id: testConversationId }
      })

      expect(convAfter!.updatedAt.getTime()).toBeGreaterThan(
        convBefore!.updatedAt.getTime()
      )
    })
  })

  describe('list', () => {
    it('should return an empty array when no messages exist', async () => {
      const messages = await messageService.list(testConversationId)
      expect(messages).toEqual([])
    })

    it('should return all messages for a conversation ordered by createdAt asc', async () => {
      await messageService.create({
        conversationId: testConversationId,
        role: 'user',
        content: 'First'
      })
      await messageService.create({
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Second'
      })
      await messageService.create({
        conversationId: testConversationId,
        role: 'user',
        content: 'Third'
      })

      const messages = await messageService.list(testConversationId)

      expect(messages).toHaveLength(3)
      expect(messages[0].content).toBe('First')
      expect(messages[1].content).toBe('Second')
      expect(messages[2].content).toBe('Third')
    })

    it('should include tool calls with messages', async () => {
      const message = await messageService.create({
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Let me help'
      })

      await messageService.createToolCall({
        messageId: message.id,
        toolName: 'readFile',
        input: JSON.stringify({ path: '/test' })
      })

      const messages = await messageService.list(testConversationId)

      expect(messages[0].toolCalls).toHaveLength(1)
      expect(messages[0].toolCalls![0].toolName).toBe('readFile')
    })
  })

  describe('update', () => {
    it('should update message content', async () => {
      const message = await messageService.create({
        conversationId: testConversationId,
        role: 'user',
        content: 'Original'
      })

      const updated = await messageService.update(message.id, {
        content: 'Updated content'
      })

      expect(updated.content).toBe('Updated content')
    })

    it('should update message thinking', async () => {
      const message = await messageService.create({
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Response'
      })

      const updated = await messageService.update(message.id, {
        thinking: 'New thinking'
      })

      expect(updated.thinking).toBe('New thinking')
    })
  })

  describe('createToolCall', () => {
    it('should create a tool call with pending status by default', async () => {
      const message = await messageService.create({
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Using tool'
      })

      const toolCall = await messageService.createToolCall({
        messageId: message.id,
        toolName: 'bash',
        input: JSON.stringify({ command: 'ls' })
      })

      expect(toolCall).toBeDefined()
      expect(toolCall.id).toBeDefined()
      expect(toolCall.toolName).toBe('bash')
      expect(toolCall.status).toBe('pending')
    })

    it('should create a tool call with custom status', async () => {
      const message = await messageService.create({
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Using tool'
      })

      const toolCall = await messageService.createToolCall({
        messageId: message.id,
        toolName: 'readFile',
        input: JSON.stringify({ path: '/test' }),
        output: 'file contents',
        status: 'success'
      })

      expect(toolCall.status).toBe('success')
      expect(toolCall.output).toBe('file contents')
    })
  })

  describe('updateToolCall', () => {
    it('should update tool call output and status', async () => {
      const message = await messageService.create({
        conversationId: testConversationId,
        role: 'assistant',
        content: 'Using tool'
      })

      const toolCall = await messageService.createToolCall({
        messageId: message.id,
        toolName: 'bash',
        input: JSON.stringify({ command: 'ls' })
      })

      const updated = await messageService.updateToolCall(toolCall.id, {
        output: 'file1.txt\nfile2.txt',
        status: 'success'
      })

      expect(updated.output).toBe('file1.txt\nfile2.txt')
      expect(updated.status).toBe('success')
    })
  })
})
