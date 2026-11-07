import { Pressable, ScrollView, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { BrandBackground, BrandPrimaryButton, BrandSecondaryButton } from '@/design/brand';
import { colors } from '@/design/tokens';
import { CATEGORIES, CATEGORY_BY_ID } from '@/content/categories';
import { isPickable, MAX_HUMANS } from '@/game/lobby';
import type { LobbyEntry } from '@/game/flow';
import { styles } from '@/features/home/home-styles';
import { OnlineGameScreen } from '@/features/online/online-game-screen';
import { useMockLobby, useServerLobby, type LobbyLink } from './use-lobby-link';

const PICKABLE = CATEGORIES.filter((category) => isPickable(category.id));

// The waiting room on the Arena server.
export function ServerLobbyScreen({ avatar, entry, nickname, onBack }: { avatar: string; entry: LobbyEntry; nickname: string; onBack: () => void }) {
  const link = useServerLobby(entry, nickname, avatar);
  return <LobbyScreen entry={entry} link={link} onBack={onBack} />;
}

// The same screen on sample data (QA only).
export function MockLobbyScreen({ avatar, entry, nickname, onBack }: { avatar: string; entry: LobbyEntry; nickname: string; onBack: () => void }) {
  const link = useMockLobby(entry, nickname, avatar);
  return <LobbyScreen entry={entry} link={link} onBack={onBack} />;
}

// Who is in the room, who is the host, and a category for everyone (switchable until the host starts).
function LobbyScreen({ entry, link, onBack }: { entry: LobbyEntry; link: LobbyLink; onBack: () => void }) {
  const leave = () => {
    link.leave();
    onBack();
  };

  if (link.status === 'connecting' || link.status === 'error' || !link.view) {
    return (
      <BrandBackground>
        <View style={[styles.shell, { justifyContent: 'center', padding: 24, gap: 16 }]}>
          <Text style={styles.stateIcon}>{link.status === 'error' ? '📡' : '⏳'}</Text>
          <Text style={styles.stateText}>{link.status === 'error' ? link.fatal : 'מתחברים לחדר…'}</Text>
          <BrandSecondaryButton label="חזרה" onPress={leave} />
        </View>
      </BrandBackground>
    );
  }

  const { view } = link;
  if (link.game) return <OnlineGameScreen link={link} onLeave={leave} />;
  const me = view.members.find((member) => member.clientId === link.myId);
  const hostIsMe = view.hostClientId === link.myId;
  const watching = link.watching || !me;
  const empty = Math.max(0, MAX_HUMANS - view.members.length);
  const inGame = view.phase === 'inGame';

  return (
    <BrandBackground>
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={styles.lobbyHeader}>
            <Text accessibilityRole="header" style={styles.lobbyName} weight="black">{view.name || entry.name}</Text>
            <View style={styles.codePill}>
              <Text style={styles.codeLabel}>קוד החדר</Text>
              <Text style={styles.codeValue} weight="black">{view.code}</Text>
            </View>
            <Text style={styles.note}>
              {watching ? '👁 אתם צופים בחדר' : `משתתפים ${view.members.length}/${MAX_HUMANS} · שאר המקומות יתמלאו בבוטים`}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle} weight="black">מי בחדר</Text>
            {view.members.map((member) => (
              <View key={member.clientId} style={styles.memberRow}>
                <AvatarPortrait avatarId={member.avatar} borderColor={member.isHost ? colors.accentGold : colors.brandSky} size={44} />
                <View style={styles.memberText}>
                  <Text style={styles.memberName} weight="bold">{member.isHost ? '👑 ' : ''}{member.name}{member.clientId === link.myId ? ' (אני)' : ''}</Text>
                  <Text style={styles.memberCategory}>
                    {member.categoryId ? `${CATEGORY_BY_ID[member.categoryId].icon} ${CATEGORY_BY_ID[member.categoryId].name}` : 'עוד לא בחר/ה קטגוריה…'}
                  </Text>
                </View>
              </View>
            ))}
            {!inGame ? Array.from({ length: empty }, (_, index) => (
              <View key={`empty-${index}`} style={[styles.memberRow, styles.memberEmpty]}>
                <View style={[styles.podiumEmptyAvatar, { width: 44, height: 44, borderRadius: 12 }]}><Text style={styles.podiumEmptyMark}>+</Text></View>
                <Text style={styles.memberCategory}>מקום פנוי – בוט יתפוס אותו</Text>
              </View>
            )) : null}
          </View>

          {!watching && !inGame && me ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle} weight="black">הקטגוריה שלי</Text>
              <Text style={styles.cardText}>אפשר להחליף כמה פעמים שרוצים עד שהמארח מתחיל. קטגוריה שחבר לקח אפורה.</Text>
              <View style={styles.catGrid}>
                {PICKABLE.map((category) => {
                  const mine = me.categoryId === category.id;
                  const taken = !mine && view.takenCategoryIds.includes(category.id);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: taken, selected: mine }}
                      key={category.id}
                      onPress={() => link.pick(category.id)}
                      style={[styles.cat, mine && styles.catMine, taken && styles.catTaken]}>
                      <Text style={styles.catText}>{category.icon}</Text>
                      <Text style={styles.catText} weight={mine ? 'black' : 'medium'}>{category.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footerBar}>
          {link.notice ? <Text style={styles.note}>{link.notice}</Text> : null}
          {link.status === 'closed' ? <Text style={styles.note}>החיבור לחדר נסגר</Text> : null}
          {!watching && !inGame && hostIsMe ? (
            <BrandPrimaryButton disabled={!view.canStart} icon="▶️" label={view.canStart ? 'התחלת המשחק' : 'מחכים לשחקן נוסף ולקטגוריות'} onPress={link.start} />
          ) : null}
          {!watching && !inGame && !hostIsMe ? <Text style={styles.note}>רק מי שפתח את החדר יכול להתחיל את המשחק</Text> : null}
          <BrandSecondaryButton label="יציאה מהחדר" onPress={leave} />
        </View>
      </View>
    </BrandBackground>
  );
}
