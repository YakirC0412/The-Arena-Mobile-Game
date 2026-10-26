import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';

let sessionMuted = false;
const muteListeners = new Set<(muted: boolean) => void>();

function publishMuteState(muted: boolean) {
  sessionMuted = muted;
  muteListeners.forEach((listener) => listener(muted));
}

export function useGameFeedback() {
  const [muted, setMuted] = useState(sessionMuted);
  const tickPlayer = useAudioPlayer(require('../../assets/sounds/clock-tick.wav'));
  const correctPlayer = useAudioPlayer(require('../../assets/sounds/correct.wav'));
  const skipPlayer = useAudioPlayer(require('../../assets/sounds/skip.wav'));
  const timeUpPlayer = useAudioPlayer(require('../../assets/sounds/time-up.wav'));
  const drawPlayer = useAudioPlayer(require('../../assets/sounds/draw.wav'));
  const conquestPlayer = useAudioPlayer(require('../../assets/sounds/conquest.wav'));
  const championPlayer = useAudioPlayer(require('../../assets/sounds/champion.wav'));

  useEffect(() => {
    muteListeners.add(setMuted);
    return () => {
      muteListeners.delete(setMuted);
    };
  }, []);

  const play = useCallback((player: ReturnType<typeof useAudioPlayer>) => {
    if (sessionMuted) return;
    void player.seekTo(0).then(() => player.play()).catch(() => undefined);
  }, []);

  const toggleMuted = useCallback(() => publishMuteState(!sessionMuted), []);
  const correct = useCallback(() => {
    play(correctPlayer);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [correctPlayer, play]);
  const skip = useCallback(() => {
    play(skipPlayer);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [play, skipPlayer]);
  const dangerTick = useCallback(() => {
    play(tickPlayer);
    void Haptics.selectionAsync();
  }, [play, tickPlayer]);
  const timeUp = useCallback(() => {
    play(timeUpPlayer);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [play, timeUpPlayer]);
  const draw = useCallback(() => {
    play(drawPlayer);
    void Haptics.selectionAsync();
  }, [drawPlayer, play]);
  const conquest = useCallback(() => {
    play(conquestPlayer);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [conquestPlayer, play]);
  const champion = useCallback(() => {
    play(championPlayer);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [championPlayer, play]);

  return {
    muted,
    toggleMuted,
    correct,
    skip,
    dangerTick,
    timeUp,
    draw,
    conquest,
    champion,
  };
}
