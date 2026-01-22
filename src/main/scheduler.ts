import schedule, { type Job } from 'node-schedule'
import { BrowserWindow } from 'electron'
import { getDatabase } from './database'

const jobs = new Map<string, Job>()

interface ScheduleRunPayload {
  runId: string
  scheduleId: string
  title: string
  prompt: string
  model: string
  frequencyText: string
  cron: string
  timezone?: string | null
}

function broadcastRun(payload: ScheduleRunPayload) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('schedule:run', payload)
  }
}

function getNextRunAt(job?: Job | null): Date | null {
  if (!job) return null
  const next = job.nextInvocation()
  return next ? next.toDate() : null
}

async function updateNextRun(scheduleId: string, job?: Job | null) {
  const prisma = getDatabase()
  const nextRunAt = getNextRunAt(job)
  await prisma.schedule.update({
    where: { id: scheduleId },
    data: { nextRunAt }
  })
}

export async function runScheduleNow(scheduleId: string) {
  const prisma = getDatabase()
  const scheduleRecord = await prisma.schedule.findUnique({ where: { id: scheduleId } })
  if (!scheduleRecord || !scheduleRecord.enabled) {
    return
  }

  const run = await prisma.scheduleRun.create({
    data: {
      scheduleId: scheduleRecord.id,
      status: 'running'
    }
  })

  await prisma.schedule.update({
    where: { id: scheduleRecord.id },
    data: {
      lastRunAt: new Date(),
      lastStatus: 'running'
    }
  })

  await updateNextRun(scheduleRecord.id, jobs.get(scheduleRecord.id))

  broadcastRun({
    runId: run.id,
    scheduleId: scheduleRecord.id,
    title: scheduleRecord.title,
    prompt: scheduleRecord.prompt,
    model: scheduleRecord.model,
    frequencyText: scheduleRecord.frequencyText,
    cron: scheduleRecord.cron,
    timezone: scheduleRecord.timezone
  })
}

export async function upsertScheduleJob(scheduleId: string) {
  const prisma = getDatabase()
  const scheduleRecord = await prisma.schedule.findUnique({ where: { id: scheduleId } })
  if (!scheduleRecord || !scheduleRecord.enabled) {
    await removeScheduleJob(scheduleId)
    return
  }

  await removeScheduleJob(scheduleId)

  try {
    const job = schedule.scheduleJob(
      { rule: scheduleRecord.cron, tz: scheduleRecord.timezone ?? undefined },
      () => {
        runScheduleNow(scheduleRecord.id).catch((error) => {
          console.error('[Scheduler] Failed to trigger schedule:', error)
        })
      }
    )

    if (job) {
      jobs.set(scheduleRecord.id, job)
      await updateNextRun(scheduleRecord.id, job)
    }
  } catch (error) {
    console.error('[Scheduler] Failed to schedule job:', error)
    await prisma.schedule.update({
      where: { id: scheduleRecord.id },
      data: { lastStatus: 'error' }
    })
  }
}

export async function removeScheduleJob(scheduleId: string) {
  const existing = jobs.get(scheduleId)
  if (existing) {
    existing.cancel()
    jobs.delete(scheduleId)
  }

  const prisma = getDatabase()
  await prisma.schedule.update({
    where: { id: scheduleId },
    data: { nextRunAt: null }
  })
}

export async function rescheduleAll() {
  const prisma = getDatabase()
  const schedules = await prisma.schedule.findMany({ where: { enabled: true } })
  for (const scheduleRecord of schedules) {
    await upsertScheduleJob(scheduleRecord.id)
  }
}

export async function getActiveScheduleCount(): Promise<number> {
  const prisma = getDatabase()
  return prisma.schedule.count({ where: { enabled: true } })
}
