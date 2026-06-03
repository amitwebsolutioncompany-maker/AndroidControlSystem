const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const adb = require("./adb");

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
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

ipcMain.handle("connect-wifi", async (event, ip) => {
    return await adb.connectWifi(ip);
});

ipcMain.handle("check-usb", async () => {
    return await adb.checkUsb();
});

ipcMain.handle("cleanup-device", async () => {
    return await adb.cleanupDevice();
});

ipcMain.handle("install-apk", async (event, apkPath) => {
    let targetPath = apkPath;

    // If no path was passed, or if the passed path doesn't exist, open a file chooser dialog
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
    return await adb.installApk(targetPath);
});

ipcMain.handle("rotate-screen", async (event, mode) => {
    return await adb.rotateScreen(mode);
});

ipcMain.handle("reboot-device", async () => {
    return await adb.rebootDevice();
});

ipcMain.handle("get-devices", async () => {
    return await adb.getConnectedDevices();
});

ipcMain.handle("open-multi-files", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
        title: "Select Files to Send to Device",
        properties: ["openFile", "multiSelections"]
    });
    if (res.canceled) return [];
    return res.filePaths;
});

ipcMain.handle("push-files", async (event, { paths, dest }) => {
    return await adb.pushFiles(paths, dest);
});