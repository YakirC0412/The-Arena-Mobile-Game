import { by } from '@/game/gender';
import { useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { CATEGORY_BY_ID } from '@/content/categories';
import type { BattleSetup, GameState } from '@/game/types';
import { ITEM_IMAGES } from '@/content/item-images';
import { styles } from './battle-transition-styles';

type SimulationFrame = {
  activeId: string;
  attackerSeconds: number;
  defenderSeconds: number;
  questionIndex: number;
  status: string;
  decided: boolean;
};

function createSimulationFrames(setup: BattleSetup, winnerId: string): SimulationFrame[] {
  const loserId = winnerId === setup.attackerId ? setup.defenderId : setup.attackerId;
  let attackerSeconds = setup.attackerSeconds;
  let defenderSeconds = setup.defenderSeconds;
  let activeId = setup.attackerId;
  let questionIndex = 0;
  const frames: SimulationFrame[] = [];
  const spendPattern = [3, 4, 2, 5, 3, 6, 2, 4, 5, 3, 4, 6, 3, 5];

  spendPattern.forEach((spend, index) => {
    if (activeId === setup.attackerId) attackerSeconds = Math.max(1, attackerSeconds - spend);
    else defenderSeconds = Math.max(1, defenderSeconds - spend);
    frames.push({
      activeId,
      attackerSeconds,
      defenderSeconds,
      questionIndex,
      status: index % 5 === 4 ? 'דילוג • 3- שניות' : 'מנסה לזהות...',
      decided: false,
    });
    if (index % 5 === 4) {
      if (activeId === setup.attackerId) attackerSeconds = Math.max(1, attackerSeconds - 3);
      else defenderSeconds = Math.max(1, defenderSeconds - 3);
    } else {
      questionIndex += 1;
      frames.push({
        activeId,
        attackerSeconds,
        defenderSeconds,
        questionIndex,
        status: 'תשובה נכונה • התור עובר',
        decided: false,
      });
      activeId = activeId === setup.attackerId ? setup.defenderId : setup.attackerId;
    }
  });

  activeId = loserId;
  frames.push({
    activeId,
    attackerSeconds,
    defenderSeconds,
    questionIndex,
    status: 'הזמן הולך ואוזל...',
    decided: false,
  });
  frames.push({
    activeId,
    attackerSeconds: loserId === setup.attackerId ? 0 : attackerSeconds,
    defenderSeconds: loserId === setup.defenderId ? 0 : defenderSeconds,
    questionIndex,
    status: 'הזמן נגמר',
    decided: true,
  });
  return frames;
}

export function AiBattleSimulationScreen({
  onComplete,
  setup,
  state,
  winnerId,
}: {
  onComplete: (winnerId: string) => void;
  setup: BattleSetup;
  state: GameState;
  winnerId: string;
}) {
  const attacker = state.players[setup.attackerId];
  const defender = state.players[setup.defenderId];
  const category = CATEGORY_BY_ID[setup.categoryId];
  const winner = state.players[winnerId];
  const frames = useMemo(() => createSimulationFrames(setup, winnerId), [setup, winnerId]);
  const [frameIndex, setFrameIndex] = useState(0);
  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const item = category.items[frame.questionIndex % category.items.length];
  const itemImage = item.imageKey ? ITEM_IMAGES[item.imageKey] : undefined;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((current) => Math.min(current + 1, frames.length - 1));
    }, 280);
    const completeTimer = setTimeout(() => onComplete(winnerId), frames.length * 280 + 1100);
    return () => {
      clearInterval(interval);
      clearTimeout(completeTimer);
    };
  }, [frames.length, onComplete, winnerId]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.simulationScreen}>
        <Text style={styles.eyebrow}>סימולציית דו־קרב</Text>
        <Text style={styles.simulationTitle}>{category.name}</Text>

        <View style={styles.simulationPlayers}>
          <SimulationClock active={!frame.decided && frame.activeId === attacker.id} avatar={attacker.avatar} color={attacker.color} name={attacker.name} seconds={frame.attackerSeconds} />
          <Text style={styles.simulationVs}>מול</Text>
          <SimulationClock active={!frame.decided && frame.activeId === defender.id} avatar={defender.avatar} color={defender.color} name={defender.name} seconds={frame.defenderSeconds} />
        </View>

        <View style={styles.questionStage}>
          <Text style={styles.questionCount}>{frame.decided ? 'הקרב הוכרע' : `תמונה ${frame.questionIndex + 1}`}</Text>
          <View style={styles.abstractImage}>
            {itemImage
              ? <Image resizeMode="contain" source={itemImage} style={styles.simulationImage} />
              : <Text style={styles.simulationVisual}>{item.visual}</Text>}
          </View>
          <Text style={styles.thinkingText}>
            {frame.decided ? `${winner.name} ${by(winner, 'ניצח', 'ניצחה')} בדו־קרב` : `${state.players[frame.activeId].name}: ${frame.status}`}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((frameIndex + 1) / frames.length) * 100}%` }]} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function SimulationClock({ active, avatar, color, name, seconds }: { active: boolean; avatar: string; color: string; name: string; seconds: number }) {
  return (
    <View style={[styles.simulationClock, active && styles.simulationClockActive, { borderColor: color }]}> 
      <AvatarPortrait avatarId={avatar} borderColor={color} size={52} />
      <Text numberOfLines={1} style={styles.clockName}>{name}</Text>
      <Text style={styles.clockSeconds}>{seconds}</Text>
      <Text style={styles.clockUnit}>שניות</Text>
    </View>
  );
}
