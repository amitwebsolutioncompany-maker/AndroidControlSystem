const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    // Connection APIs
    connectWifi: (ip) => ipcRenderer.invoke("connect-wifi", ip),
    checkUsb: () => ipcRenderer.invoke("check-usb"),
    getDevicesDetails: () => ipcRenderer.invoke("get-devices-details"),
    pairDevice: (ipport, code) => ipcRenderer.invoke("connect-pair", { ipport, code }),
    autoSetupADB: () => ipcRenderer.invoke("auto-setup-adb"),
    autoDiscoverConnect: () => ipcRenderer.invoke("auto-discover-connect"),

    // Bulk Control APIs
    bulkInstall: (deviceIds, apkPath) => ipcRenderer.invoke("bulk-install", { deviceIds, apkPath }),
    bulkPush: (deviceIds, dest) => ipcRenderer.invoke("bulk-push", { deviceIds, dest }),
    bulkCleanup: (deviceIds) => ipcRenderer.invoke("bulk-cleanup", { deviceIds }),
    bulkRotate: (deviceIds, mode) => ipcRenderer.invoke("bulk-rotate", { deviceIds, mode }),
    bulkReboot: (deviceIds) => ipcRenderer.invoke("bulk-reboot", { deviceIds }),
    bulkKeyevent: (deviceIds, keycode) => ipcRenderer.invoke("bulk-keyevent", { deviceIds, keycode }),
    bulkSpecialCommand: (deviceIds, cmdType) => ipcRenderer.invoke("bulk-special-command", { deviceIds, cmdType }),
    bulkCheckIp: (deviceIds) => ipcRenderer.invoke("bulk-check-ip", { deviceIds }),
    bulkCheckWifi: (deviceIds) => ipcRenderer.invoke("bulk-check-wifi", { deviceIds }),
    bulkCheckConnectivity: (deviceIds) => ipcRenderer.invoke("bulk-check-connectivity", { deviceIds }),
    bulkOpenDevOptions: (deviceIds) => ipcRenderer.invoke("bulk-open-dev-options", { deviceIds }),
    bulkServiceMenu: (deviceIds, menuType) => ipcRenderer.invoke("bulk-service-menu", { deviceIds, menuType }),

    // Device File Manager APIs
    fileManagerList: (deviceId, path) => ipcRenderer.invoke("file-manager-list", { deviceId, path }),
    fileManagerDelete: (deviceId, path, isDir) => ipcRenderer.invoke("file-manager-delete", { deviceId, path, isDir }),
    fileManagerRename: (deviceId, oldPath, newPath) => ipcRenderer.invoke("file-manager-rename", { deviceId, oldPath, newPath }),
    fileManagerMkdir: (deviceId, path) => ipcRenderer.invoke("file-manager-mkdir", { deviceId, path }),
    fileManagerDownload: (deviceId, remotePath) => ipcRenderer.invoke("file-manager-download", { deviceId, remotePath }),
    fileManagerUpload: (deviceId, remoteFolder) => ipcRenderer.invoke("file-manager-upload", { deviceId, remoteFolder }),

    // Apps Manager APIs
    appsList: (deviceId) => ipcRenderer.invoke("apps-list", { deviceId }),
    appsUninstall: (deviceId, packageName) => ipcRenderer.invoke("apps-uninstall", { deviceId, packageName }),
    appsDisable: (deviceId, packageName) => ipcRenderer.invoke("apps-disable", { deviceId, packageName }),

    // Screen Mirroring APIs
    startScrcpy: (deviceId, deviceName) => ipcRenderer.invoke("start-scrcpy", { deviceId, deviceName }),
    autoSetupScrcpy: () => ipcRenderer.invoke("auto-setup-scrcpy"),

    // ADB Server APIs
    startAdbServer: () => ipcRenderer.invoke("start-adb-server"),
    killAdbServer: () => ipcRenderer.invoke("kill-adb-server"),

    // Manual Command Executor
    runManualCommand: (command, deviceIds) => ipcRenderer.invoke("run-manual-command", { command, deviceIds })
});