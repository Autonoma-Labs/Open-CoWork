import { ipcMain, safeStorage, app } from 'electron'
import { getDatabase } from '../database'
import {
  createSettingsService,
  type SecureStorageBackend
} from '../services/settings.service'
import type { UpdateSettingsInput } from '../../shared/types'

// Electron-specific secure storage implementation
function createElectronSecureStorage(): SecureStorageBackend {
  const getKeyPath = async () => {
    const path = await import('path')
    return path.join(app.getPath('userData'), '.api-key')
  }

  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),

    get: async () => {
      const fs = await import('fs/promises')
      const keyPath = await getKeyPath()

      const exists = await fs
        .access(keyPath)
        .then(() => true)
        .catch(() => false)
      if (!exists) return null

      const encrypted = await fs.readFile(keyPath)
      return safeStorage.decryptString(encrypted)
    },

    set: async (value: string) => {
      const fs = await import('fs/promises')
      const keyPath = await getKeyPath()

      const encrypted = safeStorage.encryptString(value)
      await fs.writeFile(keyPath, encrypted)
    },

    delete: async () => {
      const fs = await import('fs/promises')
      const keyPath = await getKeyPath()

      await fs.unlink(keyPath).catch(() => {
        // Ignore if file doesn't exist
      })
    }
  }
}

export function registerSettingsHandlers(): void {
  const prisma = getDatabase()
  const secureStorage = createElectronSecureStorage()
  const settingsService = createSettingsService(prisma, secureStorage)

  // Settings from database
  ipcMain.handle('settings:get', async () => {
    return settingsService.get()
  })

  ipcMain.handle('settings:update', async (_, data: UpdateSettingsInput) => {
    return settingsService.update(data)
  })

  // Secure storage for API key
  ipcMain.handle('settings:getApiKey', async () => {
    return settingsService.getApiKey()
  })

  ipcMain.handle('settings:setApiKey', async (_, key: string) => {
    return settingsService.setApiKey(key)
  })

  ipcMain.handle('settings:deleteApiKey', async () => {
    return settingsService.deleteApiKey()
  })

  // App paths
  ipcMain.handle('app:getPath', async () => {
    return app.getPath('userData')
  })

  ipcMain.handle('app:getHomePath', async () => {
    return app.getPath('home')
  })

  // Shell execution
  ipcMain.handle('shell:execute', async (_, command: string, cwd?: string) => {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    const result = await execAsync(command, {
      cwd: cwd || app.getPath('home'),
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10 // 10MB
    })

    return {
      stdout: result.stdout,
      stderr: result.stderr
    }
  })
}
