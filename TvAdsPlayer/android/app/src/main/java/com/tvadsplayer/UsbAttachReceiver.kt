package com.tvadsplayer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class UsbAttachReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d("UsbAttachReceiver", "USB event received: $action")
        
        if (action != null) {
            when (action) {
                "android.hardware.usb.action.USB_DEVICE_ATTACHED",
                Intent.ACTION_MEDIA_MOUNTED -> {
                    Log.d("UsbAttachReceiver", "USB attached or media mounted, launching app")
                    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                    launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    context.startActivity(launchIntent)
                }
                Intent.ACTION_MEDIA_EJECT,
                Intent.ACTION_MEDIA_REMOVED -> {
                    Log.d("UsbAttachReceiver", "USB ejected or media removed")
                }
            }
        }
    }
}
