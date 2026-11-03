import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";

/**
 * Where the app keeps its small values: the mode, the language, the newsroom, the tips sent from
 * this phone, the session. SecureStore first; some Android Keystores refuse every write (a Redmi
 * 6 Pro on MIUI 10: « Keystore operation failed »), and the app then forgot its mode and session
 * whenever Android recreated its screen, after the photo picker for instance. A value SecureStore
 * refuses goes to a file in the app's private documents, which only Checky can read.
 */
const FILE = new File(Paths.document, "kv.json");
let fallback: Record<string, string> | null = null;

function local(): Record<string, string> {
  if (fallback) return fallback;
  try {
    fallback = FILE.exists ? (JSON.parse(FILE.textSync()) as Record<string, string>) : {};
  } catch {
    fallback = {};
  }
  return fallback;
}

function keep(key: string, value: string | null): void {
  const all = local();
  if (value === null) delete all[key];
  else all[key] = value;
  try {
    FILE.writeSync(JSON.stringify(all));
  } catch {
    // a full disk: the value lives until the app closes
  }
}

type Options = SecureStore.SecureStoreOptions;

/** The SecureStore calls the app and Better Auth's Expo client use, with the file as a fallback.
 * A value in the file is the newest: it is only written when SecureStore refused. */
export const kv = {
  getItem(key: string, options?: Options): string | null {
    const kept = local()[key];
    if (kept !== undefined) return kept;
    try {
      return SecureStore.getItem(key, options);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string, options?: Options): void {
    try {
      SecureStore.setItem(key, value, options);
      if (local()[key] !== undefined) keep(key, null);
    } catch {
      keep(key, value);
    }
  },
  async getItemAsync(key: string, options?: Options): Promise<string | null> {
    const kept = local()[key];
    if (kept !== undefined) return kept;
    try {
      return await SecureStore.getItemAsync(key, options);
    } catch {
      return null;
    }
  },
  async setItemAsync(key: string, value: string, options?: Options): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, options);
      if (local()[key] !== undefined) keep(key, null);
    } catch {
      keep(key, value);
    }
  },
  async deleteItemAsync(key: string, options?: Options): Promise<void> {
    keep(key, null);
    try {
      await SecureStore.deleteItemAsync(key, options);
    } catch {
      // nothing stored there
    }
  },
};
