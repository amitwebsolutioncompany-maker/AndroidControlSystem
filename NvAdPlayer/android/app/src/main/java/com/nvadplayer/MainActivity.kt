package com.nvadplayer

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.PowerManager
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    
    // 1. Keep screen awake continuously via Window Flags
    window.addFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
      WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
      WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
      WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
    )

    // 2. Acquire persistent PowerManager WakeLock to prevent TV screensaver / sleep
    try {
      val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
      if (powerManager != null) {
        @Suppress("DEPRECATION")
        wakeLock = powerManager.newWakeLock(
          PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ON_AFTER_RELEASE or PowerManager.ACQUIRE_CAUSES_WAKEUP,
          "NvAdPlayer:TvAlwaysOnWakeLock"
        )
        wakeLock?.acquire()
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }

    // 3. Set sticky immersive full screen
    hideSystemUI()

    // 4. Start 2-Second Kiosk Watchdog Foreground Service
    startWatchdogService()
  }

  override fun onResume() {
    super.onResume()
    isActivityResumed = true
    if (wakeLock?.isHeld == false) {
      try { wakeLock?.acquire() } catch (_: Exception) {}
    }
    hideSystemUI()
    startWatchdogService()
  }

  override fun onPause() {
    super.onPause()
    isActivityResumed = false
    if (KioskModule.isKioskLocked) {
      relaunchSelfImmediately()
    }
  }

  private fun startWatchdogService() {
    try {
      val watchdogIntent = Intent(this, KioskWatchdogService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        startForegroundService(watchdogIntent)
      } else {
        startService(watchdogIntent)
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  override fun onStop() {
    super.onStop()
    isActivityResumed = false
    if (KioskModule.isKioskLocked) {
      relaunchSelfImmediately()
    }
  }

  override fun onDestroy() {
    super.onDestroy()
    isActivityResumed = false
    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
      }
    } catch (_: Exception) {}
    if (KioskModule.isKioskLocked) {
      relaunchSelfImmediately()
    }
  }

  private fun relaunchSelfImmediately() {
    try {
      val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
        addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP
        )
      }
      if (launchIntent != null) {
        val pendingIntent = android.app.PendingIntent.getActivity(
          this,
          1005,
          launchIntent,
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
          } else {
            android.app.PendingIntent.FLAG_UPDATE_CURRENT
          }
        )
        try {
          pendingIntent.send()
        } catch (e: Exception) {
          startActivity(launchIntent)
        }
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      hideSystemUI()
      window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  private fun hideSystemUI() {
    try {
      val decorView = window.decorView
      @Suppress("DEPRECATION")
      decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      )
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (KioskModule.isKioskLocked) {
      try {
        val intent = Intent(this, MainActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(intent)
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
  }

  // Prevent user from pressing Back / Home / Menu / Settings / TV / AppSwitch keys when Kiosk Mode is locked
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (KioskModule.isKioskLocked) {
      when (keyCode) {
        KeyEvent.KEYCODE_BACK,
        KeyEvent.KEYCODE_HOME,
        KeyEvent.KEYCODE_MENU,
        KeyEvent.KEYCODE_APP_SWITCH,
        KeyEvent.KEYCODE_SETTINGS,
        KeyEvent.KEYCODE_SEARCH,
        KeyEvent.KEYCODE_TV,
        KeyEvent.KEYCODE_GUIDE -> {
          return true // Block key press completely
        }
      }
    }
    return super.onKeyDown(keyCode, event)
  }

  @Suppress("DEPRECATION")
  override fun onBackPressed() {
    if (KioskModule.isKioskLocked) {
      // Block back button press when kiosk mode is enabled
      return
    }
    super.onBackPressed()
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "NvAdPlayer"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  companion object {
    @JvmStatic
    @Volatile
    var isActivityResumed: Boolean = false
  }
}

