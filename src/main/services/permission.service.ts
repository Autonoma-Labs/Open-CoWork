import { PrismaClient } from '@prisma/client'

function permissionKey(path: string, operation: string): string {
  return `${path}:${operation}`
}

export function createPermissionService(prisma: PrismaClient) {
  // Session-only permissions (not persisted to database)
  const sessionPermissions = new Map<string, boolean>()

  return {
    check: async (path: string, operation: string) => {
      const key = permissionKey(path, operation)

      // Check session permissions first
      if (sessionPermissions.has(key)) {
        return { scope: 'session', path, operation }
      }

      // Check persisted "always" permissions
      const permission = await prisma.permission.findUnique({
        where: { path_operation: { path, operation } }
      })

      return permission
    },

    grant: async (path: string, operation: string, scope: string) => {
      const key = permissionKey(path, operation)

      if (scope === 'session') {
        sessionPermissions.set(key, true)
        return { id: key, path, operation, scope, createdAt: new Date() }
      }

      // Persist "always" permissions
      return prisma.permission.upsert({
        where: { path_operation: { path, operation } },
        update: { scope },
        create: { path, operation, scope }
      })
    },

    revoke: async (path: string, operation: string) => {
      const key = permissionKey(path, operation)
      sessionPermissions.delete(key)

      await prisma.permission
        .delete({
          where: { path_operation: { path, operation } }
        })
        .catch(() => {
          // Ignore if not found
        })
    },

    list: async () => {
      const persisted = await prisma.permission.findMany()
      const session = Array.from(sessionPermissions.keys()).map((key) => {
        const [path, operation] = key.split(':')
        return { id: key, path, operation, scope: 'session', createdAt: new Date() }
      })
      return [...persisted, ...session]
    },

    clearSession: () => {
      sessionPermissions.clear()
    },

    // For testing: get the session permissions map
    getSessionPermissions: () => sessionPermissions
  }
}

export type PermissionService = ReturnType<typeof createPermissionService>
