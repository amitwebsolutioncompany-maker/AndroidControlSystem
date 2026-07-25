# Customer User Guide: Android Control System (Desktop Admin Controller)

Welcome to the official User Guide for the **Android Control System (Nextview Multi-TV Deployment Suite)**. This guide is written in simple, non-technical language to help you install, configure, and use the software to manage all your advertising TV screens from a single Windows PC.

---

## 1. Introduction

### What is this Software?
The **Android Control System** is a professional desktop application that allows you to manage, control, and deploy advertisements to multiple Android TV screens simultaneously from your Windows computer.

### What Problems Does it Solve?
* **Manual Setup Delays:** Instead of setting up each TV one by one using a remote control, you can configure, install, and load ads on dozens of TVs at the same time.
* **Complex Settings:** It automates complicated TV optimization steps (like disabling sleep modes, screen savers, and bloatware).
* **Content Management:** It allows you to wirelessly transfer advertisement videos and images to all screens without running around with USB drives.
* **Remote Control:** It provides a virtual remote and live screen mirroring so you can operate TVs that are physically hard to reach.

### Who Should Use It?
* Digital Signage Operators
* Store Managers and Showroom Owners
* IT Administrators managing TV networks in hotels, restaurants, or offices.

### Main Benefits
* Save hours of setup time per TV.
* Ensure all screens display ads 24/7 without turning off or showing system notifications.
* Wirelessly monitor and change content instantly.

---

## 2. Key Features

### Device Discovery & Connectivity
* **What it does:** Scans your local network or USB ports to find and connect all your Android TVs.
* **Why it is useful:** You don't need to manually register each TV; the software finds them automatically.
* **Example:** Use the "Scan Network" button when you boot up 10 new TVs in a store to connect them all instantly.

### Bulk TV Cleanup & Optimizations (Step 1)
* **What it does:** Removes pre-installed TV bloatware and adjusts TV settings so the screen stays awake forever.
* **Why it is useful:** Prevents screens from going to sleep or displaying updates and advertisements from other apps.
* **Example:** Run this feature on a brand new TV to instantly turn off its built-in screensaver and set the sleep timeout to "Never".

### Signage App Installer (Step 2)
* **What it does:** Installs the advertisement player application (`TvAdsPlayer.apk` or `NvAdPlayer.apk`) onto multiple TVs simultaneously.
* **Why it is useful:** Eliminates the need to copy the APK file to a USB drive and install it on each TV manually.
* **Example:** Use this to update the player app version across 20 screens in a single click.

### Push Media Files (Step 3)
* **What it does:** Sends advertisement videos (MP4, MKV) and photos (JPG, PNG) from your PC to the TV's internal memory.
* **Why it is useful:** Wirelessly updates advertisement playlists.
* **Example:** When a new promotional campaign starts, select the new video files and push them to all screens in the store.

### Screen Orientation Control (Step 4)
* **What it does:** Rotates the TV display angle remotely.
* **Why it is useful:** Allows you to change between landscape (horizontal) and portrait (vertical) layouts easily.
* **Example:** If a TV is mounted vertically on a wall, click "Portrait (90°)" to rotate the advertisement layout correctly.

### Virtual Remote Control Simulator (Step 5)
* **What it does:** Displays an interactive remote control on your PC to send keypresses to selected TVs.
* **Why it is useful:** Permits D-pad navigation, volume changes, home, back, and settings menu access without physical remotes.
* **Example:** Use the D-pad Down and OK buttons on the virtual remote to navigate the settings drawer inside the TV player app.

### Service & Factory Menu Launchers (Step 6)
* **What it does:** Automates the remote control button sequences to open hidden TV service/factory menus.
* **Why it is useful:** Saves you from looking up and typing complex factory remote codes.
* **Example:** Select "Google TV" to automatically trigger the input sequences needed to configure advanced hardware options.

### Live Screen Mirroring (Scrcpy)
* **What it does:** Streams the TV screen live onto your computer and allows you to click and type on the TV using your mouse and keyboard.
* **Why it is useful:** Allows you to debug or configure TVs that are mounted high up on walls.
* **Example:** Open the live mirror window for a TV located in another room to check if its license is activated.

### TV File Manager
* **What it does:** Opens a browser to manage the TV's folders (upload, download, delete, rename).
* **Why it is useful:** Provides full file control over individual TVs.
* **Example:** Use the File Manager to delete an outdated advertising video from a TV's internal memory.

---

## 3. System Requirements

* **Supported Operating System:** Windows 10 or Windows 11 (64-bit).
* **Local Network:** A local Wi-Fi router or Ethernet switch connecting the PC and all TVs on the same network subnet.
* **Target Devices:** Android-based TVs, Android TV Boxes, or Fire TV sticks.
* **Android OS version:** Android 5.0 (Lollipop) up to Android 14.
* **Storage Requirement:** Minimum 500 MB free space on PC for software files; additional space depends on the size of advertising videos.
* **Internet Requirement:** Active internet connection is **not** required for daily operations. Internet is only needed during first-time setup to download the ADB and Scrcpy drivers.
* **Offline Support:** Fully supports offline deployment over a local network.

---

## 4. Installation Guide

### Step 1: Run the Installer
1. Locate the **`Android Control System Setup.exe`** file on your computer.
2. Double-click the file to start the installation.
3. If Windows displays a "User Account Control" prompt, click **Yes** to allow.

### Step 2: Choose Installation Options
1. Select the installation path (the default folder is recommended).
2. Click **Next** and then **Install**.
3. Once completed, click **Finish**. A shortcut icon will appear on your desktop.

---

## 5. First-Time Setup

### Step 1: System Security Unlock
1. Open the **Android Control System** app from your desktop.
2. On the **Security Verification** screen, enter the administrator password: **`408@amit`**.
3. Click **Unlock System**.

### Step 2: Driver Auto-Download
1. On the left sidebar, locate the **ADB Auto Setup** panel.
2. Click **Setup ADB (One-Click)**. The status will change to "Downloading ADB..." and then "ADB setup completed successfully!".
3. Click the **Other Setup** tab on the main dashboard area.
4. Click **Setup Scrcpy (One-Click)**. The app will automatically configure the screen mirroring driver.
5. Close the software and open it again to apply all changes.

### Step 3: Preparing Your Android TVs
On each TV, you must enable developer options:
1. Go to TV **Settings** -> **Device Preferences** -> **About**.
2. Scroll to **Build** (or Build Number) and press **OK** on the remote 7 times.
3. Go back to the main settings page and enter **Developer Options**.
4. Turn ON **USB Debugging** (and **Wireless Debugging** if available).

---

## 6. How to Use the Software

### Connecting TVs to the Dashboard
1. **Where to find it:** Left sidebar panel under **Connect & Pair TV**.
2. **What to click:** 
   * For wireless connection, click **Scan & Connect Network** to search the local Wi-Fi network automatically.
   * If you know the TV's IP, type it (e.g., `192.168.1.5:5555`) into the IP box and click **Connect**.
   * If connected via USB cable, click **Scan USB Devices**.
3. **What happens next:** The TVs will appear in the **Target Devices** list with a green checkmark or status icon.
4. **Expected result:** Connected TVs are displayed, and you can check the boxes next to them to select them for commands.
5. **Tip:** Use the **Select All** button above the list to quickly target all connected screens.

### Running TV Optimizations (Cleanup)
1. **Where to find it:** **Bulk Operations** tab -> **Step 1: Remove Bloatware** card.
2. **What to click:** Click **Clean Selected Devices**.
3. **Expected result:** The software will disable TV screen savers, notifications, auto-updates, and set the sleep timer to infinite. A success message will appear in the **Operation Status Logs**.

### Deploying the TV Player App
1. **Where to find it:** **Bulk Operations** tab -> **Step 2: Signage Installer** card.
2. **What to click:** Click **Choose & Deploy APK**.
3. **What happens next:** A file browser opens. Select the player app file (`TvAdsPlayer.apk` or `NvAdPlayer.apk`).
4. **Expected result:** The application installs automatically on all selected screens. Check the **Deployment Log** tab to verify.

### Sending Advertisements
1. **Where to find it:** **Bulk Operations** tab -> **Step 3: Push Media Files** card.
2. **What to click:** Click **Choose & Send Files**.
3. **What happens next:** Select the video and image files from your PC.
4. **Expected result:** Files are copied directly into the TV's internal memory inside the `/sdcard/TvAd/` folder.

### Using Screen Mirroring (Live Remote Viewer)
1. **Where to find it:** **Other Setup** tab.
2. **What to click:** Locate the TV name in the Scrcpy panel and click **Mirror TV Screen (scrcpy)**.
3. **Expected result:** A window showing the live TV screen opens on your PC. You can navigate the TV using your mouse cursor.

---

## 7. Settings Guide

* **Destination Path (Step 3):** Default is `/sdcard/`. *Recommendation: Do not change this unless requested by technical support. The TV player app is configured to read advertisements from this exact directory.*
* **Screen Rotation Angles (Step 4):**
  * `0°` (Default landscape mode)
  * `90°` (Portrait mode for vertically mounted screens)
  * `180°` (Upside-down landscape mode)
  * `270°` (Upside-down portrait mode)
* **Console Command Target:** Displays which device IDs are currently receiving custom terminal commands. *Always check this before clicking "Run" to avoid sending commands to the wrong TV.*

---

## 8. Daily Usage

Follow this standard daily deployment workflow:

```
Launch App & Unlock (Password: 408@amit)
           ↓
Click "Scan & Connect Network" to connect TVs
           ↓
Select Target TVs from the checklist
           ↓
Run "Clean Selected Devices" (If setting up new TVs)
           ↓
Click "Choose & Deploy APK" to install player app
           ↓
Click "Choose & Send Files" to upload video/photo ads
           ↓
Use "Mirror TV Screen" to check playing ads
```

---

## 9. Troubleshooting

| Problem | Possible Reason | Solution |
| :--- | :--- | :--- |
| **TV does not appear in the checklist** | TV is not on the same Wi-Fi network, or USB/Wireless Debugging is turned off. | Check TV Wi-Fi settings to ensure it matches the PC. Go to Developer Options and verify USB Debugging is ON. |
| **ADB Setup fails/shows error** | PC does not have an active internet connection during first-time driver setup. | Connect the PC to the internet, restart the app, and click "Setup ADB (One-Click)" again. |
| **Media Push fails halfway** | TV storage space is full, or the Wi-Fi connection is weak. | Clear storage space on the TV. Move the PC or Wi-Fi router closer to the TV screens. |
| **Screen mirroring fails to launch** | Scrcpy driver is not set up, or the TV is offline. | Go to the "Other Setup" tab and run the Scrcpy One-Click setup again. Make sure the TV is online. |

---

## 10. Frequently Asked Questions

#### Q1: Do I need an internet connection to run this software?
**A:** No. You only need the internet once during the initial setup to download the drivers. Once downloaded, all connections, app installations, and file transfers work completely offline using your local network.

#### Q2: What is the unlock password?
**A:** The default administrator password is `408@amit`.

#### Q3: Can I connect some TVs via Wi-Fi and others via USB at the same time?
**A:** Yes, the system supports hybrid connections. All connected devices will show up in the same list.

#### Q4: How many TVs can I control at once?
**A:** There is no hard software limit. You can manage 50+ TVs, depending on the speed and capacity of your local Wi-Fi router.

---

## 11. Best Practices

* **Use a Dedicated Wi-Fi Router:** For fast file transfers, connect all TVs and the PC to a dedicated local Wi-Fi router with high bandwidth (5 GHz recommended).
* **Apply Sleep Optimizations First:** Always run the "Clean Selected Devices" command on new TVs before installing the player app.
* **Keep Destination Path Default:** Leave the media push destination path as `/sdcard/` to ensure the player app can find your files automatically.

---

## 12. Presentation Version

````carousel
### Slide 1: Introduction to Control System
* **Topic:** Overview of Android Control System
* **Icon:** `🖥️` (Monitor / Server)
* **Bullet Points:**
  * Centralized management for all advertisement screens
  * Connects over local Wi-Fi/USB without internet
  * Eliminates manual configuration per TV screen
* **Image Suggestion:** A sleek dashboard on a laptop controlling multiple wall-mounted TV screens displaying ads.
* **Speaker Notes:** Welcome everyone. Today we are presenting the Android Control System, which lets you control all TV screens from one PC.
<!-- slide -->
### Slide 2: Device Connections
* **Topic:** Connecting TVs to Dashboard
* **Icon:** `📶` (Wi-Fi / Connectivity)
* **Bullet Points:**
  * Auto-scan network feature finds all active screens
  * Connect individually using TV IP addresses
  * Plug in USB debugging-enabled TVs directly
* **Image Suggestion:** The sidebar panel showing IP input, Scan button, and target devices checked green.
* **Speaker Notes:** You can connect TVs instantly using our network auto-scanner or by typing the TV's IP address.
<!-- slide -->
### Slide 3: One-Click TV Optimization
* **Topic:** Step 1 - TV Cleanup & Awake Settings
* **Icon:** `🧹` (Broom / Cleanup)
* **Bullet Points:**
  * Disables TV screensavers and auto-sleep timers
  * Stops pre-installed bloatware from lagging the system
  * Configures screens to stay awake 24/7 for ads
* **Image Suggestion:** The Step 1 Remove Bloatware card with a clean, verified checklist overlay.
* **Speaker Notes:** Step 1 cleans up background TV software and forces the screen to remain active and awake 24/7.
<!-- slide -->
### Slide 4: Deploying Player Applications
* **Topic:** Step 2 - Signage Installer
* **Icon:** `📥` (Download / Install)
* **Bullet Points:**
  * Pushes player APKs directly to all TVs
  * Installs apps silently in the background
  * Easily updates player apps across all devices
* **Image Suggestion:** A progress bar representing background app installation on multiple screens.
* **Speaker Notes:** Step 2 allows you to select the player APK from your PC and deploy it to all TVs simultaneously.
<!-- slide -->
### Slide 5: Pushing Media Files
* **Topic:** Step 3 - Send Videos and Photos
* **Icon:** `📤` (Upload / File Transfer)
* **Bullet Points:**
  * Wireless transfer of promotional videos and images
  * Saves files directly into the TV's advertisement folder
  * Supports high-definition video formats
* **Image Suggestion:** Selected video files being pushed to TV storage directories over local Wi-Fi network.
* **Speaker Notes:** Step 3 transfers advertisement files to the TV's internal memory `/sdcard/TvAd/` folder.
<!-- slide -->
### Slide 6: Screen Rotation
* **Topic:** Step 4 - Display Orientation
* **Icon:** `🔄` (Rotate / Angle)
* **Bullet Points:**
  * Rotates TV screen orientations instantly
  * Supports Portrait (90°) for vertical banners
  * Supports Landscape (0°) for standard layouts
* **Image Suggestion:** A TV graphic showing landscape display rotating into portrait layout.
* **Speaker Notes:** Step 4 allows you to configure screen layouts to match horizontal or vertical TV mounting setups.
<!-- slide -->
### Slide 7: Virtual Remote Simulator
* **Topic:** Step 5 - Controlling TVs Remotely
* **Icon:** `🎮` (Remote / Controller)
* **Bullet Points:**
  * On-screen remote control on your PC dashboard
  * Simulates D-pad arrows, Home, Back, and OK keys
  * Adjust volume levels and turn screens On/Off
* **Image Suggestion:** The Virtual Remote panel with clickable buttons on the desktop software UI.
* **Speaker Notes:** Step 5 includes a simulated remote control so you can change settings or navigate menus without physical remotes.
<!-- slide -->
### Slide 8: Live Screen Mirroring
* **Topic:** Wireless Live View & Touch Control
* **Icon:** `🖥️` (Mirror / Screen)
* **Bullet Points:**
  * Watch what's playing on any TV screen in real-time
  * Click and type on the TV screen using your PC mouse
  * Perfect for managing hard-to-reach screens
* **Image Suggestion:** A desktop window mirroring the Android TV interface displaying an active video playlist.
* **Speaker Notes:** The live mirroring feature lets you see and control the TV screen directly from your desktop.
<!-- slide -->
### Slide 9: TV File & App Manager
* **Topic:** Managing Files and Applications
* **Icon:** `📁` (Folders / Apps)
* **Bullet Points:**
  * Upload, download, rename, or delete files on the TV
  * List, disable, or uninstall existing apps on the TV
  * Simple table layouts showing directories
* **Image Suggestion:** The File Manager tab with rows of folders and files on the TV internal memory.
* **Speaker Notes:** The File Manager and Apps Manager tabs give you deep control over TV storage and installed apps.
<!-- slide -->
### Slide 10: Signage Setup Checklist
* **Topic:** 17-Step Deployment Verification
* **Icon:** `📋` (Checklist / Verification)
* **Bullet Points:**
  * Built-in interactive checklist for deployment
  * Tracks setup progress from start to final packing
  * Ensures zero configuration errors on site
* **Image Suggestion:** The interactive setup checklist card showing completed checkmarks.
* **Speaker Notes:** The other setup tab features a 17-step deployment checklist to guide you through a perfect TV installation.
````
