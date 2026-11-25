const { app, BrowserWindow, ipcMain, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PREFERRED_PORT = 47821;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

let mainWindow = null;
let localServer = null;
let activePort = PREFERRED_PORT;
let pendingOAuthResolve = null;

function getDistDir() {
  return path.join(__dirname, '..', 'dist');
}

function getIconPath() {
  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
  if (fs.existsSync(icoPath)) return icoPath;
  return path.join(__dirname, '..', 'public', 'icon-192.png');
}

function buildOAuthSuccessHtml(hasError) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Coldi's Corner · Google Drive</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #FAF7FD;
      color: #2E1F3E;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
    }
    .card {
      background: #fff;
      border: 1px solid #E3D4F7;
      border-radius: 24px;
      padding: 32px;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 12px 32px rgba(139, 92, 246, 0.12);
    }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { font-size: 14px; color: #6E5B85; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${hasError ? 'No se completó el inicio de sesión' : '¡Listo! Google Drive conectado 💜'}</h1>
    <p>${
      hasError
        ? 'Puedes cerrar esta pestaña e intentarlo de nuevo desde Ajustes en Coldi’s Corner.'
        : 'Ya puedes cerrar esta pestaña y volver a Coldi’s Corner. Tu estudio se sincronizará automáticamente.'
    }</p>
  </div>
  <script>setTimeout(() => window.close(), 2200);</script>
</body>
</html>`;
}

function startLocalServer() {
  return new Promise((resolve, reject) => {
    const distDir = getDistDir();

    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${activePort}`);

      // Handle Google OAuth loopback callback
      if (reqUrl.pathname === '/oauth-callback') {
        const code = reqUrl.searchParams.get('code') || undefined;
        const error = reqUrl.searchParams.get('error') || undefined;
        const state = reqUrl.searchParams.get('state') || undefined;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildOAuthSuccessHtml(Boolean(error || !code)));

        if (pendingOAuthResolve) {
          const resolveFn = pendingOAuthResolve;
          pendingOAuthResolve = null;
          resolveFn({ code, error, state });
        }

        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
        return;
      }

      // Serve built static assets from dist/
      let safePath = decodeURIComponent(reqUrl.pathname);
      if (safePath === '/' || safePath === '') safePath = '/index.html';

      const filePath = path.normalize(path.join(distDir, safePath));
      if (!filePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const targetFile = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
        ? filePath
        : path.join(distDir, 'index.html');

      const ext = path.extname(targetFile).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
      });
      fs.createReadStream(targetFile).pipe(res);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && activePort === PREFERRED_PORT) {
        activePort = 0; // Fallback to any free localhost port
        server.listen(0, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    server.on('listening', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        activePort = addr.port;
      }
      localServer = server;
      resolve(activePort);
    });

    server.listen(PREFERRED_PORT, '127.0.0.1');
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    title: "Coldi's Corner",
    backgroundColor: '#FAF7FD',
    icon: getIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.COLDI_DEV_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single-instance lock so double-clicking the desktop shortcut focuses the open app
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const port = await startLocalServer();
    createWindow(port);
    setupAutoUpdater();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(port);
      }
    });
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('coldi:update-ready', {
          version: info?.version || 'nueva',
        });
      }
    });

    autoUpdater.on('error', () => {
      // Offline or rate-limited: ignore silently so app always stays smooth offline
    });

    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 6000);
  } catch {
    // Ignore if electron-updater is unavailable
  }
}

app.on('window-all-closed', () => {
  if (localServer) {
    localServer.close();
    localServer = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for Seamless Google Drive OAuth, Updates & External Links
ipcMain.handle('coldi:get-redirect-uri', () => {
  return `http://127.0.0.1:${activePort}/oauth-callback`;
});

ipcMain.handle('coldi:get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('coldi:install-update', () => {
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.quitAndInstall(false, true);
  } catch {
    // ignore
  }
});

ipcMain.handle('coldi:start-google-oauth', async (_event, authUrl) => {
  if (pendingOAuthResolve) {
    pendingOAuthResolve({ error: 'cancelled' });
    pendingOAuthResolve = null;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (pendingOAuthResolve) {
        pendingOAuthResolve = null;
        resolve({ error: 'timeout' });
      }
    }, 5 * 60 * 1000);

    pendingOAuthResolve = (result) => {
      clearTimeout(timeout);
      resolve(result);
    };

    shell.openExternal(authUrl);
  });
});

ipcMain.handle('coldi:open-external', async (_event, url) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
  }
});
