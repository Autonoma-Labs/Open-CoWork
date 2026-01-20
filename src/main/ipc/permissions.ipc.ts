import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import { createPermissionService } from '../services/permission.service'

export function registerPermissionHandlers(): void {
  const prisma = getDatabase()
  const permissionService = createPermissionService(prisma)

  ipcMain.handle('permissions:check', async (_, path: string, operation: string) => {
    return permissionService.check(path, operation)
  })

  ipcMain.handle(
    'permissions:grant',
    async (_, path: string, operation: string, scope: string) => {
      return permissionService.grant(path, operation, scope)
    }
  )

  ipcMain.handle('permissions:revoke', async (_, path: string, operation: string) => {
    return permissionService.revoke(path, operation)
  })

  ipcMain.handle('permissions:list', async () => {
    return permissionService.list()
  })

  ipcMain.handle('permissions:clearSession', async () => {
    return permissionService.clearSession()
  })
}
