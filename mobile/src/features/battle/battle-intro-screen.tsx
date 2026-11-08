import { by } from '@/game/gender';
import { colors } from '@/design/tokens';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { CATEGORY_BY_ID, getWay } from '@/content/categories';
import type { BattleSetup, GameState } from '@/game/types';
import { styles } from './battle-transition-styles';
import { primeWebKeyboard } from '@/design/keyboard-primer';

export function BattleIntroScreen({
  battleNumber = 1,
  onComplete,
  setup,
  state,
}: {
  battleNumber?: number;
  onComplete: () => void;
  setup: BattleSetup;
  state: GameState;
}) {
  const attacker = state.players[setup.attackerId];
  const defender = state.players[setup.defenderId];
  const category = CATEGORY_BY_ID[setup.categoryId];
  const way = getWay(category, setup.wayId);
  // Decision 15: an attacked human is warned how this duel is played.
  const humanDefends = defender.isHuman;
  const hasBonusNotice = setup.attackerUsesBonus || setup.defenderUsesBonus;
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(entrance, {
      duration: 650,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.centerScreen}>
        <Text style={styles.eyebrow}>{setup.isFinal ? 'הקרב על כל הזירה' : 'האתגר נבחר'}</Text>
        <View style={styles.duelTitleWrap}>
          <Text style={[styles.duelTitle, styles.duelTitleDepth]}>{setup.isFinal ? 'דו־קרב הגמר' : `דו־קרב ${battleNumber}`}</Text>
          <Text style={styles.duelTitle}>{setup.isFinal ? 'דו־קרב הגמר' : `דו־קרב ${battleNumber}`}</Text>
        </View>

        <Animated.View
          style={[
            styles.matchup,
            {
              opacity: entrance,
              transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
          ]}>
          <PlayerCard avatar={attacker.avatar} bonus={setup.attackerUsesBonus} cellCount={attacker.cellIds.length} color={attacker.color} label="תוקף" name={attacker.name} />
          <View style={styles.versusBadge}><Text style={styles.versusText}>VS</Text></View>
          <PlayerCard avatar={defender.avatar} bonus={setup.defenderUsesBonus} cellCount={defender.cellIds.length} color={defender.color} label="מגן" name={defender.name} />
        </Animated.View>

        <View style={styles.categoryCard}>
          <Text style={styles.categoryLabel}>הקטגוריה עליה מתחרים</Text>
          <Text style={styles.categoryValue}>{category.name}</Text>
          <View style={[styles.wayNotice, humanDefends && styles.wayNoticeAlert]}>
            <Text style={styles.wayNoticeLabel}>{humanDefends ? 'שימו לב – כך משחקים בדו־קרב הזה' : 'איך משחקים'}</Text>
            <Text style={styles.wayNoticeValue}>{way.label}</Text>
          </View>
        </View>

        {hasBonusNotice && (
          <View style={styles.bonusNotice}>
            <Text style={styles.bonusNoticeText}>
              {setup.attackerUsesBonus && setup.defenderUsesBonus
                ? `ל${attacker.name} ול${defender.name} יש בונוס — כל אחד מתחיל עם 45 שניות.`
                : `${setup.attackerUsesBonus ? attacker.name : defender.name} ${by(setup.attackerUsesBonus ? attacker : defender, 'מקבל', 'מקבלת')} 45 שניות במקום 40.`}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            // Open the iPhone keyboard inside this tap, before the duel screen mounts.
            if (state.players[setup.attackerId].isHuman || state.players[setup.defenderId].isHuman) primeWebKeyboard();
            onComplete();
          }}
          style={styles.startBattleButton}>
          <Text style={styles.startBattleButtonText}>התחלת דו־קרב</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayerCard({ avatar, bonus, cellCount, color, label, name }: { avatar: string; bonus: boolean; cellCount: number; color: string; label: string; name: string }) {
  return (
    <View style={[styles.playerCard, { borderColor: color }]}>
      <View style={[styles.playerColor, { backgroundColor: color }]} />
      <Text style={styles.playerLabel}>{label}</Text>
      <View style={styles.playerAvatar}><AvatarPortrait avatarId={avatar} borderColor={colors.textPrimary} size={112} /></View>
      <Text numberOfLines={1} style={styles.playerCardName}>{name}</Text>
      <Text numberOfLines={1} style={styles.playerCategory}>{cellCount === 1 ? 'משבצת אחת' : `${cellCount} משבצות`}</Text>
      {bonus && <Text style={styles.playerBonus}>45 שניות • בונוס</Text>}
    </View>
  );
}
