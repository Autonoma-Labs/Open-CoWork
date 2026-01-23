import { Plus, Loader2, Circle, Trash2, Pin, PinOff, Pencil, ChevronDown, ChevronRight, Check, X, Download } from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog'
import { useUIStore } from '../../stores/uiStore'
import { useConversations } from '../../hooks/useConversations'
import { cn } from '../../lib/utils'

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const {
    processingConversations,
    unreadConversations,
    activeConversationId,
    setActiveConversation,
    pinnedSectionCollapsed,
    togglePinnedSection
  } = useUIStore()
  const { conversations, createConversation, updateConversation, deleteConversation, isCreating } = useConversations()
  const [conversationToDelete, setConversationToDelete] = useState<{
    id: string
    title: string
  } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleNewChat = async () => {
    const conversation = await createConversation('New Chat')
    setActiveConversation(conversation.id)
  }

  const handleDeleteConfirm = () => {
    if (conversationToDelete) {
      deleteConversation(conversationToDelete.id)
      if (activeConversationId === conversationToDelete.id) {
        setActiveConversation(null)
      }
      setConversationToDelete(null)
    }
  }

  const handleStartRename = (conv: { id: string; title: string }) => {
    setEditingId(conv.id)
    setEditingTitle(conv.title)
  }

  const handleSaveRename = () => {
    if (editingId && editingTitle.trim()) {
      updateConversation({ id: editingId, data: { title: editingTitle.trim() } })
    }
    setEditingId(null)
    setEditingTitle('')
  }

  const handleCancelRename = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  const handleTogglePin = (conv: { id: string; pinned: boolean }) => {
    updateConversation({ id: conv.id, data: { pinned: !conv.pinned } })
  }

  const handleDownload = async (convId: string) => {
    await window.api.exportChatAsMarkdown(convId)
  }

  // Separate pinned and unpinned conversations
  const pinnedConvs = useMemo(() => {
    return conversations.filter((c) => c.pinned)
  }, [conversations])

  // Get active conversations (processing or unread) - excluding pinned
  const activeConvs = useMemo(() => {
    const activeIds = new Set([...processingConversations, ...unreadConversations])
    return conversations.filter((c) => activeIds.has(c.id) && !c.pinned)
  }, [conversations, processingConversations, unreadConversations])

  // Group remaining conversations by date (exclude active ones and pinned)
  const groupedConversations = useMemo(() => {
    const activeIds = new Set([...processingConversations, ...unreadConversations])
    const nonActiveConvs = conversations.filter((c) => !activeIds.has(c.id) && !c.pinned)

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    const groups: { label: string; items: typeof conversations }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Last 7 Days', items: [] },
      { label: 'Older', items: [] }
    ]

    nonActiveConvs.forEach((conv) => {
      const date = new Date(conv.updatedAt)
      if (date >= today) {
        groups[0].items.push(conv)
      } else if (date >= yesterday) {
        groups[1].items.push(conv)
      } else if (date >= lastWeek) {
        groups[2].items.push(conv)
      } else {
        groups[3].items.push(conv)
      }
    })

    return groups.filter((g) => g.items.length > 0)
  }, [conversations, processingConversations, unreadConversations])

  const renderConversationItem = (conv: typeof conversations[number], showStatusIndicators = false) => {
    const isProcessing = processingConversations.includes(conv.id)
    const isUnread = unreadConversations.includes(conv.id)
    const isEditing = editingId === conv.id

    if (isEditing) {
      return (
        <div
          key={conv.id}
          className="flex w-full items-center gap-1 rounded-md px-2 py-1.5"
        >
          <Input
            ref={editInputRef}
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename()
              if (e.key === 'Escape') handleCancelRename()
            }}
            className="h-6 flex-1 text-sm"
          />
          <button
            onClick={handleSaveRename}
            className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancelRename}
            className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )
    }

    return (
      <div
        key={conv.id}
        className={cn(
          'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          activeConversationId === conv.id
            ? 'bg-accent/50 text-foreground'
            : 'text-muted-foreground/70 hover:text-foreground'
        )}
      >
        <button
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setActiveConversation(conv.id)}
          onDoubleClick={() => handleStartRename(conv)}
        >
          {showStatusIndicators && isProcessing ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          ) : showStatusIndicators && isUnread ? (
            <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" />
          ) : null}
          <span className="truncate" title={conv.title}>{conv.title}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="p-0.5"
            onClick={(e) => {
              e.stopPropagation()
              handleStartRename(conv)
            }}
            title="Rename"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
          <button
            className="p-0.5"
            onClick={(e) => {
              e.stopPropagation()
              handleTogglePin(conv)
            }}
            title={conv.pinned ? 'Unpin' : 'Pin'}
          >
            {conv.pinned ? (
              <PinOff className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            ) : (
              <Pin className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            )}
          </button>
          <button
            className="p-0.5"
            onClick={(e) => {
              e.stopPropagation()
              handleDownload(conv.id)
            }}
            title="Download as Markdown"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
          <button
            className="p-0.5"
            onClick={(e) => {
              e.stopPropagation()
              setConversationToDelete({ id: conv.id, title: conv.title })
            }}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <aside className={cn('flex flex-col bg-muted/30', className)}>
      <div className="p-2">
        <Button
          className="w-full justify-start gap-2"
          variant="outline"
          onClick={handleNewChat}
          disabled={isCreating}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Pinned Conversations */}
        {pinnedConvs.length > 0 && (
          <div className="px-2 py-1">
            <button
              className="mb-1 flex w-full items-center gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={togglePinnedSection}
            >
              {pinnedSectionCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              <Pin className="h-3 w-3" />
              Pinned
            </button>
            {!pinnedSectionCollapsed && (
              <div className="space-y-0.5">
                {pinnedConvs.map((conv) => renderConversationItem(conv))}
              </div>
            )}
          </div>
        )}

        {/* Active Conversations (processing or unread) */}
        {activeConvs.length > 0 && (
          <div className="px-2 py-1">
            <h3 className="mb-1 px-2 text-xs font-medium text-muted-foreground">Active</h3>
            <div className="space-y-0.5">
              {activeConvs.map((conv) => renderConversationItem(conv, true))}
            </div>
          </div>
        )}

        {/* Conversation History */}
        {groupedConversations.map((group) => (
          <div key={group.label} className="px-2 py-1">
            <h3 className="mb-1 px-2 text-xs font-medium text-muted-foreground">{group.label}</h3>
            <div className="space-y-0.5">
              {group.items.map((conv) => renderConversationItem(conv))}
            </div>
          </div>
        ))}
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={conversationToDelete !== null}
        onOpenChange={(open) => !open && setConversationToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{conversationToDelete?.title}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConversationToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
