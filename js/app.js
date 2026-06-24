// js/app.js - Multi-Device Control Center Frontend Logic

// --- GLOBALS & STATE ---
let connectedDevices = [];
let selectedDeviceIds = new Set();
let currentPath = "/sdcard";
let activeFileManagerDevice = "";
let activeAppsDevice = "";
let installedAppsList = [];
let deploymentLogs = [];

// --- DOM SELECTORS ---

// Theme & Navigation
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeIcon = document.getElementById("themeIcon");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

// Connection Controls
const ipInput = document.getElementById("ipInput");
const connectBtn = document.getElementById("connectBtn");
const usbBtn = document.getElementById("usbBtn");
const autoNetworkScanBtn = document.getElementById("autoNetworkScanBtn");
const pairCodeInput = document.getElementById("pairCodeInput");
const pairBtn = document.getElementById("pairBtn");
const pairConnectBtn = document.getElementById("pairConnectBtn");

// Step 5 & 6 Column 3 buttons
const btnScreenOn = document.getElementById("btnScreenOn");
const btnScreenOff = document.getElementById("btnScreenOff");
const dpadUp = document.getElementById("dpadUp");
const dpadDown = document.getElementById("dpadDown");
const dpadLeft = document.getElementById("dpadLeft");
const dpadRight = document.getElementById("dpadRight");
const dpadOk = document.getElementById("dpadOk");
const btnBack = document.getElementById("btnBack");
const btnHome = document.getElementById("btnHome");
const btnRecents = document.getElementById("btnRecents");
const btnVolUp = document.getElementById("btnVolUp");
const btnMute = document.getElementById("btnMute");
const btnVolDown = document.getElementById("btnVolDown");
const btnNotifications = document.getElementById("btnNotifications");
const btnQuickSettings = document.getElementById("btnQuickSettings");

const btnCheckIp = document.getElementById("btnCheckIp");
const btnCheckWifi = document.getElementById("btnCheckWifi");
const btnCheckConnectivity = document.getElementById("btnCheckConnectivity");
const btnOpenDevOptions = document.getElementById("btnOpenDevOptions");
const btnServiceMenuGTV = document.getElementById("btnServiceMenuGTV");
const btnServiceMenuSmartA = document.getElementById("btnServiceMenuSmartA");
const btnServiceMenuSmartB = document.getElementById("btnServiceMenuSmartB");

// Security Lockout selectors
const loginOverlay = document.getElementById("loginOverlay");
const loginBox = document.getElementById("loginBox");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const toggleLoginPasswordBtn = document.getElementById("toggleLoginPasswordBtn");
const toggleLoginPasswordIcon = document.getElementById("toggleLoginPasswordIcon");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const loginErrorMessage = document.getElementById("loginErrorMessage");
const connectedCountBadge = document.getElementById("connectedCountBadge");

// Sidebar Setup Panel
const autoSetupAdbBtn = document.getElementById("autoSetupAdbBtn");
const adbSetupStatus = document.getElementById("adbSetupStatus");
const autoSetupScrcpyBtn = document.getElementById("autoSetupScrcpyBtn");
const scrcpySetupStatus = document.getElementById("scrcpySetupStatus");

// Header Navbar controls
const startAdbServerBtn = document.getElementById("startAdbServerBtn");
const killAdbServerBtn = document.getElementById("killAdbServerBtn");
const refreshDevicesHeaderBtn = document.getElementById("refreshDevicesHeaderBtn");

// Sidebar Devices checklist
const refreshDevicesBtn = document.getElementById("refreshDevicesBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const unselectAllBtn = document.getElementById("unselectAllBtn");
const devicesChecklist = document.getElementById("devicesChecklist");

// Bulk Operations Tab
const bulkCleanupBtn = document.getElementById("bulkCleanupBtn");
const bulkInstallBtn = document.getElementById("bulkInstallBtn");
const bulkDestPath = document.getElementById("bulkDestPath");
const bulkPushBtn = document.getElementById("bulkPushBtn");
const bulkRotateButtons = document.querySelectorAll(".bulk-rotate-btn");
const bulkRebootBtn = document.getElementById("bulkRebootBtn");
const statusBox = document.getElementById("statusBox");

// Embedded Terminal Controls
const terminalInput = document.getElementById("terminalInput");
const terminalSendBtn = document.getElementById("terminalSendBtn");
const terminalOutput = document.getElementById("terminalOutput");
const terminalTargetLabel = document.getElementById("terminalTargetLabel");

function updateTerminalTargetLabel() {
    if (!terminalTargetLabel) return;
    const count = selectedDeviceIds.size;
    if (count === 0) {
        terminalTargetLabel.textContent = "Target: No devices selected (Select sidebar checkboxes)";
        terminalTargetLabel.style.color = "var(--danger)";
    } else {
        terminalTargetLabel.textContent = `Target: ${count} selected device(s)`;
        terminalTargetLabel.style.color = "var(--success)";
    }
}

// Loading state helper
const bulkInteractiveElements = [
    ipInput, connectBtn, usbBtn, autoNetworkScanBtn, refreshDevicesBtn, selectAllBtn, unselectAllBtn,
    bulkCleanupBtn, bulkInstallBtn, bulkPushBtn, bulkRebootBtn, ...bulkRotateButtons,
    pairCodeInput, pairBtn, pairConnectBtn, autoSetupAdbBtn, autoSetupScrcpyBtn, terminalInput, terminalSendBtn,
    startAdbServerBtn, killAdbServerBtn, refreshDevicesHeaderBtn,
    btnScreenOn, btnScreenOff, dpadUp, dpadDown, dpadLeft, dpadRight, dpadOk,
    btnBack, btnHome, btnRecents, btnVolUp, btnMute, btnVolDown,
    btnNotifications, btnQuickSettings, btnCheckIp, btnCheckWifi,
    btnCheckConnectivity, btnOpenDevOptions, btnServiceMenuGTV, btnServiceMenuSmartA, btnServiceMenuSmartB,
    loginPasswordInput, loginSubmitBtn, toggleLoginPasswordBtn
];
const fileManagerDeviceSelect = document.getElementById("fileManagerDeviceSelect");
const fileManagerUpBtn = document.getElementById("fileManagerUpBtn");
const fileManagerPathInput = document.getElementById("fileManagerPathInput");
const fileManagerRefreshBtn = document.getElementById("fileManagerRefreshBtn");
const fileManagerMkdirBtn = document.getElementById("fileManagerMkdirBtn");
const fileManagerUploadBtn = document.getElementById("fileManagerUploadBtn");
const fileManagerBody = document.getElementById("fileManagerBody");

// Installed Apps Tab
const appsDeviceSelect = document.getElementById("appsDeviceSelect");
const appsSearchInput = document.getElementById("appsSearchInput");
const appsRefreshBtn = document.getElementById("appsRefreshBtn");
const appsBulkUninstallBtn = document.getElementById("appsBulkUninstallBtn");
const appsSelectAllCheck = document.getElementById("appsSelectAllCheck");
const appsBody = document.getElementById("appsBody");

// Deployment Log Tab
const logsBody = document.getElementById("logsBody");
const clearLogsBtn = document.getElementById("clearLogsBtn");

// --- INTERACTIVE CONTROLS LOCK HELPER ---

function setBulkControlsLock(locked) {
    bulkInteractiveElements.forEach(el => {
        if (el) el.disabled = locked;
    });
    // Checkboxes inside the list
    const checks = devicesChecklist.querySelectorAll("input[type='checkbox']");
    checks.forEach(ch => {
        ch.disabled = locked;
    });
}

// Display messages in Bulk status box
function showStatus(message, type = "info") {
    statusBox.style.display = "block";
    statusBox.style.whiteSpace = "pre-wrap";
    statusBox.textContent = message;

    if (type === "success") {
        statusBox.style.background = "var(--success-bg)";
        statusBox.style.color = "var(--success)";
        statusBox.style.borderColor = "var(--success)";
    } else if (type === "error") {
        statusBox.style.background = "var(--danger-bg)";
        statusBox.style.color = "var(--danger)";
        statusBox.style.borderColor = "var(--danger)";
    } else { // info
        statusBox.style.background = "var(--info-bg)";
        statusBox.style.color = "var(--info)";
        statusBox.style.borderColor = "var(--info)";
    }
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    // 0. Security Verification Dialog Logic
    if (loginOverlay && loginPasswordInput) {
        // Force focus on password input
        setTimeout(() => loginPasswordInput.focus(), 100);

        // Toggle password show/hide
        if (toggleLoginPasswordBtn) {
            toggleLoginPasswordBtn.addEventListener("click", () => {
                const isPassword = loginPasswordInput.type === "password";
                loginPasswordInput.type = isPassword ? "text" : "password";
                toggleLoginPasswordIcon.className = isPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
            });
        }

        // Submit listener helper
        const attemptLogin = () => {
            const password = loginPasswordInput.value;
            if (password === "amit@0408") {
                // Correct password -> hide modal
                loginOverlay.classList.add("hide");
                loginErrorMessage.style.display = "none";
            } else {
                // Incorrect password -> error feedback
                loginErrorMessage.style.display = "block";
                loginBox.classList.add("shake");
                // Clear input
                loginPasswordInput.value = "";
                loginPasswordInput.focus();
                // Remove shake class after animation completes
                setTimeout(() => {
                    loginBox.classList.remove("shake");
                }, 500);
            }
        };

        if (loginSubmitBtn) {
            loginSubmitBtn.addEventListener("click", attemptLogin);
        }

        loginPasswordInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                attemptLogin();
            }
        });
    }

    // 1. Theme Configuration
    const savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.remove("dark-mode");
        themeIcon.className = "fa-solid fa-moon";
    } else {
        document.body.classList.add("dark-mode");
        themeIcon.className = "fa-solid fa-sun";
    }

    // 2. Load Saved IP address
    if (localStorage.getItem("savedDeviceIp")) {
        ipInput.value = localStorage.getItem("savedDeviceIp");
    }

    // 3. Tab switching binding
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");

            // Toggle active classes
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            tabPanels.forEach(p => p.classList.remove("active"));
            document.getElementById(`panel-${targetTab}`).classList.add("active");
        });
    });

    // 4. Device Discovery Poll
    pollDevices();
    setInterval(pollDevices, 5000);

    // Auto-discover and connect devices on the same network
    setTimeout(() => {
        autoDiscoverConnectNetwork(true);
    }, 1500);

    // 5. Initialize signage checklist & factory menu copy actions
    initChecklist();
    initFactoryCodeCopyButtons();
});

// Theme switcher event
themeToggleBtn.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-mode");
    if (isDark) {
        themeIcon.className = "fa-solid fa-sun";
        localStorage.setItem("theme", "dark");
    } else {
        themeIcon.className = "fa-solid fa-moon";
        localStorage.setItem("theme", "light");
    }
});

// --- DEPLOYMENT LOG LOGGER ---
function logDeployment(deviceId, operation, statusDetails, isSuccess) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    // Get device name/nickname
    const dev = connectedDevices.find(d => d.id === deviceId);
    const deviceName = dev ? dev.name : deviceId;

    const logEntry = {
        time: timeStr,
        device: deviceName,
        operation: operation,
        status: statusDetails,
        success: isSuccess
    };

    deploymentLogs.unshift(logEntry); // Add to beginning
    renderLogs();
}

function renderLogs() {
    if (deploymentLogs.length === 0) {
        logsBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                    No deployments performed yet. Trigger bulk actions to see status.
                </td>
            </tr>
        `;
        return;
    }

    logsBody.innerHTML = deploymentLogs.map(log => {
        const badgeClass = log.success ? "badge-online" : "badge-offline";
        const badgeLabel = log.success ? "Success" : "Failed";
        return `
            <tr>
                <td class="progress-time">${log.time}</td>
                <td><strong>${log.device}</strong></td>
                <td>${log.operation}</td>
                <td>
                    <span class="badge ${badgeClass}">${badgeLabel}</span>
                    <span style="font-size: 12px; margin-left: 8px; color: var(--text-muted);">${log.status}</span>
                </td>
            </tr>
        `;
    }).join("");
}

clearLogsBtn.addEventListener("click", () => {
    deploymentLogs = [];
    renderLogs();
});

// --- DEVICE DISCOVERY AND SIDEBAR ---
async function pollDevices() {
    try {
        const devices = await window.api.getDevicesDetails();
        connectedDevices = devices;

        // Render Sidebar checklist
        renderDevicesChecklist();

        // Refresh Device Selector Dropdowns
        refreshDeviceDropdowns();
    } catch (err) {
        console.error("Discovery polling error:", err);
    }
}

function renderDevicesChecklist() {
    // Update connected devices count badge
    if (connectedCountBadge) {
        connectedCountBadge.textContent = connectedDevices.length;
    }

    if (connectedDevices.length === 0) {
        devicesChecklist.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); font-size: 12px; margin-top: 20px;">
                No Android TVs connected.<br>Use IP or USB connection.
            </div>
        `;
        selectedDeviceIds.clear();
        updateTerminalTargetLabel();
        return;
    }

    devicesChecklist.innerHTML = connectedDevices.map(dev => {
        const isChecked = selectedDeviceIds.has(dev.id);
        const connectionBadgeClass = dev.type === "Wi-Fi" ? "badge-wifi" : "badge-usb";
        const statusBadgeClass = dev.status === "Online" ? "badge-online" : "badge-offline";
        const checkboxDisabled = dev.status !== "Online" ? "disabled" : "";

        const controlBtn = dev.status === "Online" ? `
            <button class="btn btn-primary discovery-small-btn" onclick="startRemoteControl('${dev.id}', '${dev.name.replace(/'/g, "\\'")}')" title="Show screen and control device" style="padding: 2px 6px; height: 18px; font-size: 9px; margin-top: 2px; border-radius: 4px; gap: 4px;">
                <i class="fa-solid fa-desktop" style="font-size: 9px;"></i> Control
            </button>
        ` : '';

        return `
            <div class="device-item">
                <div class="device-item-left">
                    <input type="checkbox" data-id="${dev.id}" ${isChecked ? 'checked' : ''} ${checkboxDisabled}>
                    <div class="device-item-info">
                        <div class="device-item-name" title="${dev.name}">${dev.name}</div>
                        <div class="device-item-sub">ID: ${dev.id}</div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                    <div style="display: flex; gap: 4px;">
                        <span class="badge ${connectionBadgeClass}">${dev.type}</span>
                        <span class="badge ${statusBadgeClass}">${dev.status}</span>
                    </div>
                    ${controlBtn}
                </div>
            </div>
        `;
    }).join("");

    // Bind checkbox changes
    const checks = devicesChecklist.querySelectorAll("input[type='checkbox']");
    checks.forEach(chk => {
        chk.addEventListener("change", () => {
            const devId = chk.getAttribute("data-id");
            if (chk.checked) {
                selectedDeviceIds.add(devId);
            } else {
                selectedDeviceIds.delete(devId);
            }
            updateTerminalTargetLabel();
        });
    });
    updateTerminalTargetLabel();
}

function refreshDeviceDropdowns() {
    // Keep active selections if they are still online
    const oldFileVal = fileManagerDeviceSelect.value;
    const oldAppsVal = appsDeviceSelect.value;

    const onlineDevices = connectedDevices.filter(d => d.status === "Online");

    const optionsHTML = `
        <option value="">-- Choose Target TV --</option>
        ${onlineDevices.map(d => `<option value="${d.id}">${d.name}</option>`).join("")}
    `;

    fileManagerDeviceSelect.innerHTML = optionsHTML;
    appsDeviceSelect.innerHTML = optionsHTML;

    // Restore selected values if still online
    if (oldFileVal && onlineDevices.some(d => d.id === oldFileVal)) {
        fileManagerDeviceSelect.value = oldFileVal;
        activeFileManagerDevice = oldFileVal;
    } else {
        fileManagerDeviceSelect.value = "";
        activeFileManagerDevice = "";
        if (oldFileVal) {
            renderFilesEmpty("Active TV device disconnected.");
        }
    }

    if (oldAppsVal && onlineDevices.some(d => d.id === oldAppsVal)) {
        appsDeviceSelect.value = oldAppsVal;
        activeAppsDevice = oldAppsVal;
    } else {
        appsDeviceSelect.value = "";
        activeAppsDevice = "";
        if (oldAppsVal) {
            renderAppsEmpty("Active TV device disconnected.");
        }
    }
}

// Sidebar Checklist Actions
selectAllBtn.addEventListener("click", () => {
    connectedDevices.forEach(d => {
        if (d.status === "Online") {
            selectedDeviceIds.add(d.id);
        }
    });
    renderDevicesChecklist();
});

unselectAllBtn.addEventListener("click", () => {
    selectedDeviceIds.clear();
    renderDevicesChecklist();
});

refreshDevicesBtn.addEventListener("click", async () => {
    refreshDevicesBtn.disabled = true;
    await pollDevices();
    refreshDevicesBtn.disabled = false;
});

// --- WIFI / USB CONNECTIONS ---
connectBtn.addEventListener("click", async () => {
    const ip = ipInput.value.trim();
    if (!ip) {
        showStatus("Please enter an Android TV IP address.", "error");
        return;
    }

    localStorage.setItem("savedDeviceIp", ip);
    setBulkControlsLock(true);
    showStatus(`Connecting to Wi-Fi TV at ${ip}...`, "info");

    try {
        const result = await window.api.connectWifi(ip);
        if (result.success) {
            showStatus(`Wi-Fi connection established!\n${result.message}`, "success");
            // Auto-check the connected device in checklist
            await pollDevices();
            const newDev = connectedDevices.find(d => d.id.includes(ip));
            if (newDev) selectedDeviceIds.add(newDev.id);
        } else {
            showStatus(`Connection failed:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Connection error: ${err.message || err}`, "error");
    } finally {
        await pollDevices();
        setBulkControlsLock(false);
    }
});

usbBtn.addEventListener("click", async () => {
    setBulkControlsLock(true);
    showStatus("Scanning for USB-connected Android TVs...", "info");

    try {
        const result = await window.api.checkUsb();
        if (result.success) {
            showStatus(result.message, "success");
            await pollDevices();
            // Auto check detected USB devices
            if (result.devices) {
                result.devices.forEach(id => selectedDeviceIds.add(id));
            }
        } else {
            showStatus(result.message || result.error, "error");
        }
    } catch (err) {
        showStatus(`USB check error: ${err.message || err}`, "error");
    } finally {
        await pollDevices();
        setBulkControlsLock(false);
    }
});

// Auto-discover and connect to same network button
if (autoNetworkScanBtn) {
    autoNetworkScanBtn.addEventListener("click", () => {
        autoDiscoverConnectNetwork(false);
    });
}

// Auto network discovery scan and connection logic
async function autoDiscoverConnectNetwork(silent = false) {
    if (!silent) {
        showStatus("Scanning local network subnets for ADB enabled devices... Please wait.", "info");
    }
    setBulkControlsLock(true);

    try {
        const result = await window.api.autoDiscoverConnect();
        if (result.success) {
            if (result.connectedCount > 0) {
                const deviceList = result.devices.join(", ");
                if (!silent) {
                    showStatus(`Discovery complete! Automatically connected to ${result.connectedCount} device(s): ${deviceList}`, "success");
                } else {
                    console.log(`Auto-discovered and connected to ${result.connectedCount} same-network device(s): ${deviceList}`);
                }
            } else {
                if (!silent) {
                    showStatus("Scan complete. No new same-network devices with open ADB port 5555 detected.", "info");
                }
            }
        } else {
            if (!silent) {
                showStatus(`Auto-discovery scan failed: ${result.error}`, "error");
            }
        }
    } catch (err) {
        if (!silent) {
            showStatus(`Auto-discovery error: ${err.message || err}`, "error");
        }
    } finally {
        await pollDevices();
        setBulkControlsLock(false);
    }
}

// Pair Device over wireless debugging
pairBtn.addEventListener("click", async () => {
    const ipport = ipInput.value.trim();
    const code = pairCodeInput.value.trim();
    if (!ipport || !code) {
        showStatus("Please enter both Device IP & Port (e.g. 192.168.1.6:45283) and 6-digit Pairing Code first.", "error");
        return;
    }

    setBulkControlsLock(true);
    showStatus(`Pairing with ${ipport} using code ${code}...`, "info");

    try {
        const result = await window.api.pairDevice(ipport, code);
        if (result.success) {
            showStatus(`Successfully paired to ${ipport}!\n${result.message}`, "success");
            pairCodeInput.value = "";
        } else {
            showStatus(`Pairing failed:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Pairing error: ${err.message || err}`, "error");
    } finally {
        await pollDevices();
        setBulkControlsLock(false);
    }
});

// Pair + Connect wireless debugging flow
pairConnectBtn.addEventListener("click", async () => {
    const ipport = ipInput.value.trim();
    const code = pairCodeInput.value.trim();
    if (!ipport || !code) {
        showStatus("Please enter both Device IP & Port and 6-digit Pairing Code first.", "error");
        return;
    }

    setBulkControlsLock(true);
    showStatus(`Step 1/2: Pairing with ${ipport}...`, "info");

    try {
        const pairResult = await window.api.pairDevice(ipport, code);
        if (!pairResult.success) {
            showStatus(`Pairing failed:\n${pairResult.error}`, "error");
            setBulkControlsLock(false);
            return;
        }

        const ip = ipport.split(":")[0];
        showStatus(`Step 2/2: Pairing successful! Connecting to TV at ${ip}...`, "info");

        const connResult = await window.api.connectWifi(ip);
        if (connResult.success) {
            showStatus(`Pairing & Connection Successful!\nConnected to TV at ${ip}:5555`, "success");
            pairCodeInput.value = "";
            await pollDevices();
            const newDev = connectedDevices.find(d => d.id.includes(ip));
            if (newDev) selectedDeviceIds.add(newDev.id);
        } else {
            showStatus(`Pairing succeeded, but connect failed: ${connResult.error}\nTry connecting manually using 'Connect' button.`, "warning");
        }
    } catch (err) {
        showStatus(`Pair & Connect error: ${err.message || err}`, "error");
    } finally {
        await pollDevices();
        setBulkControlsLock(false);
    }
});

// Auto-Setup ADB One-click installer
autoSetupAdbBtn.addEventListener("click", async () => {
    setBulkControlsLock(true);
    adbSetupStatus.textContent = "Status: Installing ADB...";
    adbSetupStatus.style.color = "var(--text-muted)";
    showStatus("Initializing ADB Auto Setup on Windows host. Please wait...", "info");

    try {
        const result = await window.api.autoSetupADB();
        if (result.success) {
            adbSetupStatus.textContent = "Status: Setup Completed!";
            adbSetupStatus.style.color = "var(--success)";
            showStatus(`ADB Auto-Setup Completed Successfully!\n${result.message}`, "success");
        } else {
            adbSetupStatus.textContent = "Status: Setup Failed";
            adbSetupStatus.style.color = "var(--danger)";
            showStatus(`ADB Auto-Setup Failed:\n${result.error}`, "error");
        }
    } catch (err) {
        adbSetupStatus.textContent = "Status: Error occurred";
        adbSetupStatus.style.color = "var(--danger)";
        showStatus(`ADB Setup Error: ${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
});

// Auto-Setup Scrcpy One-click installer
if (autoSetupScrcpyBtn) {
    autoSetupScrcpyBtn.addEventListener("click", async () => {
        setBulkControlsLock(true);
        scrcpySetupStatus.textContent = "Status: Installing Scrcpy...";
        scrcpySetupStatus.style.color = "var(--text-muted)";
        showStatus("Downloading and setting up Scrcpy. Please wait...", "info");

        try {
            const result = await window.api.autoSetupScrcpy();
            if (result.success) {
                scrcpySetupStatus.textContent = "Status: Setup Completed!";
                scrcpySetupStatus.style.color = "var(--success)";
                showStatus(`Scrcpy Setup Completed Successfully!\n${result.message}`, "success");
            } else {
                scrcpySetupStatus.textContent = "Status: Setup Failed";
                scrcpySetupStatus.style.color = "var(--danger)";
                showStatus(`Scrcpy Setup Failed:\n${result.error}`, "error");
            }
        } catch (err) {
            scrcpySetupStatus.textContent = "Status: Error occurred";
            scrcpySetupStatus.style.color = "var(--danger)";
            showStatus(`Scrcpy Setup Error: ${err.message || err}`, "error");
        } finally {
            setBulkControlsLock(false);
        }
    });
}

// Remote Control Screen Mirror launcher
window.startRemoteControl = async function(deviceId, deviceName) {
    showStatus(`Launching screen mirroring for ${deviceName || deviceId}...`, "info");
    try {
        const result = await window.api.startScrcpy(deviceId, deviceName);
        if (result.success) {
            showStatus(`Screen mirroring launched for ${deviceName || deviceId}!`, "success");
        } else {
            showStatus(`Mirroring failed: ${result.error}`, "error");
            alert(`Could not start remote control:\n\n${result.error}`);
        }
    } catch (err) {
        showStatus(`Mirroring error: ${err.message}`, "error");
    }
};

// ADB Server Controls bindings
if (startAdbServerBtn) {
    startAdbServerBtn.addEventListener("click", async () => {
        showStatus("Starting ADB Server...", "info");
        try {
            const res = await window.api.startAdbServer();
            if (res.success) {
                showStatus(res.message, "success");
                await pollDevices();
            } else {
                showStatus(`Failed to start ADB Server: ${res.error}`, "error");
            }
        } catch (err) {
            showStatus(`Error: ${err.message}`, "error");
        }
    });
}

if (killAdbServerBtn) {
    killAdbServerBtn.addEventListener("click", async () => {
        showStatus("Killing ADB Server...", "warning");
        try {
            const res = await window.api.killAdbServer();
            if (res.success) {
                showStatus(res.message, "success");
                await pollDevices();
            } else {
                showStatus(`Failed to kill ADB Server: ${res.error}`, "error");
            }
        } catch (err) {
            showStatus(`Error: ${err.message}`, "error");
        }
    });
}

if (refreshDevicesHeaderBtn) {
    refreshDevicesHeaderBtn.addEventListener("click", async () => {
        refreshDevicesHeaderBtn.disabled = true;
        showStatus("Polling connected devices...", "info");
        await pollDevices();
        refreshDevicesHeaderBtn.disabled = false;
    });
}

// --- BULK OPERATIONS TAB CONTROLS ---

// Helper: Ensure target devices selected
function getSelectedTargetsOrWarn() {
    const targets = Array.from(selectedDeviceIds);
    if (targets.length === 0) {
        showStatus("Please select one or more connected devices from the sidebar checkboxes first.", "error");
        return null;
    }
    return targets;
}

// Bulk Cleanup
bulkCleanupBtn.addEventListener("click", async () => {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    setBulkControlsLock(true);
    showStatus(`Running cleanup on ${targets.length} device(s) in parallel...\nApplying settings optimizations and removing bloatware.`, "info");

    try {
        const result = await window.api.bulkCleanup(targets);
        if (result.success) {
            let successCount = 0;
            let msg = "Bulk Cleanup Completed!\n\n";

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: Optimized\n`;
                    logDeployment(res.deviceId, "Optimize & Cleanup", "Optimizations successfully applied", true);
                } else {
                    msg += `✗ ${deviceLabel}: Failed (${res.error})\n`;
                    logDeployment(res.deviceId, "Optimize & Cleanup", `Failed: ${res.error}`, false);
                }
            });

            showStatus(msg, successCount === targets.length ? "success" : "info");
        } else {
            showStatus(`Bulk operations failed:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Bulk cleanup error:\n${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
});

// Bulk Signage Deploy APK
bulkInstallBtn.addEventListener("click", async () => {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    setBulkControlsLock(true);
    showStatus("Please select the signage APK package from the file dialog to deploy...", "info");

    try {
        const result = await window.api.bulkInstall(targets, null);
        if (result.success) {
            let successCount = 0;
            let msg = `Bulk Deployment Done! (APK: ${result.apkPath.split(/[\\/]/).pop()})\n\n`;

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: Installed\n`;
                    logDeployment(res.deviceId, "Install APK", "Package installed successfully", true);
                } else {
                    msg += `✗ ${deviceLabel}: Failed: ${res.message}\n`;
                    logDeployment(res.deviceId, "Install APK", `Failed: ${res.message}`, false);
                }
            });

            showStatus(msg, successCount === targets.length ? "success" : "info");
        } else {
            showStatus(`Installation failed or cancelled:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Deployment error:\n${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
});

// Bulk Push Files
bulkPushBtn.addEventListener("click", async () => {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    const dest = bulkDestPath.value.trim() || "/sdcard/";
    setBulkControlsLock(true);
    showStatus("Please choose files to push to all selected TVs...", "info");

    try {
        const result = await window.api.bulkPush(targets, dest);
        if (result.success) {
            let successCount = 0;
            let msg = `Bulk file transfer completed! (${result.fileCount} file(s) pushed to ${dest})\n\n`;

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: Uploaded ${result.fileCount} files\n`;
                    logDeployment(res.deviceId, "Send Files", `Uploaded ${result.fileCount} files to ${dest}`, true);
                } else {
                    msg += `✗ ${deviceLabel}: Failed: ${res.error}\n`;
                    logDeployment(res.deviceId, "Send Files", `Failed: ${res.error}`, false);
                }
            });

            showStatus(msg, successCount === targets.length ? "success" : "info");
        } else {
            showStatus(`File transfer cancelled or failed:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Bulk push error:\n${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
});

// Bulk Orientation Screen Rotate
bulkRotateButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
        const targets = getSelectedTargetsOrWarn();
        if (!targets) return;

        const mode = parseInt(btn.getAttribute("data-rotation"), 10);
        const modes = ["Portrait (0°)", "Landscape (90°)", "Reverse Portrait (180°)", "Reverse Landscape (270°)"];
        const modeLabel = modes[mode] || mode;

        setBulkControlsLock(true);
        showStatus(`Rotating screens to ${modeLabel} in parallel...`, "info");

        try {
            const result = await window.api.bulkRotate(targets, mode);
            if (result.success) {
                let successCount = 0;
                let msg = `Orientation change applied!\n\n`;

                result.results.forEach(res => {
                    const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                    if (res.success) {
                        successCount++;
                        msg += `✓ ${deviceLabel}: Rotated to ${modeLabel}\n`;
                        logDeployment(res.deviceId, "Rotation Control", `Set rotation to ${modeLabel}`, true);
                    } else {
                        msg += `✗ ${deviceLabel}: Failed: ${res.message}\n`;
                        logDeployment(res.deviceId, "Rotation Control", `Failed: ${res.message}`, false);
                    }
                });

                showStatus(msg, successCount === targets.length ? "success" : "info");
            } else {
                showStatus(`Rotation operations failed:\n${result.error}`, "error");
            }
        } catch (err) {
            showStatus(`Bulk rotation error:\n${err.message || err}`, "error");
        } finally {
            setBulkControlsLock(false);
        }
    });
});

// Bulk Reboot
bulkRebootBtn.addEventListener("click", async () => {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    if (!confirm(`Are you sure you want to REBOOT all ${targets.length} selected TVs simultaneously?`)) {
        return;
    }

    setBulkControlsLock(true);
    showStatus("Sending reboot command to selected devices in parallel...", "info");

    try {
        const result = await window.api.bulkReboot(targets);
        if (result.success) {
            let successCount = 0;
            let msg = "Reboot commands broadcasted!\n\n";

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: Rebooting...\n`;
                    logDeployment(res.deviceId, "Reboot", "Reboot command sent successfully", true);
                    selectedDeviceIds.delete(res.deviceId); // Remove since it's going offline
                } else {
                    msg += `✗ ${deviceLabel}: Failed: ${res.message}\n`;
                    logDeployment(res.deviceId, "Reboot", `Failed: ${res.message}`, false);
                }
            });

            showStatus(msg, successCount === targets.length ? "success" : "info");
            setTimeout(pollDevices, 3000);
        } else {
            showStatus(`Reboot operations failed:\n${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Reboot error:\n${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
});

// --- COLUMN 3: REMOTE CONTROL & SYSTEM DIAGNOSTICS BINDINGS ---

// Helper function to send bulk keyevent simulation
async function sendBulkKeyevent(keycode, label) {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    setBulkControlsLock(true);
    showStatus(`Sending key event "${label}" (${keycode}) to ${targets.length} device(s)...`, "info");

    try {
        const result = await window.api.bulkKeyevent(targets, keycode);
        if (result.success) {
            let successCount = 0;
            let msg = `Keyevent "${label}" sent!\n\n`;

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: Success\n`;
                    logDeployment(res.deviceId, `Key: ${label}`, "Key event simulated", true);
                } else {
                    msg += `✗ ${deviceLabel}: Failed (${res.error})\n`;
                    logDeployment(res.deviceId, `Key: ${label}`, `Failed: ${res.error}`, false);
                }
            });
            showStatus(msg, successCount === targets.length ? "success" : "info");
        } else {
            showStatus(`Operation failed: ${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Execution error: ${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
}

// Helper function to send bulk special statusbar commands
async function sendBulkSpecialCommand(cmdType, label) {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    setBulkControlsLock(true);
    showStatus(`Sending "${label}" command to ${targets.length} device(s)...`, "info");

    try {
        const result = await window.api.bulkSpecialCommand(targets, cmdType);
        if (result.success) {
            let successCount = 0;
            let msg = `Command "${label}" executed!\n\n`;

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: Command sent\n`;
                    logDeployment(res.deviceId, `Cmd: ${label}`, "Special command sent", true);
                } else {
                    msg += `✗ ${deviceLabel}: Failed (${res.error})\n`;
                    logDeployment(res.deviceId, `Cmd: ${label}`, `Failed: ${res.error}`, false);
                }
            });
            showStatus(msg, successCount === targets.length ? "success" : "info");
        } else {
            showStatus(`Operation failed: ${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Execution error: ${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
}

// Remote controller buttons click bindings
btnScreenOn.addEventListener("click", () => sendBulkKeyevent(224, "Screen On (Wakeup)"));
btnScreenOff.addEventListener("click", () => sendBulkKeyevent(223, "Screen Off (Sleep)"));
dpadUp.addEventListener("click", () => sendBulkKeyevent(19, "DPAD Up"));
dpadDown.addEventListener("click", () => sendBulkKeyevent(20, "DPAD Down"));
dpadLeft.addEventListener("click", () => sendBulkKeyevent(21, "DPAD Left"));
dpadRight.addEventListener("click", () => sendBulkKeyevent(22, "DPAD Right"));
dpadOk.addEventListener("click", () => sendBulkKeyevent(23, "DPAD OK"));
btnBack.addEventListener("click", () => sendBulkKeyevent(4, "Back"));
btnHome.addEventListener("click", () => sendBulkKeyevent(3, "Home"));
btnRecents.addEventListener("click", () => sendBulkKeyevent(187, "Recents (App Switch)"));
btnVolUp.addEventListener("click", () => sendBulkKeyevent(24, "Volume Up"));
btnVolDown.addEventListener("click", () => sendBulkKeyevent(25, "Volume Down"));
btnMute.addEventListener("click", () => sendBulkKeyevent(164, "Volume Mute"));

btnNotifications.addEventListener("click", () => sendBulkSpecialCommand("notifications", "Expand Notifications"));
btnQuickSettings.addEventListener("click", () => sendBulkSpecialCommand("settings", "Expand Settings"));

// Diagnostics and checks bindings

// 1. Check IP address
btnCheckIp.addEventListener("click", async () => {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    setBulkControlsLock(true);
    showStatus(`Checking IP address on ${targets.length} device(s)...`, "info");

    try {
        const result = await window.api.bulkCheckIp(targets);
        if (result.success) {
            let successCount = 0;
            let msg = "IP Address Diagnosis Report:\n\n";

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: IP Address is ${res.ip}\n`;
                    logDeployment(res.deviceId, "Check IP", `Found IP: ${res.ip}`, true);
                } else {
                    msg += `✗ ${deviceLabel}: Failed to resolve (${res.error})\n`;
                    logDeployment(res.deviceId, "Check IP", `Failed: ${res.error}`, false);
                }
            });
            showStatus(msg, successCount === targets.length ? "success" : "info");
        } else {
            showStatus(`Diagnostics failed: ${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Execution error: ${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
});

// 2. Check Wi-Fi status
btnCheckWifi.addEventListener("click", async () => {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    setBulkControlsLock(true);
    showStatus(`Querying Wi-Fi configuration on ${targets.length} device(s)...`, "info");

    try {
        const result = await window.api.bulkCheckWifi(targets);
        if (result.success) {
            let successCount = 0;
            let msg = "Wi-Fi Interface Diagnosis Report:\n\n";

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: SSID: "${res.ssid}" | Signal: ${res.rssi} (${res.quality})\n`;
                    logDeployment(res.deviceId, "Check Wi-Fi", `SSID: "${res.ssid}" | Signal: ${res.rssi}`, true);
                } else {
                    msg += `✗ ${deviceLabel}: Failed to read dumpsys (${res.error})\n`;
                    logDeployment(res.deviceId, "Check Wi-Fi", `Failed: ${res.error}`, false);
                }
            });
            showStatus(msg, successCount === targets.length ? "success" : "info");
        } else {
            showStatus(`Diagnostics failed: ${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Execution error: ${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
});

// 3. Check connectivity (Ping)
btnCheckConnectivity.addEventListener("click", async () => {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    setBulkControlsLock(true);
    showStatus(`Pinging 8.8.8.8 from ${targets.length} device(s) to verify connectivity...`, "info");

    try {
        const result = await window.api.bulkCheckConnectivity(targets);
        if (result.success) {
            let successCount = 0;
            let msg = "Internet Connectivity Diagnosis Report:\n\n";

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: ${res.status}\n`;
                    logDeployment(res.deviceId, "Check Connectivity", res.status, true);
                } else {
                    msg += `✗ ${deviceLabel}: Offline (${res.status || res.error})\n`;
                    logDeployment(res.deviceId, "Check Connectivity", `Failed: ${res.status || res.error}`, false);
                }
            });
            showStatus(msg, successCount === targets.length ? "success" : "info");
        } else {
            showStatus(`Diagnostics failed: ${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Execution error: ${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
});

// 4. Open Developer Options screen
btnOpenDevOptions.addEventListener("click", async () => {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    setBulkControlsLock(true);
    showStatus(`Opening Developer Options settings screen on ${targets.length} device(s)...`, "info");

    try {
        const result = await window.api.bulkOpenDevOptions(targets);
        if (result.success) {
            let successCount = 0;
            let msg = "Developer Options Screen Launch Report:\n\n";

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: Settings Screen Opened\n`;
                    logDeployment(res.deviceId, "Open Settings", "Developer Options activity launched", true);
                } else {
                    msg += `✗ ${deviceLabel}: Failed (${res.error})\n`;
                    logDeployment(res.deviceId, "Open Settings", `Failed: ${res.error}`, false);
                }
            });
            showStatus(msg, successCount === targets.length ? "success" : "info");
        } else {
            showStatus(`Operation failed: ${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Execution error: ${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
});

// Service menu click bindings
async function openBulkServiceMenu(menuType, label) {
    const targets = getSelectedTargetsOrWarn();
    if (!targets) return;

    setBulkControlsLock(true);
    showStatus(`Sending service menu command "${label}" to ${targets.length} device(s)...`, "info");

    try {
        const result = await window.api.bulkServiceMenu(targets, menuType);
        if (result.success) {
            let successCount = 0;
            let msg = `${label} sequence simulated!\n\n`;

            result.results.forEach(res => {
                const deviceLabel = connectedDevices.find(d => d.id === res.deviceId)?.name || res.deviceId;
                if (res.success) {
                    successCount++;
                    msg += `✓ ${deviceLabel}: Success\n`;
                    logDeployment(res.deviceId, "Service Menu", `${label} simulated`, true);
                } else {
                    msg += `✗ ${deviceLabel}: Failed (${res.error})\n`;
                    logDeployment(res.deviceId, "Service Menu", `Failed: ${res.error}`, false);
                }
            });
            showStatus(msg, successCount === targets.length ? "success" : "info");
        } else {
            showStatus(`Operation failed: ${result.error}`, "error");
        }
    } catch (err) {
        showStatus(`Execution error: ${err.message || err}`, "error");
    } finally {
        setBulkControlsLock(false);
    }
}

btnServiceMenuGTV.addEventListener("click", () => openBulkServiceMenu("gtv", "Google TV Service Menu"));
btnServiceMenuSmartA.addEventListener("click", () => openBulkServiceMenu("smarta", "Smart TV Menu A (8814)"));
btnServiceMenuSmartB.addEventListener("click", () => openBulkServiceMenu("smartb", "Smart TV Menu B (208)"));

// --- DEVICE FILE MANAGER TAB ---

// Enable/Disable toolbar controls based on active selection
function setFileManagerControlsEnabled(enabled) {
    fileManagerUpBtn.disabled = !enabled;
    fileManagerRefreshBtn.disabled = !enabled;
    fileManagerMkdirBtn.disabled = !enabled;
    fileManagerUploadBtn.disabled = !enabled;
}

function renderFilesEmpty(message) {
    fileManagerBody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                ${message}
            </td>
        </tr>
    `;
}

// Load files list from device
async function loadFilesList() {
    if (!activeFileManagerDevice) {
        renderFilesEmpty("Select a connected TV device from the dropdown to browse its storage.");
        setFileManagerControlsEnabled(false);
        return;
    }

    setFileManagerControlsEnabled(false);
    fileManagerBody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; color: var(--primary); padding: 30px 0;">
                <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Reading TV directories...
            </td>
        </tr>
    `;

    try {
        const result = await window.api.fileManagerList(activeFileManagerDevice, currentPath);
        if (result.success) {
            setFileManagerControlsEnabled(true);

            // Enable/disable UP button based on root
            fileManagerUpBtn.disabled = currentPath === "" || currentPath === "/";

            if (result.items.length === 0) {
                renderFilesEmpty("This directory is empty.");
                return;
            }

            // Render files list
            fileManagerBody.innerHTML = result.items.map(item => {
                const icon = item.isDir ? "fa-folder" : "fa-file";
                const iconColor = item.isDir ? "#f59e0b" : "#94a3b8";
                const sizeLabel = item.isDir ? "--" : formatBytes(item.size);

                const trClass = item.isDir ? "style='cursor: pointer; font-weight: 500;'" : "";
                const dbClickAttr = item.isDir ? `navigateFolder('${item.name}')` : "";

                return `
                    <tr ${trClass}>
                        <td class="file-name-cell" ${item.isDir ? `ondblclick="${dbClickAttr}"` : ""}>
                            <i class="fa-solid ${icon}" style="color: ${iconColor}; margin-right: 8px;"></i>
                            <span class="file-name-text">${item.name}</span>
                        </td>
                        <td>${item.isDir ? 'Folder' : 'File'}</td>
                        <td>${sizeLabel}</td>
                        <td class="progress-time">${item.date}</td>
                        <td class="file-actions-cell" style="text-align: right;">
                            <button class="btn btn-secondary discovery-small-btn" onclick="window.startRenameFileManagerItem('${item.name}', ${item.isDir}, this)" title="Rename"><i class="fa-solid fa-pen"></i></button>
                            ${!item.isDir ? `<button class="btn btn-secondary discovery-small-btn" onclick="downloadFileManagerFile('${item.name}')" title="Download"><i class="fa-solid fa-download"></i></button>` : ''}
                            <button class="btn btn-danger discovery-small-btn" onclick="deleteFileManagerItem('${item.name}', ${item.isDir})" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            }).join("");
        } else {
            renderFilesEmpty(`Error reading folder: ${result.error}`);
            setFileManagerControlsEnabled(true);
            fileManagerUpBtn.disabled = currentPath === "" || currentPath === "/";
        }
    } catch (err) {
        renderFilesEmpty(`Read error: ${err.message || err}`);
        setFileManagerControlsEnabled(true);
    }
}

// Navigation helpers exposed globally so ondblclick can trigger them
window.navigateFolder = function (folderName) {
    // Remove double slashes
    if (currentPath === "/") {
        currentPath = "/" + folderName;
    } else {
        currentPath = currentPath + "/" + folderName;
    }
    fileManagerPathInput.value = currentPath;
    loadFilesList();
};

// Back Up Navigation
fileManagerUpBtn.addEventListener("click", () => {
    if (currentPath === "" || currentPath === "/") return;

    const parts = currentPath.split("/");
    parts.pop();
    currentPath = parts.join("/") || "/";
    fileManagerPathInput.value = currentPath;
    loadFilesList();
});

// Dropdown selector
fileManagerDeviceSelect.addEventListener("change", (e) => {
    activeFileManagerDevice = e.target.value;
    currentPath = "/sdcard";
    fileManagerPathInput.value = currentPath;
    loadFilesList();
});

// Refresh button
fileManagerRefreshBtn.addEventListener("click", loadFilesList);

// Create Folder mkdir
fileManagerMkdirBtn.addEventListener("click", async () => {
    if (!activeFileManagerDevice) return;
    
    // Auto generate a unique default folder name
    let baseName = "New_Folder";
    let folderName = baseName;
    let counter = 1;
    
    const existingNames = Array.from(fileManagerBody.querySelectorAll(".file-name-text"))
        .map(el => el.textContent.trim());
        
    while (existingNames.includes(folderName)) {
        folderName = `${baseName}_${counter}`;
        counter++;
    }

    showStatus("Creating directory...", "info");
    const targetFolder = currentPath === "/" ? `/${folderName}` : `${currentPath}/${folderName}`;

    try {
        const res = await window.api.fileManagerMkdir(activeFileManagerDevice, targetFolder);
        if (res.success) {
            await loadFilesList();
            
            // Auto open the rename edit mode for the newly created folder
            setTimeout(() => {
                const rows = Array.from(fileManagerBody.querySelectorAll("tr"));
                const newRow = rows.find(r => {
                    const txtEl = r.querySelector(".file-name-text");
                    return txtEl && txtEl.textContent.trim() === folderName;
                });
                if (newRow) {
                    const renameBtn = newRow.querySelector(".file-actions-cell button");
                    if (renameBtn) renameBtn.click();
                }
            }, 150);
        } else {
            alert(`Mkdir failed: ${res.error}`);
        }
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
});

// Upload File
fileManagerUploadBtn.addEventListener("click", async () => {
    if (!activeFileManagerDevice) return;

    fileManagerUploadBtn.disabled = true;
    try {
        const result = await window.api.fileManagerUpload(activeFileManagerDevice, currentPath);
        if (result.success) {
            const msg = result.total > 1 
                ? `Successfully uploaded ${result.uploaded} of ${result.total} files!`
                : `File uploaded successfully!`;
            alert(msg);
            loadFilesList();
        } else if (!result.error.includes("cancelled")) {
            alert(`Upload failed: ${result.error}`);
        }
    } catch (err) {
        alert(`Upload error: ${err.message}`);
    } finally {
        fileManagerUploadBtn.disabled = false;
    }
});

// Download File (Global handler)
window.downloadFileManagerFile = async function (fileName) {
    if (!activeFileManagerDevice) return;
    const remotePath = currentPath === "/" ? `/${fileName}` : `${currentPath}/${fileName}`;

    try {
        const res = await window.api.fileManagerDownload(activeFileManagerDevice, remotePath);
        if (res.success) {
            alert(`File downloaded successfully!`);
        } else if (!res.error.includes("cancelled")) {
            alert(`Download failed: ${res.error}`);
        }
    } catch (err) {
        alert(`Download error: ${err.message}`);
    }
};

// Delete File/Folder (Global handler)
window.deleteFileManagerItem = async function (itemName, isDir) {
    if (!activeFileManagerDevice) return;
    const targetPath = currentPath === "/" ? `/${itemName}` : `${currentPath}/${itemName}`;

    if (!confirm(`Are you sure you want to delete this ${isDir ? 'folder' : 'file'}?\nPath: ${targetPath}`)) {
        return;
    }

    try {
        const res = await window.api.fileManagerDelete(activeFileManagerDevice, targetPath, isDir);
        if (res.success) {
            loadFilesList();
        } else {
            alert(`Delete failed: ${res.error}`);
        }
    } catch (err) {
        alert(`Delete error: ${err.message}`);
    }
};

// Rename File/Folder (Global handler - Inline Edit start)
window.startRenameFileManagerItem = function (itemName, isDir, btn) {
    const row = btn.closest("tr");
    const nameCell = row.querySelector(".file-name-cell");
    const actionsCell = row.querySelector(".file-actions-cell");
    
    const icon = isDir ? "fa-folder" : "fa-file";
    const iconColor = isDir ? "#f59e0b" : "#94a3b8";

    // Disable double click handler temporarily during edit
    nameCell.removeAttribute("ondblclick");

    nameCell.innerHTML = `
        <i class="fa-solid ${icon}" style="color: ${iconColor}; margin-right: 8px;"></i>
        <input type="text" class="rename-input" value="${itemName}" style="padding: 4px 8px; font-size: 13px; border-radius: 4px; border: 1px solid var(--primary); background: #ffffff; color: #000000; width: 70%; outline: none; font-weight: 500;">
    `;
    
    const input = nameCell.querySelector(".rename-input");
    input.focus();
    input.select();
    
    // Handle Enter to Save, Escape to Cancel
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            window.saveRenameFileManagerItem(itemName, input.value, isDir);
        } else if (e.key === "Escape") {
            loadFilesList();
        }
    });

    // Replace actions cell with Save and Cancel buttons
    actionsCell.innerHTML = `
        <button class="btn btn-success discovery-small-btn" onclick="window.saveRenameFileManagerItem('${itemName}', this.closest('tr').querySelector('.rename-input').value, ${isDir})" title="Save"><i class="fa-solid fa-check"></i> Save</button>
        <button class="btn btn-secondary discovery-small-btn" onclick="loadFilesList()" title="Cancel"><i class="fa-solid fa-xmark"></i> Cancel</button>
    `;
};

// Rename File/Folder (Global handler - Inline Edit save)
window.saveRenameFileManagerItem = async function (oldName, newName, isDir) {
    if (!activeFileManagerDevice) return;
    if (!newName || !newName.trim() || newName.trim() === oldName) {
        loadFilesList();
        return;
    }

    const oldPath = currentPath === "/" ? `/${oldName}` : `${currentPath}/${oldName}`;
    const newPath = currentPath === "/" ? `/${newName.trim()}` : `${currentPath}/${newName.trim()}`;

    try {
        const res = await window.api.fileManagerRename(activeFileManagerDevice, oldPath, newPath);
        if (res.success) {
            loadFilesList();
        } else {
            alert(`Rename failed: ${res.error}`);
            loadFilesList();
        }
    } catch (err) {
        alert(`Rename error: ${err.message}`);
        loadFilesList();
    }
};

// Formats file sizes
function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// --- INSTALLED APPLICATIONS TAB ---

function setAppsManagerControlsEnabled(enabled) {
    appsSearchInput.disabled = !enabled;
    appsRefreshBtn.disabled = !enabled;
    appsBulkUninstallBtn.disabled = !enabled;
    appsSelectAllCheck.disabled = !enabled;
}

function renderAppsEmpty(message) {
    appsBody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                ${message}
            </td>
        </tr>
    `;
}

// Fetch applications package list
async function loadAppsList() {
    if (!activeAppsDevice) {
        renderAppsEmpty("Select a connected TV device from the dropdown to list its applications.");
        setAppsManagerControlsEnabled(false);
        return;
    }

    setAppsManagerControlsEnabled(false);
    appsSelectAllCheck.checked = false;
    appsBody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: center; color: var(--primary); padding: 30px 0;">
                <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Loading package registry from TV...
            </td>
        </tr>
    `;

    try {
        const result = await window.api.appsList(activeAppsDevice);
        if (result.success) {
            installedAppsList = result.apps;
            setAppsManagerControlsEnabled(true);
            renderAppsRows(installedAppsList);
        } else {
            renderAppsEmpty(`Error listing apps: ${result.error}`);
            setAppsManagerControlsEnabled(true);
        }
    } catch (err) {
        renderAppsEmpty(`Apps load error: ${err.message || err}`);
        setAppsManagerControlsEnabled(true);
    }
}

// Render apps table rows
function renderAppsRows(apps) {
    if (apps.length === 0) {
        renderAppsEmpty("No packages match your search filter.");
        return;
    }

    appsBody.innerHTML = apps.map(app => {
        return `
            <tr>
                <td style="text-align: center;">
                    <input type="checkbox" class="app-row-check" data-pkg="${app.packageName}">
                </td>
                <td><strong>${app.friendlyName}</strong></td>
                <td style="font-family: monospace; font-size: 12px; color: var(--text-muted);">${app.packageName}</td>
                <td style="text-align: right; display: flex;">
                    <button class="btn btn-warning discovery-small-btn" onclick="disableSingleApp('${app.packageName}')" style="margin-right: 5px;">
                        <i class="fa-solid fa-ban"></i> Disable
                    </button>
                    <button class="btn btn-danger discovery-small-btn" onclick="uninstallSingleApp('${app.packageName}')">
                        <i class="fa-solid fa-trash"></i> Uninstall
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    // Bind checkboxes to check state logic
    const rowChecks = appsBody.querySelectorAll(".app-row-check");
    rowChecks.forEach(ch => {
        ch.addEventListener("change", () => {
            // If all checks are checked, set parent check to checked
            const allChecked = Array.from(rowChecks).every(c => c.checked);
            appsSelectAllCheck.checked = allChecked;
        });
    });
}

// Dropdown Selector Apps
appsDeviceSelect.addEventListener("change", (e) => {
    activeAppsDevice = e.target.value;
    appsSearchInput.value = "";
    loadAppsList();
});

// Refresh Apps Button
appsRefreshBtn.addEventListener("click", loadAppsList);

// App Search input binding
appsSearchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
        renderAppsRows(installedAppsList);
        return;
    }

    const filtered = installedAppsList.filter(app => {
        return app.packageName.toLowerCase().includes(query) || app.friendlyName.toLowerCase().includes(query);
    });
    renderAppsRows(filtered);
});

// Package Selection Header check
appsSelectAllCheck.addEventListener("change", (e) => {
    const checks = appsBody.querySelectorAll(".app-row-check");
    checks.forEach(ch => {
        ch.checked = e.target.checked;
    });
});

// Uninstall Single App
window.uninstallSingleApp = async function (packageName) {
    if (!activeAppsDevice) return;

    if (!confirm(`Are you sure you want to uninstall this application package from the TV?\nPackage: ${packageName}`)) {
        return;
    }

    setAppsManagerControlsEnabled(false);
    showStatus(`Uninstalling package ${packageName} from active TV...`, "info");

    try {
        const result = await window.api.appsUninstall(activeAppsDevice, packageName);
        if (result.success) {
            alert(result.message);
            loadAppsList();
        } else {
            alert(`Uninstall failed: ${result.error}`);
        }
    } catch (err) {
        alert(`Uninstall error: ${err.message}`);
    } finally {
        setAppsManagerControlsEnabled(true);
    }
};

// Disable Single App
window.disableSingleApp = async function (packageName) {
    if (!activeAppsDevice) return;

    if (!confirm(`Are you sure you want to DISABLE this application package on the TV?\nPackage: ${packageName}`)) {
        return;
    }

    setAppsManagerControlsEnabled(false);
    showStatus(`Disabling package ${packageName} on active TV...`, "info");

    try {
        const result = await window.api.appsDisable(activeAppsDevice, packageName);
        if (result.success) {
            alert(result.message);
            loadAppsList();
        } else {
            alert(`Disable failed: ${result.error}`);
        }
    } catch (err) {
        alert(`Disable error: ${err.message}`);
    } finally {
        setAppsManagerControlsEnabled(true);
    }
};

// Bulk Uninstall Checked Apps
appsBulkUninstallBtn.addEventListener("click", async () => {
    if (!activeAppsDevice) return;

    const checkedBoxes = appsBody.querySelectorAll(".app-row-check:checked");
    if (checkedBoxes.length === 0) {
        alert("Please select one or more application packages first.");
        return;
    }

    const packages = Array.from(checkedBoxes).map(ch => ch.getAttribute("data-pkg"));

    if (!confirm(`Are you sure you want to uninstall ALL ${packages.length} selected applications simultaneously?`)) {
        return;
    }

    setAppsManagerControlsEnabled(false);
    showStatus(`Uninstalling ${packages.length} packages in bulk...`, "info");

    try {
        // Run in parallel
        const results = await Promise.all(
            packages.map(async (pkg) => {
                try {
                    const r = await window.api.appsUninstall(activeAppsDevice, pkg);
                    return { pkg, success: r.success, error: r.error };
                } catch (e) {
                    return { pkg, success: false, error: String(e) };
                }
            })
        );

        let successCount = 0;
        let msg = "Uninstall Operation Completed:\n\n";
        results.forEach(res => {
            if (res.success) {
                successCount++;
                msg += `✓ ${res.pkg}: Uninstalled\n`;
            } else {
                msg += `✗ ${res.pkg}: Failed (${res.error})\n`;
            }
        });

        alert(msg);
        loadAppsList();
    } catch (err) {
        alert(`Bulk uninstall error: ${err.message}`);
    } finally {
    }
});

// --- EMBEDDED COMMAND PROMPT TERMINAL LOGIC ---

async function executeTerminalCommand() {
    const cmd = terminalInput.value.trim();
    if (!cmd) return;

    const targets = Array.from(selectedDeviceIds);
    if (targets.length === 0) {
        appendTerminalText(`\n$ ${cmd}\nError: No devices selected. Select one or more devices from the sidebar.`);
        return;
    }

    terminalInput.value = "";
    appendTerminalText(`\n$ ${cmd} (Executing on ${targets.length} device(s)...)`);

    try {
        const result = await window.api.runManualCommand(cmd, targets);
        if (result.success) {
            let output = "";
            result.results.forEach(res => {
                const dev = connectedDevices.find(d => d.id === res.deviceId);
                const devLabel = dev ? dev.name : res.deviceId;
                output += `\n[${devLabel}]:\n`;
                if (res.success) {
                    output += res.stdout || "(No output)\n";
                } else {
                    output += `Error: ${res.stderr || res.error || "Execution failed."}\n`;
                }
            });
            appendTerminalText(output);
        } else {
            appendTerminalText(`Error: ${result.error}`);
        }
    } catch (err) {
        appendTerminalText(`Execution Error: ${err.message || err}`);
    }
}

function appendTerminalText(text) {
    terminalOutput.textContent += "\n" + text;
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

terminalSendBtn.addEventListener("click", executeTerminalCommand);
terminalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        executeTerminalCommand();
    }
});

// --- CUSTOM CENTER ALERT POPUP SYSTEM ---
const customAlertOverlay = document.getElementById("customAlertOverlay");
const customAlertBox = document.getElementById("customAlertBox");
const customAlertIcon = document.getElementById("customAlertIcon");
const customAlertTitle = document.getElementById("customAlertTitle");
const customAlertMessage = document.getElementById("customAlertMessage");
const customAlertCloseBtn = document.getElementById("customAlertCloseBtn");

let customAlertTimeout = null;

function showCustomAlert(title, message, type = "success") {
    if (!customAlertOverlay || !customAlertBox) return;

    // Clear any active auto-dismiss timer
    if (customAlertTimeout) {
        clearTimeout(customAlertTimeout);
        customAlertTimeout = null;
    }

    // Set content
    customAlertTitle.textContent = title;
    customAlertMessage.textContent = message;

    // Set icon based on type
    let iconClass = "fa-solid fa-circle-check"; // success default
    if (type === "error") {
        iconClass = "fa-solid fa-circle-xmark";
    } else if (type === "warning") {
        iconClass = "fa-solid fa-circle-exclamation";
    } else if (type === "info") {
        iconClass = "fa-solid fa-circle-info";
    }
    customAlertIcon.innerHTML = `<i class="${iconClass}"></i>`;

    // Reset theme classes
    customAlertBox.className = "custom-alert-box " + type;

    // Show popup
    customAlertOverlay.classList.add("show");

    // Auto-dismiss after 3.5 seconds
    customAlertTimeout = setTimeout(() => {
        closeCustomAlert();
    }, 3500);
}

function closeCustomAlert() {
    if (customAlertOverlay) {
        customAlertOverlay.classList.remove("show");
    }
    if (customAlertTimeout) {
        clearTimeout(customAlertTimeout);
        customAlertTimeout = null;
    }
}

if (customAlertCloseBtn) {
    customAlertCloseBtn.addEventListener("click", closeCustomAlert);
}
if (customAlertOverlay) {
    customAlertOverlay.addEventListener("click", (e) => {
        if (e.target === customAlertOverlay) {
            closeCustomAlert();
        }
    });
}

// Override standard window.alert to use our custom center popup
const originalAlert = window.alert;
window.alert = function (message) {
    let title = "Notification";
    let type = "info";
    
    if (typeof message !== "string") {
        message = String(message);
    }
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("success") || lowerMsg.includes("completed") || lowerMsg.includes("done") || lowerMsg.includes("optimized") || lowerMsg.includes("installed") || lowerMsg.includes("uploaded")) {
        title = "Success";
        type = "success";
    } else if (lowerMsg.includes("fail") || lowerMsg.includes("error") || lowerMsg.includes("could not") || lowerMsg.includes("cancelled")) {
        title = "Error";
        type = "error";
    } else if (lowerMsg.includes("warn") || lowerMsg.includes("attention")) {
        title = "Warning";
        type = "warning";
    }
    
    showCustomAlert(title, message, type);
};

// --- OTHER SETUP TAB STATE & BEHAVIOR ---
const setupChecklistItems = document.getElementById("setupChecklistItems");
const checklistProgressText = document.getElementById("checklistProgressText");
const checklistProgressBar = document.getElementById("checklistProgressBar");
const resetChecklistBtn = document.getElementById("resetChecklistBtn");

function initChecklist() {
    if (!setupChecklistItems) return;

    // Load initial state from localStorage
    const savedState = JSON.parse(localStorage.getItem("signageChecklistState")) || {};

    const checkboxes = setupChecklistItems.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(cb => {
        const id = cb.id;
        
        // Restore check state
        if (savedState[id]) {
            cb.checked = true;
            cb.closest(".checklist-item").classList.add("checked");
        } else {
            cb.checked = false;
            cb.closest(".checklist-item").classList.remove("checked");
        }

        // Change handler on the checkbox
        cb.addEventListener("change", () => {
            const itemContainer = cb.closest(".checklist-item");
            if (cb.checked) {
                itemContainer.classList.add("checked");
            } else {
                itemContainer.classList.remove("checked");
            }
            saveChecklistState();
            updateChecklistProgress();
        });

        // Click handler on the checklist item box itself (excluding the checkbox) to make it check/uncheck easily
        const itemContainer = cb.closest(".checklist-item");
        itemContainer.addEventListener("click", (e) => {
            if (e.target !== cb) {
                cb.checked = !cb.checked;
                // trigger change manually
                cb.dispatchEvent(new Event("change"));
            }
        });
    });

    updateChecklistProgress();
}

function saveChecklistState() {
    if (!setupChecklistItems) return;
    const checkboxes = setupChecklistItems.querySelectorAll("input[type='checkbox']");
    const state = {};
    checkboxes.forEach(cb => {
        state[cb.id] = cb.checked;
    });
    localStorage.setItem("signageChecklistState", JSON.stringify(state));
}

function updateChecklistProgress() {
    if (!setupChecklistItems || !checklistProgressText || !checklistProgressBar) return;

    const checkboxes = setupChecklistItems.querySelectorAll("input[type='checkbox']");
    const total = checkboxes.length;
    let checkedCount = 0;
    checkboxes.forEach(cb => {
        if (cb.checked) checkedCount++;
    });

    const percent = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
    checklistProgressText.textContent = `${percent}% (${checkedCount} of ${total} completed)`;
    checklistProgressBar.style.width = `${percent}%`;
}

if (resetChecklistBtn) {
    resetChecklistBtn.addEventListener("click", () => {
        if (window.confirm("Are you sure you want to reset the setup checklist progress?")) {
            const checkboxes = setupChecklistItems.querySelectorAll("input[type='checkbox']");
            checkboxes.forEach(cb => {
                cb.checked = false;
                cb.closest(".checklist-item").classList.remove("checked");
            });
            saveChecklistState();
            updateChecklistProgress();
            showCustomAlert("Checklist Reset", "All checklist progress has been cleared.", "info");
        }
    });
}

// Factory Menu Copy Buttons functionality
function initFactoryCodeCopyButtons() {
    const copyButtons = document.querySelectorAll(".copy-code-btn");
    copyButtons.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation(); // prevent parent clicks if any
            const sequence = btn.getAttribute("data-clipboard");
            const modelName = btn.closest(".factory-code-card").querySelector(".tv-model").textContent;

            try {
                await navigator.clipboard.writeText(sequence);
                
                // Show micro-animation feedback on button
                const originalHTML = btn.innerHTML;
                btn.innerHTML = `<i class="fa-solid fa-check" style="color: var(--success);"></i> Copied`;
                btn.classList.add("btn-success");
                btn.classList.remove("btn-secondary");

                // Trigger beautiful popup success alert
                showCustomAlert("Copied to Clipboard", `Factory code for ${modelName} copied: "${sequence}"`, "success");

                // Restore button state after 1.5 seconds
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.classList.remove("btn-success");
                    btn.classList.add("btn-secondary");
                }, 1500);

            } catch (err) {
                console.error("Clipboard copy failed:", err);
                showCustomAlert("Copy Failed", "Failed to copy sequence to clipboard.", "error");
            }
        });
    });
}