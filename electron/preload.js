const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    connectWifi: (ip) => ipcRenderer.invoke("connect-wifi", ip),
    checkUsb: () => ipcRenderer.invoke("check-usb"),
    cleanup: () => ipcRenderer.invoke("cleanup-device"),
    installApk: (apkPath) => ipcRenderer.invoke("install-apk", apkPath),
    rotate: (mode) => ipcRenderer.invoke("rotate-screen", mode),
    reboot: () => ipcRenderer.invoke("reboot-device"),
    getDevices: () => ipcRenderer.invoke("get-devices"),
    openMultiFiles: () => ipcRenderer.invoke("open-multi-files"),
    pushFiles: (paths, dest) => ipcRenderer.invoke("push-files", { paths, dest })
});