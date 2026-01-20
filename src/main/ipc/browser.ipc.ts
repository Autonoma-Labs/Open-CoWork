import { ipcMain, app } from 'electron'
import { join } from 'path'
import { platform } from 'os'
import { existsSync } from 'fs'
import { getDatabase } from '../database'

// Types from playwright (imported dynamically)
type Browser = Awaited<ReturnType<typeof import('playwright')['chromium']['launch']>>
type BrowserContext = Awaited<ReturnType<Browser['newContext']>>
type Page = Awaited<ReturnType<BrowserContext['newPage']>>

// Browser state - kept alive across tool calls
let browser: Browser | null = null
let context: BrowserContext | null = null
let page: Page | null = null
let currentBrowserType: string | null = null

// Lazy-loaded playwright module - use require to load at runtime from node_modules
let playwrightModule: typeof import('playwright') | null = null

function getPlaywright(): typeof import('playwright') {
  if (!playwrightModule) {
    // Use dynamic require to prevent bundling - the module name is constructed at runtime
    const moduleName = 'playwright'
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    playwrightModule = require(moduleName)
  }
  return playwrightModule!
}

// Browser configurations
interface BrowserConfig {
  name: string
  id: string
  channel?: string
  getUserDataDir: () => string
}

function getBrowserConfigs(): BrowserConfig[] {
  const homeDir = app.getPath('home')
  const plat = platform()

  const configs: BrowserConfig[] = []

  // Chrome
  configs.push({
    name: 'Google Chrome',
    id: 'chrome',
    channel: 'chrome',
    getUserDataDir: () => {
      switch (plat) {
        case 'darwin':
          return join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome')
        case 'win32':
          return join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
        default:
          return join(homeDir, '.config', 'google-chrome')
      }
    }
  })

  // Arc (macOS only)
  if (plat === 'darwin') {
    configs.push({
      name: 'Arc',
      id: 'arc',
      getUserDataDir: () => join(homeDir, 'Library', 'Application Support', 'Arc', 'User Data')
    })
  }

  // Brave
  configs.push({
    name: 'Brave',
    id: 'brave',
    getUserDataDir: () => {
      switch (plat) {
        case 'darwin':
          return join(homeDir, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser')
        case 'win32':
          return join(homeDir, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data')
        default:
          return join(homeDir, '.config', 'BraveSoftware', 'Brave-Browser')
      }
    }
  })

  // Edge
  configs.push({
    name: 'Microsoft Edge',
    id: 'edge',
    channel: 'msedge',
    getUserDataDir: () => {
      switch (plat) {
        case 'darwin':
          return join(homeDir, 'Library', 'Application Support', 'Microsoft Edge')
        case 'win32':
          return join(homeDir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data')
        default:
          return join(homeDir, '.config', 'microsoft-edge')
      }
    }
  })

  // Chromium
  configs.push({
    name: 'Chromium',
    id: 'chromium',
    getUserDataDir: () => {
      switch (plat) {
        case 'darwin':
          return join(homeDir, 'Library', 'Application Support', 'Chromium')
        case 'win32':
          return join(homeDir, 'AppData', 'Local', 'Chromium', 'User Data')
        default:
          return join(homeDir, '.config', 'chromium')
      }
    }
  })

  return configs
}

// Get available browsers (ones that have user data directories)
function getAvailableBrowsers(): { id: string; name: string; hasData: boolean }[] {
  const configs = getBrowserConfigs()
  return configs.map((config) => ({
    id: config.id,
    name: config.name,
    hasData: existsSync(config.getUserDataDir())
  }))
}

// Get browser config by ID
function getBrowserConfig(id: string): BrowserConfig | undefined {
  return getBrowserConfigs().find((c) => c.id === id)
}

// Initialize browser with specified profile
async function ensureBrowser(preferredBrowserId?: string, headless: boolean = true): Promise<Page> {
  // If we have a page and it's the same browser type, reuse it
  if (page && !page.isClosed() && currentBrowserType === preferredBrowserId) {
    return page
  }

  // Close existing browser if we need a different one or page is closed
  if (browser) {
    await browser.close().catch(() => {})
    browser = null
    context = null
    page = null
    currentBrowserType = null
  }

  // Get playwright dynamically
  const { chromium } = getPlaywright()

  // Get the browser config
  const browserId = preferredBrowserId || 'chrome'
  const config = getBrowserConfig(browserId)
  const appDataDir = join(app.getPath('userData'), 'browser-data', browserId)

  // Try to launch with the specified browser
  try {
    const launchOptions: Parameters<typeof chromium.launchPersistentContext>[1] = {
      headless,
      viewport: { width: 1280, height: 800 },
      args: ['--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation']
    }

    // If using Chrome or Edge, use the channel option to use the installed browser
    if (config?.channel) {
      launchOptions.channel = config.channel
    }

    // Use app's persistent context - cookies and sessions will be saved here
    // Note: We can't directly use user's browser profile (it may be locked)
    // Users will need to log in once, then sessions persist in our app data
    context = await chromium.launchPersistentContext(appDataDir, launchOptions)
    currentBrowserType = browserId
    console.log(`[Browser] Launched ${browserId} with persistent context at ${appDataDir}`)
  } catch (error) {
    // Fallback: launch with default Chromium
    console.log('[Browser] Could not use specified browser, launching with default Chromium:', error)
    context = await chromium.launchPersistentContext(appDataDir, {
      headless,
      viewport: { width: 1280, height: 800 }
    })
    currentBrowserType = 'chromium'
  }

  // Get existing page or create new one
  const pages = context.pages()
  page = pages.length > 0 ? pages[0] : await context.newPage()

  return page
}

// Get browser settings from database
async function getBrowserSettings(): Promise<{ preferredBrowser: string | null; headless: boolean }> {
  const prisma = getDatabase()
  const settings = await prisma.settings.findUnique({
    where: { id: 'default' }
  })
  return {
    preferredBrowser: settings?.preferredBrowser || null,
    headless: settings?.browserHeadless ?? true // Default to headless
  }
}

// Take a screenshot helper
async function takeScreenshot(p: Page): Promise<string> {
  const screenshot = await p.screenshot({
    type: 'png',
    fullPage: false
  })
  return `data:image/png;base64,${screenshot.toString('base64')}`
}

export function registerBrowserHandlers(): void {
  // Get list of available browsers
  ipcMain.handle('browser:getAvailableBrowsers', async () => {
    return getAvailableBrowsers()
  })

  // Navigate to a URL
  ipcMain.handle('browser:navigate', async (_, url: string) => {
    try {
      const settings = await getBrowserSettings()
      const p = await ensureBrowser(settings.preferredBrowser || undefined, settings.headless)
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Take screenshot after navigation
      const screenshot = await takeScreenshot(p)

      return {
        success: true,
        url: p.url(),
        title: await p.title(),
        screenshot
      }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Navigation failed'
      }
    }
  })

  // Get current page info
  ipcMain.handle('browser:getPageInfo', async () => {
    try {
      if (!page || page.isClosed()) {
        return {
          error: true,
          message: 'No browser page is open. Use browser:navigate first.'
        }
      }

      return {
        url: page.url(),
        title: await page.title()
      }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Failed to get page info'
      }
    }
  })

  // Get page content (text only, cleaned up)
  ipcMain.handle('browser:getContent', async (_, selector?: string) => {
    try {
      const settings = await getBrowserSettings()
      const p = await ensureBrowser(settings.preferredBrowser || undefined, settings.headless)

      let content: string
      if (selector) {
        const element = await p.$(selector)
        if (!element) {
          return { error: true, message: `Element not found: ${selector}` }
        }
        content = await element.innerText()
      } else {
        // Get main content, avoiding nav/footer
        content = await p.evaluate(() => {
          // Try to get main content area
          const main = document.querySelector('main, article, [role="main"], .content, #content')
          if (main) {
            return (main as HTMLElement).innerText
          }
          // Fallback to body but clean it up
          const body = document.body.cloneNode(true) as HTMLElement
          // Remove scripts, styles, nav, footer, ads
          body
            .querySelectorAll(
              'script, style, nav, footer, header, aside, [role="navigation"], [role="banner"], [role="contentinfo"], .ad, .ads, .advertisement'
            )
            .forEach((el) => el.remove())
          return body.innerText.substring(0, 10000) // Limit content length
        })
      }

      // Take screenshot after getting content
      const screenshot = await takeScreenshot(p)

      return {
        content: content.trim(),
        url: p.url(),
        title: await p.title(),
        screenshot
      }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Failed to get content'
      }
    }
  })

  // Click on an element
  ipcMain.handle('browser:click', async (_, selector: string) => {
    try {
      const settings = await getBrowserSettings()
      const p = await ensureBrowser(settings.preferredBrowser || undefined, settings.headless)

      // Try to find and click the element
      const element = await p.$(selector)
      if (!element) {
        // Try by text content
        const byText = await p.$(`text="${selector}"`)
        if (byText) {
          await byText.click()
          await p.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {})
          const screenshot = await takeScreenshot(p)
          return { success: true, url: p.url(), screenshot }
        }
        return { error: true, message: `Element not found: ${selector}` }
      }

      await element.click()
      await p.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {})

      // Take screenshot after click
      const screenshot = await takeScreenshot(p)

      return {
        success: true,
        url: p.url(),
        title: await p.title(),
        screenshot
      }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Click failed'
      }
    }
  })

  // Type text into an input
  ipcMain.handle('browser:type', async (_, selector: string, text: string) => {
    try {
      const settings = await getBrowserSettings()
      const p = await ensureBrowser(settings.preferredBrowser || undefined, settings.headless)

      await p.fill(selector, text)

      // Take screenshot after typing
      const screenshot = await takeScreenshot(p)

      return { success: true, screenshot }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Type failed'
      }
    }
  })

  // Press a key (Enter, Tab, etc.)
  ipcMain.handle('browser:press', async (_, key: string) => {
    try {
      const settings = await getBrowserSettings()
      const p = await ensureBrowser(settings.preferredBrowser || undefined, settings.headless)

      await p.keyboard.press(key)
      await p.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {})

      // Take screenshot after key press
      const screenshot = await takeScreenshot(p)

      return {
        success: true,
        url: p.url(),
        screenshot
      }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Key press failed'
      }
    }
  })

  // Take a screenshot
  ipcMain.handle('browser:screenshot', async () => {
    try {
      const settings = await getBrowserSettings()
      const p = await ensureBrowser(settings.preferredBrowser || undefined, settings.headless)

      const screenshot = await takeScreenshot(p)

      return {
        success: true,
        image: screenshot,
        url: p.url(),
        title: await p.title()
      }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Screenshot failed'
      }
    }
  })

  // Get all links on the page
  ipcMain.handle('browser:getLinks', async () => {
    try {
      const settings = await getBrowserSettings()
      const p = await ensureBrowser(settings.preferredBrowser || undefined, settings.headless)

      const links = await p.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map((a) => ({
            text: (a as HTMLAnchorElement).innerText.trim().substring(0, 100),
            href: (a as HTMLAnchorElement).href
          }))
          .filter((l) => l.text && l.href.startsWith('http'))
          .slice(0, 50) // Limit to 50 links
      })

      return { links, count: links.length }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Failed to get links'
      }
    }
  })

  // Scroll the page
  ipcMain.handle('browser:scroll', async (_, direction: 'up' | 'down' | 'top' | 'bottom') => {
    try {
      const settings = await getBrowserSettings()
      const p = await ensureBrowser(settings.preferredBrowser || undefined, settings.headless)

      await p.evaluate((dir) => {
        switch (dir) {
          case 'up':
            window.scrollBy(0, -500)
            break
          case 'down':
            window.scrollBy(0, 500)
            break
          case 'top':
            window.scrollTo(0, 0)
            break
          case 'bottom':
            window.scrollTo(0, document.body.scrollHeight)
            break
        }
      }, direction)

      // Take screenshot after scrolling
      const screenshot = await takeScreenshot(p)

      return { success: true, screenshot }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Scroll failed'
      }
    }
  })

  // Close the browser
  ipcMain.handle('browser:close', async () => {
    try {
      if (browser) {
        await browser.close()
        browser = null
        context = null
        page = null
        currentBrowserType = null
      }
      return { success: true }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Close failed'
      }
    }
  })

  // Wait for an element to appear
  ipcMain.handle('browser:waitFor', async (_, selector: string, timeout?: number) => {
    try {
      const settings = await getBrowserSettings()
      const p = await ensureBrowser(settings.preferredBrowser || undefined, settings.headless)

      await p.waitForSelector(selector, { timeout: timeout || 10000 })

      // Take screenshot after wait completes
      const screenshot = await takeScreenshot(p)

      return { success: true, screenshot }
    } catch (error) {
      return {
        error: true,
        message:
          error instanceof Error ? error.message : `Element not found within timeout: ${selector}`
      }
    }
  })

  // Open browser for user login - ALWAYS headful so user can interact
  ipcMain.handle('browser:openForLogin', async (_, url: string) => {
    try {
      const settings = await getBrowserSettings()
      // Always use headless: false for login so user can see and interact with the browser
      const p = await ensureBrowser(settings.preferredBrowser || undefined, false)
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      return {
        success: true,
        url: p.url(),
        title: await p.title(),
        message: 'Browser opened for login. The user can now log in manually.'
      }
    } catch (error) {
      return {
        error: true,
        message: error instanceof Error ? error.message : 'Failed to open browser for login'
      }
    }
  })
}

// Cleanup on app quit
export function cleanupBrowser(): void {
  if (browser) {
    browser.close().catch(() => {})
  }
}
