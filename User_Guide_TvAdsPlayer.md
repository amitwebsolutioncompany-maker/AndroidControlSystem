# Customer User Guide: TvAdsPlayer (Android TV Client App)

Welcome to the official User Guide for the **TvAdsPlayer** application. This guide is written in simple, non-technical language to help you install, activate, and configure the application on your Android TV screens to display video and image advertisements.

---

## 1. Introduction

### What is this Software?
**TvAdsPlayer** is a dedicated digital signage player application designed to run on Android TVs and media player boxes.

### What Problems Does it Solve?
* **Manual Playlist Management:** Instead of manually opening a video player every time the TV starts, this app automatically scans and loops media files.
* **Accidental Exits:** It secures your display screens, preventing customers or employees from closing the advertisement using the remote control.
* **Complex Content Updates:** It integrates with USB drives and wireless controllers so updates require zero technical skills.
* **Inconsistent Display Dimensions:** It automatically adjusts stretching and fit settings to match the aspect ratio of different screens.

### Who Should Use It?
* Retail Store Managers
* Advertising Agencies managing TV networks
* Shop Owners displaying digital menus, discount posters, or promotional videos.

### Main Benefits
* 24/7 continuous fullscreen video/image loop without freeze screens.
* Works fully offline without requiring an active internet connection.
* Locks the TV keys (Kiosk Mode) to protect your signage from tampering.

---

## 2. Key Features

### Fullscreen Autoplay Loop
* **What it does:** Starts playing advertising videos and photos in a fullscreen loop as soon as the app opens.
* **Why it is useful:** Ensures that no black bars, media player buttons, or settings options are visible to customers.
* **Example:** The app automatically cycles through 5 promo videos and 10 sale images in alphabetical order.

### Dual-Storage Playback
* **What it does:** Plays ads from the TV's internal memory (`TvAd` folder) or directly from a plugged-in USB drive (`Ads` folder).
* **Why it is useful:** Gives you flexibility. You can push ads wirelessly over a network or plug in a physical USB drive.
* **Example:** Plug in a USB drive containing new videos; the app immediately starts playing them. Unplug it, and the app falls back to playing internal ads.

### Scrolling Ticker Marquee
* **What it does:** Scrolls a text banner message across the top or bottom of the screen while videos are playing.
* **Why it is useful:** Allows you to display text announcements, deals, or scrolling alerts without stopping the video.
* **Example:** Display *"Special Offer: Buy 1 Get 1 Free on all items today!"* at the bottom of the screen.

### Native Kiosk Lock Mode
* **What it does:** Prevents users from closing the app or navigating away using the remote.
* **Why it is useful:** Protects the screen from being tampered with by customers or staff.
* **Example:** When Kiosk Mode is ON, pressing the 'Back' button on the TV remote does not exit the app; the ads continue playing.

### Auto-Start on TV Boot
* **What it does:** Automatically launches the app when the TV is turned on.
* **Why it is useful:** Ensures that advertisements start playing automatically after a power cut.
* **Example:** If the store loses power, when power returns and the TV boots up, the app launches and starts playing ads without human intervention.

### Remote-Controlled Settings Drawer
* **What it does:** Opens a settings menu overlay by pressing a button on the TV remote.
* **Why it is useful:** Allows you to change durations, scroll messages, and layout fits without keyboard or mouse.
* **Example:** Press Down arrow on your remote to open the drawer, change the slide duration from 5s to 15s, and close it.

---

## 3. System Requirements

* **Supported Devices:** Android TV, Android TV Box (Mi Box, Nvidia Shield, etc.), or Amazon Fire TV Stick.
* **Android OS version:** Android 5.0 (API Level 21) or higher.
* **Storage space:** 100 MB free space for the player app; additional storage space depends on the size of advertising videos.
* **Internet requirement:** Active internet connection is **not** required for daily playback. Internet is only required once during first-time device activation.
* **USB Requirements:** USB 2.0 or 3.0 drive formatted as FAT32 or NTFS (if using USB playback).

---

## 4. Installation Guide

The application is distributed as a compiled Android Package (`TvAdsPlayer.apk`).

### Method 1: Wireless Installation (via Android Control System)
1. Ensure your PC and TV are on the same Wi-Fi network and Developer Options / USB Debugging are enabled on the TV.
2. Connect the TV to the desktop **Android Control System** app.
3. Click **Choose & Deploy APK** under **Step 2: Signage Installer**.
4. Select the `TvAdsPlayer.apk` file. The app will install automatically on the TV screen.

### Method 2: Manual Installation via USB Pen Drive
1. Copy the `TvAdsPlayer.apk` file onto a USB drive.
2. Insert the USB drive into the USB port of your Android TV.
3. Open any **File Manager** app on your TV (such as Cx File Explorer).
4. Locate the USB storage, click on `TvAdsPlayer.apk`, and select **Install**.
5. Once installation finishes, click **Open**.

---

## 5. First-Time Setup

### Step 1: Device License Activation
1. Launch the **TvAdsPlayer** app on your TV.
2. The screen will display a unique **Device ID**. Copy this ID.
3. Share the Device ID with your manager or admin to get the corresponding **License Key**.
4. Type the **License Key** into the text field on the activation screen using the TV remote and click **Save and Activate**.

### Step 2: Grant Permissions
Once activated, the app will ask for permissions:
1. **File Access:** When the "File Access Required" screen appears, click **Grant Permission**. In the TV settings page that opens, enable the toggle next to **TvAdsPlayer** to allow managing all files.
2. **Display Over Other Apps (Overlay):** Go to your TV settings under Apps -> Special App Access -> Display over other apps, and make sure **TvAdsPlayer** is set to **Allowed**.

---

## 6. How to Use the Software

### Loading Advertisements Wireless
1. Connect the TV to the desktop **Android Control System** app.
2. Go to **Step 3: Push Media Files** on the desktop software.
3. Select your advertising videos and photos and send them.
4. The app will detect the files and automatically start playing them.

### Loading Advertisements via USB Pen Drive
1. Insert a USB drive into your PC.
2. Create a folder named **`Ads`** (exactly as written) at the root level of the drive.
3. Copy your advertising videos and images into this `Ads` folder.
4. Plug the USB drive into the TV. The app will immediately display a popup: *"USB Pendrive Detected"* and start playing the files.

### Accessing TV Remote Settings Menu
1. **Where to find it:** While ads are playing, press **OK**, **Down Arrow**, or the **Menu** button on your TV remote.
2. **Expected result:** A configuration drawer slides open from the side.
3. **What to click:** Use the remote arrow keys to select option values (duration, ticker settings, resize modes).
4. **Closing it:** Press the remote's **Back** button to save changes and return to fullscreen ads.

---

## 7. Settings Guide

Open the settings drawer using the TV remote to adjust:
* **Slide Duration:** 5 Sec, 10 Sec, 15 Sec, or 20 Sec. *Recommendation: Use 10 Sec for images to give customers enough time to read.*
* **Ticker Text:** Input the custom text message to display. *Leave empty to hide the ticker.*
* **Ticker Colors:** Select from White, Black, Red, Green, Blue, Yellow, Cyan, or Magenta for text and background. *Recommendation: White text on Black background for high contrast.*
* **Ticker Position:** Top or Bottom.
* **Resize Mode:**
  * `stretch` (Stretches media to fill the entire TV screen - default).
  * `cover` (Fills screen while maintaining aspect ratio, may crop edges).
  * `contain` (Fits media within screen boundaries, showing black bars if aspect ratio doesn't match).
* **Kiosk Mode:** Toggle ON to disable the Back button and lock the screen.

---

## 8. Daily Usage

Follow this normal daily operations workflow:

```
Power On the TV screen
           ↓
App automatically launches on boot
           ↓
Checks for USB drive (If present, plays USB 'Ads' folder)
           ↓
If no USB, plays internal '/sdcard/TvAd' folder
           ↓
Advertisements play in a continuous fullscreen loop
```

---

## 9. Troubleshooting

| Problem | Possible Reason | Solution |
| :--- | :--- | :--- |
| **"No Media Files Found" screen** | The folder is empty, or files are placed in the wrong folder. | Make sure files are in the `/sdcard/TvAd/` folder on TV memory, or inside the `Ads` folder on the USB drive. Check file extensions. |
| **License Activation fails** | TV is not connected to the internet during activation, or the key is wrong. | Check TV Wi-Fi status. Make sure the license key matches the Device ID exactly. |
| **Videos lag or drop frames** | Video resolution/bitrate is too high for the TV hardware. | Compress the video files to 1080p resolution at 30fps using a standard video encoder. |
| **Ticker text does not appear** | Ticker text is empty, or overlay permission is missing. | Open settings drawer, type ticker text. Ensure "Display over other apps" is allowed in TV settings. |

---

## 10. Frequently Asked Questions

#### Q1: What file formats are supported?
**A:** Videos: `.mp4`, `.mkv`, `.mov`, `.avi`, `.3gp`, `.webm`. Images: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`.

#### Q2: Will the advertisements continue playing if the Wi-Fi disconnects?
**A:** Yes. Once files are loaded, the player operates entirely offline. It does not need internet or Wi-Fi to keep playing.

#### Q3: How do I disable the lock so I can exit the app?
**A:** Open the settings drawer by pressing Down or OK, select **Kiosk Mode**, toggle it to OFF, then press the remote's Back button twice to exit.

---

## 11. Best Practices

* **Always Enable Kiosk Mode:** Keep Kiosk Mode enabled on display screens in public areas to prevent customers from closing the ads.
* **Video Encoding:** Encode all videos as H.264 MP4 format at 1080p resolution for smooth playback on all TV hardware.
* **USB File Sync:** When using USB drives, ensure the folder name is exactly `Ads` (capital A, lowercase ds).

---

## 12. Presentation Version

````carousel
### Slide 1: Welcome to TvAdsPlayer
* **Topic:** Overview of TV Advertisement Client
* **Icon:** `📺` (Television / Play)
* **Bullet Points:**
  * Turns any Android TV into a digital advertising display
  * Displays fullscreen video and image playlists in a loop
  * Completely offline playback requiring zero internet connection
* **Image Suggestion:** An Android TV screen mounted on a wall displaying a bright, colorful advertisement.
* **Speaker Notes:** Welcome. We are presenting TvAdsPlayer, the player application that runs directly on your Android TV screens to play advertisement loops.
<!-- slide -->
### Slide 2: Playback Features
* **Topic:** Autoplay and Sorting Loops
* **Icon:** `🔄` (Loop / Play)
* **Bullet Points:**
  * Runs automatically when the TV is powered ON
  * Sorts advertisement files alphabetically for consistency
  * Seamless transitions between videos and images
* **Image Suggestion:** A sequence diagram showing alphabetical file loops (01_ad.mp4 -> 02_ad.png -> 03_ad.mp4).
* **Speaker Notes:** The app automatically launches on boot and loops your media files in alphabetical order.
<!-- slide -->
### Slide 3: Dual-Storage Support
* **Topic:** Play from Memory or USB
* **Icon:** `💾` (Save / USB)
* **Bullet Points:**
  * Wirelessly push media files to TV internal storage
  * Plug in a USB drive with an `Ads` folder to play directly
  * Automatic fallback to internal memory when USB is removed
* **Image Suggestion:** A USB pen drive being inserted into a TV port with a folder structure showing /Ads/ folder.
* **Speaker Notes:** You can wirelessly upload advertisements to the TV or simply plug in a USB pen drive.
<!-- slide -->
### Slide 4: Device Activation
* **Topic:** Secure Licensing System
* **Icon:** `🔑` (Key / Shield)
* **Bullet Points:**
  * Unique Device ID displayed on first launch
  * Unlocks instantly using an administrator License Key
  * License is stored permanently on device memory
* **Image Suggestion:** The activation screen showing a Device ID field and a License Key input box.
* **Speaker Notes:** To start, copy the Device ID from the screen and enter the activation key provided by the admin.
<!-- slide -->
### Slide 5: Permission Setup
* **Topic:** Storage and Overlay Permissions
* **Icon:** `🔓` (Permissions / Settings)
* **Bullet Points:**
  * Requires "All Files Access" to read advertisements
  * Requires "Overlay Permission" to display scroll banner
  * One-click settings redirection overlay inside app
* **Image Suggestion:** Android TV settings page showing file management permission toggle set to ON.
* **Speaker Notes:** Ensure you grant All Files Access and Display Over Other Apps permissions when prompted.
<!-- slide -->
### Slide 6: Scrolling Marquee Ticker
* **Topic:** Custom Scrolling Announcements
* **Icon:** `💬` (Message Banner)
* **Bullet Points:**
  * Display news, deals, or messages while videos play
  * Customize banner text, colors, position, and font size
  * High-contrast styling for clear reading
* **Image Suggestion:** A video playing with a prominent scrolling banner message at the bottom of the screen.
* **Speaker Notes:** You can display scrolling text messages at the top or bottom of the screen while ads are running.
<!-- slide -->
### Slide 7: Native Kiosk Mode
* **Topic:** Tamper-Proof Screen Security
* **Icon:** `🔒` (Lock / Security)
* **Bullet Points:**
  * Prevents customers from closing the player app
  * Disables TV remote Back button actions
  * Overrides screensavers and sleep timers to stay awake
* **Image Suggestion:** A lock symbol overlaying a TV remote icon indicating disabled buttons.
* **Speaker Notes:** Kiosk Mode locks the screen and remote buttons, preventing customers from exit-tampering.
<!-- slide -->
### Slide 8: Auto Boot Launch
* **Topic:** Power Outage Recovery
* **Icon:** `⚡` (Power / Quick Start)
* **Bullet Points:**
  * App launches automatically when TV boots up
  * Recovers advertisement loops after power cuts
  * Zero human intervention required on-site
* **Image Suggestion:** TV power cable plugged in, showing TV starting and instantly loading player screen.
* **Speaker Notes:** The app automatically launches when the TV is powered on, which is great for recovering after power cuts.
<!-- slide -->
### Slide 9: Remote Settings drawer
* **Topic:** Adjust Options on TV
* **Icon:** `🎛️` (Control Knobs / Drawer)
* **Bullet Points:**
  * Press OK or Down Arrow on remote to open settings
  * Configure image timers, banner text, and resize modes
  * Settings auto-save when you exit settings screen
* **Image Suggestion:** The sidebar drawer settings overlay showing slide duration and resize mode selectors.
* **Speaker Notes:** Press Down or OK on the TV remote to open the settings drawer and easily change options.
<!-- slide -->
### Slide 10: Best Practices
* **Topic:** Tips for Perfect Display
* **Icon:** `⭐` (Star / Recommendations)
* **Bullet Points:**
  * Encode videos in H.264 MP4 format at 1080p
  * Check Kiosk Mode toggle ON in public stores
  * Keep USB folder name as exactly `Ads`
* **Image Suggestion:** A checkmark list outlining MP4 format, Kiosk ON, and Ads folder name.
* **Speaker Notes:** Follow these best practices to ensure optimal performance and smooth advertisement playback.
````
