import { useState, useEffect } from 'react'
import { Search, Download, Check, ExternalLink, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { useSkills } from '../../hooks/useSkills'

interface SkillsMarketplaceProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface RegistrySkill {
  id: string
  name: string
  description: string
}

// Search skillregistry.io API via main process (bypasses CORS)
async function searchSkillRegistry(query: string): Promise<RegistrySkill[]> {
  try {
    return await window.api.skillRegistrySearch(query)
  } catch (error) {
    console.error('[SkillRegistry] Search error:', error)
    return []
  }
}

// Fetch skill content via main process (bypasses CORS)
async function fetchSkillContent(skillId: string): Promise<string> {
  const content = await window.api.skillRegistryGetContent(skillId)
  if (!content) {
    throw new Error('Failed to fetch skill content')
  }
  return content
}

export function SkillsMarketplace({ open, onOpenChange }: SkillsMarketplaceProps) {
  const { skills: installedSkills, createSkill, isCreating } = useSkills()
  const [searchQuery, setSearchQuery] = useState('')
  const [registrySkills, setRegistrySkills] = useState<RegistrySkill[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  // Search skills when query changes (debounced)
  useEffect(() => {
    if (!open) return

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    // Set loading state
    setIsLoading(true)

    // Debounce search
    const timeout = setTimeout(async () => {
      const results = await searchSkillRegistry(searchQuery || '')
      setRegistrySkills(results)
      setIsLoading(false)
    }, 300)

    setSearchTimeout(timeout)

    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [open, searchQuery])

  // Clear search timeout ref warning
  useEffect(() => {
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout)
    }
  }, [searchTimeout])

  const isInstalled = (skillName: string) =>
    installedSkills.some((s) => s.name === skillName)

  const handleInstall = async (skill: RegistrySkill) => {
    setInstallingId(skill.id)
    try {
      // Fetch skill content from skillregistry.io/skills/{id}
      const skillContent = await fetchSkillContent(skill.id)

      await createSkill({
        name: skill.name,
        description: skill.description,
        content: skillContent,
        sourceUrl: `https://skillregistry.io/skills/${skill.id}`
      })
    } catch (error) {
      console.error('[SkillRegistry] Install error:', error)
    } finally {
      setInstallingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Skills Marketplace</DialogTitle>
          <DialogDescription>
            Browse and install skills to enhance your AI assistant
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Skills List */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : registrySkills.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No skills found matching your search
            </div>
          ) : (
            <div className="space-y-3">
              {registrySkills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{skill.name}</h3>
                        {isInstalled(skill.name) && (
                          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Check className="h-3 w-3" />
                            Installed
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{skill.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8"
                      >
                        <a href={`https://skillregistry.io/skills/${skill.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      {isInstalled(skill.name) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="h-9 rounded-full border border-input bg-muted px-4 text-sm text-muted-foreground"
                        >
                          Installed
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInstall(skill)}
                          disabled={installingId === skill.id || isCreating}
                          className="h-9 rounded-full border border-input bg-foreground px-4 text-sm text-background hover:bg-foreground/90"
                        >
                          {installingId === skill.id ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-1 h-4 w-4" />
                          )}
                          Install
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          Skills provided by{' '}
          <a
            href="https://skillregistry.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            skillregistry.io
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
