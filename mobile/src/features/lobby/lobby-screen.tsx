import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { BrandBackground, BrandPrimaryButton, BrandSecondaryButton } from '@/design/brand';
import { colors } from '@/design/tokens';
import { CATEGORIES, CATEGORY_BY_ID } from '@/content/categories';
import { isPickable, Lobby, MAX_HUMANS, MIN_HUMANS_TO_START } from '@/game/lobby';
import type { LobbyError } from '@/game/lobby';
import type { LobbyEntry } from '@/game/flow';
import { styles } from '@/features/home/home-styles';

const MESSAGES: Record<LobbyError, string> = {
  room_full: 'החדר מלא',
  in_game: 'המשחק כבר התחיל',
  unknown_category: 'אי אפשר לבחור את הקטגוריה הזו',
  category_taken: 'הקטגוריה כבר נלקחה – בחרו אחרת',
  bad_way: 'אי אפשר לבחור את דרך המשחק הזו',
  not_a_player: 'רק שחקנים בחדר יכולים לבחור',
  not_host: 'רק מי שפתח את החדר מתחיל',
  need_more_players: `צריך לפחות ${MIN_HUMANS_TO_START} שחקנים כדי להתחיל`,
  need_categories: 'לא כולם בחרו קטגוריה',
  already_started: 'המשחק כבר התחיל',
};

const ME = 'me';
// Stand-ins for other people while the lobby runs on mock data (the server version sends the real ones).
const MOCK_PEOPLE = [
  { clientId: 'm1', userId: 101, name: 'דנה', avatar: 'avatar-05' },
  { clientId: 'm2', userId: 102, name: 'רון', avatar: 'avatar-09' },
  { clientId: 'm3', userId: 103, name: 'מיכל', avatar: 'avatar-12' },
];
const PICKABLE = CATEGORIES.filter((category) => isPickable(category.id));

// The waiting room: who is in, who is the host, and a category for everyone (switchable until the host starts).
// Runs the same rules as the server (game/lobby.ts) on mock people for now.
export function LobbyScreen({ avatar, entry, nickname, onBack }: { avatar: string; entry: LobbyEntry; nickname: string; onBack: () => void }) {
  const lobby = useMemo(() => new Lobby(entry.name, entry.code, 'public'), [entry.name, entry.code]);
  const avatars = useRef<Record<string, string>>({ [ME]: avatar });
  const [, setVersion] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const redraw = () => setVersion((value) => value + 1);

  // Seed the room. A room you opened starts with you alone and a friend arrives a moment later;
  // a room you joined already has people in it (the host first).
  useEffect(() => {
    const addMock = (index: number, category: string | null) => {
      const person = MOCK_PEOPLE[index];
      avatars.current[person.clientId] = person.avatar;
      lobby.join(person);
      if (category) lobby.pickCategory(person.clientId, category);
      redraw();
    };
    const [a, b] = [PICKABLE[3].id, PICKABLE[7].id];
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (entry.watching) {
      addMock(0, a); addMock(1, b); addMock(2, PICKABLE[11].id);
    } else if (entry.isHost) {
      lobby.join({ clientId: ME, userId: 1, name: nickname });
      timers.push(setTimeout(() => addMock(0, null), 1600), setTimeout(() => { lobby.pickCategory('m1', a); redraw(); }, 3200));
    } else {
      addMock(0, a); addMock(1, b);
      lobby.join({ clientId: ME, userId: 1, name: nickname });
    }
    redraw();
    return () => timers.forEach(clearTimeout);
  }, [lobby, entry.isHost, entry.watching, nickname]);

  const view = lobby.view();
  const me = view.members.find((member) => member.clientId === ME);
  const hostIsMe = view.hostClientId === ME;
  const empty = Math.max(0, MAX_HUMANS - view.members.length);

  const pick = (categoryId: string) => {
    const result = lobby.pickCategory(ME, categoryId);
    setMessage(result.ok ? null : MESSAGES[result.error]);
    redraw();
  };
  const start = () => {
    const result = lobby.canStart(ME);
    setMessage(result.ok ? 'המשחק המלא אונליין מתחבר בשלב הבא – כאן נתחיל אותו.' : MESSAGES[result.error]);
  };

  return (
    <BrandBackground>
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={styles.lobbyHeader}>
            <Text accessibilityRole="header" style={styles.lobbyName} weight="black">{entry.name}</Text>
            <View style={styles.codePill}>
              <Text style={styles.codeLabel}>קוד החדר</Text>
              <Text style={styles.codeValue} weight="black">{entry.code}</Text>
            </View>
            <Text style={styles.note}>
              {entry.watching ? '👁 אתם צופים בחדר' : `משתתפים ${view.members.length}/${MAX_HUMANS} · שאר המקומות יתמלאו בבוטים`}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle} weight="black">מי בחדר</Text>
            {view.members.map((member) => (
              <View key={member.clientId} style={styles.memberRow}>
                <AvatarPortrait avatarId={avatars.current[member.clientId] ?? 'avatar-01'} borderColor={member.isHost ? colors.accentGold : colors.brandSky} size={44} />
                <View style={styles.memberText}>
                  <Text style={styles.memberName} weight="bold">{member.isHost ? '👑 ' : ''}{member.name}{member.clientId === ME ? ' (אני)' : ''}</Text>
                  <Text style={styles.memberCategory}>
                    {member.categoryId ? `${CATEGORY_BY_ID[member.categoryId].icon} ${CATEGORY_BY_ID[member.categoryId].name}` : 'עוד לא בחר/ה קטגוריה…'}
                  </Text>
                </View>
              </View>
            ))}
            {Array.from({ length: empty }, (_, index) => (
              <View key={`empty-${index}`} style={[styles.memberRow, styles.memberEmpty]}>
                <View style={[styles.podiumEmptyAvatar, { width: 44, height: 44, borderRadius: 12 }]}><Text style={styles.podiumEmptyMark}>+</Text></View>
                <Text style={styles.memberCategory}>מקום פנוי – בוט יתפוס אותו</Text>
              </View>
            ))}
          </View>

          {!entry.watching && me ? (
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
                      onPress={() => pick(category.id)}
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
          {message ? <Text style={styles.note}>{message}</Text> : null}
          {!entry.watching && hostIsMe ? (
            <BrandPrimaryButton disabled={!view.canStart} icon="▶️" label={view.canStart ? 'התחלת המשחק' : 'מחכים לשחקן נוסף ולקטגוריות'} onPress={start} />
          ) : null}
          {!entry.watching && !hostIsMe ? <Text style={styles.note}>רק מי שפתח את החדר יכול להתחיל את המשחק</Text> : null}
          <BrandSecondaryButton label="יציאה מהחדר" onPress={onBack} />
        </View>
      </View>
    </BrandBackground>
  );
}
