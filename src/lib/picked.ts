import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef } from "react";

export type Picked = { uri: string; mime: string; name: string; size?: number | null };

/** What the rest of the app needs from a picked photo or video. */
export function asPicked(a: ImagePicker.ImagePickerAsset): Picked {
  const mime = a.mimeType ?? (a.type === "video" ? "video/mp4" : "image/jpeg");
  const name = a.fileName ?? `${a.type === "video" ? "video" : "photo"}.${mime.split("/")[1] ?? "bin"}`;
  return { uri: a.uri, mime, name, size: a.fileSize };
}

/**
 * Android may destroy the app's screen while the photo picker is open (a phone short of memory
 * does it every time), and the code that asked never gets the photo: the app reopens on its
 * first screen. The picker keeps the result; this reads it once when that first screen mounts
 * and carries on as if the pick had returned normally.
 */
export function usePendingPick(onPicked: (file: Picked) => void): void {
  const handler = useRef(onPicked);
  useEffect(() => {
    handler.current = onPicked;
  });
  useEffect(() => {
    let live = true;
    ImagePicker.getPendingResultAsync()
      .then((res) => {
        if (!live || !res || !("canceled" in res) || res.canceled) return;
        const asset = res.assets?.[0];
        if (asset) handler.current(asPicked(asset));
      })
      .catch(() => null);
    return () => {
      live = false;
    };
  }, []);
}
