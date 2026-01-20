import { PrismaClient } from '@prisma/client'
import type {
  CreateMessageInput,
  UpdateMessageInput,
  CreateToolCallInput,
  UpdateToolCallInput
} from '../../shared/types'

export function createMessageService(prisma: PrismaClient) {
  return {
    list: (conversationId: string) => {
      return prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        include: { toolCalls: true }
      })
    },

    create: async (data: CreateMessageInput) => {
      // Also update conversation's updatedAt
      await prisma.conversation.update({
        where: { id: data.conversationId },
        data: { updatedAt: new Date() }
      })

      return prisma.message.create({
        data,
        include: { toolCalls: true }
      })
    },

    update: (id: string, data: UpdateMessageInput) => {
      return prisma.message.update({
        where: { id },
        data,
        include: { toolCalls: true }
      })
    },

    // Tool Call operations
    createToolCall: (data: CreateToolCallInput) => {
      return prisma.toolCall.create({
        data: {
          messageId: data.messageId,
          toolName: data.toolName,
          input: data.input,
          output: data.output,
          status: data.status || 'pending'
        }
      })
    },

    updateToolCall: (id: string, data: UpdateToolCallInput) => {
      return prisma.toolCall.update({
        where: { id },
        data
      })
    }
  }
}

export type MessageService = ReturnType<typeof createMessageService>
