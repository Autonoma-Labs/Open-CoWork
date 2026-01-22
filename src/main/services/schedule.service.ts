import { PrismaClient } from '@prisma/client'

interface CreateScheduleInput {
  title: string
  prompt: string
  frequencyText: string
  cron: string
  timezone?: string | null
  model: string
  enabled?: boolean
}

interface UpdateScheduleInput {
  title?: string
  prompt?: string
  frequencyText?: string
  cron?: string
  timezone?: string | null
  model?: string
  enabled?: boolean
  lastRunAt?: Date | null
  nextRunAt?: Date | null
  lastStatus?: string | null
}

interface UpdateScheduleRunInput {
  status?: string
  finishedAt?: Date | null
  output?: string | null
  error?: string | null
  conversationId?: string | null
}

export function createScheduleService(prisma: PrismaClient) {
  return {
    list: () => {
      return prisma.schedule.findMany({
        orderBy: { createdAt: 'desc' }
      })
    },

    get: (id: string) => {
      return prisma.schedule.findUnique({
        where: { id }
      })
    },

    create: (data: CreateScheduleInput) => {
      return prisma.schedule.create({
        data: {
          title: data.title,
          prompt: data.prompt,
          frequencyText: data.frequencyText,
          cron: data.cron,
          timezone: data.timezone ?? null,
          model: data.model,
          enabled: data.enabled ?? true
        }
      })
    },

    update: (id: string, data: UpdateScheduleInput) => {
      return prisma.schedule.update({
        where: { id },
        data
      })
    },

    delete: (id: string) => {
      return prisma.schedule.delete({
        where: { id }
      })
    },

    listRuns: (scheduleId?: string | null) => {
      return prisma.scheduleRun.findMany({
        where: scheduleId ? { scheduleId } : undefined,
        include: { schedule: true },
        orderBy: { startedAt: 'desc' }
      })
    },

    createRun: (scheduleId: string) => {
      return prisma.scheduleRun.create({
        data: {
          scheduleId,
          status: 'running'
        }
      })
    },

    updateRun: (id: string, data: UpdateScheduleRunInput) => {
      return prisma.scheduleRun.update({
        where: { id },
        data
      })
    }
  }
}

export type ScheduleService = ReturnType<typeof createScheduleService>
