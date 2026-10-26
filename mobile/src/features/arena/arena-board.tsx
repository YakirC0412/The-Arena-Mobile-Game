import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AvatarPortrait } from '@/design/avatar-portrait';
import { AppText } from '@/design/app-text';
import { colors, radii, spacing, typeScale } from '@/design/tokens';
import { CATEGORY_BY_ID } from '@/content/categories';
import { getTerritoryLabelRegion } from '@/features/arena/territory-layout';
import type { GameState } from '@/game/types';

export type ArenaBoardMode = 'select-target' | 'simulation' | 'overview';

type ArenaBoardProps = {
  meId?: string | null;
  mode?: ArenaBoardMode;
  onSelectTarget?: (playerId: string) => void;
  selectedId?: string | null;
  state: GameState;
  targetIds?: string[];
};

type TerritoryState = 'me' | 'target' | 'selected' | 'dark' | 'overview';

export function ArenaBoard({
  meId,
  mode = 'overview',
  onSelectTarget,
  selectedId,
  state,
  targetIds = [],
}: ArenaBoardProps) {
  const targets = useMemo(() => new Set(targetIds), [targetIds]);
  const territoryRegions = useMemo(() => {
    const regions = new Map<string, ReturnType<typeof getTerritoryLabelRegion>>();
    Object.values(state.players).forEach((player) => {
      if (!player.isActive || player.cellIds.length === 0) return;
      const cells = player.cellIds.map((cellId) => state.cells[cellId]);
      regions.set(player.id, getTerritoryLabelRegion(cells));
    });
    return regions;
  }, [state.cells, state.players]);

  return (
    <View accessibilityLabel="לוח הזירה, ארבע על ארבע" style={styles.frame}>
      <View style={styles.board}>
        {state.cells.map((cell) => {
          const owner = state.players[cell.ownerId];
          const category = CATEGORY_BY_ID[owner.categoryId];
          const isMe = owner.id === meId;
          const isTarget = targets.has(owner.id);
          const isSelected = owner.id === selectedId;
          const territoryState: TerritoryState = mode === 'overview'
            ? isMe ? 'me' : 'overview'
            : isSelected
              ? 'selected'
              : isMe
                ? 'me'
                : isTarget
                  ? 'target'
                  : 'dark';
          const isInteractive = mode === 'select-target' && isTarget;
          const isAnchor = territoryRegions.get(owner.id)?.anchorId === cell.id;
          const sameOwnerAt = (row: number, column: number) => (
            row >= 0 && row < 4 && column >= 0 && column < 4
              ? state.cells[row * 4 + column].ownerId === owner.id
              : false
          );
          const joinsTop = sameOwnerAt(cell.row - 1, cell.column);
          const joinsBottom = sameOwnerAt(cell.row + 1, cell.column);
          const joinsLeft = sameOwnerAt(cell.row, cell.column - 1);
          const joinsRight = sameOwnerAt(cell.row, cell.column + 1);
          const outlineWidth = territoryState === 'target' || territoryState === 'selected'
            ? 3
            : territoryState === 'me'
              ? 2
              : 1;
          const territoryShape = {
            borderTopWidth: joinsTop ? 0 : outlineWidth,
            borderBottomWidth: joinsBottom ? 0 : outlineWidth,
            borderLeftWidth: joinsLeft ? 0 : outlineWidth,
            borderRightWidth: joinsRight ? 0 : outlineWidth,
            borderTopLeftRadius: !joinsTop && !joinsLeft ? radii.cell : 0,
            borderTopRightRadius: !joinsTop && !joinsRight ? radii.cell : 0,
            borderBottomLeftRadius: !joinsBottom && !joinsLeft ? radii.cell : 0,
            borderBottomRightRadius: !joinsBottom && !joinsRight ? radii.cell : 0,
            left: `${cell.column * 25}%` as const,
            top: `${cell.row * 25}%` as const,
          };
          const fillColor = territoryState === 'selected' || territoryState === 'target'
            ? colors.territoryTarget
            : territoryState === 'overview'
              ? colors.surface
              : colors.boardCellDark;
          const borderColor = territoryState === 'selected'
            ? colors.territorySelected
            : territoryState === 'target'
              ? colors.territoryTargetBorder
              : territoryState === 'me'
                ? colors.territoryMeBorder
                : territoryState === 'overview'
                  ? colors.border
                  : colors.boardCellDarkBorder;

          return (
            <Pressable
              accessible={isAnchor}
              accessibilityLabel={isInteractive
                ? `${category.name}, ${owner.name}, ניתן לתקוף`
                : `${category.name}, ${owner.name}`}
              accessibilityRole={isInteractive ? 'button' : undefined}
              accessibilityState={isInteractive ? { selected: isSelected } : undefined}
              importantForAccessibility={isAnchor ? 'yes' : 'no-hide-descendants'}
              disabled={!isInteractive}
              key={cell.id}
              onPress={() => {
                void Haptics.selectionAsync();
                onSelectTarget?.(owner.id);
              }}
              style={({ pressed }) => [
                styles.cell,
                { backgroundColor: fillColor, borderColor },
                territoryShape,
                territoryState === 'target' && styles.targetCell,
                territoryState === 'selected' && styles.selectedCell,
                territoryState === 'me' && styles.meCell,
                territoryState === 'dark' && styles.darkCell,
                pressed && styles.pressedCell,
              ]}>
              {territoryState === 'me' ? <View pointerEvents="none" style={styles.cellFill} /> : null}

              {joinsLeft ? <View pointerEvents="none" style={[styles.verticalBridge, styles.bridgeLeft, { backgroundColor: territoryState === 'me' ? colors.territoryMeEnd : fillColor }]} /> : null}
              {joinsRight ? <View pointerEvents="none" style={[styles.verticalBridge, styles.bridgeRight, { backgroundColor: territoryState === 'me' ? colors.territoryMeEnd : fillColor }]} /> : null}
              {joinsTop ? <View pointerEvents="none" style={[styles.horizontalBridge, styles.bridgeTop, { backgroundColor: territoryState === 'me' ? colors.territoryMeEnd : fillColor }]} /> : null}
              {joinsBottom ? <View pointerEvents="none" style={[styles.horizontalBridge, styles.bridgeBottom, { backgroundColor: territoryState === 'me' ? colors.territoryMeEnd : fillColor }]} /> : null}

            </Pressable>
          );
        })}

        {Object.values(state.players).map((owner) => {
          const region = territoryRegions.get(owner.id);
          if (!region || !owner.isActive) return null;
          const isMe = owner.id === meId;
          const isTarget = targets.has(owner.id);
          const isSelected = owner.id === selectedId;
          const territoryState: TerritoryState = mode === 'overview'
            ? isMe ? 'me' : 'overview'
            : isSelected
              ? 'selected'
              : isMe
                ? 'me'
                : isTarget
                  ? 'target'
                  : 'dark';
          if (territoryState === 'dark') return null;
          return (
            <View
              key={`label-${owner.id}`}
              pointerEvents="none"
              style={[
                styles.territoryLabelPosition,
                {
                  height: `${region.height}%`,
                  left: `${region.left}%`,
                  top: `${region.top}%`,
                  width: `${region.width}%`,
                },
              ]}>
              <TerritoryLabel
                categoryName={CATEGORY_BY_ID[owner.categoryId].name}
                isMe={territoryState === 'me'}
                mode={mode}
                ownerAvatar={owner.avatar}
                ownerName={owner.name}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TerritoryLabel({
  categoryName,
  isMe,
  mode,
  ownerAvatar,
  ownerName,
}: {
  categoryName: string;
  isMe: boolean;
  mode: ArenaBoardMode;
  ownerAvatar: string;
  ownerName: string;
}) {
  const compactLabel = mode !== 'overview';
  return (
    <View pointerEvents="none" style={styles.label}>
      <AppText numberOfLines={1} style={[styles.category, isMe && styles.meText]} weight="bold">
        {categoryName}
      </AppText>
      <View style={styles.ownerRow}>
        <AvatarPortrait avatarId={ownerAvatar} borderColor={isMe ? colors.boardFrame : colors.textPrimary} size={compactLabel ? 24 : 28} />
        <AppText numberOfLines={1} style={[styles.owner, isMe && styles.meOwner]} weight="bold">
          {ownerName}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 380,
    aspectRatio: 1,
    alignSelf: 'center',
    padding: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: colors.boardFrameBorder,
    backgroundColor: colors.boardFrame,
    shadowColor: colors.boardFrameBorder,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  board: { flex: 1, position: 'relative' },
  cell: {
    position: 'absolute',
    width: '25%',
    height: '25%',
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  cellFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.territoryMeEnd },
  meCell: { zIndex: 1 },
  targetCell: { zIndex: 2 },
  selectedCell: { zIndex: 3 },
  darkCell: { opacity: 0.82 },
  pressedCell: { transform: [{ scale: 0.97 }] },
  verticalBridge: { position: 'absolute', top: 0, bottom: 0, width: 6, zIndex: 1 },
  horizontalBridge: { position: 'absolute', left: 0, right: 0, height: 6, zIndex: 1 },
  bridgeLeft: { left: -3 },
  bridgeRight: { right: -3 },
  bridgeTop: { top: -3 },
  bridgeBottom: { bottom: -3 },
  label: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 2, zIndex: 4 },
  territoryLabelPosition: {
    position: 'absolute',
    overflow: 'hidden',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  category: {
    maxWidth: '100%',
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
    textShadowColor: colors.bg,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  meText: { color: colors.boardFrame, fontSize: 16, lineHeight: 19, textShadowRadius: 0 },
  ownerRow: { maxWidth: '100%', flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs },
  owner: { flexShrink: 1, color: colors.textPrimary, fontSize: typeScale.caption, lineHeight: 15, textAlign: 'center' },
  meOwner: { color: colors.boardFrame },
});
