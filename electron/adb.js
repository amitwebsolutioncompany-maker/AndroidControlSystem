const { exec } = require("child_process");

// Helper to run shell commands as a Promise
function runShell(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: stderr || err.message, stdout });
      } else {
        resolve({ success: true, stdout, stderr });
      }
    });
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

// Check for USB devices
async function checkUsb() {
  const res = await runShell("adb devices");
  if (!res.success) {
    return { success: false, error: res.error || "Failed to run adb devices." };
  }

  const lines = res.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const devices = [];
  
  // First line is header
  for (const line of lines.slice(1)) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2 && parts[1] === "device") {
      devices.push(parts[0]);
    }
  }

  // Filter out Wi-Fi IP connections (they contain colons)
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

// Remove bloatware and optimize settings for signage TV
async function cleanupDevice() {
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
    // Disable popups & notifications
    "settings put global heads_up_notifications_enabled 0",
    "settings put secure show_notification_snooze 0",
    "settings put global heads_up_off 1",
    "settings put global auto_update_system 0",
    "settings put global ota_disable_automatic_update 1",
    // Always on display and prevent sleep
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

  // 1. Uninstall bloatware
  for (const pkg of bloatwareList) {
    const res = await runShell(`adb shell pm uninstall --user 0 ${pkg}`);
    results.push({
      item: `Uninstall ${pkg}`,
      status: res.success && res.stdout.includes("Success") ? "Success" : "Already Removed / Skipped"
    });
  }

  // 2. Run optimizations
  for (const cmd of optimizationCommands) {
    const res = await runShell(`adb shell ${cmd}`);
    results.push({
      item: `Optimize: ${cmd.substring(0, 30)}...`,
      status: res.success ? "Success" : "Failed"
    });
  }

  return { success: true, results };
}

// Install APK on connected device
async function installApk(apkPath) {
  if (!apkPath) {
    return { success: false, error: "No APK path provided." };
  }
  const res = await runShell(`adb install -r "${apkPath}"`);
  if (res.success && res.stdout.includes("Success")) {
    return { success: true, message: `Successfully installed APK: ${apkPath}` };
  } else {
    return { success: false, error: res.stdout.trim() || res.error || "Installation failed." };
  }
}

// Rotate screen (0: Portrait, 1: Landscape, 2: Rev Portrait, 3: Rev Land)
async function rotateScreen(mode) {
  const res = await runShell(`adb shell settings put system accelerometer_rotation 0 && adb shell settings put system user_rotation ${mode}`);
  if (res.success) {
    const modes = ["Portrait (0°)", "Landscape (90°)", "Reverse Portrait (180°)", "Reverse Landscape (270°)"];
    return { success: true, message: `Screen orientation set to: ${modes[mode] || mode}` };
  } else {
    return { success: false, error: res.error || "Failed to set screen rotation." };
  }
}

// Reboot device
async function rebootDevice() {
  const res = await runShell("adb reboot");
  if (res.success) {
    return { success: true, message: "Reboot command sent to device. Connection will close." };
  } else {
    return { success: false, error: res.error || "Failed to send reboot command." };
  }
}

// Retrieve currently connected devices via adb devices
async function getConnectedDevices() {
  const res = await runShell("adb devices");
  if (!res.success) {
    return [];
  }
  const lines = res.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const list = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2 && parts[1] === "device") {
      list.push(parts[0]);
    }
  }
  return list;
}

// Push multiple files to device destination (defaults to /sdcard/)
async function pushFiles(paths, dest = "/sdcard/") {
  if (!paths || paths.length === 0) {
    return { success: false, error: "No files provided." };
  }
  const path = require("path");
  const results = [];
  for (const filePath of paths) {
    const filename = path.basename(filePath);
    const res = await runShell(`adb push "${filePath}" "${dest}"`);
    if (res.success) {
      results.push({ file: filename, status: "Success" });
    } else {
      results.push({ file: filename, status: "Failed", error: res.error || res.stdout });
    }
  }
  return { success: true, results };
}

module.exports = {
  connectWifi,
  checkUsb,
  cleanupDevice,
  installApk,
  rotateScreen,
  rebootDevice,
  getConnectedDevices,
  pushFiles
};