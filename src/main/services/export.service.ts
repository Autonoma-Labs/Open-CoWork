import type { Conversation, Message, ToolCall } from '@prisma/client'

type MessageWithToolCalls = Message & { toolCalls: ToolCall[] }
type ConversationWithMessages = Conversation & { messages: MessageWithToolCalls[] }

export function createExportService() {
  return {
    /**
     * Converts a conversation to markdown format
     */
    toMarkdown: (conversation: ConversationWithMessages): string => {
      const lines: string[] = []

      // Header
      lines.push(`# ${conversation.title}`)
      lines.push('')
      lines.push(`*Exported on ${new Date().toLocaleString()}*`)
      lines.push('')
      lines.push('---')
      lines.push('')

      // Messages
      for (const message of conversation.messages) {
        const roleLabel = message.role === 'user' ? 'User' : 'Assistant'
        lines.push(`## ${roleLabel}`)
        lines.push('')

        // Main content
        if (message.content) {
          lines.push(message.content)
          lines.push('')
        }

        // Thinking (if present)
        if (message.thinking) {
          lines.push('<details>')
          lines.push('<summary>Thinking</summary>')
          lines.push('')
          lines.push(message.thinking)
          lines.push('')
          lines.push('</details>')
          lines.push('')
        }

        // Tool calls (if present)
        if (message.toolCalls && message.toolCalls.length > 0) {
          lines.push('<details>')
          lines.push('<summary>Tool Calls</summary>')
          lines.push('')

          for (const toolCall of message.toolCalls) {
            lines.push(`### ${toolCall.toolName}`)
            lines.push('')
            lines.push('**Input:**')
            lines.push('```json')
            lines.push(formatJson(toolCall.input))
            lines.push('```')
            lines.push('')

            if (toolCall.output) {
              lines.push('**Output:**')
              lines.push('```')
              lines.push(truncateOutput(toolCall.output))
              lines.push('```')
              lines.push('')
            }

            lines.push(`**Status:** ${toolCall.status}`)
            lines.push('')
          }

          lines.push('</details>')
          lines.push('')
        }

        lines.push('---')
        lines.push('')
      }

      return lines.join('\n')
    }
  }
}

/**
 * Formats JSON string with proper indentation
 */
function formatJson(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return jsonString
  }
}

/**
 * Truncates long output to avoid huge markdown files
 */
function truncateOutput(output: string, maxLength = 2000): string {
  if (output.length <= maxLength) {
    return output
  }
  return output.substring(0, maxLength) + '\n... (truncated)'
}

export type ExportService = ReturnType<typeof createExportService>
