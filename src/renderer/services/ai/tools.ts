import { z } from 'zod'
import { tool } from 'ai'
import { useTodoStore, type Todo, type TodoStatus } from '../../stores/todoStore'
import { useBrowserStore } from '../../stores/browserStore'
import { useQuestionStore } from '../../stores/questionStore'

// Helper to check if browser is configured
async function checkBrowserConfigured(): Promise<{ configured: boolean; needsSetup?: boolean }> {
  const settings = await window.api.getSettings()
  if (!settings?.preferredBrowser) {
    // Show the browser selection dialog
    useBrowserStore.getState().setShowSelectionDialog(true)
    return {
      configured: false,
      needsSetup: true
    }
  }
  return { configured: true }
}

// Define tools for the AI agent
// Each tool handles its own execution and error handling
// Errors are returned as results so the agent can see them and try to fix issues

export const tools = {
  listDirectory: tool({
    description: 'List the contents of a directory. Returns file names, sizes, and whether each item is a folder.',
    parameters: z.object({
      path: z.string().describe('The absolute path to the directory to list (e.g., "/Users/john/Desktop")')
    }),
    execute: async ({ path }) => {
      try {
        const results = await window.api.readDirectory(path)
        return results.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.isDirectory ? 'folder' : 'file',
          size: item.size ? formatFileSize(item.size) : undefined
        }))
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to list directory',
          suggestion: 'Check if the path exists and you have permission to access it'
        }
      }
    }
  }),

  glob: tool({
    description: 'Find files matching a glob pattern. Use patterns like "*.txt" for text files, "**/*.js" for all JavaScript files recursively, or "report*.pdf" for PDFs starting with "report".',
    parameters: z.object({
      pattern: z.string().describe('The glob pattern to match (e.g., "*.pdf", "**/*.ts", "config*")'),
      path: z.string().optional().describe('The directory to search in. If not provided, searches from the current location.')
    }),
    execute: async ({ pattern, path }) => {
      try {
        const results = await window.api.glob(pattern, path)
        if (results.length === 0) {
          return {
            files: [],
            message: `No files found matching pattern "${pattern}"${path ? ` in ${path}` : ''}`
          }
        }
        return results.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.isDirectory ? 'folder' : 'file',
          size: item.size ? formatFileSize(item.size) : undefined
        }))
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to search for files',
          suggestion: 'Check if the search path exists and the pattern is valid'
        }
      }
    }
  }),

  grep: tool({
    description: 'Search inside files for text matching a pattern. Returns the files and lines where matches are found.',
    parameters: z.object({
      pattern: z.string().describe('The text or pattern to search for'),
      path: z.string().describe('The file or directory to search in'),
      maxResults: z.number().optional().describe('Maximum number of results to return (default: 50)')
    }),
    execute: async ({ pattern, path, maxResults }) => {
      try {
        const results = await window.api.grep(pattern, path, { maxResults: maxResults || 50 })
        if (results.length === 0) {
          return {
            matches: [],
            message: `No matches found for "${pattern}" in ${path}`
          }
        }
        return {
          matches: results,
          count: results.length,
          message: `Found ${results.length} matches for "${pattern}"`
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to search file contents',
          suggestion: 'Check if the path exists and is readable'
        }
      }
    }
  }),

  readFile: tool({
    description: 'Read the full contents of a text file. Use this after you have found the file you need.',
    parameters: z.object({
      path: z.string().describe('The absolute path to the file to read')
    }),
    execute: async ({ path }) => {
      try {
        const content = await window.api.readFile(path)
        return {
          path,
          content,
          length: content.length
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to read file',
          suggestion: 'Check if the file exists and you have permission to read it'
        }
      }
    }
  }),

  viewImage: tool({
    description: 'View an image file. Use this to see the contents of images (PNG, JPG, GIF, etc.) so you can describe or analyze them. Returns the image as a data URL that you can see. If this tool fails, tell the user the specific error and suggest they restart the app if it mentions "No handler registered".',
    parameters: z.object({
      path: z.string().describe('The absolute path to the image file to view')
    }),
    execute: async ({ path }) => {
      try {
        const result = await window.api.readFileBase64(path)
        return {
          path,
          mimeType: result.mimeType,
          // Return as a special format that indicates this is an image
          type: 'image',
          image: result.dataUrl,
          message: `Image loaded successfully. The image is now visible to you.`
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to read image'
        const isHandlerMissing = errorMessage.includes('No handler registered')

        return {
          error: true,
          message: errorMessage,
          suggestion: isHandlerMissing
            ? 'IMPORTANT: Tell the user this error: "The image viewing feature requires a full app restart. Please close and reopen the app, then try again." Do NOT retry this tool - it will fail until the app is restarted.'
            : 'Check if the file exists, is a valid image format (PNG, JPG, GIF, WEBP), and you have permission to read it. You may retry once if the path was incorrect.',
          requiresRestart: isHandlerMissing,
          retryable: !isHandlerMissing
        }
      }
    }
  }),

  todoWrite: tool({
    description: 'Update the TODO panel to show progress on multi-step tasks. Use this to help the user see what you are working on.',
    parameters: z.object({
      todos: z.array(
        z.object({
          id: z.string().optional().describe('ID of existing todo to update'),
          content: z.string().describe('Short description of the task'),
          status: z.enum(['pending', 'in_progress', 'completed']).describe('Current status: pending (not started), in_progress (working on it), or completed (done)')
        })
      )
    }),
    execute: async ({ todos }) => {
      try {
        const mappedTodos: Todo[] = todos.map((t, i) => ({
          id: t.id || `todo-${Date.now()}-${i}`,
          content: t.content,
          status: t.status as TodoStatus
        }))

        // Access zustand store directly (works outside React)
        useTodoStore.getState().setTodos(mappedTodos)

        return {
          success: true,
          message: `Updated ${todos.length} todo(s)`,
          todos: mappedTodos.map(t => ({ id: t.id, content: t.content, status: t.status }))
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to update todos'
        }
      }
    }
  }),

  askQuestion: tool({
    description: `Ask the user one or more questions when you need clarification or input. Each question has multiple choice options. The user can also provide a custom answer. Use this when you need to:
- Clarify requirements or preferences
- Choose between multiple approaches
- Get confirmation before proceeding with a significant action
- Gather missing information

IMPORTANT: After calling this tool, you MUST STOP and wait for the user's response. Do not continue with other tasks until you receive the answers.`,
    parameters: z.object({
      questions: z.array(
        z.object({
          id: z.string().describe('Unique identifier for this question'),
          question: z.string().describe('The question to ask the user'),
          options: z.array(
            z.object({
              id: z.string().describe('Unique identifier for this option'),
              label: z.string().describe('The option text to display')
            })
          ).min(2).max(5).describe('2-5 multiple choice options'),
          allowCustom: z.boolean().default(true).describe('Whether to show a "Write your own answer" option')
        })
      ).min(1).max(5).describe('1-5 questions to ask the user')
    }),
    execute: async ({ questions }) => {
      try {
        // Store questions in the question store
        const questionSetId = useQuestionStore.getState().setQuestions(questions)

        return {
          success: true,
          message: 'Questions displayed to user. Waiting for their response...',
          questionSetId,
          questionCount: questions.length,
          waitingForResponse: true
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to display questions'
        }
      }
    }
  }),

  bash: tool({
    description: `Execute a shell command. Use this for running scripts, installing packages, checking versions, etc.

IMPORTANT SAFETY NOTES:
- This runs without a sandbox, so be VERY careful
- NEVER use destructive commands like rm -rf, rm -r, or rm with force flags
- NEVER delete files or directories
- NEVER modify system files
- NEVER run sudo commands
- Prefer read-only operations when possible
- Always double-check the command before running

Examples of SAFE commands:
- ls, pwd, cat, head, tail
- npm install, npm run build, npm test
- git status, git log, git diff
- python script.py, node script.js

Examples of BLOCKED commands (will be rejected):
- rm -rf, rm -r, rm --force
- sudo anything
- chmod 777, chown
- dd, mkfs`,
    parameters: z.object({
      command: z.string().describe('The shell command to execute'),
      cwd: z.string().optional().describe('The working directory to run the command in (optional)'),
      timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000, max: 120000)')
    }),
    execute: async ({ command, cwd, timeout }) => {
      try {
        const result = await window.api.bash(command, {
          cwd,
          timeout: Math.min(timeout || 30000, 120000)
        })

        // Format the result for the agent
        if (result.exitCode !== 0) {
          return {
            success: false,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            message: `Command failed with exit code ${result.exitCode}`,
            suggestion: result.stderr ? `Error output: ${result.stderr}` : 'Check the command syntax and try again'
          }
        }

        return {
          success: true,
          exitCode: 0,
          stdout: result.stdout,
          stderr: result.stderr || undefined
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to execute command',
          suggestion: 'This command may be blocked for safety reasons, or the path may be invalid'
        }
      }
    }
  }),

  // Browser tools - use the user's browser with their existing logins
  browserNavigate: tool({
    description: 'Navigate to a URL in the browser. Opens a real browser window with the user\'s logins and cookies. Use this to visit websites, access user accounts, and browse the web.',
    parameters: z.object({
      url: z.string().describe('The URL to navigate to (e.g., "https://twitter.com", "https://github.com")')
    }),
    execute: async ({ url }) => {
      try {
        // Check if browser is configured
        const check = await checkBrowserConfigured()
        if (!check.configured) {
          return {
            error: true,
            message: 'Browser not configured. A dialog has been shown to the user to select their preferred browser.',
            suggestion: 'Wait for the user to select a browser, then try again.',
            needsBrowserSetup: true
          }
        }

        const result = await window.api.browserNavigate(url)
        if (result.error) {
          return {
            error: true,
            message: result.message || 'Navigation failed',
            suggestion: 'Check if the URL is valid and try again'
          }
        }
        return {
          success: true,
          url: result.url,
          title: result.title,
          message: `Navigated to ${result.title || result.url}`,
          screenshot: result.screenshot
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to navigate',
          suggestion: 'The browser may not be available. Try again.'
        }
      }
    }
  }),

  browserGetContent: tool({
    description: 'Get the text content of the current page or a specific element. Use this to read what\'s on a webpage after navigating to it.',
    parameters: z.object({
      selector: z.string().optional().describe('CSS selector to get content from a specific element (optional). If not provided, gets the main content of the page.')
    }),
    execute: async ({ selector }) => {
      try {
        const result = await window.api.browserGetContent(selector)
        if (result.error) {
          return {
            error: true,
            message: result.message || 'Failed to get content',
            suggestion: selector ? 'The selector may not exist on this page. Try a different one.' : 'Navigate to a page first.'
          }
        }
        return {
          success: true,
          url: result.url,
          title: result.title,
          content: result.content,
          screenshot: result.screenshot
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to get page content',
          suggestion: 'Make sure you have navigated to a page first'
        }
      }
    }
  }),

  browserClick: tool({
    description: 'Click on an element on the page. Use a CSS selector or the text content of the element to click.',
    parameters: z.object({
      selector: z.string().describe('CSS selector or text content to click (e.g., "button.submit", "Sign In", "#login-button")')
    }),
    execute: async ({ selector }) => {
      try {
        const result = await window.api.browserClick(selector)
        if (result.error) {
          return {
            error: true,
            message: result.message || 'Click failed',
            suggestion: 'The element may not exist or may not be clickable. Try a different selector.'
          }
        }
        return {
          success: true,
          url: result.url,
          title: result.title,
          message: `Clicked on "${selector}"`,
          screenshot: result.screenshot
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to click',
          suggestion: 'Check if the element exists and is visible'
        }
      }
    }
  }),

  browserType: tool({
    description: 'Type text into an input field on the page. Use this to fill in forms, search boxes, etc.',
    parameters: z.object({
      selector: z.string().describe('CSS selector for the input field (e.g., "input[name=search]", "#email", ".search-box")'),
      text: z.string().describe('The text to type into the field')
    }),
    execute: async ({ selector, text }) => {
      try {
        const result = await window.api.browserType(selector, text)
        if (result.error) {
          return {
            error: true,
            message: result.message || 'Type failed',
            suggestion: 'The input field may not exist. Try a different selector.'
          }
        }
        return {
          success: true,
          message: `Typed "${text}" into ${selector}`,
          screenshot: result.screenshot
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to type',
          suggestion: 'Check if the input field exists and is editable'
        }
      }
    }
  }),

  browserPress: tool({
    description: 'Press a key on the keyboard. Use this for Enter, Tab, Escape, arrow keys, etc.',
    parameters: z.object({
      key: z.string().describe('The key to press (e.g., "Enter", "Tab", "Escape", "ArrowDown")')
    }),
    execute: async ({ key }) => {
      try {
        const result = await window.api.browserPress(key)
        if (result.error) {
          return {
            error: true,
            message: result.message || 'Key press failed'
          }
        }
        return {
          success: true,
          url: result.url,
          message: `Pressed ${key}`,
          screenshot: result.screenshot
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to press key'
        }
      }
    }
  }),

  browserGetLinks: tool({
    description: 'Get all links on the current page. Useful for finding URLs to navigate to.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const result = await window.api.browserGetLinks()
        if (result.error) {
          return {
            error: true,
            message: result.message || 'Failed to get links',
            suggestion: 'Navigate to a page first'
          }
        }
        return {
          success: true,
          count: result.count,
          links: result.links
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to get links'
        }
      }
    }
  }),

  browserScroll: tool({
    description: 'Scroll the page up, down, or to the top/bottom.',
    parameters: z.object({
      direction: z.enum(['up', 'down', 'top', 'bottom']).describe('Direction to scroll: "up" (scroll up), "down" (scroll down), "top" (scroll to top), "bottom" (scroll to bottom)')
    }),
    execute: async ({ direction }) => {
      try {
        const result = await window.api.browserScroll(direction)
        if (result.error) {
          return {
            error: true,
            message: result.message || 'Scroll failed'
          }
        }
        return {
          success: true,
          message: `Scrolled ${direction}`,
          screenshot: result.screenshot
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to scroll'
        }
      }
    }
  }),

  browserScreenshot: tool({
    description: 'Take a screenshot of the current page. Returns a base64-encoded image.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const result = await window.api.browserScreenshot()
        if (result.error) {
          return {
            error: true,
            message: result.message || 'Screenshot failed',
            suggestion: 'Navigate to a page first'
          }
        }
        return {
          success: true,
          url: result.url,
          title: result.title,
          image: result.image,
          message: 'Screenshot captured'
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to take screenshot'
        }
      }
    }
  }),

  browserClose: tool({
    description: 'Close the browser window. Use this when done with web browsing.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const result = await window.api.browserClose()
        if (result.error) {
          return {
            error: true,
            message: result.message || 'Close failed'
          }
        }
        return {
          success: true,
          message: 'Browser closed'
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to close browser'
        }
      }
    }
  }),

  requestLogin: tool({
    description: `Ask the user to log in to a website. This opens a VISIBLE browser window where the user can manually enter their credentials and complete the login process.

Use this when:
- You need to access a website that requires authentication
- The user asks you to do something on a site they're not logged into
- You encounter a login page while browsing

After calling this tool, WAIT for the user to confirm they've logged in before proceeding. The browser will stay open so the user can see and interact with it.`,
    parameters: z.object({
      url: z.string().describe('The URL of the login page (e.g., "https://twitter.com/login", "https://github.com/login")'),
      siteName: z.string().describe('The name of the website for display purposes (e.g., "Twitter", "GitHub")')
    }),
    execute: async ({ url, siteName }) => {
      try {
        // Check if browser is configured
        const check = await checkBrowserConfigured()
        if (!check.configured) {
          return {
            error: true,
            message: 'Browser not configured. A dialog has been shown to the user to select their preferred browser.',
            suggestion: 'Wait for the user to select a browser, then try again.',
            needsBrowserSetup: true
          }
        }

        const result = await window.api.browserOpenForLogin(url)
        if (result.error) {
          return {
            error: true,
            message: result.message || 'Failed to open browser for login',
            suggestion: 'Try again or ask the user to manually log in.'
          }
        }

        return {
          success: true,
          url: result.url,
          title: result.title,
          message: `I've opened ${siteName} in a browser window. Please log in to your account there. Let me know when you're done logging in, and I'll continue with your request.`,
          waitingForUser: true,
          note: 'IMPORTANT: Wait for the user to confirm they have logged in before taking any further browser actions.'
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to open login page',
          suggestion: 'Try again or ask the user to manually log in first.'
        }
      }
    }
  }),

  // Skills tools - search and install skills from skillregistry.io
  searchSkills: tool({
    description: `Search for skills on skillregistry.io. Skills are pre-built automation capabilities that can help you perform tasks you couldn't do otherwise.

IMPORTANT: Before using the browser to accomplish a task, ALWAYS search for relevant skills first. Skills are faster, more reliable, and often already authenticated.

Examples of when to search:
- User asks to send a WhatsApp message → search "whatsapp"
- User wants to post on Twitter → search "twitter"
- User needs to check Gmail → search "gmail"
- User wants to create a Notion page → search "notion"

If a relevant skill is found, install it and use its instructions instead of opening the browser.`,
    parameters: z.object({
      query: z.string().describe('Search query to find relevant skills (e.g., "whatsapp", "twitter", "gmail")')
    }),
    execute: async ({ query }) => {
      try {
        // Use IPC to fetch from main process (bypasses CORS)
        const skills = await window.api.skillRegistrySearch(query)

        if (skills.length === 0) {
          return {
            success: true,
            skills: [],
            message: `No skills found for "${query}". You may need to use the browser instead.`
          }
        }

        return {
          success: true,
          skills: skills.map((s: { id: string; name: string; description: string }) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            url: `https://skillregistry.io/skills/${s.id}`
          })),
          count: skills.length,
          message: `Found ${skills.length} skill(s) for "${query}". Install a relevant skill to use it.`
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to search skills',
          suggestion: 'Network error. You can try the browser instead.'
        }
      }
    }
  }),

  installSkill: tool({
    description: `Install a skill from skillregistry.io. After installation, the skill's instructions will be available in your system prompt for use.

Use this after searching for skills and finding one that matches what the user needs.`,
    parameters: z.object({
      skillId: z.string().describe('The skill ID from the search results (e.g., "slack", "imsg", "discord")'),
      name: z.string().describe('The display name of the skill'),
      description: z.string().describe('A brief description of what the skill does')
    }),
    execute: async ({ skillId, name, description }) => {
      try {
        // Check if skill is already installed
        const existingSkills = await window.api.getSkills()
        const alreadyInstalled = existingSkills.some((s: { name: string }) => s.name === name)

        if (alreadyInstalled) {
          return {
            success: true,
            alreadyInstalled: true,
            message: `Skill "${name}" is already installed. You can use it now.`
          }
        }

        // Fetch skill content via IPC (bypasses CORS)
        const content = await window.api.skillRegistryGetContent(skillId)
        if (!content) {
          return {
            error: true,
            message: `Failed to fetch skill content for ${skillId}`,
            suggestion: 'The skill may have been removed. Try searching again.'
          }
        }

        // Install the skill
        await window.api.createSkill({
          name,
          description,
          content,
          sourceUrl: `https://skillregistry.io/skills/${skillId}`
        })

        return {
          success: true,
          installed: true,
          name,
          message: `Successfully installed skill "${name}". The skill instructions are now available. You can use them to help the user.`,
          skillContent: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
          note: 'The full skill content is now part of your context. Follow the instructions in the skill to help the user.'
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to install skill',
          suggestion: 'Try searching for the skill again or use the browser instead.'
        }
      }
    }
  }),

  listInstalledSkills: tool({
    description: `List all installed skills with their names and descriptions. Use this to see what skills are available before trying to use them or to check if a skill is already installed.`,
    parameters: z.object({}),
    execute: async () => {
      try {
        const skills = await window.api.getSkills()

        if (skills.length === 0) {
          return {
            success: true,
            skills: [],
            count: 0,
            message: 'No skills are currently installed. Use searchSkills to find and install skills from skillregistry.io.'
          }
        }

        return {
          success: true,
          skills: skills.map((s: { id: string; name: string; description?: string | null; enabled: boolean }) => ({
            id: s.id,
            name: s.name,
            description: s.description || 'No description',
            enabled: s.enabled
          })),
          count: skills.length,
          message: `Found ${skills.length} installed skill(s). Use viewSkill to see the full content of a specific skill.`
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to list skills'
        }
      }
    }
  }),

  viewSkill: tool({
    description: `View the full content of an installed skill. Use this when you need to see the complete instructions for a skill to use it properly.`,
    parameters: z.object({
      skillName: z.string().describe('The name of the skill to view')
    }),
    execute: async ({ skillName }) => {
      try {
        const skills = await window.api.getSkills()
        const skill = skills.find((s: { name: string }) =>
          s.name.toLowerCase() === skillName.toLowerCase()
        )

        if (!skill) {
          return {
            error: true,
            message: `Skill "${skillName}" not found.`,
            suggestion: 'Use listInstalledSkills to see available skills, or searchSkills to find and install new ones.'
          }
        }

        return {
          success: true,
          name: skill.name,
          description: skill.description,
          content: skill.content,
          enabled: skill.enabled,
          sourceUrl: skill.sourceUrl,
          message: `Here is the full content of the "${skill.name}" skill. Follow these instructions to help the user.`
        }
      } catch (error) {
        return {
          error: true,
          message: error instanceof Error ? error.message : 'Failed to view skill'
        }
      }
    }
  })
}

// Helper to format file sizes in human-readable form
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
