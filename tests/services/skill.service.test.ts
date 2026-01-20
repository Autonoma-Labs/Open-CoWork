import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestDb } from '../helpers/test-db'
import { createSkillService } from '../../src/main/services/skill.service'
import type { PrismaClient } from '@prisma/client'

describe('SkillService', () => {
  let prisma: PrismaClient
  let cleanup: () => Promise<void>
  let skillService: ReturnType<typeof createSkillService>

  beforeAll(async () => {
    const ctx = await createTestDb()
    prisma = ctx.prisma
    cleanup = ctx.cleanup
    skillService = createSkillService(prisma)
  })

  afterAll(async () => {
    await cleanup()
  })

  beforeEach(async () => {
    // Clean up skills before each test
    await prisma.skill.deleteMany()
  })

  describe('create', () => {
    it('should create a new skill', async () => {
      const skill = await skillService.create({
        name: 'test-skill',
        description: 'A test skill',
        content: '# Test Skill\n\nThis is a test skill.'
      })

      expect(skill).toBeDefined()
      expect(skill.id).toBeDefined()
      expect(skill.name).toBe('test-skill')
      expect(skill.description).toBe('A test skill')
      expect(skill.content).toContain('# Test Skill')
      expect(skill.enabled).toBe(true) // Default value
    })

    it('should create a skill with source URL', async () => {
      const skill = await skillService.create({
        name: 'pdf',
        description: 'PDF processing skill',
        content: '# PDF Processing',
        sourceUrl: 'https://skillregistry.io/skills/pdf'
      })

      expect(skill.sourceUrl).toBe('https://skillregistry.io/skills/pdf')
    })
  })

  describe('list', () => {
    it('should return an empty array when no skills exist', async () => {
      const skills = await skillService.list()
      expect(skills).toEqual([])
    })

    it('should return all skills ordered by name asc', async () => {
      await skillService.create({ name: 'zip', content: 'zip content' })
      await skillService.create({ name: 'pdf', content: 'pdf content' })
      await skillService.create({ name: 'docx', content: 'docx content' })

      const skills = await skillService.list()

      expect(skills).toHaveLength(3)
      expect(skills[0].name).toBe('docx')
      expect(skills[1].name).toBe('pdf')
      expect(skills[2].name).toBe('zip')
    })
  })

  describe('listEnabled', () => {
    it('should return only enabled skills', async () => {
      await skillService.create({
        name: 'enabled-skill',
        content: 'enabled content'
      })
      const disabledSkill = await skillService.create({
        name: 'another-enabled',
        content: 'more content'
      })

      // Disable one skill
      await skillService.update(disabledSkill.id, { enabled: false })

      const enabledSkills = await skillService.listEnabled()

      expect(enabledSkills).toHaveLength(1)
      expect(enabledSkills[0].name).toBe('enabled-skill')
    })

    it('should return enabled skills ordered by name asc', async () => {
      await skillService.create({ name: 'xlsx', content: 'xlsx content' })
      await skillService.create({ name: 'pdf', content: 'pdf content' })
      await skillService.create({ name: 'docx', content: 'docx content' })

      const enabledSkills = await skillService.listEnabled()

      expect(enabledSkills).toHaveLength(3)
      expect(enabledSkills[0].name).toBe('docx')
      expect(enabledSkills[1].name).toBe('pdf')
      expect(enabledSkills[2].name).toBe('xlsx')
    })
  })

  describe('update', () => {
    it('should update skill enabled status', async () => {
      const skill = await skillService.create({
        name: 'test',
        content: 'test content'
      })
      expect(skill.enabled).toBe(true)

      const updated = await skillService.update(skill.id, { enabled: false })

      expect(updated.enabled).toBe(false)
    })

    it('should update skill content', async () => {
      const skill = await skillService.create({
        name: 'test',
        content: 'original content'
      })

      const updated = await skillService.update(skill.id, {
        content: 'updated content'
      })

      expect(updated.content).toBe('updated content')
    })

    it('should update multiple fields at once', async () => {
      const skill = await skillService.create({
        name: 'test',
        content: 'original'
      })

      const updated = await skillService.update(skill.id, {
        enabled: false,
        content: 'new content'
      })

      expect(updated.enabled).toBe(false)
      expect(updated.content).toBe('new content')
    })
  })

  describe('delete', () => {
    it('should delete an existing skill', async () => {
      const skill = await skillService.create({
        name: 'to-delete',
        content: 'content'
      })

      await skillService.delete(skill.id)

      const skills = await skillService.list()
      expect(skills).toHaveLength(0)
    })

    it('should throw when deleting non-existent skill', async () => {
      await expect(skillService.delete('non-existent-id')).rejects.toThrow()
    })
  })
})
