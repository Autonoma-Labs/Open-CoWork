import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react'
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Wrench,
  Paperclip,
  FileText,
  FolderSearch,
  Terminal,
  ListChecks,
  Sparkles,
  Globe,
  RotateCcw,
  GitFork,
  Copy,
  Check
} from 'lucide-react'
import logoImage from '../../assets/logo.png'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Dialog, DialogContent } from '../ui/dialog'
import { ChatInput, type ChatInputHandle, type Attachment } from './ChatInput'
import { FindBar } from './FindBar'
import { QuestionSlider } from './QuestionSlider'
import { useUIStore, modelSupportsSearch, DEFAULT_MODELS } from '../../stores/uiStore'
import { useAttachmentStore, hashKey } from '../../stores/attachmentStore'
import { useQuestionStore } from '../../stores/questionStore'
import { useConversation, useConversations } from '../../hooks/useConversations'
import { useChat } from '../../hooks/useChat'
import { generateConversationTitle } from '../../services/ai/openrouter'
import { cn } from '../../lib/utils'

interface ChatAreaProps {
  className?: string
}

export function ChatArea({ className }: ChatAreaProps) {
  const {
    activeConversationId,
    setActiveConversation,
    selectedModel,
    searchEnabled,
    toggleSearch,
    customModels
  } = useUIStore()
  const { createConversation, updateConversation } = useConversations()
  const { messages } = useConversation(activeConversationId)
  const { sendMessage, stopGeneration, isLoading, streamingMessage, error } = useChat()
  const { getAttachments } = useAttachmentStore()
  const { activeQuestionSet } = useQuestionStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isFindOpen, setIsFindOpen] = useState(false)
  const dragCounterRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const inputRef = useRef<ChatInputHandle>(null)

  // Cmd+F / Ctrl+F keyboard shortcut for find
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setIsFindOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Check if current model supports search
  const currentModelSupportsSearch = modelSupportsSearch(selectedModel)
  const allModels = useMemo(() => [...DEFAULT_MODELS, ...customModels], [customModels])

  const hasActiveQuestion = !!activeQuestionSet && !activeQuestionSet.submitted

  // Handle question submission - send answers back to the chat
  const handleQuestionSubmit = async (
    answers: Record<string, { selectedOption?: string; customAnswer?: string }>
  ) => {
    // Format answers as a user message
    const answerLines = Object.entries(answers).map(([questionId, answer]) => {
      const answerText = answer.selectedOption || answer.customAnswer || 'No answer'
      return `${questionId}: ${answerText}`
    })
    const content = `Here are my answers:\n${answerLines.join('\n')}`

    // Send as a user message
    if (activeConversationId) {
      await sendMessage(content, activeConversationId, selectedModel)
    }
  }

  // Handle drag-and-drop events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      await inputRef.current?.addFiles(files)
    }
  }, [])

  const handleSubmit = async (content: string, currentAttachments: Attachment[]) => {
    // Create conversation if needed
    let convId = activeConversationId
    if (!convId) {
      // Create with temporary title
      const tempTitle = content.slice(0, 30) + (content.length > 30 ? '...' : '') || 'New Chat'
      const newConv = await createConversation(tempTitle)
      convId = newConv.id
      setActiveConversation(convId)

      // Capture the conversation ID for the async closure
      const conversationIdForTitle = newConv.id
      const messageContent = content

      // Generate proper title in background
      ;(async () => {
        try {
          const apiKey = await window.api.getApiKey()
          if (!apiKey) {
            console.log('[Title Generation] No API key, skipping title generation')
            return
          }
          console.log(`[Title Generation] Generating title for conversation ${conversationIdForTitle}`)
          const generatedTitle = await generateConversationTitle(apiKey, messageContent)
          console.log(`[Title Generation] Generated: "${generatedTitle}", updating conversation...`)
          updateConversation({ id: conversationIdForTitle, data: { title: generatedTitle } })
          console.log(`[Title Generation] Update sent for conversation ${conversationIdForTitle}`)
        } catch (err) {
          console.error('[Title Generation] Failed:', err)
        }
      })()
    }

    // Determine model ID - append :online if search is enabled and model supports it
    let modelToUse = selectedModel
    if (searchEnabled && currentModelSupportsSearch && !selectedModel.endsWith(':online')) {
      modelToUse = `${selectedModel}:online`
    }

    await sendMessage(content, convId, modelToUse, currentAttachments)
  }

  // Build all messages with attachments from session store
  const messagesWithAttachments = useMemo(() => {
    return messages.map((msg) => {
      if (msg.role === 'user' && activeConversationId) {
        const key = hashKey(activeConversationId, msg.content)
        const storedAttachments = getAttachments(key)
        if (storedAttachments.length > 0) {
          return { ...msg, attachments: storedAttachments }
        }
      }
      return msg
    })
  }, [messages, activeConversationId, getAttachments])

  // Combine with streaming message (cast to common type)
  const allMessages: Array<{
    id?: string
    role: string
    content: string
    thinking?: string | null
    attachments?: Attachment[]
    toolCalls?: Array<{
      id: string
      toolName: string
      input: string
      output?: string | null
      status: string
    }>
  }> = useMemo(() => {
    const combined = [...messagesWithAttachments]
    if (streamingMessage) {
      combined.push(streamingMessage)
    }
    return combined
  }, [messagesWithAttachments, streamingMessage])

  const rowVirtualizer = useVirtualizer({
    count: allMessages.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 200,
    overscan: 6
  })

  // Memoized callback for redo action
  const handleRedo = useCallback(() => {
    const userMessages = allMessages.filter((m) => m.role === 'user')
    const lastUserMsg = userMessages[userMessages.length - 1]
    if (lastUserMsg && activeConversationId) {
      let modelToUse = selectedModel
      if (searchEnabled && currentModelSupportsSearch) {
        modelToUse = `${selectedModel}:online`
      }
      sendMessage(lastUserMsg.content, activeConversationId, modelToUse)
    }
  }, [allMessages, activeConversationId, selectedModel, searchEnabled, currentModelSupportsSearch, sendMessage])

  // Memoized callback for fork action
  const handleFork = useCallback((modelId: string) => {
    const userMessages = allMessages.filter((m) => m.role === 'user')
    const lastUserMsg = userMessages[userMessages.length - 1]
    if (lastUserMsg && activeConversationId) {
      sendMessage(lastUserMsg.content, activeConversationId, modelId)
    }
  }, [allMessages, activeConversationId, sendMessage])

  // Find the last assistant message index for enabling redo/fork
  const lastAssistantIndex = useMemo(() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].role === 'assistant') return i
    }
    return -1
  }, [allMessages])

  // Track previous message count to detect new messages
  const prevMessageCountRef = useRef(allMessages.length)

  // Auto-scroll only when new messages are added (not during streaming content updates)
  useEffect(() => {
    if (!listRef.current) return
    if (allMessages.length === 0) return

    const isNewMessage = allMessages.length > prevMessageCountRef.current
    prevMessageCountRef.current = allMessages.length

    // Only auto-scroll if a new message was added AND user is near bottom
    if (isNewMessage && isNearBottomRef.current) {
      rowVirtualizer.scrollToIndex(allMessages.length - 1, { align: 'end' })
    }
  }, [allMessages.length, rowVirtualizer])

  return (
    <div
      className={cn('relative flex h-full min-h-0 flex-col overflow-hidden', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-primary bg-background/80 p-8 text-center shadow-lg">
            <Paperclip className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-lg font-medium">Drop files here</p>
            <p className="text-sm text-muted-foreground">Images and documents will be attached</p>
          </div>
        </div>
      )}

      {/* Find bar */}
      <FindBar isOpen={isFindOpen} onClose={() => setIsFindOpen(false)} />

      {/* Messages Area */}
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto p-4"
        onScroll={(event) => {
          const target = event.currentTarget
          const distance = target.scrollHeight - target.scrollTop - target.clientHeight
          isNearBottomRef.current = distance < 200
        }}
      >
        <div className="mx-auto max-w-3xl">
          {allMessages.length === 0 && !activeConversationId ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-8 text-center">
                <div className="mb-4 flex justify-center">
                  <img src={logoImage} alt="Open CoWork" className="h-16 w-16 dark:invert" />
                </div>
                <h2 className="text-2xl font-medium" style={{ fontFamily: '"Space Mono", monospace' }}>Welcome to open co|work</h2>
                <p className="mt-2 text-muted-foreground">
                  Your AI assistant for exploring files, running commands, and getting things done.
                </p>
              </div>

              <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
                {/* Explore Files Card */}
                <button
                  onClick={() => inputRef.current?.setValue('What files do I have on my Desktop?')}
                  className="group rounded-xl border bg-card p-4 text-left transition-all hover:border-foreground/20 hover:shadow-md"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
                    <FolderSearch className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium">Explore Files</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Browse folders, search for files, and read documents
                  </p>
                </button>

                {/* Run Commands Card */}
                <button
                  onClick={() => inputRef.current?.setValue('What is my current directory and what files are here?')}
                  className="group rounded-xl border bg-card p-4 text-left transition-all hover:border-foreground/20 hover:shadow-md"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium">Run Commands</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Execute shell commands, run scripts, check versions
                  </p>
                </button>

                {/* Get Help Card */}
                <button
                  onClick={() => inputRef.current?.setValue('Help me understand this project structure')}
                  className="group rounded-xl border bg-card p-4 text-left transition-all hover:border-foreground/20 hover:shadow-md"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium">Track Tasks</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Break down tasks into steps and track progress
                  </p>
                </button>

                {/* Search Content Card */}
                <button
                  onClick={() => inputRef.current?.setValue('Search my files for...')}
                  className="group rounded-xl border bg-card p-4 text-left transition-all hover:border-foreground/20 hover:shadow-md"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium">Search Content</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Find text inside files and code across your projects
                  </p>
                </button>
              </div>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                Type a message below or click a card to get started
              </p>

              {/* Discord Community Link */}
              <a
                href="https://discord.gg/4Y6jn92q"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Join our Discord community
              </a>
            </div>
          ) : (
            <div>
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const msg = allMessages[virtualRow.index]
                  return (
                    <div
                      key={msg.id || virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      <div className="pb-4">
                        <MessageBubble
                          message={msg}
                          allModels={allModels}
                          onRedo={virtualRow.index === lastAssistantIndex ? handleRedo : undefined}
                          onFork={virtualRow.index === lastAssistantIndex ? handleFork : undefined}
                          isLoading={isLoading}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              {isLoading && !streamingMessage && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
              {error && (
                <div className="rounded-md bg-destructive/10 p-4 text-destructive">{error}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Question Slider - shown when agent asks questions */}
      {hasActiveQuestion && (
        <div className="border-t bg-background p-4">
          <QuestionSlider onSubmit={handleQuestionSubmit} />
        </div>
      )}

      <ChatInput
        ref={inputRef}
        isLoading={isLoading}
        activeConversationId={activeConversationId}
        onSubmit={handleSubmit}
        onStop={stopGeneration}
        searchEnabled={searchEnabled}
        toggleSearch={toggleSearch}
        currentModelSupportsSearch={currentModelSupportsSearch}
      />
    </div>
  )
}

interface ModelOption {
  id: string
  name: string
  provider: string
}

interface MessageBubbleProps {
  message: {
    id?: string
    role: string
    content: string
    thinking?: string | null
    attachments?: Array<{
      id: string
      type: 'image' | 'file'
      name: string
      data: string
    }>
    toolCalls?: Array<{
      id: string
      toolName: string
      input: string
      output?: string | null
      status: string
    }>
  }
  allModels?: ModelOption[]
  onRedo?: () => void
  onFork?: (modelId: string) => void
  isLoading?: boolean
}

const MessageBubble = memo(function MessageBubble({
  message,
  allModels,
  onRedo,
  onFork,
  isLoading
}: MessageBubbleProps) {
  const [showThinking, setShowThinking] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showForkMenu, setShowForkMenu] = useState(false)
  const isUser = message.role === 'user'

  // Extract text content without attachment markers for display
  const displayContent = message.content.replace(/\[Attached: [^\]]+\]\n*/g, '').trim()

  // Copy content to clipboard
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  return (
    <div className={cn('group flex flex-col gap-2', isUser && 'items-end')}>
      {/* Thinking block */}
      {message.thinking && (
        <div className="max-w-[80%] rounded-md bg-muted/50 p-2 text-sm">
          <button
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setShowThinking(!showThinking)}
          >
            {showThinking ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>Thinking</span>
          </button>
          {showThinking && (
            <div className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {message.thinking}
            </div>
          )}
        </div>
      )}

      {/* Tool calls */}
      {message.toolCalls?.map((tool) => (
        <div key={tool.id} className="max-w-[80%]">
          <ToolCallBlock toolCall={tool} />
        </div>
      ))}

      {/* Image attachments for user messages */}
      {isUser && message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.attachments
            .filter((a) => a.type === 'image')
            .map((attachment) => (
              <button
                key={attachment.id}
                onClick={() => setLightboxImage(attachment.data)}
                className="overflow-hidden rounded-lg border hover:opacity-90 transition-opacity"
              >
                <img
                  src={attachment.data}
                  alt={attachment.name}
                  className="h-32 w-auto max-w-[200px] object-cover"
                />
              </button>
            ))}
        </div>
      )}

      {/* Message content */}
      {displayContent && (
        <div
          className={cn(
            'max-w-[80%]',
            isUser ? 'rounded-xl bg-muted/40 px-4 py-2' : ''
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap text-base leading-relaxed">{displayContent}</div>
          ) : (
            <div className="prose dark:prose-invert max-w-none prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-headings:my-4 prose-p:leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

        {/* Message actions - show on hover */}
        <div
          className={cn(
            'flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100',
            isUser ? 'justify-end' : 'justify-start'
          )}
        >
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Copy message"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>

          {/* Redo button - only for last assistant message */}
          {!isUser && onRedo && (
            <button
              onClick={onRedo}
              disabled={isLoading}
              className={cn(
                'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground',
                isLoading && 'cursor-not-allowed opacity-50'
              )}
              title="Regenerate response"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          {/* Fork button - only for last assistant message */}
          {!isUser && onFork && allModels && (
            <div className="relative">
              <button
                onClick={() => setShowForkMenu(!showForkMenu)}
                disabled={isLoading}
                className={cn(
                  'rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground',
                  isLoading && 'cursor-not-allowed opacity-50'
                )}
                title="Regenerate with different model"
              >
                <GitFork className="h-4 w-4" />
              </button>

              {/* Fork model selector dropdown */}
              {showForkMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowForkMenu(false)} />
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-lg border bg-popover p-2 shadow-lg">
                    <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">
                      Regenerate with:
                    </div>
                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {allModels.map((model) => (
                        <button
                          key={model.id}
                          className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            onFork(model.id)
                            setShowForkMenu(false)
                          }}
                        >
                          <div>
                            <div className="font-medium">{model.name}</div>
                            <div className="text-xs text-muted-foreground">{model.provider}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      {/* Image lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {lightboxImage && (
            <img
              src={lightboxImage}
              alt="Full size"
              className="w-full h-auto"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
})

interface ToolCallBlockProps {
  toolCall: {
    id: string
    toolName: string
    input: string
    output?: string | null
    status: string
  }
}

// Friendly tool names and descriptions for non-technical users
const toolDisplayInfo: Record<string, { name: string; icon: 'folder' | 'search' | 'file' | 'terminal' | 'list' | 'globe' | 'sparkles'; getContext?: (input: Record<string, unknown>) => string }> = {
  listDirectory: {
    name: 'Browsing folder',
    icon: 'folder',
    getContext: (input) => input.path as string
  },
  glob: {
    name: 'Searching for files',
    icon: 'search',
    getContext: (input) => `"${input.pattern}"${input.path ? ` in ${input.path}` : ''}`
  },
  grep: {
    name: 'Searching file contents',
    icon: 'search',
    getContext: (input) => `"${input.pattern}" in ${input.path}`
  },
  readFile: {
    name: 'Reading file',
    icon: 'file',
    getContext: (input) => (input.path as string)?.split('/').pop() || input.path as string
  },
  viewImage: {
    name: 'Viewing image',
    icon: 'file',
    getContext: (input) => (input.path as string)?.split('/').pop() || input.path as string
  },
  todoWrite: {
    name: 'Updating task list',
    icon: 'list'
  },
  askQuestion: {
    name: 'Asking you a question',
    icon: 'sparkles'
  },
  bash: {
    name: 'Running command',
    icon: 'terminal',
    getContext: (input) => {
      const cmd = input.command as string
      return cmd.length > 40 ? cmd.slice(0, 40) + '...' : cmd
    }
  },
  browserNavigate: {
    name: 'Opening webpage',
    icon: 'globe',
    getContext: (input) => {
      try {
        const url = new URL(input.url as string)
        return url.hostname
      } catch {
        return input.url as string
      }
    }
  },
  browserGetContent: {
    name: 'Reading webpage',
    icon: 'globe'
  },
  browserClick: {
    name: 'Clicking',
    icon: 'globe',
    getContext: (input) => `"${input.selector}"`
  },
  browserType: {
    name: 'Typing',
    icon: 'globe',
    getContext: (input) => `"${(input.text as string)?.slice(0, 20)}${(input.text as string)?.length > 20 ? '...' : ''}"`
  },
  browserPress: {
    name: 'Pressing key',
    icon: 'globe',
    getContext: (input) => input.key as string
  },
  browserGetLinks: {
    name: 'Getting page links',
    icon: 'globe'
  },
  browserScroll: {
    name: 'Scrolling',
    icon: 'globe',
    getContext: (input) => input.direction as string
  },
  browserScreenshot: {
    name: 'Taking screenshot',
    icon: 'globe'
  },
  browserClose: {
    name: 'Closing browser',
    icon: 'globe'
  }
}

function getToolIcon(iconType: string) {
  switch (iconType) {
    case 'folder': return <FolderSearch className="h-4 w-4" />
    case 'search': return <FolderSearch className="h-4 w-4" />
    case 'file': return <FileText className="h-4 w-4" />
    case 'terminal': return <Terminal className="h-4 w-4" />
    case 'list': return <ListChecks className="h-4 w-4" />
    case 'globe': return <Globe className="h-4 w-4" />
    case 'sparkles': return <Sparkles className="h-4 w-4" />
    default: return <Wrench className="h-4 w-4" />
  }
}

function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false)

  // Get friendly display info
  const displayInfo = toolDisplayInfo[toolCall.toolName]
  const friendlyName = displayInfo?.name || toolCall.toolName
  const icon = displayInfo?.icon || 'sparkles'

  // Get context from input
  let context = ''
  if (displayInfo?.getContext) {
    try {
      const input = JSON.parse(toolCall.input)
      context = displayInfo.getContext(input)
    } catch {
      // Ignore parse errors
    }
  }

  // Check if output has a screenshot (for browser tools) or imageRef
  let screenshot: string | null = null
  let imageRef: { imageId: number; hint: string } | null = null
  let parsedOutput: Record<string, unknown> | null = null
  if (toolCall.output) {
    try {
      parsedOutput = JSON.parse(toolCall.output)
      if (parsedOutput && typeof parsedOutput === 'object' && 'screenshot' in parsedOutput) {
        screenshot = parsedOutput.screenshot as string
      }
      // Also check for 'image' field (browserScreenshot tool)
      if (parsedOutput && typeof parsedOutput === 'object' && 'image' in parsedOutput) {
        screenshot = parsedOutput.image as string
      }
      // Check for imageRef (image registry reference)
      if (parsedOutput && typeof parsedOutput === 'object' && 'imageRef' in parsedOutput) {
        imageRef = parsedOutput.imageRef as { imageId: number; hint: string }
      }
    } catch (e) {
      console.error('Failed to parse tool output:', e)
    }
  }

  // Check if this is a browser tool (to auto-show screenshot)
  const isBrowserTool = toolCall.toolName.startsWith('browser')

  return (
    <div className="rounded-md border bg-muted/30 p-2 text-sm">
      <button
        className="flex items-center gap-2 font-medium"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {getToolIcon(icon)}
        <span>{friendlyName}</span>
        {context && <span className="text-muted-foreground font-normal">{context}</span>}
        <span
          className={cn(
            'ml-auto rounded px-1.5 py-0.5 text-xs',
            toolCall.status === 'success' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            toolCall.status === 'error' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
            toolCall.status === 'pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          )}
        >
          {toolCall.status === 'success' ? 'done' : toolCall.status === 'error' ? 'failed' : 'working...'}
        </span>
      </button>

      {/* Show screenshot for browser tools (always visible, not in expanded) */}
      {isBrowserTool && screenshot && toolCall.status === 'success' && (
        <div className="mt-2 relative inline-block">
          <img
            src={screenshot}
            alt="Browser screenshot"
            className="w-full max-w-md rounded-md border"
          />
          {/* Image ID badge overlay */}
          {imageRef && (
            <div className="absolute top-2 left-2 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
              #{imageRef.imageId}
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <div className="text-xs text-muted-foreground">Input:</div>
            <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-xs">
              {JSON.stringify(JSON.parse(toolCall.input), null, 2)}
            </pre>
          </div>
          {toolCall.output && (
            <div>
              <div className="text-xs text-muted-foreground">Output:</div>
              <pre className="mt-1 overflow-x-auto rounded bg-background p-2 text-xs">
                {toolCall.output.length > 500 ? toolCall.output.slice(0, 500) + '...' : toolCall.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
