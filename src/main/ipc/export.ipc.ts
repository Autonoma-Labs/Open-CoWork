import { ipcMain, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { getDatabase } from '../database'
import { createConversationService } from '../services/conversation.service'
import { createExportService } from '../services/export.service'

export function registerExportHandlers(): void {
  const prisma = getDatabase()
  const conversationService = createConversationService(prisma)
  const exportService = createExportService()

  ipcMain.handle('export:markdown', async (_, conversationId: string) => {
    // Get the conversation with messages
    const conversation = await conversationService.get(conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    // Convert to markdown
    const markdown = exportService.toMarkdown(conversation)

    // Generate a safe filename from the title
    const safeTitle = conversation.title
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .substring(0, 50)
    const defaultFilename = `${safeTitle}.md`

    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Export Chat as Markdown',
      defaultPath: defaultFilename,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    // Write the file
    await writeFile(result.filePath, markdown, 'utf-8')

    return { success: true, filePath: result.filePath }
  })
}
