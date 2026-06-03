// js/app.js - Frontend controller for Android Control Center

// DOM Elements
const statusBadge = document.getElementById("statusBadge");
const ipInput = document.getElementById("ipInput");
const connectBtn = document.getElementById("connectBtn");
const usbBtn = document.getElementById("usbBtn");
const statusBox = document.getElementById("statusBox");
const cleanupBtn = document.getElementById("cleanupBtn");
const installCustomApkBtn = document.getElementById("installCustomApkBtn");
const sendFilesBtn = document.getElementById("sendFilesBtn");
const rotationButtons = document.querySelectorAll(".rotate-btn");
const rebootBtn = document.getElementById("rebootBtn");

// Loading state helper
const allInteractiveElements = [
    ipInput,
    connectBtn,
    usbBtn,
    cleanupBtn,
    installCustomApkBtn,
    sendFilesBtn,
    rebootBtn,
    ...rotationButtons
];

// Load previously saved IP on start
if (localStorage.getItem("savedDeviceIp")) {
    ipInput.value = localStorage.getItem("savedDeviceIp");
}

function disableAllControls() {
    allInteractiveElements.forEach(el => {
        if (el) el.disabled = true;
    });
}

function enableAllControls() {
    allInteractiveElements.forEach(el => {
        if (el) el.disabled = false;
    });
}

// Display messages in status box with premium colors
function showStatus(message, type = "info") {
    statusBox.style.display = "block";
    statusBox.style.whiteSpace = "pre-wrap";
    statusBox.textContent = message;

    if (type === "success") {
        statusBox.style.background = "#edf9ee";
        statusBox.style.color = "#19743a";
        statusBox.style.border = "1px solid #14863f";
    } else if (type === "error") {
        statusBox.style.background = "#fde8e8";
        statusBox.style.color = "#9b1c1c";
        statusBox.style.border = "1px solid #f8b4b4";
    } else { // info / loading
        statusBox.style.background = "#e1effe";
        statusBox.style.color = "#1e429f";
        statusBox.style.border = "1px solid #a4cafe";
    }
}

// Refresh connection status badge
async function refreshConnectionStatus() {
    try {
        const devices = await window.api.getDevices();
        if (devices && devices.length > 0) {
            statusBadge.textContent = "Connected";
            statusBadge.className = "status connected";
            
            // If statusBox is not showing an active message, show connection info
            if (statusBox.style.display === "none" || statusBox.textContent.includes("No connected devices")) {
                showStatus(`Connected to device(s): ${devices.join(", ")}`, "success");
            }
            return true;
        } else {
            statusBadge.textContent = "Disconnected";
            statusBadge.className = "status disconnected";
            return false;
        }
    } catch (err) {
        console.error("Failed to check connection status:", err);
        statusBadge.textContent = "Disconnected";
        statusBadge.className = "status disconnected";
        return false;
    }
}

// WIFI Connect Button
connectBtn.addEventListener("click", async () => {
    const ip = ipInput.value.trim();
    if (!ip) {
        showStatus("Please enter a device IP address first.", "error");
        return;
    }

    // Save IP to localStorage
    localStorage.setItem("savedDeviceIp", ip);

    disableAllControls();
    statusBadge.textContent = "Connecting...";
    statusBadge.className = "status connecting";
    showStatus(`Attempting connection to ${ip}...`, "info");

    try {
        const result = await window.api.connectWifi(ip);
        if (result.success) {
            showStatus(`Successfully connected to ${ip}!\n${result.message}`, "success");
        } else {
            showStatus(`Connection failed:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Connection error:\n${err.message || err}`, "error");
    } finally {
        await refreshConnectionStatus();
        enableAllControls();
    }
});

// USB Check Button
usbBtn.addEventListener("click", async () => {
    disableAllControls();
    showStatus("Scanning for USB connected Android devices...", "info");

    try {
        const result = await window.api.checkUsb();
        if (result.success) {
            showStatus(result.message, "success");
        } else {
            showStatus(result.message || result.error, "error");
        }
    } catch (err) {
        showStatus(`USB scan error:\n${err.message || err}`, "error");
    } finally {
        await refreshConnectionStatus();
        enableAllControls();
    }
});

// Start Cleanup Process (Bloatware removal + optimizations)
cleanupBtn.addEventListener("click", async () => {
    const isConnected = await refreshConnectionStatus();
    if (!isConnected) {
        showStatus("No device connected. Please connect a device via Wi-Fi or USB first.", "error");
        return;
    }

    disableAllControls();
    showStatus("Starting cleanup process...\nUninstalling bloatware apps and applying signage settings optimizations. Please wait...", "info");

    try {
        const result = await window.api.cleanup();
        if (result.success) {
            let msg = "Cleanup & Optimizations completed!\n\n";
            result.results.forEach(res => {
                msg += `• ${res.item}: ${res.status}\n`;
            });
            showStatus(msg, "success");
        } else {
            showStatus(`Cleanup failed:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Cleanup error:\n${err.message || err}`, "error");
    } finally {
        await refreshConnectionStatus();
        enableAllControls();
    }
});

// Choose & Install APK
installCustomApkBtn.addEventListener("click", async () => {
    const isConnected = await refreshConnectionStatus();
    if (!isConnected) {
        showStatus("No device connected. Please connect a device via Wi-Fi or USB first.", "error");
        return;
    }

    disableAllControls();
    showStatus("Please choose an APK file from the file dialog...", "info");

    try {
        // Passing null forces the file dialog to open
        const result = await window.api.installApk(null);
        if (result.success) {
            showStatus(result.message, "success");
        } else {
            showStatus(`Installation failed / cancelled:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Installation error:\n${err.message || err}`, "error");
    } finally {
        await refreshConnectionStatus();
        enableAllControls();
    }
});

// Select & Send multiple files to device
sendFilesBtn.addEventListener("click", async () => {
    const isConnected = await refreshConnectionStatus();
    if (!isConnected) {
        showStatus("No device connected. Please connect a device via Wi-Fi or USB first.", "error");
        return;
    }

    disableAllControls();
    showStatus("Please select one or more files to send to the device...", "info");

    try {
        const filePaths = await window.api.openMultiFiles();
        if (!filePaths || filePaths.length === 0) {
            showStatus("Send files cancelled. No files selected.", "error");
            enableAllControls();
            return;
        }

        showStatus(`Sending ${filePaths.length} file(s) to device (/sdcard/)... Please wait.`, "info");
        const result = await window.api.pushFiles(filePaths, "/sdcard/");
        if (result.success) {
            let msg = `Successfully sent ${filePaths.length} file(s) to /sdcard/!\n\n`;
            result.results.forEach(res => {
                msg += `• ${res.file}: ${res.status}${res.error ? ' (' + res.error + ')' : ''}\n`;
            });
            showStatus(msg, "success");
        } else {
            showStatus(`Failed to send files:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`File send error:\n${err.message || err}`, "error");
    } finally {
        enableAllControls();
    }
});

// Rotation Buttons
rotationButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
        const isConnected = await refreshConnectionStatus();
        if (!isConnected) {
            showStatus("No device connected. Please connect a device via Wi-Fi or USB first.", "error");
            return;
        }

        const mode = parseInt(btn.getAttribute("data-rotation"), 10);
        disableAllControls();
        showStatus("Setting screen rotation orientation...", "info");

        try {
            const result = await window.api.rotate(mode);
            if (result.success) {
                showStatus(result.message, "success");
            } else {
                showStatus(`Rotation failed:\n${result.error}`, "error");
            }
        } catch (err) {
            showStatus(`Rotation error:\n${err.message || err}`, "error");
        } finally {
            enableAllControls();
        }
    });
});

// Reboot Button
rebootBtn.addEventListener("click", async () => {
    const isConnected = await refreshConnectionStatus();
    if (!isConnected) {
        showStatus("No device connected. Please connect a device via Wi-Fi or USB first.", "error");
        return;
    }

    if (!confirm("Are you sure you want to reboot the connected device?")) {
        return;
    }

    disableAllControls();
    showStatus("Sending reboot command to device...", "info");

    try {
        const result = await window.api.reboot();
        if (result.success) {
            showStatus(result.message, "success");
        } else {
            showStatus(`Reboot failed:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Reboot error:\n${err.message || err}`, "error");
    } finally {
        // Delay connection refresh because device is rebooting
        setTimeout(async () => {
            await refreshConnectionStatus();
            enableAllControls();
        }, 3000);
    }
});

// Initial startup scan
document.addEventListener("DOMContentLoaded", () => {
    refreshConnectionStatus();
});