import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/design/tokens';
import type { GameState } from '@/game/types';

type ArenaBattleMiniMapProps = {
  attackerId: string;
  defenderId: string;
  state: GameState;
};

export function ArenaBattleMiniMap({ attackerId, defenderId, state }: ArenaBattleMiniMapProps) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];

  return (
    <View
      accessibilityLabel={`מפת הזירה: הקרב בין ${attacker.name} לבין ${defender.name}`}
      style={styles.frame}>
      {state.cells.map((cell) => {
        const isAttacker = cell.ownerId === attackerId;
        const isDefender = cell.ownerId === defenderId;
        return (
          <View
            key={cell.id}
            style={[
              styles.cell,
              // Arena colors: the attacker is the active light blue, the defender the
              // chosen (gold) target, everything else floor.
              { backgroundColor: isAttacker
                ? colors.territoryMeEnd
                : isDefender
                  ? colors.territorySelected
                  : colors.arenaFloor },
              (isAttacker || isDefender) && styles.battleCell,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 70,
    height: 70,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    padding: 3,
  },
  cell: {
    width: 13,
    height: 13,
    borderRadius: radii.cell / 2,
    opacity: 0.6,
  },
  battleCell: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    opacity: 1,
  },
});
