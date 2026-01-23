import { useCallback, useEffect, useRef, useState, memo } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface FindBarProps {
  isOpen: boolean
  onClose: () => void
}

export const FindBar = memo(function FindBar({ isOpen, onClose }: FindBarProps) {
  const [searchText, setSearchText] = useState('')
  const [result, setResult] = useState<{ activeMatchOrdinal: number; matches: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure the component is rendered
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [isOpen])

  // Subscribe to find results from main process
  useEffect(() => {
    if (!isOpen) return

    const unsubscribe = window.api.onFindResult((res) => {
      setResult(res)
    })

    return () => {
      unsubscribe()
      window.api.findStop()
      setResult(null)
    }
  }, [isOpen])

  const handleSearch = useCallback((text: string) => {
    setSearchText(text)
    if (text.length > 0) {
      window.api.findStart(text)
      // Electron's findInPage moves focus to the highlighted match in the webContents.
      // We need to restore focus to the input so the user can continue typing.
      setTimeout(() => inputRef.current?.focus(), 10)
    } else {
      window.api.findStop()
      setResult(null)
    }
  }, [])

  const handleNext = useCallback(() => {
    if (searchText) {
      window.api.findNext(searchText)
      // Restore focus after findInPage moves it to the match
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [searchText])

  const handlePrevious = useCallback(() => {
    if (searchText) {
      window.api.findPrevious(searchText)
      // Restore focus after findInPage moves it to the match
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [searchText])

  const handleClose = useCallback(() => {
    window.api.findStop()
    setSearchText('')
    setResult(null)
    onClose()
  }, [onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          handlePrevious()
        } else {
          handleNext()
        }
      }
    },
    [handleClose, handleNext, handlePrevious]
  )

  if (!isOpen) return null

  return (
    <div className="absolute right-4 top-2 z-50 flex items-center gap-2 rounded-lg border bg-background p-2 shadow-lg">
      <input
        ref={inputRef}
        type="text"
        value={searchText}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in page..."
        className="w-48 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />

      {searchText && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {result && result.matches > 0
            ? `${result.activeMatchOrdinal} / ${result.matches}`
            : result ? 'No results' : '...'}
        </span>
      )}

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={!searchText || !result?.matches}
          className={cn(
            'rounded p-1 hover:bg-muted',
            (!searchText || !result?.matches) && 'cursor-not-allowed opacity-50'
          )}
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!searchText || !result?.matches}
          className={cn(
            'rounded p-1 hover:bg-muted',
            (!searchText || !result?.matches) && 'cursor-not-allowed opacity-50'
          )}
          title="Next match (Enter)"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleClose}
        className="rounded p-1 hover:bg-muted"
        title="Close (Escape)"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
})
