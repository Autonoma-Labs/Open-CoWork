import { app, shell, BrowserWindow, Menu, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, closeDatabase } from './database'
import { registerIpcHandlers } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Context menu for copy/paste
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuTemplate: Electron.MenuItemConstructorOptions[] = []

    // Add spelling suggestions if available
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        menuTemplate.push({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion)
        })
      }
      if (params.dictionarySuggestions.length > 0) {
        menuTemplate.push({ type: 'separator' })
      }
    }

    // Standard edit operations
    if (params.isEditable) {
      menuTemplate.push(
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll', enabled: params.editFlags.canSelectAll }
      )
    } else if (params.selectionText) {
      // Text is selected but not in an editable field
      menuTemplate.push(
        { label: 'Copy', role: 'copy' },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll' }
      )
    } else {
      // No selection, no editable - still allow select all
      menuTemplate.push({ label: 'Select All', role: 'selectAll' })
    }

    // Only show menu if we have items
    if (menuTemplate.length > 0) {
      const menu = Menu.buildFromTemplate(menuTemplate)
      menu.popup()
    }
  })

  // Find in page handlers - need to pass text each time for proper navigation
  let lastSearchText = ''

  ipcMain.on('find:start', (_event, text: string) => {
    if (text) {
      lastSearchText = text
      mainWindow.webContents.findInPage(text)
    }
  })

  ipcMain.on('find:next', (_event, text: string) => {
    const searchText = text || lastSearchText
    if (searchText) {
      mainWindow.webContents.findInPage(searchText, { forward: true, findNext: true })
    }
  })

  ipcMain.on('find:previous', (_event, text: string) => {
    const searchText = text || lastSearchText
    if (searchText) {
      mainWindow.webContents.findInPage(searchText, { forward: false, findNext: true })
    }
  })

  ipcMain.on('find:stop', () => {
    lastSearchText = ''
    mainWindow.webContents.stopFindInPage('clearSelection')
  })

  // Send find results back to renderer
  mainWindow.webContents.on('found-in-page', (_event, result) => {
    mainWindow.webContents.send('find:result', {
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches
    })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.opencowork')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  await initDatabase()

  // Register IPC handlers
  registerIpcHandlers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
