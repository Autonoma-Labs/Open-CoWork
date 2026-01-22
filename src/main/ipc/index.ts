import { registerDatabaseHandlers } from './database.ipc'
import { registerFileSystemHandlers } from './file-system.ipc'
import { registerPermissionHandlers } from './permissions.ipc'
import { registerSettingsHandlers } from './settings.ipc'
import { registerBrowserHandlers, cleanupBrowser } from './browser.ipc'
import { registerSkillRegistryHandlers } from './skillregistry.ipc'
import { registerImageHandlers } from './image.ipc'
import { registerScheduleHandlers } from './schedules.ipc'

export function registerIpcHandlers(): void {
  registerDatabaseHandlers()
  registerFileSystemHandlers()
  registerPermissionHandlers()
  registerSettingsHandlers()
  registerBrowserHandlers()
  registerSkillRegistryHandlers()
  registerImageHandlers()
  registerScheduleHandlers()
}

export { cleanupBrowser }
