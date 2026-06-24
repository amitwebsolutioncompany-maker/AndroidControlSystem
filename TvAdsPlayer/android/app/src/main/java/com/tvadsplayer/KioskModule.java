package com.tvadsplayer;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;

@ReactModule(name = "KioskModule")
public class KioskModule extends ReactContextBaseJavaModule {
    private static final String TAG = "KioskModule";
    private boolean isKioskMode = false;

    public KioskModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "KioskModule";
    }

    @ReactMethod
    public void enableKioskMode() {
        try {
            Activity activity = getCurrentActivity();
            if (activity != null) {
                activity.runOnUiThread(() -> {
                    try {
                        // Set flags to prevent home button and recent apps
                        activity.getWindow().addFlags(
                            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                        );
                        
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            activity.setTaskDescription(new android.app.ActivityManager.TaskDescription("TvAdsPlayer"));
                        }
                        
                        isKioskMode = true;
                        Log.d(TAG, "Kiosk mode enabled");
                    } catch (Exception e) {
                        Log.e(TAG, "Error enabling kiosk mode", e);
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in enableKioskMode", e);
        }
    }

    @ReactMethod
    public void disableKioskMode() {
        try {
            Activity activity = getCurrentActivity();
            if (activity != null) {
                activity.runOnUiThread(() -> {
                    try {
                        // Clear kiosk mode flags
                        activity.getWindow().clearFlags(
                            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                        );
                        
                        isKioskMode = false;
                        Log.d(TAG, "Kiosk mode disabled");
                    } catch (Exception e) {
                        Log.e(TAG, "Error disabling kiosk mode", e);
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in disableKioskMode", e);
        }
    }

    @ReactMethod
    public void setAsHomeLauncher() {
        try {
            Activity activity = getCurrentActivity();
            if (activity != null) {
                activity.runOnUiThread(() -> {
                    try {
                        // This requires the app to be set as default launcher via system settings
                        // The user needs to manually set it as home launcher
                        // We can show a dialog to guide them
                        Log.d(TAG, "To set as home launcher, user must manually select this app as default launcher in system settings");
                    } catch (Exception e) {
                        Log.e(TAG, "Error setting as home launcher", e);
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in setAsHomeLauncher", e);
        }
    }
}
