const { exec } = require("child_process");

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

// Remove bloatware and optimize settings on specific device
async function cleanupDevice(deviceId) {
  const bloatwareList = [
    "tv.cloudwalker.updater",
    "tv.cloudwalker.profile",
    "com.cvte.tv.systemupgrade",
    "tv.cloudwalker.inputserver",
    "tv.cloudwalker.voice",
    "tv.cloudwalker.player",
    "tv.cloudwalker.apiservice",
    "tv.cloudwalker.guide",
    "com.stark.store",
    "com.seraphic.openinet.cvte",
    "com.zeasn.services.general",
    "com.example.user.myapplication"
  ];

  const optimizationCommands = [
    "settings put global heads_up_notifications_enabled 0",
    "settings put secure show_notification_snooze 0",
    "settings put global heads_up_off 1",
    "settings put global auto_update_system 0",
    "settings put global ota_disable_automatic_update 1",
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

  for (const pkg of bloatwareList) {
    const res = await runAdb(deviceId, `shell pm uninstall --user 0 ${pkg}`);
    results.push({
      item: `Uninstall ${pkg}`,
      status: res.success && res.stdout.includes("Success") ? "Success" : "Already Removed / Skipped"
    });
  }

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

// Parse output lines of ls -la
function parseLsOutput(stdout) {
  const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
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
  return items;
}

// List files on device at path
async function listFiles(deviceId, remotePath) {
  const targetPath = remotePath || "/sdcard/";
  // Use -p to separate folders or parse the Toybox output
  const res = await runAdb(deviceId, `shell ls -la "${targetPath}"`);
  if (!res.success) {
    return { success: false, error: res.error || res.stdout || "Failed to list directories." };
  }
  const items = parseLsOutput(res.stdout);
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
  uninstallApp
};