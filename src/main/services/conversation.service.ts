import { PrismaClient } from '@prisma/client'
import type { UpdateConversationInput } from '../../shared/types'

export function createConversationService(prisma: PrismaClient) {
  return {
    list: () => {
      return prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' }
      })
    },

    get: (id: string) => {
      return prisma.conversation.findUnique({
        where: { id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { toolCalls: true }
          }
        }
      })
    },

    create: (title: string) => {
      return prisma.conversation.create({
        data: { title }
      })
    },

    update: (id: string, data: UpdateConversationInput) => {
      return prisma.conversation.update({
        where: { id },
        data
      })
    },

    delete: (id: string) => {
      return prisma.conversation.delete({
        where: { id }
      })
    }
  }
}

export type ConversationService = ReturnType<typeof createConversationService>
