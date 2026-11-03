package expo.modules.checkytext

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.lang.ref.WeakReference

/**
 * « Checky » in Android's text-selection menu (ACTION_PROCESS_TEXT). One activity, three menu
 * entries: the activity itself (« Checky », check the selection) and two aliases declared in
 * this module's manifest (« Traduire FR ↔ MG », « Remplacer par le démenti »). The alias used
 * tells the sheet what to do.
 *
 * It renders the JS component `checky-sheet` over the app the journalist is in (translucent
 * theme), on the same React host as the main activity, so it shares the app's JS runtime. The
 * sheet ends through [CheckyTextModule.finish]: with a text, Android replaces the selection
 * (only when it is editable); without, nothing changes.
 */
open class ProcessTextActivity : ReactActivity() {
  override fun getMainComponentName(): String = COMPONENT

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, COMPONENT) {
      override fun getLaunchOptions(): Bundle = request(intent)
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    // No saved state: a recreated sheet starts from its intent again.
    super.onCreate(null)
    current = WeakReference(this)
  }

  override fun onDestroy() {
    if (current?.get() === this) current = null
    super.onDestroy()
  }

  /** Ends the sheet. A non-null [text] replaces the selection when the caller allows it. */
  fun finishWith(text: String?) {
    val readOnly = intent.getBooleanExtra(Intent.EXTRA_PROCESS_TEXT_READONLY, false)
    if (text != null && !readOnly) {
      setResult(Activity.RESULT_OK, Intent().putExtra(Intent.EXTRA_PROCESS_TEXT, text))
    } else {
      setResult(Activity.RESULT_CANCELED)
    }
    finish()
  }

  companion object {
    const val COMPONENT = "checky-sheet"
    /** Set by the tile, the shortcuts and the widget: what the sheet opens on. */
    const val EXTRA_ACTION = "expo.modules.checkytext.ACTION"
    private const val MAX_CHARS = 4000

    @Volatile var current: WeakReference<ProcessTextActivity>? = null

    fun request(intent: Intent?): Bundle {
      val text = intent?.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString().orEmpty()
      val alias = intent?.component?.className.orEmpty()
      val asked = intent?.getStringExtra(EXTRA_ACTION)
      val action = when {
        asked == "clipboard" -> "clipboard"
        alias.endsWith(".TranslateText") -> "translate"
        alias.endsWith(".DebunkText") -> "debunk"
        else -> "check"
      }
      return Bundle().apply {
        putString("text", text.take(MAX_CHARS))
        putBoolean("readOnly", intent?.getBooleanExtra(Intent.EXTRA_PROCESS_TEXT_READONLY, false) ?: true)
        putString("action", action)
      }
    }
  }
}
