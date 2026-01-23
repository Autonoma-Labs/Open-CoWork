import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb } from '../helpers/test-db'
import { createExportService } from '../../src/main/services/export.service'
import { createConversationService } from '../../src/main/services/conversation.service'
import { createMessageService } from '../../src/main/services/message.service'
import type { PrismaClient } from '@prisma/client'

describe('ExportService', () => {
  let prisma: PrismaClient
  let cleanup: () => Promise<void>
  let exportService: ReturnType<typeof createExportService>
  let conversationService: ReturnType<typeof createConversationService>
  let messageService: ReturnType<typeof createMessageService>

  beforeAll(async () => {
    const ctx = await createTestDb()
    prisma = ctx.prisma
    cleanup = ctx.cleanup
    exportService = createExportService()
    conversationService = createConversationService(prisma)
    messageService = createMessageService(prisma)
  })

  afterAll(async () => {
    await cleanup()
  })

  beforeEach(async () => {
    // Clean up before each test
    await prisma.message.deleteMany()
    await prisma.conversation.deleteMany()
  })

  describe('toMarkdown', () => {
    it('should export a conversation with title and header', async () => {
      const conversation = await conversationService.create('Test Conversation')
      const fullConversation = await conversationService.get(conversation.id)

      const markdown = exportService.toMarkdown(fullConversation!)

      expect(markdown).toContain('# Test Conversation')
      expect(markdown).toContain('*Exported on')
      expect(markdown).toContain('---')
    })

    it('should export user messages with correct role label', async () => {
      const conversation = await conversationService.create('User Message Test')
      await messageService.create({
        conversationId: conversation.id,
        role: 'user',
        content: 'Hello, this is a user message'
      })

      const fullConversation = await conversationService.get(conversation.id)
      const markdown = exportService.toMarkdown(fullConversation!)

      expect(markdown).toContain('## User')
      expect(markdown).toContain('Hello, this is a user message')
    })

    it('should export assistant messages with correct role label', async () => {
      const conversation = await conversationService.create('Assistant Message Test')
      await messageService.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Hello, this is an assistant response'
      })

      const fullConversation = await conversationService.get(conversation.id)
      const markdown = exportService.toMarkdown(fullConversation!)

      expect(markdown).toContain('## Assistant')
      expect(markdown).toContain('Hello, this is an assistant response')
    })

    it('should export multiple messages in order', async () => {
      const conversation = await conversationService.create('Multi Message Test')
      await messageService.create({
        conversationId: conversation.id,
        role: 'user',
        content: 'First message'
      })
      await messageService.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Second message'
      })
      await messageService.create({
        conversationId: conversation.id,
        role: 'user',
        content: 'Third message'
      })

      const fullConversation = await conversationService.get(conversation.id)
      const markdown = exportService.toMarkdown(fullConversation!)

      const firstIndex = markdown.indexOf('First message')
      const secondIndex = markdown.indexOf('Second message')
      const thirdIndex = markdown.indexOf('Third message')

      expect(firstIndex).toBeLessThan(secondIndex)
      expect(secondIndex).toBeLessThan(thirdIndex)
    })

    it('should export thinking content in a collapsible details block', async () => {
      const conversation = await conversationService.create('Thinking Test')
      await messageService.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Here is my response',
        thinking: 'Let me think about this carefully...'
      })

      const fullConversation = await conversationService.get(conversation.id)
      const markdown = exportService.toMarkdown(fullConversation!)

      expect(markdown).toContain('<details>')
      expect(markdown).toContain('<summary>Thinking</summary>')
      expect(markdown).toContain('Let me think about this carefully...')
      expect(markdown).toContain('</details>')
    })

    it('should export tool calls in a collapsible details block', async () => {
      const conversation = await conversationService.create('Tool Call Test')
      const message = await messageService.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Let me read that file for you'
      })

      await messageService.createToolCall({
        messageId: message.id,
        toolName: 'readFile',
        input: JSON.stringify({ path: '/test/file.txt' }),
        output: 'File contents here',
        status: 'success'
      })

      const fullConversation = await conversationService.get(conversation.id)
      const markdown = exportService.toMarkdown(fullConversation!)

      expect(markdown).toContain('<details>')
      expect(markdown).toContain('<summary>Tool Calls</summary>')
      expect(markdown).toContain('### readFile')
      expect(markdown).toContain('**Input:**')
      expect(markdown).toContain('/test/file.txt')
      expect(markdown).toContain('**Output:**')
      expect(markdown).toContain('File contents here')
      expect(markdown).toContain('**Status:** success')
    })

    it('should format JSON input in tool calls', async () => {
      const conversation = await conversationService.create('JSON Format Test')
      const message = await messageService.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Running command'
      })

      await messageService.createToolCall({
        messageId: message.id,
        toolName: 'bash',
        input: JSON.stringify({ command: 'ls -la', cwd: '/home' }),
        status: 'pending'
      })

      const fullConversation = await conversationService.get(conversation.id)
      const markdown = exportService.toMarkdown(fullConversation!)

      // Should be formatted with indentation
      expect(markdown).toContain('"command": "ls -la"')
      expect(markdown).toContain('"cwd": "/home"')
    })

    it('should handle multiple tool calls in a single message', async () => {
      const conversation = await conversationService.create('Multiple Tools Test')
      const message = await messageService.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Performing multiple operations'
      })

      await messageService.createToolCall({
        messageId: message.id,
        toolName: 'readFile',
        input: JSON.stringify({ path: '/file1.txt' }),
        output: 'Content 1',
        status: 'success'
      })

      await messageService.createToolCall({
        messageId: message.id,
        toolName: 'writeFile',
        input: JSON.stringify({ path: '/file2.txt', content: 'new content' }),
        output: 'Written successfully',
        status: 'success'
      })

      const fullConversation = await conversationService.get(conversation.id)
      const markdown = exportService.toMarkdown(fullConversation!)

      expect(markdown).toContain('### readFile')
      expect(markdown).toContain('### writeFile')
      expect(markdown).toContain('Content 1')
      expect(markdown).toContain('Written successfully')
    })

    it('should handle tool calls without output', async () => {
      const conversation = await conversationService.create('No Output Test')
      const message = await messageService.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Starting operation'
      })

      await messageService.createToolCall({
        messageId: message.id,
        toolName: 'bash',
        input: JSON.stringify({ command: 'echo test' }),
        status: 'pending'
      })

      const fullConversation = await conversationService.get(conversation.id)
      const markdown = exportService.toMarkdown(fullConversation!)

      expect(markdown).toContain('### bash')
      expect(markdown).toContain('**Input:**')
      expect(markdown).toContain('**Status:** pending')
      // Should not have Output section since output is null
      expect(markdown.indexOf('**Output:**')).toBe(-1)
    })

    it('should truncate very long tool outputs', async () => {
      const conversation = await conversationService.create('Long Output Test')
      const message = await messageService.create({
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Reading large file'
      })

      // Create a very long output (more than 2000 characters)
      const longOutput = 'x'.repeat(3000)

      await messageService.createToolCall({
        messageId: message.id,
        toolName: 'readFile',
        input: JSON.stringify({ path: '/large-file.txt' }),
        output: longOutput,
        status: 'success'
      })

      const fullConversation = await conversationService.get(conversation.id)
      const markdown = exportService.toMarkdown(fullConversation!)

      expect(markdown).toContain('... (truncated)')
      // Should not contain the full 3000 character output
      expect(markdown.length).toBeLessThan(longOutput.length + 1000)
    })

    it('should handle empty conversation with no messages', async () => {
      const conversation = await conversationService.create('Empty Conversation')
      const fullConversation = await conversationService.get(conversation.id)

      const markdown = exportService.toMarkdown(fullConversation!)

      expect(markdown).toContain('# Empty Conversation')
      expect(markdown).toContain('*Exported on')
      // Should still be valid markdown even with no messages
      expect(markdown.split('\n').length).toBeGreaterThan(3)
    })

    it('should handle messages with empty content', async () => {
      const conversation = await conversationService.create('Empty Content Test')
      await messageService.create({
        conversationId: conversation.id,
        role: 'user',
        content: ''
      })

      const fullConversation = await conversationService.get(conversation.id)
      const markdown = exportService.toMarkdown(fullConversation!)

      expect(markdown).toContain('## User')
      // Should not throw an error
      expect(markdown).toBeDefined()
    })
  })
})
