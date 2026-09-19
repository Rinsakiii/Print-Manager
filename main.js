const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const db = require('./src/db');
const fileLibrary = require('./src/fileLibrary');
const slicerLauncher = require('./src/slicerLauncher');
const slicerDetect = require('./src/slicerDetect');

// Must be set before the app is ready — this is what the default macOS
// application menu (About/Hide/Quit) and app.getName() reflect. Running
// unpackaged via `electron .` still shows "Electron" in a couple of
// OS-level spots (Dock hover tooltip, Force Quit list) that only a real
// packaged build (npm run dist) can fully rebrand, since those are read
// from the actual running executable's bundle info, not this at runtime.
app.setName('Print Manager');

const iconPath = path.join(__dirname, 'assets', 'icon.png');

let mainWindow;

// Two instances sharing the same db.json is exactly how a save from one can
// stomp on the other's in-memory state. Only one instance is allowed to run;
// launching a second just focuses the first.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 920,
    minHeight: 600,
    backgroundColor: '#f5f5f5',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.env.PM_DEBUG_CONSOLE) {
    mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    });
  }
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(iconPath);
    }
    db.init(app.getPath('userData'));
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function registerIpcHandlers() {
  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('settings:update', (_e, patch) => db.updateSettings(patch));

  ipcMain.handle('filamentProfiles:list', () => db.listFilamentProfiles());
  ipcMain.handle('filamentProfiles:create', (_e, payload) => db.createFilamentProfile(payload));
  ipcMain.handle('filamentProfiles:update', (_e, { id, patch }) => db.updateFilamentProfile(id, patch));
  ipcMain.handle('filamentProfiles:delete', (_e, id) => db.deleteFilamentProfile(id));

  ipcMain.handle('people:list', () => db.listPeople());
  ipcMain.handle('people:update', (_e, { id, patch }) => db.updatePerson(id, patch));

  ipcMain.handle('orders:listAll', () => db.listAllOrders());
  ipcMain.handle('orders:get', (_e, id) => db.getOrder(id));
  ipcMain.handle('orders:createForPerson', (_e, payload) => db.createOrderForPerson(payload));
  ipcMain.handle('orders:update', (_e, { id, patch }) => db.updateOrder(id, patch));
  ipcMain.handle('orders:delete', (_e, id) => {
    const removedPlates = db.deleteOrder(id);
    removedPlates.forEach((p) => fileLibrary.deleteFile(p.storedFileName));
  });

  ipcMain.handle('plates:listByOrder', (_e, orderId) => db.listPlatesByOrder(orderId));
  ipcMain.handle('plates:pickFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose a .3mf file',
      properties: ['openFile'],
      filters: [{ name: '3MF Project', extensions: ['3mf'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  ipcMain.handle('plates:previewFile', (_e, sourcePath) => fileLibrary.previewThreeMf(sourcePath));
  ipcMain.handle('plates:create', (_e, { orderId, sourceFilePath, ...fields }) => {
    const storedFileName = fileLibrary.importFile(sourceFilePath);
    return db.createPlate(orderId, {
      ...fields,
      fileName: path.basename(sourceFilePath),
      storedFileName,
    });
  });
  ipcMain.handle('plates:update', (_e, { id, patch }) => db.updatePlate(id, patch));
  ipcMain.handle('plates:delete', (_e, id) => {
    const plate = db.deletePlate(id);
    if (plate) fileLibrary.deleteFile(plate.storedFileName);
  });
  ipcMain.handle('plates:reorder', (_e, orderedIds) => db.reorderQueue(orderedIds));
  ipcMain.handle('plates:reveal', (_e, storedFileName) => shell.showItemInFolder(fileLibrary.urlFor(storedFileName)));

  ipcMain.handle('queue:list', () => db.listQueue());
  ipcMain.handle('queue:stats', () => db.getQueueStats());

  ipcMain.handle('slicer:send', async (_e, plateId) => {
    const plate = db.getPlate(plateId);
    if (!plate) throw new Error('Plate not found');
    const settings = db.getSettings();
    const result = await slicerLauncher.open(fileLibrary.urlFor(plate.storedFileName), settings.slicerPath || null);
    if (!result.ok) {
      throw new Error(result.error || 'Failed to open your slicer');
    }
    return db.updatePlate(plateId, { status: 'Sent to Slicer', sentAt: new Date().toISOString() });
  });

  ipcMain.handle('slicers:detect', () => slicerDetect.detectInstalled());
  ipcMain.handle('slicers:browse', async () => {
    const isMac = process.platform === 'darwin';
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose your slicer application',
      properties: ['openFile'],
      filters: isMac ? [{ name: 'Applications', extensions: ['app'] }] : [{ name: 'Executable', extensions: ['exe'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
