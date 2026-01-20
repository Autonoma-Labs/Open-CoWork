import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb } from '../helpers/test-db'
import { createPermissionService } from '../../src/main/services/permission.service'
import type { PrismaClient } from '@prisma/client'

describe('PermissionService', () => {
  let prisma: PrismaClient
  let cleanup: () => Promise<void>
  let permissionService: ReturnType<typeof createPermissionService>

  beforeAll(async () => {
    const ctx = await createTestDb()
    prisma = ctx.prisma
    cleanup = ctx.cleanup
  })

  afterAll(async () => {
    await cleanup()
  })

  beforeEach(async () => {
    // Clean up permissions and create fresh service for each test
    await prisma.permission.deleteMany()
    permissionService = createPermissionService(prisma)
  })

  describe('check', () => {
    it('should return null when no permission exists', async () => {
      const result = await permissionService.check('/some/path', 'read')
      expect(result).toBeNull()
    })

    it('should find session permission', async () => {
      await permissionService.grant('/test/path', 'read', 'session')

      const result = await permissionService.check('/test/path', 'read')

      expect(result).toBeDefined()
      expect(result!.scope).toBe('session')
      expect(result!.path).toBe('/test/path')
      expect(result!.operation).toBe('read')
    })

    it('should find persisted permission', async () => {
      await permissionService.grant('/test/path', 'write', 'always')

      const result = await permissionService.check('/test/path', 'write')

      expect(result).toBeDefined()
      expect(result!.scope).toBe('always')
    })

    it('should prioritize session permissions over persisted', async () => {
      // Grant both session and persisted for the same path/operation
      await permissionService.grant('/test/path', 'read', 'always')
      await permissionService.grant('/test/path', 'read', 'session')

      const result = await permissionService.check('/test/path', 'read')

      // Session should be checked first
      expect(result!.scope).toBe('session')
    })
  })

  describe('grant', () => {
    it('should grant session permission', async () => {
      const permission = await permissionService.grant(
        '/path/to/file',
        'read',
        'session'
      )

      expect(permission).toBeDefined()
      expect(permission.path).toBe('/path/to/file')
      expect(permission.operation).toBe('read')
      expect(permission.scope).toBe('session')
      expect(permission.createdAt).toBeInstanceOf(Date)
    })

    it('should grant persisted permission', async () => {
      const permission = await permissionService.grant(
        '/path/to/file',
        'write',
        'always'
      )

      expect(permission).toBeDefined()
      expect(permission.scope).toBe('always')
      expect(permission.id).toBeDefined()

      // Verify it's persisted in database
      const dbPermission = await prisma.permission.findFirst({
        where: { path: '/path/to/file', operation: 'write' }
      })
      expect(dbPermission).toBeDefined()
    })

    it('should update existing persisted permission', async () => {
      // Grant as always
      await permissionService.grant('/path', 'read', 'always')

      // Update the scope (upsert behavior)
      const updated = await permissionService.grant('/path', 'read', 'always')

      expect(updated.scope).toBe('always')

      // Should still be only one permission in database
      const count = await prisma.permission.count({
        where: { path: '/path', operation: 'read' }
      })
      expect(count).toBe(1)
    })
  })

  describe('revoke', () => {
    it('should revoke session permission', async () => {
      await permissionService.grant('/test', 'read', 'session')

      await permissionService.revoke('/test', 'read')

      const result = await permissionService.check('/test', 'read')
      expect(result).toBeNull()
    })

    it('should revoke persisted permission', async () => {
      await permissionService.grant('/test', 'write', 'always')

      await permissionService.revoke('/test', 'write')

      const result = await permissionService.check('/test', 'write')
      expect(result).toBeNull()
    })

    it('should not throw when revoking non-existent permission', async () => {
      // Should not throw
      await expect(
        permissionService.revoke('/nonexistent', 'read')
      ).resolves.not.toThrow()
    })
  })

  describe('list', () => {
    it('should return empty array when no permissions exist', async () => {
      const permissions = await permissionService.list()
      expect(permissions).toEqual([])
    })

    it('should list both session and persisted permissions', async () => {
      await permissionService.grant('/path1', 'read', 'session')
      await permissionService.grant('/path2', 'write', 'always')

      const permissions = await permissionService.list()

      expect(permissions).toHaveLength(2)

      const sessionPerm = permissions.find((p) => p.path === '/path1')
      const persistedPerm = permissions.find((p) => p.path === '/path2')

      expect(sessionPerm?.scope).toBe('session')
      expect(persistedPerm?.scope).toBe('always')
    })
  })

  describe('clearSession', () => {
    it('should clear all session permissions', async () => {
      await permissionService.grant('/path1', 'read', 'session')
      await permissionService.grant('/path2', 'write', 'session')
      await permissionService.grant('/path3', 'execute', 'always')

      permissionService.clearSession()

      const permissions = await permissionService.list()

      // Only the persisted permission should remain
      expect(permissions).toHaveLength(1)
      expect(permissions[0].scope).toBe('always')
    })

    it('should not affect persisted permissions', async () => {
      await permissionService.grant('/test', 'read', 'always')

      permissionService.clearSession()

      const result = await permissionService.check('/test', 'read')
      expect(result).toBeDefined()
      expect(result!.scope).toBe('always')
    })
  })

  describe('getSessionPermissions', () => {
    it('should expose the session permissions map for testing', () => {
      const map = permissionService.getSessionPermissions()
      expect(map).toBeInstanceOf(Map)
      expect(map.size).toBe(0)
    })

    it('should reflect granted session permissions', async () => {
      await permissionService.grant('/test', 'read', 'session')

      const map = permissionService.getSessionPermissions()
      expect(map.has('/test:read')).toBe(true)
    })
  })
})
