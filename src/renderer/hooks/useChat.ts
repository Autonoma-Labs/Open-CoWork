import { useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApiKey } from './useSettings'
import { useSkills } from './useSkills'
import { useUIStore } from '../stores/uiStore'
import { useAttachmentStore, hashKey } from '../stores/attachmentStore'
import { generateSystemPrompt } from '../services/ai/system-prompt'
import {
  createOpenRouterClient,
  streamChat,
  isApproachingContextLimit,
  isContextTooLargeError,
  compactConversation,
  estimateTokens
} from '../services/ai/openrouter'
import { tools } from '../services/ai/tools'
import {
  trackMessageSent,
  trackMessageReceived,
  trackMessageError,
  trackToolUsed,
  trackConversationCreated,
  trackGenerationStopped
} from '../services/analytics'

interface Attachment {
  id: string
  type: 'image' | 'file'
  name: string
  data: string
  mimeType: string
}

interface ToolCall {
  id: string
  toolName: string
  input: string
  output?: string | null
  status: 'pending' | 'success' | 'error'
}

interface Message {
  id?: string
  role: string
  content: string
  thinking?: string | null
  attachments?: Attachment[]
  toolCalls?: ToolCall[]
}

interface ConversationState {
  isLoading: boolean
  streamingMessage: Message | null
  error: string | null
}

export function useChat() {
  const queryClient = useQueryClient()
  const { apiKey } = useApiKey()
  const { enabledSkills } = useSkills()
  const { setProcessing, markAsUnread, activeConversationId } = useUIStore()
  const { storeAttachments } = useAttachmentStore()

  // Track state per conversation
  const [conversationStates, setConversationStates] = useState<Map<string, ConversationState>>(
    new Map()
  )

  // Track abort controllers per conversation
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  // Helper to update a specific conversation's state
  const updateConversationState = useCallback(
    (conversationId: string, updates: Partial<ConversationState>) => {
      setConversationStates((prev) => {
        const newMap = new Map(prev)
        const current = newMap.get(conversationId) || {
          isLoading: false,
          streamingMessage: null,
          error: null
        }
        newMap.set(conversationId, { ...current, ...updates })
        return newMap
      })
    },
    []
  )

  // Get state for a specific conversation
  const getConversationState = useCallback(
    (conversationId: string | null): ConversationState => {
      if (!conversationId) {
        return { isLoading: false, streamingMessage: null, error: null }
      }
      return (
        conversationStates.get(conversationId) || {
          isLoading: false,
          streamingMessage: null,
          error: null
        }
      )
    },
    [conversationStates]
  )

  const sendMessage = useCallback(
    async (content: string, conversationId: string, model: string, attachments?: Attachment[]) => {
      if (!apiKey) {
        updateConversationState(conversationId, {
          error: 'API key not configured. Please set your OpenRouter API key in settings.'
        })
        return
      }

      if (!conversationId) {
        updateConversationState(conversationId, { error: 'No active conversation' })
        return
      }

      // Initialize state for this conversation
      updateConversationState(conversationId, {
        isLoading: true,
        error: null,
        streamingMessage: null
      })

      // Create new abort controller for this conversation
      const abortController = new AbortController()
      abortControllersRef.current.set(conversationId, abortController)

      // Mark conversation as processing
      setProcessing(conversationId, true)

      try {
        // Build message content - include file contents for text files
        let messageContent = content
        if (attachments && attachments.length > 0) {
          const fileContents: string[] = []

          for (const attachment of attachments) {
            if (attachment.type === 'file') {
              // Decode base64 data URL to get text content
              try {
                const base64Data = attachment.data.split(',')[1]
                const textContent = atob(base64Data)
                fileContents.push(`<file name="${attachment.name}">\n${textContent}\n</file>`)
              } catch {
                fileContents.push(`[Attached: ${attachment.name} (could not read content)]`)
              }
            }
            // Images are handled separately via multipart content
          }

          if (fileContents.length > 0) {
            messageContent = fileContents.join('\n\n') + (content ? '\n\n' + content : '')
          }
        }

        // Save user message to database
        await window.api.createMessage({
          conversationId,
          role: 'user',
          content: messageContent
        })

        // Immediately invalidate queries so user message shows up
        queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })

        // Store attachments in session store for display
        if (attachments && attachments.length > 0) {
          const key = hashKey(conversationId, messageContent)
          storeAttachments(key, attachments)
        }

        // Get conversation history
        const dbMessages = await window.api.getMessages(conversationId)

        // Track message sent (after we have dbMessages to know if it's a new conversation)
        const isNewConversation = dbMessages.length === 1 // Only the message we just sent
        trackMessageSent({
          messageLength: messageContent.length,
          hasAttachments: !!attachments && attachments.length > 0,
          attachmentCount: attachments?.length || 0,
          model,
          isNewConversation
        })
        if (isNewConversation) {
          trackConversationCreated()
        }

        // Start timing for latency tracking
        const startTime = Date.now()

        // Build history, converting the last message to multipart if it has images
        const history = dbMessages.map((m, index) => {
          // For the last user message with attachments, create multipart content
          if (
            index === dbMessages.length - 1 &&
            m.role === 'user' &&
            attachments?.some((a) => a.type === 'image')
          ) {
            const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> =
              []

            // Add images first
            for (const attachment of attachments.filter((a) => a.type === 'image')) {
              parts.push({
                type: 'image',
                image: attachment.data
              })
            }

            // Add text content
            if (content) {
              parts.push({ type: 'text', text: content })
            }

            return {
              role: m.role as 'user' | 'assistant' | 'system',
              content: parts
            }
          }

          return {
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content
          }
        })

        // Get home directory for system prompt
        const homeDir = await window.api.getHomePath()

        // Generate system prompt with skills and home directory
        const systemPrompt = generateSystemPrompt({ homeDir, skills: enabledSkills })

        // Check if we're approaching context limit and need to compact
        let effectiveHistory = history
        let conversationSummary = ''

        if (isApproachingContextLimit(history, systemPrompt, model)) {
          console.log('[Context] Approaching limit, initiating compaction...')

          // Get string-content only messages for compaction
          const stringMessages = dbMessages.map((m) => ({
            role: m.role,
            content: m.content
          }))

          const { summary, keptMessages } = await compactConversation(apiKey, stringMessages)
          conversationSummary = summary

          if (summary) {
            // Rebuild history with compacted messages
            // Keep only the last N messages that weren't summarized
            const keptDbMessages = dbMessages.slice(-keptMessages.length)
            effectiveHistory = keptDbMessages.map((m, index) => {
              // Handle last message with images as before
              if (
                index === keptDbMessages.length - 1 &&
                m.role === 'user' &&
                attachments?.some((a) => a.type === 'image')
              ) {
                const parts: Array<
                  { type: 'text'; text: string } | { type: 'image'; image: string }
                > = []
                for (const attachment of attachments.filter((a) => a.type === 'image')) {
                  parts.push({ type: 'image', image: attachment.data })
                }
                if (content) {
                  parts.push({ type: 'text', text: content })
                }
                return {
                  role: m.role as 'user' | 'assistant' | 'system',
                  content: parts
                }
              }
              return {
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content
              }
            })

            console.log(
              `[Context] Compacted: ${dbMessages.length} → ${effectiveHistory.length} messages`
            )
          }
        }

        // Build effective system prompt with summary if we compacted
        const effectiveSystemPrompt = conversationSummary
          ? `${systemPrompt}\n\n## Previous Conversation Summary\nThe following is a summary of the earlier part of this conversation:\n\n${conversationSummary}\n\n---\nContinue the conversation based on the above context.`
          : systemPrompt

        // Initialize streaming message
        updateConversationState(conversationId, {
          streamingMessage: {
            role: 'assistant',
            content: '',
            thinking: null,
            toolCalls: []
          }
        })

        // Track tool calls for this message
        const toolCallsMap = new Map<string, ToolCall>()

        // Stream the response using the agent pattern
        const client = createOpenRouterClient(apiKey)
        let assistantContent = ''
        let needsParagraphBreak = false // Track if we need a break after tool result

        // Helper function to attempt streaming (allows retry on context error)
        const attemptStream = async (
          streamMessages: typeof effectiveHistory,
          streamPrompt: string
        ): Promise<void> => {
          await streamChat({
            client,
            systemPrompt: streamPrompt,
            messages: streamMessages,
            tools,
            model,
            maxSteps: 15,
            abortSignal: abortController.signal,

            onText: (text) => {
              // Add paragraph break if coming after a tool result
              if (needsParagraphBreak && assistantContent.length > 0 && text.trim()) {
                assistantContent += '\n\n'
                needsParagraphBreak = false
              }
              assistantContent += text
              updateConversationState(conversationId, {
                streamingMessage: {
                  role: 'assistant',
                  content: assistantContent,
                  thinking: null,
                  toolCalls: Array.from(toolCallsMap.values())
                }
              })
            },

            onToolCall: (toolCall) => {
              console.log('Tool call started:', toolCall.id, toolCall.name)
              const tc: ToolCall = {
                id: toolCall.id,
                toolName: toolCall.name,
                input: JSON.stringify(toolCall.args),
                status: 'pending'
              }
              toolCallsMap.set(toolCall.id, tc)

              updateConversationState(conversationId, {
                streamingMessage: {
                  role: 'assistant',
                  content: assistantContent,
                  thinking: null,
                  toolCalls: Array.from(toolCallsMap.values())
                }
              })
            },

            onToolResult: (toolResult) => {
              console.log('Tool result received:', toolResult.id)
              const existing = toolCallsMap.get(toolResult.id)
              if (existing) {
                const resultStr = JSON.stringify(toolResult.result)
                const hasError =
                  typeof toolResult.result === 'object' &&
                  toolResult.result !== null &&
                  'error' in toolResult.result &&
                  (toolResult.result as { error?: boolean }).error === true

                const updated: ToolCall = {
                  ...existing,
                  output: resultStr,
                  status: hasError ? 'error' : 'success'
                }
                toolCallsMap.set(toolResult.id, updated)

                // Track tool usage
                trackToolUsed({
                  toolName: existing.toolName,
                  success: !hasError,
                  durationMs: Date.now() - startTime // Approximate duration
                })

                // Mark that next text should have a paragraph break
                needsParagraphBreak = true

                updateConversationState(conversationId, {
                  streamingMessage: {
                    role: 'assistant',
                    content: assistantContent,
                    thinking: null,
                    toolCalls: Array.from(toolCallsMap.values())
                  }
                })
              }
            }
          })
        }

        // Try to stream, with automatic compaction on context error
        try {
          await attemptStream(effectiveHistory, effectiveSystemPrompt)
        } catch (streamError) {
          // Check if this is a context-too-large error
          if (isContextTooLargeError(streamError) && !conversationSummary) {
            console.log('[Context] Error detected, attempting emergency compaction...')

            // Force compaction with more aggressive settings
            const stringMessages = dbMessages.map((m) => ({
              role: m.role,
              content: m.content
            }))

            const { summary, keptMessages } = await compactConversation(apiKey, stringMessages, 4)

            if (summary) {
              // Rebuild with compacted history
              const keptDbMessages = dbMessages.slice(-keptMessages.length)
              const compactedHistory = keptDbMessages.map((m) => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content
              }))

              const compactedPrompt = `${systemPrompt}\n\n## Previous Conversation Summary\n${summary}\n\n---\nContinue from here.`

              console.log('[Context] Retrying with compacted context...')
              assistantContent = '' // Reset for retry
              needsParagraphBreak = false // Reset paragraph break flag
              toolCallsMap.clear()
              await attemptStream(compactedHistory, compactedPrompt)
            } else {
              throw streamError // Re-throw if compaction failed
            }
          } else {
            throw streamError // Re-throw non-context errors
          }
        }

        // Calculate latency and performance metrics
        const latencyMs = Date.now() - startTime
        const responseTokens = estimateTokens(assistantContent)
        const tokensPerSecond = latencyMs > 0 ? (responseTokens / latencyMs) * 1000 : undefined

        // Track message received
        trackMessageReceived({
          responseLength: assistantContent.length,
          latencyMs,
          tokensPerSecond,
          toolCallCount: toolCallsMap.size,
          model,
          wasCompacted: !!conversationSummary
        })

        // Save assistant message to database
        const savedMessage = await window.api.createMessage({
          conversationId,
          role: 'assistant',
          content: assistantContent
        })

        // Save tool calls with output and status
        for (const tc of toolCallsMap.values()) {
          await window.api.createToolCall({
            messageId: savedMessage.id,
            toolName: tc.toolName,
            input: tc.input,
            output: tc.output || undefined,
            status: tc.status
          })
        }

        // Refresh conversation
        queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
        queryClient.invalidateQueries({ queryKey: ['conversations'] })

        updateConversationState(conversationId, { streamingMessage: null })

        // If user switched to another conversation, mark this one as unread
        if (activeConversationId !== conversationId) {
          markAsUnread(conversationId)
        }
      } catch (err) {
        // Don't show error if it was aborted by user
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Request was cancelled by user')
          trackGenerationStopped()
        } else {
          console.error('Chat error:', err)
          // Track error
          trackMessageError({
            errorType: isContextTooLargeError(err) ? 'context_too_large' : 'unknown',
            model,
            wasRetried: false
          })
          updateConversationState(conversationId, {
            error: err instanceof Error ? err.message : 'An error occurred'
          })
        }
      } finally {
        updateConversationState(conversationId, {
          isLoading: false,
          streamingMessage: null
        })
        abortControllersRef.current.delete(conversationId)
        // Mark conversation as no longer processing
        setProcessing(conversationId, false)
      }
    },
    [
      apiKey,
      enabledSkills,
      queryClient,
      setProcessing,
      markAsUnread,
      activeConversationId,
      storeAttachments,
      updateConversationState
    ]
  )

  // Stop generation for a specific conversation
  const stopGeneration = useCallback((conversationId?: string) => {
    if (conversationId) {
      const controller = abortControllersRef.current.get(conversationId)
      if (controller) {
        controller.abort()
        abortControllersRef.current.delete(conversationId)
      }
    } else {
      // Stop all if no specific conversation provided
      for (const [id, controller] of abortControllersRef.current) {
        controller.abort()
        abortControllersRef.current.delete(id)
      }
    }
  }, [])

  // Check if any conversation is loading
  const isAnyLoading = useCallback(() => {
    for (const state of conversationStates.values()) {
      if (state.isLoading) return true
    }
    return false
  }, [conversationStates])

  return {
    sendMessage,
    stopGeneration,
    getConversationState,
    isAnyLoading,
    // For backward compatibility, expose state for active conversation
    isLoading: getConversationState(activeConversationId).isLoading,
    streamingMessage: getConversationState(activeConversationId).streamingMessage,
    error: getConversationState(activeConversationId).error
  }
}
