const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    // Connection APIs
    connectWifi: (ip) => ipcRenderer.invoke("connect-wifi", ip),
    checkUsb: () => ipcRenderer.invoke("check-usb"),
    getDevicesDetails: () => ipcRenderer.invoke("get-devices-details"),

    // Bulk Control APIs
    bulkInstall: (deviceIds, apkPath) => ipcRenderer.invoke("bulk-install", { deviceIds, apkPath }),
    bulkPush: (deviceIds, dest) => ipcRenderer.invoke("bulk-push", { deviceIds, dest }),
    bulkCleanup: (deviceIds) => ipcRenderer.invoke("bulk-cleanup", { deviceIds }),
    bulkRotate: (deviceIds, mode) => ipcRenderer.invoke("bulk-rotate", { deviceIds, mode }),
    bulkReboot: (deviceIds) => ipcRenderer.invoke("bulk-reboot", { deviceIds }),

    // Device File Manager APIs
    fileManagerList: (deviceId, path) => ipcRenderer.invoke("file-manager-list", { deviceId, path }),
    fileManagerDelete: (deviceId, path, isDir) => ipcRenderer.invoke("file-manager-delete", { deviceId, path, isDir }),
    fileManagerRename: (deviceId, oldPath, newPath) => ipcRenderer.invoke("file-manager-rename", { deviceId, oldPath, newPath }),
    fileManagerMkdir: (deviceId, path) => ipcRenderer.invoke("file-manager-mkdir", { deviceId, path }),
    fileManagerDownload: (deviceId, remotePath) => ipcRenderer.invoke("file-manager-download", { deviceId, remotePath }),
    fileManagerUpload: (deviceId, remoteFolder) => ipcRenderer.invoke("file-manager-upload", { deviceId, remoteFolder }),

    // Apps Manager APIs
    appsList: (deviceId) => ipcRenderer.invoke("apps-list", { deviceId }),
    appsUninstall: (deviceId, packageName) => ipcRenderer.invoke("apps-uninstall", { deviceId, packageName })
});