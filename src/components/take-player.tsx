import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { Button } from "@/components/ui";
import { Play, Stop } from "@/lib/icons";

/** Plays back a recorded take (the voice note, the radio clip) before it is kept. */
export function TakePlayer({ uri, play, stop }: { uri: string; play: string; stop: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  return (
    <Button
      label={status.playing ? stop : play}
      icon={status.playing ? Stop : Play}
      variant="outline"
      onPress={() => {
        if (status.playing) return player.pause();
        // Played to the end, it starts again from the top.
        if (status.didJustFinish || (status.duration && status.currentTime >= status.duration - 0.1)) player.seekTo(0);
        player.play();
      }}
    />
  );
}
