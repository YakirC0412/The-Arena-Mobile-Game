import { Pressable, ScrollView, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { BrandBackground } from '@/design/brand';
import { colors } from '@/design/tokens';
import type { HomeTab, LobbyEntry } from '@/game/flow';
import type { RoomsSource } from '@/online/rooms-source';
import { HomeMultiTab } from './home-multi-tab';
import { HomeSingleTab } from './home-single-tab';
import { styles } from './home-styles';

const TABS: { id: HomeTab; icon: string; label: string }[] = [
  { id: 'single', icon: '⚔️', label: 'משחק יחיד' },
  { id: 'multi', icon: '👥', label: 'רב־משתתפים' },
];

// The signed-in home. The toggle at the bottom switches between two ways to play:
// Single (you against 15 bots) and Multi (rooms with friends, the hall of fame, live open rooms).
export function HomeScreen({ avatar, nickname, onGuide, onNewGame, onOpenLobby, onSignOut, onTab, source, tab }: {
  avatar: string;
  nickname: string;
  onGuide: () => void;
  onNewGame: () => void;
  onOpenLobby: (entry: LobbyEntry) => void;
  onSignOut: () => void;
  onTab: (tab: HomeTab) => void;
  source: RoomsSource;
  tab: HomeTab;
}) {
  return (
    <BrandBackground>
      <View style={styles.shell}>
        <View style={styles.topBar}>
          <AvatarPortrait avatarId={avatar} borderColor={colors.brandSky} size={48} />
          <View style={styles.topText}>
            <Text style={styles.topGreeting}>שלום,</Text>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.topName} weight="black">{nickname}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.smallButton}>
            <Text style={styles.smallButtonText} weight="bold">התנתקות</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {tab === 'single' ? (
            <HomeSingleTab avatar={avatar} nickname={nickname} onGuide={onGuide} onNewGame={onNewGame} />
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
    </BrandBackground>
  );
}
