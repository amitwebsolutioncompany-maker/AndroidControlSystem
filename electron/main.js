const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const adb = require("./adb");

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1500,
        height: 950,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile("index.html");
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// IPC Handlers

// Device Connection Handlers
ipcMain.handle("connect-wifi", async (event, ip) => {
    return await adb.connectWifi(ip);
});

ipcMain.handle("check-usb", async () => {
    return await adb.checkUsb();
});

ipcMain.handle("get-devices-details", async () => {
    return await adb.getConnectedDevicesWithDetails();
});

// --- Bulk Operations Handlers ---

// Bulk APK Installer (runs in parallel)
ipcMain.handle("bulk-install", async (event, { deviceIds, apkPath }) => {
    let targetPath = apkPath;
    if (!targetPath || !fs.existsSync(targetPath)) {
        const res = await dialog.showOpenDialog(mainWindow, {
            title: "Select Signage APK to Install",
            properties: ["openFile"],
            filters: [
                { name: "APK Files", extensions: ["apk"] },
                { name: "All Files", extensions: ["*"] }
            ]
        });
        if (res.canceled || res.filePaths.length === 0) {
            return { success: false, error: "Installation cancelled. No APK file selected." };
        }
        targetPath = res.filePaths[0];
    }

    const results = await Promise.all(
        deviceIds.map(async (id) => {
            try {
                const r = await adb.installApkOnDevice(id, targetPath);
                return { deviceId: id, success: r.success, message: r.message || r.error };
            } catch (e) {
                return { deviceId: id, success: false, error: String(e) };
            }
        })
    );
    return { success: true, results, apkPath: targetPath };
});

// Bulk File Transfer (runs in parallel)
ipcMain.handle("bulk-push", async (event, { deviceIds, dest }) => {
    const res = await dialog.showOpenDialog(mainWindow, {
        title: "Select Files to Send to Devices",
        properties: ["openFile", "multiSelections"]
    });
    if (res.canceled || res.filePaths.length === 0) {
        return { success: false, error: "No files selected." };
    }
    const filePaths = res.filePaths;

    const results = await Promise.all(
        deviceIds.map(async (id) => {
            try {
                const r = await adb.pushFilesToDevice(id, filePaths, dest);
                return { deviceId: id, success: r.success, results: r.results, error: r.error };
            } catch (e) {
                return { deviceId: id, success: false, error: String(e) };
            }
        })
    );
    return { success: true, results, fileCount: filePaths.length };
});

// Bulk Device Cleanup & Optimizations (runs in parallel)
ipcMain.handle("bulk-cleanup", async (event, { deviceIds }) => {
    const results = await Promise.all(
        deviceIds.map(async (id) => {
            try {
                const r = await adb.cleanupDevice(id);
                return { deviceId: id, success: r.success, results: r.results, error: r.error };
            } catch (e) {
                return { deviceId: id, success: false, error: String(e) };
            }
        })
    );
    return { success: true, results };
});

// Bulk Screen Rotation (runs in parallel)
ipcMain.handle("bulk-rotate", async (event, { deviceIds, mode }) => {
    const results = await Promise.all(
        deviceIds.map(async (id) => {
            try {
                const r = await adb.rotateScreenOnDevice(id, mode);
                return { deviceId: id, success: r.success, message: r.message || r.error };
            } catch (e) {
                return { deviceId: id, success: false, error: String(e) };
            }
        })
    );
    return { success: true, results };
});

// Bulk Device Reboot (runs in parallel)
ipcMain.handle("bulk-reboot", async (event, { deviceIds }) => {
    const results = await Promise.all(
        deviceIds.map(async (id) => {
            try {
                const r = await adb.rebootDevice(id);
                return { deviceId: id, success: r.success, message: r.message || r.error };
            } catch (e) {
                return { deviceId: id, success: false, error: String(e) };
            }
        })
    );
    return { success: true, results };
});

// --- Device File Manager Handlers ---

// List files/folders on target device
ipcMain.handle("file-manager-list", async (event, { deviceId, path }) => {
    return await adb.listFiles(deviceId, path);
});

// Delete file/folder on target device
ipcMain.handle("file-manager-delete", async (event, { deviceId, path, isDir }) => {
    return await adb.deletePath(deviceId, path, isDir);
});

// Rename file/folder on target device
ipcMain.handle("file-manager-rename", async (event, { deviceId, oldPath, newPath }) => {
    return await adb.renamePath(deviceId, oldPath, newPath);
});

// Create directory on target device
ipcMain.handle("file-manager-mkdir", async (event, { deviceId, path }) => {
    return await adb.createFolder(deviceId, path);
});

// Pull (download) file from TV to PC
ipcMain.handle("file-manager-download", async (event, { deviceId, remotePath }) => {
    const filename = path.basename(remotePath);
    const res = await dialog.showSaveDialog(mainWindow, {
        title: "Download File from TV",
        defaultPath: filename
    });
    if (res.canceled || !res.filePath) {
        return { success: false, error: "Download cancelled." };
    }
    return await adb.pullFile(deviceId, remotePath, res.filePath);
});

// Push (upload) file from PC to TV
ipcMain.handle("file-manager-upload", async (event, { deviceId, remoteFolder }) => {
    const res = await dialog.showOpenDialog(mainWindow, {
        title: "Select File to Upload to TV",
        properties: ["openFile"]
    });
    if (res.canceled || res.filePaths.length === 0) {
        return { success: false, error: "Upload cancelled." };
    }
    const localPath = res.filePaths[0];
    const filename = path.basename(localPath);
    // Posix paths are used on Android file systems (slash separation)
    const remoteDest = path.posix.join(remoteFolder, filename);
    return await adb.pushFile(deviceId, localPath, remoteDest);
});

// --- Apps Manager Handlers ---

// List installed activities/packages
ipcMain.handle("apps-list", async (event, { deviceId }) => {
    return await adb.listApps(deviceId);
});

// Uninstall package
ipcMain.handle("apps-uninstall", async (event, { deviceId, packageName }) => {
    return await adb.uninstallApp(deviceId, packageName);
});

// Disable package
ipcMain.handle("apps-disable", async (event, { deviceId, packageName }) => {
    return await adb.disableApp(deviceId, packageName);
});

// Wireless pairing handler
ipcMain.handle("connect-pair", async (event, { ipport, code }) => {
    return await adb.pairDevice(ipport, code);
});

// Auto ADB setup handler
ipcMain.handle("auto-setup-adb", async () => {
    return await adb.autoSetupADB();
});

// Manual command runner handler
ipcMain.handle("run-manual-command", async (event, { command, deviceIds }) => {
    if (!deviceIds || deviceIds.length === 0) {
        return await adb.runManualCommand(command);
    }
    const results = await Promise.all(
        deviceIds.map(async (id) => {
            try {
                const r = await adb.runManualCommand(command, id);
                return { deviceId: id, success: r.success, stdout: r.stdout, stderr: r.stderr };
            } catch (e) {
                return { deviceId: id, success: false, error: String(e) };
            }
        })
    );
    return { success: true, results };
});

// Start Screen Mirroring & Control (scrcpy)
ipcMain.handle("start-scrcpy", async (event, { deviceId, deviceName }) => {
    return await adb.startScrcpy(deviceId, deviceName);
});

// Auto Scrcpy setup handler
ipcMain.handle("auto-setup-scrcpy", async () => {
    return await adb.autoSetupScrcpy();
});

// Start ADB Server handler
ipcMain.handle("start-adb-server", async () => {
    return await adb.startAdbServer();
});

// Kill ADB Server handler
ipcMain.handle("kill-adb-server", async () => {
    return await adb.killAdbServer();
});