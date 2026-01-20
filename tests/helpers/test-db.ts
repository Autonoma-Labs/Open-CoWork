import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

interface TestDbContext {
  prisma: PrismaClient
  cleanup: () => Promise<void>
}

/**
 * Creates an isolated test database for each test suite.
 * Uses a file-based SQLite database in a temp directory.
 */
export async function createTestDb(): Promise<TestDbContext> {
  // Create a temporary directory for this test's database
  const tempDir = mkdtempSync(join(tmpdir(), 'open-cowork-test-'))
  const dbPath = join(tempDir, 'test.db')
  const dbUrl = `file:${dbPath}`

  // Push the schema to the test database using Prisma CLI
  execSync('npx prisma db push --skip-generate', {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: dbUrl
    },
    stdio: 'pipe'
  })

  // Create a PrismaClient instance for this test database
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  })

  await prisma.$connect()

  // Initialize default settings (like the main app does)
  await prisma.settings.create({
    data: {
      id: 'default',
      theme: 'system',
      defaultModel: 'anthropic/claude-sonnet-4',
      onboardingComplete: false
    }
  })

  const cleanup = async (): Promise<void> => {
    await prisma.$disconnect()
    // Remove the temp directory and database file
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }

  return { prisma, cleanup }
}

/**
 * Creates a fresh PrismaClient for the same database URL.
 * Useful when you need multiple clients in the same test.
 */
export function createPrismaClient(dbUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    }
  })
}
