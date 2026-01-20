import { PrismaClient } from '@prisma/client'
import type { UpdateSettingsInput } from '../../shared/types'

// Interface for secure storage backend (allows mocking in tests)
export interface SecureStorageBackend {
  isAvailable: () => boolean
  get: () => Promise<string | null>
  set: (value: string) => Promise<void>
  delete: () => Promise<void>
}

export function createSettingsService(
  prisma: PrismaClient,
  secureStorage?: SecureStorageBackend
) {
  return {
    get: () => {
      return prisma.settings.findUnique({
        where: { id: 'default' }
      })
    },

    update: (data: UpdateSettingsInput) => {
      return prisma.settings.update({
        where: { id: 'default' },
        data
      })
    },

    // Secure storage operations (API key)
    getApiKey: async (): Promise<string | null> => {
      if (!secureStorage) {
        console.warn('Secure storage not available')
        return null
      }

      try {
        if (!secureStorage.isAvailable()) {
          console.warn('Encryption not available, API key storage disabled')
          return null
        }
        return secureStorage.get()
      } catch (error) {
        console.error('Failed to get API key:', error)
        return null
      }
    },

    setApiKey: async (key: string): Promise<void> => {
      if (!secureStorage) {
        throw new Error('Secure storage not available')
      }

      if (!secureStorage.isAvailable()) {
        throw new Error('Encryption not available')
      }

      return secureStorage.set(key)
    },

    deleteApiKey: async (): Promise<void> => {
      if (!secureStorage) {
        return
      }

      return secureStorage.delete()
    }
  }
}

export type SettingsService = ReturnType<typeof createSettingsService>
