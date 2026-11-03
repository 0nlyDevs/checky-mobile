package expo.modules.checkytext

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Keeps the app's process in the foreground while a check runs after the journalist went back
 * to Facebook or WhatsApp. Without it, Android freezes a backgrounded app within seconds and the
 * upload and the check stop until the app is reopened. It only shows « Vérification en cours… »
 * and does no work itself: the JS outbox runs the check; it stops this service when the queue is
 * empty. Type dataSync (Android 14+); Android 15 caps that type at 6 hours a day, far above a check.
 */
class CheckWorkService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Checky"
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: ""
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL, getString(R.string.checky_work_channel), NotificationManager.IMPORTANCE_LOW)
      )
    }
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let {
      android.app.PendingIntent.getActivity(
        this, 0, it, android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
      )
    }
    val notification = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(R.drawable.checky_stat)
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setSilent(true)
      .setProgress(0, 0, true)
      .setContentIntent(open)
      .build()
    try {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        notification,
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC else 0
      )
    } catch (e: Exception) {
      // Not allowed now (started from the background, or the daily dataSync budget is spent):
      // the check carries on for as long as Android lets the app run, and resumes when it is opened.
      stopSelf()
    }
    return START_NOT_STICKY
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    stopSelf()
  }

  companion object {
    private const val CHANNEL = "checky-work"
    private const val NOTIFICATION_ID = 4201
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
  }
}
