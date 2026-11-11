import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnlineDuel } from '@/features/online-game/online-duel';
import type { OnlineView } from '@/game/online-view';
import { viewToGameState } from '@/online/view-to-state';

// QA: the online duel with a fixed fake view. `?img=cartoons-11` picks the picture (any key from item-images),
// `?side=attacker|defender|watch` picks who looks at it.
export default function QaOnlineDuelScreen() {
  const params = useLocalSearchParams<{ img?: string; side?: string }>();
  const img = (Array.isArray(params.img) ? params.img[0] : params.img) ?? 'cartoons-11';
  const sideParam = Array.isArray(params.side) ? params.side[0] : params.side;
  const mySide = sideParam === 'watch' ? null : sideParam === 'defender' ? 'defender' : 'attacker';
  const view = {
    stage: 'duel', round: 1, duels: 3, cells: [], attackerId: 'a', targets: [], finalOptions: [], result: null,
    drawQuick: false, continuing: false, chosenTargetId: null, milestone: null, choiceLeftMs: null, championId: null,
    events: [], serverNow: Date.now(),
    players: [
      { id: 'a', name: 'נועם', avatar: 'avatar-01', gender: 'male', isHuman: true, isActive: true, categoryId: 'x', cells: 1, winStreak: 0, bonusReady: false, played: false, away: false },
      { id: 'b', name: 'מלך הזירה', avatar: 'avatar-02', gender: 'female', isHuman: true, isActive: false, categoryId: 'x', cells: 1, winStreak: 0, bonusReady: false, played: false, away: false },
    ],
    setup: {
      attackerId: 'a', defenderId: 'b', categoryId: 'cartoons', categoryName: 'דמויות מצוירות', wayLabel: 'דמות ← שם הדמות',
      attackerSeconds: 40, defenderSeconds: 40, attackerUsesBonus: false, defenderUsesBonus: false, isFinal: false,
    },
    duel: { active: 'attacker', itemId: 'i', imageKey: img, remainingMs: { attacker: 12600, defender: 10200 }, paused: true, winner: null },
  } as unknown as OnlineView;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <OnlineDuel correctCount={0} muted={false} mySide={mySide} onToggleMuted={() => {}} receivedAt={Date.now()} send={() => {}} state={viewToGameState(view, 'a')} view={view} />
    </SafeAreaView>
  );
}
