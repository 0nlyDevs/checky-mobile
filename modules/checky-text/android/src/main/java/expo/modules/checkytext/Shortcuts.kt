package expo.modules.checkytext

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat

/**
 * Long press on the app icon: « Vérifier le presse-papiers », « Enregistrer la radio », « Scanner ».
 * Dynamic shortcuts, set by the app at start in the interface language (labels come from JS).
 * A route shortcut opens the app on its deep link (Expo Router).
 */
object Shortcuts {
  data class Entry(val id: String, val label: String, val target: String)

  fun set(context: Context, entries: List<Entry>) {
    val shortcuts = entries.map { e ->
      val intent = when (e.target) {
        "clipboard" -> CheckTileService.quickCheck(context).setAction(Intent.ACTION_VIEW)
        else -> Intent(Intent.ACTION_VIEW, Uri.parse("${context.getString(R.string.checky_scheme)}://${e.target}")).setPackage(context.packageName)
      }
      ShortcutInfoCompat.Builder(context, e.id)
        .setShortLabel(e.label)
        .setLongLabel(e.label)
        .setIcon(IconCompat.createWithResource(context, icon(e.target)))
        .setIntent(intent)
        .build()
    }
    ShortcutManagerCompat.setDynamicShortcuts(context, shortcuts)
  }

  private fun icon(target: String): Int = when (target) {
    "clipboard" -> R.drawable.checky_sc_clipboard
    "scanner" -> R.drawable.checky_sc_scan
    "enregistrer" -> R.drawable.checky_sc_record
    else -> R.drawable.checky_sc_scan
  }
}
