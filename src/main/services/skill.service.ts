import { PrismaClient } from '@prisma/client'
import type { CreateSkillInput, UpdateSkillInput } from '../../shared/types'

export function createSkillService(prisma: PrismaClient) {
  return {
    list: () => {
      return prisma.skill.findMany({
        orderBy: { name: 'asc' }
      })
    },

    listEnabled: () => {
      return prisma.skill.findMany({
        where: { enabled: true },
        orderBy: { name: 'asc' }
      })
    },

    create: (data: CreateSkillInput) => {
      return prisma.skill.create({ data })
    },

    update: (id: string, data: UpdateSkillInput) => {
      return prisma.skill.update({
        where: { id },
        data
      })
    },

    delete: (id: string) => {
      return prisma.skill.delete({
        where: { id }
      })
    }
  }
}

export type SkillService = ReturnType<typeof createSkillService>
