import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { BrandBackground, BrandPrimaryButton, BrandSecondaryButton } from '@/design/brand';
import { BottomSheet } from './bottom-sheet';
import { colors } from '@/design/tokens';
import type { HomeTab, LobbyEntry } from '@/game/flow';
import type { RoomsSource } from '@/online/rooms-source';
import { EditProfileSheet } from './edit-profile-sheet';
import { HomeMultiTab } from './home-multi-tab';
import { HomeSingleTab } from './home-single-tab';
import { styles } from './home-styles';

// The hint bubble shows once per account on this device (the first time the home screen opens after sign-up / sign-in).
const hintKey = (userId: string) => `arena.profileHintSeen:${userId}`;
function shouldShowProfileHint(userId: string): boolean {
  try {
    return globalThis.localStorage?.getItem(hintKey(userId)) !== '1';
  } catch {
    return false;
  }
}
function markProfileHintSeen(userId: string) {
  try {
    globalThis.localStorage?.setItem(hintKey(userId), '1');
  } catch {
    // no storage: the hint simply may show again next visit
  }
}

const TABS:{ id: HomeTab; icon: string; label: string }[] = [
  { id: 'single', icon: '⚔️', label: 'משחק יחיד' },
  { id: 'multi', icon: '👥', label: 'רב־משתתפים' },
];

// The signed-in home. The toggle at the bottom switches between two ways to play:
// Single (you against 15 bots) and Multi (rooms with friends, the hall of fame, live open rooms).
export function HomeScreen({ avatar, nickname, onGuide, onNewGame, onOpenLobby, onSaveProfile, onSignOut, onTab, source, tab, userId }: {
  avatar: string;
  nickname: string;
  onGuide: () => void;
  onNewGame: () => void;
  onOpenLobby: (entry: LobbyEntry) => void;
  // Saves a new nickname and picture; answers with an error text, or null when saved.
  onSaveProfile: (nickname: string, avatar: string) => string | null;
  onSignOut: () => void;
  onTab: (tab: HomeTab) => void;
  source: RoomsSource;
  tab: HomeTab;
  userId: string;
}) {
  // Signing out asks first: it sits in the top bar, within easy reach of a thumb.
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [editing, setEditing] = useState(false);
  // A new player is told once that the avatar is a button (a bubble pointing at it).
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!shouldShowProfileHint(userId)) return;
    setHint(true);
    markProfileHintSeen(userId);
    const timer = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(timer);
  }, [userId]);
  const openEditor = () => { setHint(false); setEditing(true); };
  return (
    <BrandBackground>
      <View style={styles.shell}>
        <View style={styles.topBar}>
          <Pressable accessibilityHint="לחיצה לעריכת הכינוי והדמות" accessibilityLabel="עריכת פרופיל" accessibilityRole="button" onPress={openEditor} style={styles.avatarButton}>
            <AvatarPortrait avatarId={avatar} borderColor={colors.brandSky} size={48} />
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>✎</Text>
            </View>
          </Pressable>
          <View style={styles.topText}>
            <Text style={styles.topGreeting}>שלום,</Text>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.topName} weight="black">{nickname}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setConfirmSignOut(true)} style={styles.smallButton}>
            <Text style={styles.smallButtonText} weight="bold">התנתקות</Text>
          </Pressable>
        </View>

        {hint && (
          <Pressable accessibilityRole="button" onPress={openEditor} style={styles.hintBubble}>
            <View style={styles.hintArrow} />
            <Text style={styles.hintText} weight="bold">לחיצה על הדמות פותחת עריכה של הכינוי והדמות</Text>
          </Pressable>
        )}

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {tab === 'single' ? (
            <HomeSingleTab onGuide={onGuide} onNewGame={onNewGame} />
          ) : (
            <HomeMultiTab nickname={nickname} onOpenLobby={onOpenLobby} source={source} />
          )}
        </ScrollView>

        <View accessibilityRole="tablist" style={styles.tabBar}>
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={item.id}
                onPress={() => onTab(item.id)}
                style={[styles.tab, active && styles.tabActive]}>
                <Text style={styles.tabLabel}>{item.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]} weight={active ? 'black' : 'bold'}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <EditProfileSheet
        avatar={avatar}
        nickname={nickname}
        onClose={() => setEditing(false)}
        onSave={(nextName, nextAvatar) => {
          const problem = onSaveProfile(nextName, nextAvatar);
          if (!problem) setEditing(false);
          return problem;
        }}
        visible={editing}
      />
      <BottomSheet onClose={() => setConfirmSignOut(false)} title="להתנתק?" visible={confirmSignOut}>
        <BrandPrimaryButton label="כן, להתנתק" onPress={() => { setConfirmSignOut(false); onSignOut(); }} />
        <BrandSecondaryButton label="ביטול" onPress={() => setConfirmSignOut(false)} />
      </BottomSheet>
    </BrandBackground>
  );
}
