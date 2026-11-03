import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { flush, hasPending, whenQueued } from "@/lib/outbox";

/** Follow-up for « À envoyer » when Android stopped the app anyway (memory, a reboot, the
 * foreground service refused): WorkManager runs this task now and then (at best every 15 min,
 * often later, only with a network) and it sends what still waits, then the usual notification
 * says it is ready. Defined at startup (index.ts) so a run with no screen finds it. */
const TASK = "checky-outbox";

TaskManager.defineTask(TASK, async () => {
  try {
    await flush();
    if (!hasPending()) await BackgroundTask.unregisterTaskAsync(TASK).catch(() => null);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registered once something is queued; cheap when it already is. */
async function followUp(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) return;
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
  } catch {
    // not available (Expo Go, web): the queue still runs while the app is open
  }
}

whenQueued(() => void followUp());
