import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { AvatarPortrait } from '@/design/avatar-portrait';
import { BrandPrimaryButton } from '@/design/brand';
import { colors } from '@/design/tokens';
import { AVATARS } from '@/content/avatars';
import { NICKNAME_MAX_LENGTH } from '@/services/accounts/accounts';
import { BottomSheet } from './bottom-sheet';
import { styles } from './home-styles';

// Tap on your avatar in the home top bar: change the nickname and the picture. `onSave` answers with an error text, or null when saved.
export function EditProfileSheet({ avatar, nickname, onClose, onSave, visible }: {
  avatar: string;
  nickname: string;
  onClose: () => void;
  onSave: (nickname: string, avatar: string) => string | null;
  visible: boolean;
}) {
  const [name, setName] = useState(nickname);
  const [picked, setPicked] = useState(avatar);
  const [error, setError] = useState('');

  // Every time the sheet opens it starts from the saved profile.
  useEffect(() => {
    if (visible) {
      setName(nickname);
      setPicked(avatar);
      setError('');
    }
  }, [visible, nickname, avatar]);

  const save = () => {
    const problem = onSave(name, picked);
    if (problem) setError(problem);
  };

  return (
    <BottomSheet onClose={onClose} title="עריכת פרופיל" visible={visible}>
      <ScrollView contentContainerStyle={styles.editBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.editScroll}>
        <View style={styles.editPreview}>
          <AvatarPortrait avatarId={picked} borderColor={colors.brandSky} size={84} />
        </View>

        <Text style={styles.editLabel} weight="bold">כינוי בזירה</Text>
        <TextInput
          accessibilityLabel="כינוי בזירה"
          maxLength={NICKNAME_MAX_LENGTH}
          onChangeText={(value) => { setName(value); setError(''); }}
          placeholder="הכינוי שלך"
          placeholderTextColor={colors.inkSoft}
          style={[styles.input, !!error && styles.inputError]}
          textAlign="right"
          value={name}
        />
        {!!error && <Text accessibilityRole="alert" style={styles.editError} weight="bold">{error}</Text>}

        <Text style={styles.editLabel} weight="bold">בחירת דמות</Text>
        <View accessibilityLabel="בחירת דמות" style={styles.editAvatarGrid}>
          {AVATARS.map(({ id }) => {
            const selected = picked === id;
            return (
              <Pressable
                accessibilityLabel={`דמות ${id}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={id}
                onPress={() => setPicked(id)}
                style={[styles.editAvatarOption, selected && styles.editAvatarOptionSelected]}>
                <AvatarPortrait avatarId={id} borderColor={selected ? colors.brandSky : colors.brandBorder} size={52} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <BrandPrimaryButton label="שמירה" onPress={save} />
    </BottomSheet>
  );
}
