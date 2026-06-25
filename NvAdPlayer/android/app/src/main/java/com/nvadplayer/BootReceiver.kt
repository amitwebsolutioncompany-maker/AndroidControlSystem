package com.nvadplayer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_BOOT_COMPLETED || 
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON" ||
            action == "android.intent.action.REBOOT" ||
            action == "android.intent.action.USER_PRESENT") {
            
            try {
                val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    }
                    context.startActivity(launchIntent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
