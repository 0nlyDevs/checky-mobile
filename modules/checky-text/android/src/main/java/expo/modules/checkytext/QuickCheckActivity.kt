package expo.modules.checkytext

/**
 * The same sheet as the selection menu, opened by the Quick Settings tile, the « Vérifier le
 * presse-papiers » shortcut and the widget's « Vérifier » button, with nothing selected: it
 * offers to check what was copied. Its own task (empty affinity, see the manifest), so it slides
 * up over whatever app the journalist is in instead of bringing Checky's screens forward.
 */
class QuickCheckActivity : ProcessTextActivity()
