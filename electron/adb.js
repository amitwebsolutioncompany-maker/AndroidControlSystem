const { exec, spawn } = require("child_process");
const os = require("os");

// Helper to run shell commands as a Promise
function runShell(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: stderr || err.message, stdout });
      } else {
        resolve({ success: true, stdout, stderr });
      }
    });
  });
}

// Prefix commands with adb -s DEVICE_ID if deviceId is provided
function runAdb(deviceId, command) {
  const prefix = deviceId ? `adb -s "${deviceId}" ` : "adb ";
  return runShell(prefix + command);
}

// Pair device via Wi-Fi TLS (uses spawn for interactive input)
function pairDevice(ipport, code) {
  return new Promise((resolve) => {
    if (!ipport || !code) {
      resolve({ success: false, error: "IP:Port and Pairing Code are required." });
      return;
    }
    try {
      const adb = spawn("adb", ["pair", ipport]);
      let output = "";

      adb.on("error", (err) => {
        resolve({ success: false, error: `ADB command not found or not setup. Please click 'Setup ADB (One-Click)' first. Details: ${err.message}` });
      });

      adb.stdout.on("data", (data) => { output += data.toString(); });
      adb.stderr.on("data", (data) => { output += data.toString(); });

      // Write the 6-digit code to stdin and press enter
      adb.stdin.write(code + "\n");

      adb.on("close", (codeExit) => {
        const isSuccess = codeExit === 0 || output.includes("Successfully paired");
        if (isSuccess) {
          resolve({ success: true, message: output.trim() || "Paired successfully!" });
        } else {
          resolve({ success: false, error: output.trim() || `Pairing failed (Exit code: ${codeExit})` });
        }
      });
    } catch (err) {
      resolve({ success: false, error: err.message || String(err) });
    }
  });
}

// Connect device via Wi-Fi
async function connectWifi(ip) {
  if (!ip) {
    return { success: false, error: "No IP address provided." };
  }
  const target = ip.includes(":") ? ip : `${ip}:5555`;
  const res = await runShell(`adb connect ${target}`);
  if (res.success && (res.stdout.includes("connected to") || res.stdout.includes("already connected"))) {
    return { success: true, message: res.stdout.trim() };
  } else {
    return { success: false, error: res.stdout.trim() || res.error || "Failed to connect." };
  }
}

// Check for USB devices (non-device-specific)
async function checkUsb() {
  const res = await runShell("adb devices");
  if (!res.success) {
    return { success: false, error: res.error || "Failed to run adb devices." };
  }

  const lines = res.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const devices = [];

  for (const line of lines.slice(1)) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2 && parts[1] === "device") {
      devices.push(parts[0]);
    }
  }

  const usbDevices = devices.filter(d => !d.includes(":"));
  if (usbDevices.length > 0) {
    return {
      success: true,
      message: `Detected ${usbDevices.length} USB device(s): ${usbDevices.join(", ")}`,
      devices: usbDevices
    };
  } else {
    return { success: false, message: "No USB devices detected. Make sure USB debugging is enabled on the device." };
  }
}

// Get connected devices list with details (USB/Wi-Fi connection type, model, online status)
async function getConnectedDevicesWithDetails() {
  const res = await runShell("adb devices -l");
  if (!res.success) {
    return [];
  }
  const lines = res.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const devices = [];

  for (const line of lines.slice(1)) {
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    const id = parts[0];
    const adbStatus = parts[1];
    let status = "Offline";
    if (adbStatus === "device") {
      status = "Online";
    } else if (adbStatus === "unauthorized") {
      status = "Unauthorized";
    } else if (adbStatus === "offline") {
      status = "Offline";
    }

    let model = "";
    let product = "";
    for (const part of parts.slice(2)) {
      if (part.startsWith("model:")) {
        model = part.substring(6).replace(/_/g, ' ');
      }
      if (part.startsWith("product:")) {
        product = part.substring(8).replace(/_/g, ' ');
      }
    }

    const type = (id.includes(":") || id.startsWith("adb-")) ? "Wi-Fi" : "USB";
    let name = model || product || id;
    if (name !== id) {
      name = `${name} (${id})`;
    }

    devices.push({
      id,
      name,
      type,
      status
    });
  }
  return devices;
}

// Install APK on specific connected device
async function installApkOnDevice(deviceId, apkPath) {
  if (!apkPath) {
    return { success: false, error: "No APK path provided." };
  }
  const res = await runAdb(deviceId, `install -r "${apkPath}"`);
  if (res.success && res.stdout.includes("Success")) {
    return { success: true, message: "Successfully installed APK." };
  } else {
    return { success: false, error: res.stdout.trim() || res.error || "Installation failed." };
  }
}

// Push files to specific device destination
async function pushFilesToDevice(deviceId, paths, dest = "/sdcard/") {
  const path = require("path");
  const results = [];
  for (const filePath of paths) {
    const filename = path.basename(filePath);
    const res = await runAdb(deviceId, `push "${filePath}" "${dest}"`);
    if (res.success) {
      results.push({ file: filename, status: "Success" });
    } else {
      results.push({ file: filename, status: "Failed", error: res.error || res.stdout });
    }
  }
  return { success: true, results };
}

// Remove bloatware (disable-user) and optimize settings on specific device
async function cleanupDevice(deviceId) {
  const disablePackagesList = [
    "tv.cloudwalker.updater",
    "com.cvte.tv.systemupgrade",
    "tv.cloudwalker.inputserver",
    "tv.cloudwalker.market",
    "tv.cloudwalker.profile",
    "tv.cloudwalker.voice",
    "tv.cloudwalker.player",
    "tv.cloudwalker.guide",
    "com.stark.store",
    "com.seraphic.openinet.cvte",
  ];

  const optimizationCommands = [
    "settings put global ota_disable_automatic_update 1",
    "settings put global auto_update_apps 0",
    "settings put global auto_update_system 0",
    "settings put global heads_up_notifications_enabled 0",
    "settings put secure show_notification_snooze 0",
    "settings put global heads_up_off 1",
    "settings put system screen_off_timeout 2147483647",
    "settings put secure screensaver_enabled 0",
    "settings put secure screensaver_activate_on_sleep 0",
    "settings put secure screensaver_activate_on_dock 0",
    "settings put global stay_on_while_plugged_in 3",
    "settings put global low_power 0",
    "svc power stayon true",
    "settings put secure sleep_timeout -1"
  ];

  const results = [];

  // Disable bloatware packages
  for (const pkg of disablePackagesList) {
    const res = await runAdb(deviceId, `shell pm disable-user --user 0 ${pkg}`);
    results.push({
      item: `Disable ${pkg}`,
      status: res.success && (res.stdout.includes("new state") || res.stdout.includes("disabled")) ? "Success" : "Already Disabled / Skipped"
    });
  }

  // Run optimizations (reboot, screensaver timeouts, sleep overrides)
  for (const cmd of optimizationCommands) {
    const res = await runAdb(deviceId, `shell ${cmd}`);
    results.push({
      item: `Optimize: ${cmd.substring(0, 30)}...`,
      status: res.success ? "Success" : "Failed"
    });
  }

  return { success: true, results };
}

// Set orientation on specific device (0: Portrait, 1: Landscape, 2: Rev Portrait, 3: Rev Land)
async function rotateScreenOnDevice(deviceId, mode) {
  const res = await runAdb(deviceId, `shell "settings put system accelerometer_rotation 0 && settings put system user_rotation ${mode}"`);
  if (res.success) {
    const modes = ["Portrait (0°)", "Landscape (90°)", "Reverse Portrait (180°)", "Reverse Landscape (270°)"];
    return { success: true, message: `Orientation set to: ${modes[mode] || mode}` };
  } else {
    return { success: false, error: res.error || "Failed to set screen rotation." };
  }
}

// Reboot specific device
async function rebootDevice(deviceId) {
  const res = await runAdb(deviceId, "reboot");
  if (res.success) {
    return { success: true, message: "Reboot command sent to device." };
  } else {
    return { success: false, error: res.error || "Failed to send reboot command." };
  }
}

// --- Device File Manager Helpers ---

// List files on device at path
async function listFiles(deviceId, remotePath) {
  const targetPath = remotePath || "/sdcard/";
  const res = await runAdb(deviceId, `shell ls -la "${targetPath}"`);
  if (!res.success) {
    return { success: false, error: res.error || res.stdout || "Failed to list directories." };
  }

  // Reuse parse logic from previous turn
  const lines = res.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];

  for (const line of lines) {
    if (line.startsWith("total ")) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 8) continue;

    const perms = parts[0];
    const isDir = perms.startsWith('d');
    const isLink = perms.startsWith('l');

    const size = parseInt(parts[4], 10) || 0;
    const dateStr = `${parts[5]} ${parts[6]}`;

    let name = parts.slice(7).join(" ");

    if (isLink && name.includes(" -> ")) {
      name = name.split(" -> ")[0];
    }

    if (name === "." || name === "..") continue;

    items.push({
      name,
      isDir: isDir || isLink,
      size,
      date: dateStr
    });
  }

  return { success: true, items };
}

// Delete file/folder on device
async function deletePath(deviceId, remotePath, isDir) {
  const cmd = isDir ? `shell rm -rf "${remotePath}"` : `shell rm -f "${remotePath}"`;
  const res = await runAdb(deviceId, cmd);
  if (res.success) {
    return { success: true, message: "Deleted successfully." };
  } else {
    return { success: false, error: res.error || res.stdout || "Delete operation failed." };
  }
}

// Rename/move file/folder on device
async function renamePath(deviceId, oldPath, newPath) {
  const res = await runAdb(deviceId, `shell mv "${oldPath}" "${newPath}"`);
  if (res.success) {
    return { success: true, message: "Renamed/moved successfully." };
  } else {
    return { success: false, error: res.error || res.stdout || "Rename operation failed." };
  }
}

// Create directory on device
async function createFolder(deviceId, remotePath) {
  const res = await runAdb(deviceId, `shell mkdir -p "${remotePath}"`);
  if (res.success) {
    return { success: true, message: "Folder created successfully." };
  } else {
    return { success: false, error: res.error || res.stdout || "Failed to create directory." };
  }
}

// Pull (download) file from device
async function pullFile(deviceId, remotePath, localDest) {
  const res = await runAdb(deviceId, `pull "${remotePath}" "${localDest}"`);
  if (res.success) {
    return { success: true, message: "Downloaded file successfully." };
  } else {
    return { success: false, error: res.error || res.stdout || "Failed to pull file." };
  }
}

// Push (upload) file to device
async function pushFile(deviceId, localPath, remoteDest) {
  const res = await runAdb(deviceId, `push "${localPath}" "${remoteDest}"`);
  if (res.success) {
    return { success: true, message: "Uploaded file successfully." };
  } else {
    return { success: false, error: res.error || res.stdout || "Failed to push file." };
  }
}

// --- Apps Manager Helpers ---

// Generate friendly reader-friendly app name from packages
function getFriendlyAppName(packageName) {
  const knownApps = {
    "com.cxinventor.file.explorer": "Cx File Explorer",
    "com.digitalsignage.app.qa": "Digital Signage QA",
    "com.nvaplayerpc": "NVA Player PC",
    "com.signageplayertv": "Signage Player TV",
    "tv.cloudwalker.player": "Cloudwalker Player",
    "tv.cloudwalker.market": "Cloudwalker Market",
    "com.phlox.tvwebbrowser": "TVBro Web Browser",
    "in.startv.hotstar": "Hotstar",
    "com.google.android.youtube.tv": "YouTube TV",
    "com.netflix.ninja": "Netflix",
    "com.amazon.amazonvideo.livingroom": "Amazon Prime Video",
    "tv.cloudwalker.neonlauncher.com": "Cloudwalker Neon Launcher"
  };

  if (knownApps[packageName]) {
    return knownApps[packageName];
  }

  const parts = packageName.split('.');
  let lastPart = parts[parts.length - 1];
  if (lastPart === "tv" || lastPart === "android" || lastPart === "app") {
    lastPart = parts[parts.length - 2] || lastPart;
  }

  return lastPart
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// List packages installed on device
async function listApps(deviceId) {
  const res = await runAdb(deviceId, "shell pm list packages");
  if (!res.success) {
    return { success: false, error: res.error || res.stdout || "Failed to list packages." };
  }
  const lines = res.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const apps = [];
  for (const line of lines) {
    if (line.startsWith("package:")) {
      const pkg = line.substring(8);
      apps.push({
        packageName: pkg,
        friendlyName: getFriendlyAppName(pkg)
      });
    }
  }
  apps.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));
  return { success: true, apps };
}

// Uninstall package from device
async function uninstallApp(deviceId, packageName) {
  const res = await runAdb(deviceId, `shell pm uninstall --user 0 ${packageName}`);
  if (res.success && res.stdout.includes("Success")) {
    return { success: true, message: `Successfully uninstalled ${packageName}` };
  } else {
    return { success: false, error: res.stdout.trim() || res.error || "Uninstall failed." };
  }
}

// Disable package from device
async function disableApp(deviceId, packageName) {
  const res = await runAdb(deviceId, `shell pm disable-user --user 0 ${packageName}`);
  if (res.success && (res.stdout.includes("new state") || res.stdout.includes("disabled"))) {
    return { success: true, message: `Successfully disabled ${packageName}` };
  } else {
    return { success: false, error: res.stdout.trim() || res.error || "Disable failed." };
  }
}

// --- Setup and Manual Command Executors ---

// Auto Setup ADB platform tools (Windows)
function autoSetupADB() {
  if (os.platform() !== "win32") {
    return Promise.resolve({ success: false, error: "Auto ADB setup is supported only on Windows." });
  }

  const psScript = `
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$adbExists = Get-Command adb -ErrorAction SilentlyContinue
if ($adbExists) {
  Write-Output "ADB already installed at: $($adbExists.Source)"
  exit
}

$adbUrl = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
$zipPath = "$env:TEMP\\platform-tools.zip"
$installPath = "$env:USERPROFILE\\platform-tools"

Write-Output "Downloading ADB..."
Invoke-WebRequest -Uri $adbUrl -OutFile $zipPath

Write-Output "Extracting files to $installPath..."
Expand-Archive -Path $zipPath -DestinationPath $env:USERPROFILE -Force

$oldPath = [Environment]::GetEnvironmentVariable("Path","User")
if ($oldPath -notlike "*platform-tools*") {
  Write-Output "Adding platform-tools to USER PATH..."
  [Environment]::SetEnvironmentVariable("Path", "$oldPath;$installPath", "User")
}

Write-Output "Verifying installation..."
& "$installPath\\adb.exe" version
Write-Output "ADB setup completed successfully! Restarting client may be required."
`;

  const encoded = Buffer.from(psScript, "utf16le").toString("base64");

  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr || err.message });
        } else {
          resolve({ success: true, message: stdout.trim() });
        }
      }
    );
  });
}

// Run custom shell command (for Embedded Command Prompt)
function runManualCommand(command, deviceId) {
  let finalCommand = command.trim();
  if (deviceId) {
    if (finalCommand.startsWith("adb")) {
      if (!/\badb\s+-s\b/.test(finalCommand)) {
        finalCommand = finalCommand.replace(/^adb(\b)/, `adb -s "${deviceId}"$1`);
      }
    } else {
      finalCommand = `adb -s "${deviceId}" ${finalCommand}`;
    }
  }
  return new Promise((resolve) => {
    exec(finalCommand, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        stdout: stdout || "",
        stderr: stderr || (err ? err.message : "")
      });
    });
  });
}

// Start Screen Mirroring & Control using scrcpy
function startScrcpy(deviceId, deviceName) {
  return new Promise((resolve) => {
    const path = require("path");
    const fs = require("fs");
    const os = require("os");

    const scrcpyPath = path.join(os.homedir(), "scrcpy", "scrcpy.exe");
    const title = deviceName ? `Control - ${deviceName}` : `Control - ${deviceId}`;
    const args = ["--serial", deviceId, "--window-title", title, "--always-on-top"];

    const fileExists = fs.existsSync(scrcpyPath);

    console.log(`[scrcpy-launch] Resolved Path: ${scrcpyPath}`);
    console.log(`[scrcpy-launch] File Exists: ${fileExists}`);
    console.log(`[scrcpy-launch] Spawn Arguments: ${JSON.stringify(args)}`);

    if (!fileExists) {
      const errorMsg = `scrcpy.exe not found at ${scrcpyPath}. Please configure it first.`;
      console.error(`[scrcpy-launch] Error: ${errorMsg}`);
      resolve({ success: false, error: errorMsg });
      return;
    }

    try {
      const scrcpyProcess = spawn(scrcpyPath, args, {
        detached: true,
        stdio: "ignore"
      });

      scrcpyProcess.unref();

      scrcpyProcess.on("error", (err) => {
        console.error(`[scrcpy-launch] Spawn error: ${err.message}`);
        resolve({ success: false, error: `Could not launch scrcpy process. Detail: ${err.message}` });
      });

      setTimeout(() => {
        resolve({ success: true, message: `Screen control window launched.` });
      }, 450);
    } catch (err) {
      console.error(`[scrcpy-launch] Try-catch spawn error: ${err.message || err}`);
      resolve({ success: false, error: `Error spawning scrcpy: ${err.message || err}` });
    }
  });
}

// Auto Setup Scrcpy (Windows)
function autoSetupScrcpy() {
  if (os.platform() !== "win32") {
    return Promise.resolve({ success: false, error: "Auto setup is supported only on Windows." });
  }

  const psScript = `
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$installPath = "$env:USERPROFILE\\scrcpy"
$scrcpyExists = Get-Command scrcpy -ErrorAction SilentlyContinue
if ($scrcpyExists) {
  Write-Output "Scrcpy already installed at: $($scrcpyExists.Source)"
  exit
}

# If PATH is not set but folder exists, check if scrcpy.exe exists in that folder
$scrcpyExePath = Join-Path $installPath "scrcpy.exe"
if (Test-Path $scrcpyExePath) {
  $oldPath = [Environment]::GetEnvironmentVariable("Path","User")
  if ($oldPath -notlike "*scrcpy*") {
    [Environment]::SetEnvironmentVariable("Path", "$oldPath;$installPath", "User")
  }
  Write-Output "Scrcpy folder already exists. Registered to USER PATH."
  exit
}

# Clean up any failed extractions first
$tempExtracted = Get-ChildItem -Path $env:USERPROFILE -Filter "scrcpy-win64-*" | Select-Object -First 1
if ($tempExtracted) {
  Remove-Item -Path $tempExtracted.FullName -Recurse -Force
}
if (Test-Path $installPath) {
  Remove-Item -Path $installPath -Recurse -Force
}

$scrcpyUrl = "https://github.com/Genymobile/scrcpy/releases/download/v2.4/scrcpy-win64-v2.4.zip"
$zipPath = "$env:TEMP\\scrcpy.zip"

Write-Output "Downloading Scrcpy..."
Invoke-WebRequest -Uri $scrcpyUrl -OutFile $zipPath

Write-Output "Extracting files to $installPath..."
Expand-Archive -Path $zipPath -DestinationPath $env:USERPROFILE -Force

$extractedFolder = Get-ChildItem -Path $env:USERPROFILE -Filter "scrcpy-win64-*" | Select-Object -First 1
if ($extractedFolder) {
  Rename-Item -Path $extractedFolder.FullName -NewName "scrcpy" -Force
}

$oldPath = [Environment]::GetEnvironmentVariable("Path","User")
if ($oldPath -notlike "*scrcpy*") {
  [Environment]::SetEnvironmentVariable("Path", "$oldPath;$installPath", "User")
}

Write-Output "Verifying installation..."
& "$installPath\\scrcpy.exe" --version
Write-Output "Scrcpy setup completed successfully! Restarting client may be required."
`;

  const encoded = Buffer.from(psScript, "utf16le").toString("base64");

  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, error: stderr || err.message });
        } else {
          resolve({ success: true, message: stdout.trim() });
        }
      }
    );
  });
}

// Start ADB Server
async function startAdbServer() {
  const res = await runShell("adb start-server");
  if (res.success) {
    return { success: true, message: res.stdout.trim() || "ADB Server started successfully." };
  } else {
    return { success: false, error: res.error || "Failed to start ADB Server." };
  }
}

// Kill ADB Server
async function killAdbServer() {
  const res = await runShell("adb kill-server");
  if (res.success) {
    return { success: true, message: res.stdout.trim() || "ADB Server killed successfully." };
  } else {
    return { success: false, error: res.error || "Failed to kill ADB Server." };
  }
}

// Disconnect specific device
async function disconnectDevice(deviceId) {
  if (!deviceId) {
    return { success: false, error: "No Device ID provided." };
  }
  const res = await runShell(`adb disconnect ${deviceId}`);
  if (res.success) {
    return { success: true, message: res.stdout.trim() };
  } else {
    return { success: false, error: res.stdout.trim() || res.error || "Failed to disconnect device." };
  }
}

module.exports = {
  connectWifi,
  checkUsb,
  getConnectedDevicesWithDetails,
  installApkOnDevice,
  pushFilesToDevice,
  cleanupDevice,
  rotateScreenOnDevice,
  rebootDevice,
  listFiles,
  deletePath,
  renamePath,
  createFolder,
  pullFile,
  pushFile,
  listApps,
  uninstallApp,
  disableApp,
  pairDevice,
  autoSetupADB,
  runManualCommand,
  startScrcpy,
  autoSetupScrcpy,
  startAdbServer,
  killAdbServer,
  disconnectDevice
};