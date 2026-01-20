import { useRef, useEffect, useState, useCallback } from 'react'
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Wrench,
  Paperclip,
  X,
  FileText,
  FolderSearch,
  Terminal,
  ListChecks,
  Sparkles,
  Globe,
  RotateCcw,
  GitFork,
  Copy,
  Check,
  Square
} from 'lucide-react'
import logoImage from '../../assets/logo.png'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ScrollArea } from '../ui/scroll-area'
import { Dialog, DialogContent } from '../ui/dialog'
import { ModelPicker } from './ModelPicker'
import { QuestionSlider } from './QuestionSlider'
import { useUIStore, modelSupportsSearch, DEFAULT_MODELS } from '../../stores/uiStore'
import { useAttachmentStore, hashKey } from '../../stores/attachmentStore'
import { useQuestionStore } from '../../stores/questionStore'
import { useTodoStore } from '../../stores/todoStore'
import { useConversation, useConversations } from '../../hooks/useConversations'
import { useChat } from '../../hooks/useChat'
import { generateConversationTitle } from '../../services/ai/openrouter'
import { cn } from '../../lib/utils'

interface Attachment {
  id: string
  type: 'image' | 'file'
  name: string
  data: string // base64 data URL
  mimeType: string
}

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
  const { todos } = useTodoStore()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // Check if current model supports search
  const currentModelSupportsSearch = modelSupportsSearch(selectedModel)
  const allModels = [...DEFAULT_MODELS, ...customModels]

  const hasActiveQuestion = !!activeQuestionSet && !activeQuestionSet.submitted
  const [isStopHovered, setIsStopHovered] = useState(false)

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

  // Convert file to base64 data URL
  // Compress and resize image to reduce API payload size
  const compressImage = useCallback(
    (file: File, maxSize: number = 1024, quality: number = 0.8): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        img.onload = () => {
          // Calculate new dimensions
          let { width, height } = img
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height * maxSize) / width)
              width = maxSize
            } else {
              width = Math.round((width * maxSize) / height)
              height = maxSize
            }
          }

          canvas.width = width
          canvas.height = height
          ctx?.drawImage(img, 0, 0, width, height)

          // Convert to JPEG for better compression (unless it's a PNG with transparency)
          const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
          const dataUrl = canvas.toDataURL(mimeType, quality)

          console.log(
            `[Image] Compressed: ${img.width}x${img.height} → ${width}x${height}, ` +
              `${Math.round(file.size / 1024)}KB → ~${Math.round((dataUrl.length * 0.75) / 1024)}KB`
          )

          resolve(dataUrl)
        }

        img.onerror = reject

        // Load image from file
        const reader = new FileReader()
        reader.onload = () => {
          img.src = reader.result as string
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    },
    []
  )

  // Convert file to base64 data URL (with compression for images)
  const fileToDataUrl = useCallback(
    async (file: File): Promise<string> => {
      // Compress images to reduce API payload
      if (file.type.startsWith('image/')) {
        return compressImage(file)
      }

      // For non-images, just read as data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    },
    [compressImage]
  )

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return

    const newAttachments: Attachment[] = []
    for (const file of Array.from(files)) {
      const data = await fileToDataUrl(file)
      const isImage = file.type.startsWith('image/')
      newAttachments.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: isImage ? 'image' : 'file',
        name: file.name,
        data,
        mimeType: file.type
      })
    }
    setAttachments((prev) => [...prev, ...newAttachments])
  }, [fileToDataUrl])

  // Handle paste event for images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const data = await fileToDataUrl(file)
          setAttachments((prev) => [...prev, {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'image',
            name: `pasted-image-${Date.now()}.png`,
            data,
            mimeType: file.type
          }])
        }
      }
    }
  }, [fileToDataUrl])

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
      await handleFileSelect(files)
    }
  }, [handleFileSelect])

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && attachments.length === 0) || isLoading) return

    const content = input.trim()
    const currentAttachments = [...attachments]
    setInput('')
    setAttachments([])

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

    // Send message with attachments
    await sendMessage(content, convId, modelToUse, currentAttachments)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  // Build all messages with attachments from session store
  const messagesWithAttachments = messages.map((msg) => {
    if (msg.role === 'user' && activeConversationId) {
      const key = hashKey(activeConversationId, msg.content)
      const storedAttachments = getAttachments(key)
      if (storedAttachments.length > 0) {
        return { ...msg, attachments: storedAttachments }
      }
    }
    return msg
  })

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
  }> = [...messagesWithAttachments]

  if (streamingMessage) {
    allMessages.push(streamingMessage)
  }

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

      {/* Messages Area */}
      <ScrollArea className="min-h-0 flex-1 p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {allMessages.length === 0 && !activeConversationId && (
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
                  onClick={() => setInput('What files do I have on my Desktop?')}
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
                  onClick={() => setInput('What is my current directory and what files are here?')}
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
                  onClick={() => setInput('Help me understand this project structure')}
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
                  onClick={() => setInput('Search my files for...')}
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
            </div>
          )}

          {allMessages.map((msg, index) => (
            <MessageBubble
              key={msg.id || index}
              message={msg}
              allModels={allModels}
              onRedo={
                msg.role === 'assistant' && index === allMessages.length - 1
                  ? () => {
                      // Get the last user message to redo
                      const userMessages = allMessages.filter((m) => m.role === 'user')
                      const lastUserMsg = userMessages[userMessages.length - 1]
                      if (lastUserMsg && activeConversationId) {
                        // Determine model to use
                        let modelToUse = selectedModel
                        if (searchEnabled && currentModelSupportsSearch) {
                          modelToUse = `${selectedModel}:online`
                        }
                        sendMessage(lastUserMsg.content, activeConversationId, modelToUse)
                      }
                    }
                  : undefined
              }
              onFork={
                msg.role === 'assistant' && index === allMessages.length - 1
                  ? (modelId: string) => {
                      const userMessages = allMessages.filter((m) => m.role === 'user')
                      const lastUserMsg = userMessages[userMessages.length - 1]
                      if (lastUserMsg && activeConversationId) {
                        sendMessage(lastUserMsg.content, activeConversationId, modelId)
                      }
                    }
                  : undefined
              }
              isLoading={isLoading}
            />
          ))}

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
      </ScrollArea>

      {/* Question Slider - shown when agent asks questions */}
      {hasActiveQuestion && (
        <div className="border-t bg-background p-4">
          <QuestionSlider onSubmit={handleQuestionSubmit} />
        </div>
      )}

      {/* Input Area */}
      <div className="bg-background p-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.scss,.yaml,.yml,.xml,.sql,.sh,.bash,.zsh,.env,.gitignore,.toml,.rs,.go,.java,.c,.cpp,.h,.hpp,.swift,.kt,.rb,.php"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />

          {/* Unified Input Container */}
          <div className="rounded-2xl border bg-card shadow-sm">
            {/* Attachment Previews - inside container at top */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b p-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="group relative flex items-center gap-2 rounded-lg border bg-muted/50 p-2"
                  >
                    {attachment.type === 'image' && attachment.data ? (
                      <img
                        src={attachment.data}
                        alt={attachment.name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <span className="max-w-[80px] truncate text-xs">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Textarea */}
            <div className="px-4 pt-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="How can I help you today?"
                className="w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground"
                disabled={isLoading}
                rows={1}
              />
            </div>

            {/* Bottom toolbar with model picker, search, and attachment */}
            <div className="flex items-center justify-between px-3 pb-3 pt-2">
              {/* Left side: Model picker */}
              <div className="flex items-center gap-1">
                <ModelPicker variant="minimal" />
              </div>

              {/* Right side: Search toggle and Attachment */}
              <div className="flex items-center gap-1">
                {/* Search Toggle */}
                <button
                  type="button"
                  onClick={toggleSearch}
                  disabled={!currentModelSupportsSearch}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                    searchEnabled && currentModelSupportsSearch
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    !currentModelSupportsSearch && 'cursor-not-allowed opacity-40'
                  )}
                  title={
                    currentModelSupportsSearch
                      ? searchEnabled
                        ? 'Web search enabled - click to disable'
                        : 'Click to enable web search'
                      : 'This model does not support web search'
                  }
                >
                  <Globe className="h-4 w-4" />
                </button>

                {/* Attachment Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  title="Add attachment"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                {/* Loading indicator / Stop button */}
                {isLoading && (
                  <button
                    type="button"
                    onClick={() => stopGeneration(activeConversationId || undefined)}
                    onMouseEnter={() => setIsStopHovered(true)}
                    onMouseLeave={() => setIsStopHovered(false)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                      isStopHovered
                        ? 'bg-destructive/15 text-destructive'
                        : 'text-muted-foreground'
                    )}
                    title="Stop generating"
                  >
                    {isStopHovered ? (
                      <Square className="h-4 w-4 fill-current" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Hint text */}
          {!isLoading && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Press Enter to send · Shift+Enter for new line
            </p>
          )}
        </form>
      </div>
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

function MessageBubble({ message, allModels, onRedo, onFork, isLoading }: MessageBubbleProps) {
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
}

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

  // Check if output has a screenshot (for browser tools)
  let screenshot: string | null = null
  let parsedOutput: Record<string, unknown> | null = null
  if (toolCall.output) {
    try {
      parsedOutput = JSON.parse(toolCall.output)
      if (parsedOutput && typeof parsedOutput === 'object' && 'screenshot' in parsedOutput) {
        screenshot = parsedOutput.screenshot as string
        console.log('Screenshot found, starts with:', screenshot?.substring(0, 50), 'length:', screenshot?.length)
      }
      // Also check for 'image' field (browserScreenshot tool)
      if (parsedOutput && typeof parsedOutput === 'object' && 'image' in parsedOutput) {
        screenshot = parsedOutput.image as string
        console.log('Image found, starts with:', screenshot?.substring(0, 50), 'length:', screenshot?.length)
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
        <div className="mt-2">
          <img
            src={screenshot}
            alt="Browser screenshot"
            className="w-full max-w-md rounded-md border"
          />
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
