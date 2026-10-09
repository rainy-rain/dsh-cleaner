const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'DSH 会话清理工具',
    icon: path.join(__dirname, 'icon.png'),
  });

  mainWindow.loadFile('main.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: 获取所有会话列表
ipcMain.handle('get-sessions', async () => {
  const home = path.join(os.homedir(), '.dsh');
  const sessRoot = path.join(home, 'sessions');
  const projRoot = path.join(home, 'storages', 'session_projcache', 'sessions');
  const wsFile = path.join(home, 'storages', 'workspace.json');

  // 读取 workspace.json
  let workspaces = {};
  let archived = [];
  let pinned = [];
  try {
    const wsData = fs.readFileSync(wsFile, 'utf8');
    const wsJson = JSON.parse(wsData);
    workspaces = wsJson.tables?.workspaces || {};
    archived = wsJson.global?.archivedSessionIds || [];
    pinned = wsJson.global?.pinnedSessionIds || [];
  } catch (e) {
    console.error('Failed to read workspace.json:', e);
  }

  // 获取所有会话目录
  const groups = {};
  try {
    const groupDirs = fs.readdirSync(sessRoot, { withFileTypes: true }).filter(e => e.isDirectory());
    for (const g of groupDirs) {
      const gdir = path.join(sessRoot, g.name);
      const ids = fs.readdirSync(gdir, { withFileTypes: true }).filter(e => e.isDirectory());
      groups[g.name] = ids.map(e => e.name);
    }
  } catch (e) {
    console.error('Failed to read sessions:', e);
  }

  // 获取会话详情
  const sessions = [];
  for (const [grpName, ids] of Object.entries(groups)) {
    for (const id of ids) {
      let title = '(无缓存标题)';
      let size = 0;
      let mtime = null;
      let wsTitle = '未分组';

      // 尝试从 projcache 读取标题
      const pj = path.join(projRoot, id + '.json');
      if (fs.existsSync(pj)) {
        try {
          const j = JSON.parse(fs.readFileSync(pj, 'utf8'));
          title = j?.record?.rows?.title?.val || title;
          const st = fs.statSync(pj);
          size = st.size;
          mtime = st.mtime;
        } catch (e) {
          console.error(`Failed to read projcache for ${id}:`, e);
        }
      }

      // 查找所属工作区
      for (const [wsId, ws] of Object.entries(workspaces)) {
        if (ws.sessionIds?.includes(id)) {
          wsTitle = ws.title;
          break;
        }
      }

      sessions.push({
        id,
        title,
        size,
        mtime,
        wsTitle,
        isArchived: archived.includes(id),
        isPinned: pinned.includes(id),
        groupId: grpName,
      });
    }
  }

  // 按最后修改时间排序
  sessions.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

  return sessions;
});

// IPC: 删除选中的会话
ipcMain.handle('delete-sessions', async (event, idsToDelete) => {
  const home = path.join(os.homedir(), '.dsh');
  const wsFile = path.join(home, 'storages', 'workspace.json');
  const REMOVE = new Set(idsToDelete);

  // 备份 workspace.json
  const backupPath = path.join(path.dirname(wsFile), `workspace.json.bak-${Date.now()}`);
  fs.copyFileSync(wsFile, backupPath);

  let deleted = [];
  let errors = [];

  // 删除会话目录和缓存
  const groups = fs.readdirSync(path.join(home, 'sessions'), { withFileTypes: true }).filter(e => e.isDirectory());
  for (const g of groups) {
    const gdir = path.join(home, 'sessions', g.name);
    const ids = fs.readdirSync(gdir, { withFileTypes: true }).filter(e => e.isDirectory());
    for (const id of ids) {
      if (REMOVE.has(id.name)) {
        const sd = path.join(gdir, id.name);
        const pj = path.join(home, 'storages', 'session_projcache', 'sessions', id.name + '.json');
        try {
          if (fs.existsSync(sd)) fs.rmSync(sd, { recursive: true, force: true });
          if (fs.existsSync(pj)) fs.unlinkSync(pj);
          deleted.push(id.name);
        } catch (e) {
          errors.push({ id: id.name, error: e.message });
        }
      }
    }
  }

  // 更新 workspace.json
  try {
    const wsData = fs.readFileSync(wsFile, 'utf8');
    const wsJson = JSON.parse(wsData);

    // 从工作区的 sessionIds 中移除
    for (const [wsId, ws] of Object.entries(wsJson.tables?.workspaces || {})) {
      if (Array.isArray(ws.sessionIds)) {
        ws.sessionIds = ws.sessionIds.filter(id => !REMOVE.has(id));
      }
    }

    // 从 archivedSessionIds 中移除
    if (Array.isArray(wsJson.global?.archivedSessionIds)) {
      wsJson.global.archivedSessionIds = wsJson.global.archivedSessionIds.filter(id => !REMOVE.has(id));
    }

    // 从 pinnedSessionIds 中移除
    if (Array.isArray(wsJson.global?.pinnedSessionIds)) {
      wsJson.global.pinnedSessionIds = wsJson.global.pinnedSessionIds.filter(id => !REMOVE.has(id));
    }

    fs.writeFileSync(wsFile, JSON.stringify(wsJson, null, 2) + '\n', 'utf8');
  } catch (e) {
    errors.push({ id: 'workspace.json', error: e.message });
  }

  return { deleted, errors, backupPath };
});

// ---------- workspace.json 读写helper ----------
const wsFilePath = () => path.join(os.homedir(), '.dsh', 'storages', 'workspace.json');

function readWorkspace() {
  return JSON.parse(fs.readFileSync(wsFilePath(), 'utf8'));
}

function writeWorkspace(json) {
  fs.writeFileSync(wsFilePath(), JSON.stringify(json, null, 2) + '\n', 'utf8');
}

function makeBackup() {
  const wsFile = wsFilePath();
  const backupPath = path.join(path.dirname(wsFile), `workspace.json.bak-${Date.now()}`);
  fs.copyFileSync(wsFile, backupPath);
  return backupPath;
}

// IPC: 切换归档状态
ipcMain.handle('toggle-archive', async (event, id) => {
  const json = readWorkspace();
  json.global = json.global || {};
  const list = json.global.archivedSessionIds || [];
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(id);
  json.global.archivedSessionIds = list;
  writeWorkspace(json);
  return { archived: idx < 0 };
});

// IPC: 切换置顶状态
ipcMain.handle('toggle-pin', async (event, id) => {
  const json = readWorkspace();
  json.global = json.global || {};
  const list = json.global.pinnedSessionIds || [];
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else list.unshift(id);
  json.global.pinnedSessionIds = list;
  writeWorkspace(json);
  return { pinned: idx < 0 };
});

// IPC: 手动备份当前状态
ipcMain.handle('backup-current', async () => {
  return { backupPath: makeBackup() };
});

// IPC: 获取备份列表
ipcMain.handle('get-backups', async () => {
  const home = path.join(os.homedir(), '.dsh', 'storages');
  const backups = [];
  try {
    const files = fs.readdirSync(home);
    for (const f of files) {
      if (f.startsWith('workspace.json.bak-')) {
        const p = path.join(home, f);
        const st = fs.statSync(p);
        backups.push({
          name: f,
          size: st.size,
          mtime: st.mtime,
          path: p,
        });
      }
    }
  } catch (e) {
    console.error('Failed to list backups:', e);
  }
  backups.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  return backups;
});

// IPC: 恢复备份
ipcMain.handle('restore-backup', async (event, backupPath) => {
  const home = path.join(os.homedir(), '.dsh', 'storages');
  const wsFile = path.join(home, 'workspace.json');
  try {
    fs.copyFileSync(backupPath, wsFile);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// IPC: 清理备份
ipcMain.handle('cleanup-backups', async () => {
  const home = path.join(os.homedir(), '.dsh', 'storages');
  let cleaned = 0;
  try {
    const files = fs.readdirSync(home);
    for (const f of files) {
      if (f.startsWith('workspace.json.bak-')) {
        fs.unlinkSync(path.join(home, f));
        cleaned++;
      }
    }
  } catch (e) {
    console.error('Failed to cleanup backups:', e);
  }
  return cleaned;
});
