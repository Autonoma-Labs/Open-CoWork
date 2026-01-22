import { useEffect } from 'react'
import { useChat } from '../../hooks/useChat'
import { useConversations } from '../../hooks/useConversations'

export function ScheduleRunner() {
  const { sendMessage, getConversationState } = useChat()
  const { createConversation } = useConversations()

  useEffect(() => {
    const unsubscribe = window.api.onScheduleRun(async (payload) => {
      const { runId, title, prompt, model } = payload

      try {
        const conversationTitle = `Schedule: ${title}`
        const conversation = await createConversation(conversationTitle)

        await window.api.updateScheduleRun(runId, {
          conversationId: conversation.id
        })

        await sendMessage(prompt, conversation.id, model)

        const state = getConversationState(conversation.id)
        const error = state.error

        let output: string | null = null
        try {
          const messages = await window.api.getMessages(conversation.id)
          const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
          output = lastAssistant?.content || null
        } catch {
          output = null
        }

        await window.api.updateScheduleRun(runId, {
          status: error ? 'error' : 'success',
          error: error || null,
          output,
          finishedAt: new Date()
        })
      } catch (error) {
        await window.api.updateScheduleRun(runId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Schedule run failed',
          finishedAt: new Date()
        })
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [createConversation, getConversationState, sendMessage])

  return null
}
