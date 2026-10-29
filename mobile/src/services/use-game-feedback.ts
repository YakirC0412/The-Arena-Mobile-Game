import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Sound and haptics for the whole game.
//
// Sounds are shared, app-wide players created once (not per screen). On the
// web, iPhone Safari only lets an audio element play after it was started
// inside a user gesture, so the first tap anywhere "unlocks" every player by
// playing it muted for an instant. Browsers also block vibration before the
// first tap, and iPhone Safari has no vibration at all, so web haptics wait
// for a tap and are skipped where unsupported.

const SOURCES = {
  tick: require('../../assets/sounds/clock-tick.wav'),
  correct: require('../../assets/sounds/correct.wav'),
  skip: require('../../assets/sounds/skip.wav'),
  timeUp: require('../../assets/sounds/time-up.wav'),
  draw: require('../../assets/sounds/draw.wav'),
  conquest: require('../../assets/sounds/conquest.wav'),
  champion: require('../../assets/sounds/champion.wav'),
} as const;
type SoundName = keyof typeof SOURCES;

const IS_WEB = Platform.OS === 'web';
let players: Record<SoundName, AudioPlayer> | null = null;
let userHasTapped = !IS_WEB;
let sessionMuted = false;
const muteListeners = new Set<(muted: boolean) => void>();

function getPlayers() {
  if (!players) {
    players = Object.fromEntries(
      Object.entries(SOURCES).map(([name, source]) => [name, createAudioPlayer(source)]),
    ) as Record<SoundName, AudioPlayer>;
  }
  return players;
}

function unlockOnFirstTap() {
  if (!IS_WEB || typeof document === 'undefined') return;
  const unlock = () => {
    userHasTapped = true;
    for (const player of Object.values(getPlayers())) {
      try {
        player.muted = true;
        player.play();
        player.pause();
        void player.seekTo(0);
        player.muted = false;
      } catch {
        // A player that cannot start now will simply stay silent.
      }
    }
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
}
unlockOnFirstTap();

function play(name: SoundName) {
  if (sessionMuted || !userHasTapped) return;
  const player = getPlayers()[name];
  void player.seekTo(0).then(() => player.play()).catch(() => undefined);
}

function canVibrate() {
  if (!IS_WEB) return true;
  return userHasTapped && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function haptic(kind: 'light' | 'medium' | 'select' | 'success' | 'error') {
  if (!canVibrate()) return;
  const done = () => undefined;
  if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(done);
  else if (kind === 'medium') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(done);
  else if (kind === 'select') void Haptics.selectionAsync().catch(done);
  else if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(done);
  else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(done);
}

function publishMuteState(muted: boolean) {
  sessionMuted = muted;
  muteListeners.forEach((listener) => listener(muted));
}

const actions = {
  toggleMuted: () => publishMuteState(!sessionMuted),
  correct: () => { play('correct'); haptic('light'); },
  skip: () => { play('skip'); haptic('light'); },
  dangerTick: () => { play('tick'); haptic('select'); },
  timeUp: () => { play('timeUp'); haptic('error'); },
  draw: () => { play('draw'); haptic('select'); },
  conquest: () => { play('conquest'); haptic('medium'); },
  champion: () => { play('champion'); haptic('success'); },
};

export function useGameFeedback() {
  const [muted, setMuted] = useState(sessionMuted);

  useEffect(() => {
    muteListeners.add(setMuted);
    return () => {
      muteListeners.delete(setMuted);
    };
  }, []);

  // Stable identities, so screens can list them in effect dependencies.
  const toggleMuted = useCallback(() => actions.toggleMuted(), []);
  return { muted, ...actions, toggleMuted };
}
