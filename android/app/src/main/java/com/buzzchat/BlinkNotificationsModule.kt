package com.buzzchat

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BlinkNotificationsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BlinkNotifications"

  @ReactMethod
  fun createChannels(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channels = listOf(
          NotificationChannel("messages", "Messages", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Direct message notifications"
          },
          NotificationChannel("friend_requests", "Friend requests", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "Connection request notifications"
          },
          NotificationChannel("groups", "Groups", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Group chat notifications"
          },
        )
        manager.createNotificationChannels(channels)
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("CHANNEL_CREATE_FAILED", error)
    }
  }

  @ReactMethod
  fun showNotification(channelId: String, title: String, body: String, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val granted = ContextCompat.checkSelfPermission(
          reactContext,
          Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
          promise.resolve(false)
          return
        }
      }

      val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)
        ?: Intent(reactContext, MainActivity::class.java)
      launchIntent.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP

      val pendingIntent = PendingIntent.getActivity(
        reactContext,
        channelId.hashCode(),
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      val notification = NotificationCompat.Builder(reactContext, channelId)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .build()

      NotificationManagerCompat.from(reactContext).notify(System.currentTimeMillis().toInt(), notification)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("SHOW_NOTIFICATION_FAILED", error)
    }
  }
}