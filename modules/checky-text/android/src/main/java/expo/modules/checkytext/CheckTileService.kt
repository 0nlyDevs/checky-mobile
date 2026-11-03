package expo.modules.checkytext

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * Quick Settings tile « Vérifier »: a tap opens the sheet over the current app, which checks what
 * was copied once the journalist taps « Vérifier » there. Android only lets the app in front read
 * the clipboard, so the tile itself never reads it.
 */
class CheckTileService : TileService() {
  override fun onStartListening() {
    qsTile?.apply {
      state = Tile.STATE_INACTIVE
      updateTile()
    }
  }

  @SuppressLint("StartActivityAndCollapseDeprecated")
  override fun onClick() {
    val intent = quickCheck(this)
    if (Build.VERSION.SDK_INT >= 34) {
      startActivityAndCollapse(PendingIntent.getActivity(this, 1, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
    } else {
      @Suppress("DEPRECATION")
      startActivityAndCollapse(intent)
    }
  }

  companion object {
    /** The sheet on « check the clipboard ». */
    fun quickCheck(context: Context): Intent =
      Intent(context, QuickCheckActivity::class.java)
        .putExtra(ProcessTextActivity.EXTRA_ACTION, "clipboard")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
  }
}
