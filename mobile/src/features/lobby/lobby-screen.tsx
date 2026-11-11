import { by } from '@/game/gender';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { BrandBackground, BrandPrimaryButton, BrandSecondaryButton } from '@/design/brand';
import { colors } from '@/design/tokens';
import { CATEGORY_BY_ID, getAvailableWays, getWay } from '@/content/categories';
import { MAX_HUMANS } from '@/game/lobby';
import type { LobbyEntry } from '@/game/flow';
import { BottomSheet } from '@/features/home/bottom-sheet';
import { styles } from '@/features/home/home-styles';
import { OnlineGameScreen } from '@/features/online/online-game-screen';
import { CategoryPicker } from './category-picker';
import { shareRoomInvite, type ShareResult } from './share-room';
import { useMockLobby, useServerLobby, type LobbyLink } from './use-lobby-link';

// The waiting room on the Arena server.
export function ServerLobbyScreen({ avatar, entry, gender, nickname, onBack }: { avatar: string; entry: LobbyEntry; gender: 'male' | 'female'; nickname: string; onBack: () => void }) {
  const link = useServerLobby(entry, nickname, avatar, gender);
  return <LobbyScreen entry={entry} link={link} onBack={onBack} />;
}

// The same screen on sample data (QA only).
export function MockLobbyScreen({ avatar, entry, nickname, onBack }: { avatar: string; entry: LobbyEntry; nickname: string; onBack: () => void }) {
  const link = useMockLobby(entry, nickname, avatar);
  return <LobbyScreen entry={entry} link={link} onBack={onBack} />;
}

// Who is in the room, who is the host, and a category for everyone (switchable until the host starts).
function LobbyScreen({ entry, link, onBack }: { entry: LobbyEntry; link: LobbyLink; onBack: () => void }) {
  const [shareState, setShareState] = useState<ShareResult | null>(null);
  // Changing the category later happens in a pop-up (the first choice is a required full screen, see below).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const leave = () => {
    link.leave();
    onBack();
  };

  if (link.status === 'connecting' || link.status === 'error' || !link.view || (link.status === 'closed' && !link.game)) {
    return (
      <BrandBackground>
        <View style={[styles.shell, { justifyContent: 'center', padding: 24, gap: 16 }]}>
          <Text style={styles.stateIcon}>{link.status === 'error' ? '📡' : link.status === 'closed' ? '🚪' : '⏳'}</Text>
          <Text style={styles.stateText}>{link.status === 'error' ? link.fatal : link.status === 'closed' ? 'החדר נסגר' : 'מתחברים לחדר…'}</Text>
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

  // Choosing a category is required to be in the room: nobody sees the lobby before they have one.
  if (!watching && !inGame && me && !me.categoryId) {
    return (
      <BrandBackground>
        <View style={styles.shell}>
          <View style={styles.gateHeader}>
            <Text accessibilityRole="header" style={styles.gateTitle} weight="black">בחרו קטגוריה</Text>
            <Text style={styles.note}>הקטגוריה שבחרתם היא התחום שלכם בזירה. כדי להיכנס לחדר "{view.name || entry.name}" צריך לבחור אחת.</Text>
          </View>
          {/* A phone this small may need a little scrolling; on normal phones a page of 12 fits without it. */}
          <ScrollView contentContainerStyle={styles.gateBody} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <CategoryPicker mineId={null} onPick={link.pick} takenIds={view.takenCategoryIds} />
            {link.notice ? <Text style={styles.errorText}>{link.notice}</Text> : null}
          </ScrollView>
          <View style={styles.footerBar}>
            <BrandSecondaryButton label="יציאה מהחדר" onPress={leave} />
          </View>
        </View>
      </BrandBackground>
    );
  }

  return (
    <BrandBackground>
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={styles.lobbyHeader}>
            <Text accessibilityRole="header" style={styles.lobbyName} weight="black">{view.name || entry.name}</Text>
            {/* A public room needs no code on screen; only a private room shows it, with a copy-and-share button. */}
            {view.visibility === 'private' ? (
              <>
                <View style={styles.codePill}>
                  <Text style={styles.codeLabel}>קוד החדר</Text>
                  <Text style={styles.codeValue} weight="black">{view.code}</Text>
                </View>
                <Pressable
                  accessibilityLabel="העתקה ושיתוף של קוד החדר"
                  accessibilityRole="button"
                  onPress={async () => setShareState(await shareRoomInvite(view.name || entry.name, view.code))}
                  style={styles.copyButton}>
                  <Text style={styles.copyButtonText} weight="bold">
                    {shareState === 'copied' ? '✓ הועתק, אפשר להדביק ולשלוח' : shareState === 'failed' ? 'לא הצלחנו להעתיק' : '📋 העתקה ושיתוף'}
                  </Text>
                </Pressable>
              </>
            ) : null}
            <Text style={styles.note}>
              {watching ? '👁 אתם צופים בחדר' : `משתתפים ${view.members.length}/${MAX_HUMANS}`}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle} weight="black">מי בחדר</Text>
            {view.members.map((member) => (
              <Pressable accessibilityRole={member.clientId === link.myId ? 'button' : undefined} disabled={member.clientId !== link.myId || inGame} key={member.clientId} onPress={() => setPickerOpen(true)} style={styles.memberRow}>
                <AvatarPortrait avatarId={member.avatar} borderColor={member.isHost ? colors.accentGold : colors.brandSky} size={44} />
                <View style={styles.memberText}>
                  <Text style={styles.memberName} weight="bold">{member.isHost ? '👑 ' : ''}{member.name}{member.clientId === link.myId ? ' (אני)' : ''}</Text>
                  <Text style={styles.memberCategory}>
                    {member.categoryId ? `${CATEGORY_BY_ID[member.categoryId].icon} ${CATEGORY_BY_ID[member.categoryId].name}` : `עוד לא ${by(member, 'בחר', 'בחרה')} קטגוריה…`}
                  </Text>
                </View>
              </Pressable>
            ))}
            {!inGame ? Array.from({ length: empty }, (_, index) => (
              <View key={`empty-${index}`} style={[styles.memberRow, styles.memberEmpty]}>
                <View style={[styles.podiumEmptyAvatar, { width: 44, height: 44, borderRadius: 12 }]}><Text style={styles.podiumEmptyMark}>+</Text></View>
                <Text style={styles.memberCategory}>מקום פנוי – בוט יתפוס אותו</Text>
              </View>
            )) : null}
          </View>

          {!watching && !inGame && me ? (
            <Pressable
              accessibilityHint="לחיצה פותחת בחירה של קטגוריה אחרת"
              accessibilityLabel={`הקטגוריה שלי: ${me.categoryId ? CATEGORY_BY_ID[me.categoryId].name : ''}. החלפה`}
              accessibilityRole="button"
              onPress={() => setPickerOpen(true)}
              style={styles.myCategory}>
              <Text style={styles.myCategoryIcon}>{me.categoryId ? CATEGORY_BY_ID[me.categoryId].icon : ''}</Text>
              <View style={styles.memberText}>
                <Text style={styles.codeLabel}>הקטגוריה שלי</Text>
                <Text style={styles.myCategoryName} weight="black">{me.categoryId ? CATEGORY_BY_ID[me.categoryId].name : ''}</Text>
                {me.categoryId && getAvailableWays(CATEGORY_BY_ID[me.categoryId]).length > 1 ? (
                  <Text style={styles.codeLabel}>{getWay(CATEGORY_BY_ID[me.categoryId], me.wayId).label}</Text>
                ) : null}
              </View>
              <Text style={styles.myCategoryChange} weight="bold">החלפה ✎</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={styles.footerBar}>
          {link.notice ? <Text style={styles.note}>{link.notice}</Text> : null}
          {!watching && !inGame && hostIsMe ? (
            <>
              {/* Needs at least 2 people in the room. */}
              <BrandPrimaryButton
                disabled={view.members.length < 2 || !view.canStart}
                label={view.members.length < 2 ? 'יש להמתין לשחקן נוסף על מנת להתחיל' : 'התחלת משחק'}
                onPress={link.start}
                style={styles.playButton}
              />
              <BrandSecondaryButton label="מחיקת חדר" onPress={() => setConfirmDelete(true)} />
            </>
          ) : (
            <BrandSecondaryButton label="יציאה מהחדר" onPress={leave} />
          )}
        </View>
      </View>
      <BottomSheet onClose={() => setConfirmDelete(false)} title="מחיקת החדר" visible={confirmDelete}>
        <Text style={styles.cardText}>החדר יימחק וכל מי שנמצא בו ייצא. אי אפשר לבטל.</Text>
        <BrandPrimaryButton label="כן, למחוק את החדר" onPress={() => { setConfirmDelete(false); link.closeRoom(); leave(); }} />
        <BrandSecondaryButton label="ביטול" onPress={() => setConfirmDelete(false)} />
      </BottomSheet>
      <BottomSheet onClose={() => setPickerOpen(false)} title="החלפת קטגוריה" visible={pickerOpen}>
        <CategoryPicker mineId={me?.categoryId ?? null} onPick={(categoryId, wayId) => { link.pick(categoryId, wayId); setPickerOpen(false); }} takenIds={view.takenCategoryIds} />
      </BottomSheet>
    </BrandBackground>
  );
}
