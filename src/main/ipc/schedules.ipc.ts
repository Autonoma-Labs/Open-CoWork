import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { createScheduleService } from '../services/schedule.service'
import { upsertScheduleJob, removeScheduleJob, runScheduleNow } from '../scheduler'

export function registerScheduleHandlers(): void {
  const prisma = getDatabase()
  const scheduleService = createScheduleService(prisma)

  ipcMain.handle('db:schedules:list', async () => {
    return scheduleService.list()
  })

  ipcMain.handle('db:schedules:get', async (_, id: string) => {
    return scheduleService.get(id)
  })

  ipcMain.handle('db:schedules:create', async (_, data) => {
    const schedule = await scheduleService.create(data)
    await upsertScheduleJob(schedule.id)
    return schedule
  })

  ipcMain.handle('db:schedules:update', async (_, id: string, data) => {
    const schedule = await scheduleService.update(id, data)
    await upsertScheduleJob(schedule.id)
    return schedule
  })

  ipcMain.handle('db:schedules:delete', async (_, id: string) => {
    await removeScheduleJob(id)
    return scheduleService.delete(id)
  })

  ipcMain.handle('db:schedules:runs:list', async (_, scheduleId?: string) => {
    return scheduleService.listRuns(scheduleId)
  })

  ipcMain.handle('db:schedules:runs:update', async (_, id: string, data) => {
    const run = await scheduleService.updateRun(id, data)

    if (data.status) {
      await scheduleService.update(run.scheduleId, {
        lastStatus: data.status
      })
    }

    return run
  })

  ipcMain.handle('db:schedules:runNow', async (_, id: string) => {
    await runScheduleNow(id)
    return { success: true }
  })
}
