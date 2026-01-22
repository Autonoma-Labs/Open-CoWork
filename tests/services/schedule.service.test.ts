import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb } from '../helpers/test-db'
import { createScheduleService } from '../../src/main/services/schedule.service'
import type { PrismaClient } from '@prisma/client'

describe('ScheduleService', () => {
  let prisma: PrismaClient
  let cleanup: () => Promise<void>
  let scheduleService: ReturnType<typeof createScheduleService>

  beforeAll(async () => {
    const ctx = await createTestDb()
    prisma = ctx.prisma
    cleanup = ctx.cleanup
    scheduleService = createScheduleService(prisma)
  })

  afterAll(async () => {
    await cleanup()
  })

  beforeEach(async () => {
    await prisma.scheduleRun.deleteMany()
    await prisma.schedule.deleteMany()
  })

  it('creates a schedule with defaults', async () => {
    const schedule = await scheduleService.create({
      title: 'Daily Summary',
      prompt: 'Summarize my inbox and send an email.',
      frequencyText: 'every day at 9am',
      cron: '0 9 * * *',
      model: 'google/gemini-3-flash-preview'
    })

    expect(schedule.id).toBeDefined()
    expect(schedule.title).toBe('Daily Summary')
    expect(schedule.enabled).toBe(true)
    expect(schedule.cron).toBe('0 9 * * *')
  })

  it('lists schedules ordered by createdAt desc', async () => {
    await scheduleService.create({
      title: 'First',
      prompt: 'First',
      frequencyText: 'daily',
      cron: '0 8 * * *',
      model: 'google/gemini-3-flash-preview'
    })
    await scheduleService.create({
      title: 'Second',
      prompt: 'Second',
      frequencyText: 'daily',
      cron: '0 9 * * *',
      model: 'google/gemini-3-flash-preview'
    })

    const schedules = await scheduleService.list()
    expect(schedules).toHaveLength(2)
    expect(schedules[0].title).toBe('Second')
    expect(schedules[1].title).toBe('First')
  })

  it('updates a schedule', async () => {
    const schedule = await scheduleService.create({
      title: 'Weekly',
      prompt: 'Weekly check',
      frequencyText: 'weekly',
      cron: '0 10 * * 1',
      model: 'google/gemini-3-flash-preview'
    })

    const updated = await scheduleService.update(schedule.id, {
      title: 'Weekly Report',
      enabled: false
    })

    expect(updated.title).toBe('Weekly Report')
    expect(updated.enabled).toBe(false)
  })

  it('creates and updates schedule runs', async () => {
    const schedule = await scheduleService.create({
      title: 'Daily',
      prompt: 'Daily',
      frequencyText: 'daily',
      cron: '0 7 * * *',
      model: 'google/gemini-3-flash-preview'
    })

    const run = await scheduleService.createRun(schedule.id)
    expect(run.status).toBe('running')

    const updatedRun = await scheduleService.updateRun(run.id, {
      status: 'success',
      finishedAt: new Date(),
      output: 'Done'
    })

    expect(updatedRun.status).toBe('success')
    expect(updatedRun.output).toBe('Done')

    const runs = await scheduleService.listRuns(schedule.id)
    expect(runs).toHaveLength(1)
    expect(runs[0].schedule?.id).toBe(schedule.id)
  })

  it('deletes a schedule and cascades runs', async () => {
    const schedule = await scheduleService.create({
      title: 'Daily',
      prompt: 'Daily',
      frequencyText: 'daily',
      cron: '0 7 * * *',
      model: 'google/gemini-3-flash-preview'
    })

    await scheduleService.createRun(schedule.id)
    await scheduleService.delete(schedule.id)

    const runs = await prisma.scheduleRun.findMany()
    expect(runs).toHaveLength(0)
  })
})
