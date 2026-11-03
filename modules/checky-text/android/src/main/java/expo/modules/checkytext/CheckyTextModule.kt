package expo.modules.checkytext

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** What the JS side of the selection-menu sheet and the background check call. */
class CheckyTextModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CheckyText")

    /** App-icon long-press shortcuts: [{id, label, target}]. */
    Function("setShortcuts") { entries: List<Map<String, String>> ->
      val context = appContext.reactContext ?: return@Function false
      try {
        Shortcuts.set(context, entries.map { Shortcuts.Entry(it["id"] ?: "", it["label"] ?: "", it["target"] ?: "") })
        true
      } catch (e: Exception) {
        false
      }
    }

    /** What the home-screen widget shows (JSON: labels + up to three rows). */
    Function("setWidget") { json: String ->
      val context = appContext.reactContext ?: return@Function false
      VerdictsWidget.save(context, json)
      true
    }

    /** Ends the selection-menu sheet; a text replaces the selection where the app allows it. */
    AsyncFunction("finish") { text: String? ->
      ProcessTextActivity.current?.get()?.finishWith(text)
      Unit
    }.runOnQueue(Queues.MAIN)

    /** Keeps the process running (foreground service) while checks run in the background. */
    Function("keepAlive") { title: String, text: String ->
      val context = appContext.reactContext ?: return@Function false
      val intent = Intent(context, CheckWorkService::class.java)
        .putExtra(CheckWorkService.EXTRA_TITLE, title)
        .putExtra(CheckWorkService.EXTRA_TEXT, text)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
        true
      } catch (e: Exception) {
        // ForegroundServiceStartNotAllowedException: the app is no longer in front.
        false
      }
    }

    Function("letGo") {
      val context = appContext.reactContext ?: return@Function Unit
      context.stopService(Intent(context, CheckWorkService::class.java))
      Unit
    }

    /** Back to the app the journalist came from, the task staying alive. */
    Function("moveToBack") {
      appContext.currentActivity?.moveTaskToBack(true) ?: false
    }
  }

}
