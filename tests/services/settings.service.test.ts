import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createTestDb } from '../helpers/test-db'
import {
  createSettingsService,
  type SecureStorageBackend
} from '../../src/main/services/settings.service'
import type { PrismaClient } from '@prisma/client'

// Mock secure storage for testing
function createMockSecureStorage(): SecureStorageBackend & {
  _storage: Map<string, string>
  _available: boolean
} {
  const storage = new Map<string, string>()
  let available = true

  return {
    _storage: storage,
    _available: available,
    isAvailable: () => available,
    get: async () => storage.get('api-key') ?? null,
    set: async (value: string) => {
      storage.set('api-key', value)
    },
    delete: async () => {
      storage.delete('api-key')
    }
  }
}

describe('SettingsService', () => {
  let prisma: PrismaClient
  let cleanup: () => Promise<void>

  beforeAll(async () => {
    const ctx = await createTestDb()
    prisma = ctx.prisma
    cleanup = ctx.cleanup
  })

  afterAll(async () => {
    await cleanup()
  })

  describe('get', () => {
    it('should return default settings', async () => {
      const settingsService = createSettingsService(prisma)

      const settings = await settingsService.get()

      expect(settings).toBeDefined()
      expect(settings!.id).toBe('default')
      expect(settings!.theme).toBe('system')
      expect(settings!.defaultModel).toBe('anthropic/claude-sonnet-4')
      expect(settings!.onboardingComplete).toBe(false)
    })
  })

  describe('update', () => {
    beforeEach(async () => {
      // Reset settings to default state
      await prisma.settings.update({
        where: { id: 'default' },
        data: {
          theme: 'system',
          defaultModel: 'anthropic/claude-sonnet-4',
          analyticsOptIn: null,
          onboardingComplete: false,
          preferredBrowser: null,
          browserHeadless: true
        }
      })
    })

    it('should update theme', async () => {
      const settingsService = createSettingsService(prisma)

      const updated = await settingsService.update({ theme: 'dark' })

      expect(updated.theme).toBe('dark')
    })

    it('should update default model', async () => {
      const settingsService = createSettingsService(prisma)

      const updated = await settingsService.update({
        defaultModel: 'anthropic/claude-opus-4'
      })

      expect(updated.defaultModel).toBe('anthropic/claude-opus-4')
    })

    it('should update onboarding status', async () => {
      const settingsService = createSettingsService(prisma)

      const updated = await settingsService.update({ onboardingComplete: true })

      expect(updated.onboardingComplete).toBe(true)
    })

    it('should update analytics opt-in', async () => {
      const settingsService = createSettingsService(prisma)

      const updated = await settingsService.update({ analyticsOptIn: true })

      expect(updated.analyticsOptIn).toBe(true)
    })

    it('should update preferred browser', async () => {
      const settingsService = createSettingsService(prisma)

      const updated = await settingsService.update({ preferredBrowser: 'arc' })

      expect(updated.preferredBrowser).toBe('arc')
    })

    it('should update browser headless mode', async () => {
      const settingsService = createSettingsService(prisma)

      const updated = await settingsService.update({ browserHeadless: false })

      expect(updated.browserHeadless).toBe(false)
    })

    it('should update multiple settings at once', async () => {
      const settingsService = createSettingsService(prisma)

      const updated = await settingsService.update({
        theme: 'light',
        defaultModel: 'anthropic/claude-opus-4',
        onboardingComplete: true
      })

      expect(updated.theme).toBe('light')
      expect(updated.defaultModel).toBe('anthropic/claude-opus-4')
      expect(updated.onboardingComplete).toBe(true)
    })
  })

  describe('API Key operations with mock storage', () => {
    it('should return null when no API key is set', async () => {
      const mockStorage = createMockSecureStorage()
      const settingsService = createSettingsService(prisma, mockStorage)

      const key = await settingsService.getApiKey()

      expect(key).toBeNull()
    })

    it('should store and retrieve API key', async () => {
      const mockStorage = createMockSecureStorage()
      const settingsService = createSettingsService(prisma, mockStorage)

      await settingsService.setApiKey('sk-test-api-key-123')
      const key = await settingsService.getApiKey()

      expect(key).toBe('sk-test-api-key-123')
    })

    it('should delete API key', async () => {
      const mockStorage = createMockSecureStorage()
      const settingsService = createSettingsService(prisma, mockStorage)

      await settingsService.setApiKey('sk-test-api-key-123')
      await settingsService.deleteApiKey()
      const key = await settingsService.getApiKey()

      expect(key).toBeNull()
    })

    it('should return null when storage is unavailable', async () => {
      const mockStorage = createMockSecureStorage()
      // Override isAvailable to return false
      mockStorage.isAvailable = () => false

      const settingsService = createSettingsService(prisma, mockStorage)

      const key = await settingsService.getApiKey()

      expect(key).toBeNull()
    })

    it('should throw when setting key with unavailable storage', async () => {
      const mockStorage = createMockSecureStorage()
      mockStorage.isAvailable = () => false

      const settingsService = createSettingsService(prisma, mockStorage)

      await expect(
        settingsService.setApiKey('sk-test-key')
      ).rejects.toThrow('Encryption not available')
    })
  })

  describe('API Key operations without secure storage', () => {
    it('should return null when no secure storage is provided', async () => {
      const settingsService = createSettingsService(prisma)

      const key = await settingsService.getApiKey()

      expect(key).toBeNull()
    })

    it('should throw when setting key without secure storage', async () => {
      const settingsService = createSettingsService(prisma)

      await expect(
        settingsService.setApiKey('sk-test-key')
      ).rejects.toThrow('Secure storage not available')
    })

    it('should not throw when deleting key without secure storage', async () => {
      const settingsService = createSettingsService(prisma)

      // Should not throw
      await expect(settingsService.deleteApiKey()).resolves.not.toThrow()
    })
  })
})
