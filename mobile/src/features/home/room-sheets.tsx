import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { BrandPrimaryButton } from '@/design/brand';
import { colors } from '@/design/tokens';
import { isCompleteRoomCode, normalizeRoomCode } from '@/online/format';
import type { RoomsSource } from '@/online/rooms-source';
import type { RoomSummary, RoomVisibility } from '@/online/types';
import { BottomSheet } from '@/design/bottom-sheet';
import { styles } from './home-styles';

const MAX_NAME = 24;

// "פתיחת חדר חדש": a name and public / code-only. The room's code is created by the server.
export function CreateRoomSheet({ host, onClose, onCreated, source, visible }: {
  host: string;
  onClose: () => void;
  onCreated: (room: RoomSummary) => void;
  source: RoomsSource;
  visible: boolean;
}) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError('נותנים שם לחדר, כדי שחברים יזהו אותו');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await source.createRoom({ name, visibility, host });
      setName('');
      onCreated(room);
    } catch {
      setError('לא הצלחנו לפתוח חדר. בדקו שהשרת פעיל ונסו שוב');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="פתיחת חדר חדש" visible={visible}>
      <View style={{ gap: 6 }}>
        <Text style={styles.label} weight="bold">שם החדר</Text>
        <TextInput
          accessibilityLabel="שם החדר"
          maxLength={MAX_NAME}
          onChangeText={(value) => { setName(value); setError(null); }}
          placeholder="למשל: ערב טריוויה"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, !!error && !name.trim() && styles.inputError]}
          value={name}
        />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={styles.label} weight="bold">מי יכול להצטרף?</Text>
        <View accessibilityRole="tablist" style={styles.segment}>
          {([['public', '🌐 ציבורי'], ['private', '🔒 פרטי']] as const).map(([value, label]) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: visibility === value }}
              key={value}
              onPress={() => setVisibility(value)}
              style={[styles.segmentOption, visibility === value && styles.segmentActive]}>
              <Text style={[styles.segmentText, visibility === value && styles.segmentTextActive]} weight="bold">{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <BrandPrimaryButton disabled={busy} icon="➕" label={busy ? 'פותח חדר…' : 'פתיחת החדר'} onPress={create} />
    </BottomSheet>
  );
}

// "הכנסת קוד": four characters; a full room or a running game opens as a spectator.
export function JoinCodeSheet({ onClose, onFound, source, visible }: {
  onClose: () => void;
  onFound: (room: RoomSummary) => void;
  source: RoomsSource;
  visible: boolean;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (busy || !isCompleteRoomCode(code)) return;
    setBusy(true);
    setError(null);
    try {
      const room = await source.findByCode(code);
      if (!room) setError('לא נמצא חדר עם הקוד הזה. בדקו שהקוד נכון');
      else {
        setCode('');
        onFound(room);
      }
    } catch {
      setError('השרת לא זמין כרגע. נסו שוב בעוד רגע');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet onClose={onClose} title="הכנסת קוד חדר" visible={visible}>
      <Text style={styles.hint}>יש להכניס את הקוד בין 4 תווים</Text>
      <TextInput
        accessibilityLabel="קוד החדר"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={4}
        onChangeText={(value) => { setCode(normalizeRoomCode(value)); setError(null); }}
        onSubmitEditing={join}
        placeholder="• • • •"
        placeholderTextColor={colors.textSecondary}
        returnKeyType="go"
        style={[styles.input, styles.codeInput, !!error && styles.inputError]}
        value={code}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <BrandPrimaryButton disabled={busy || !isCompleteRoomCode(code)} icon="🔑" label={busy ? 'מחפש…' : 'כניסה לחדר'} onPress={join} />
    </BottomSheet>
  );
}
