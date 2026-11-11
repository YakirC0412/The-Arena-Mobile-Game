import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';

import { AppText as Text } from '@/design/app-text';
import { styles } from '../features/home/home-styles';

// A bottom sheet: dims the screen, slides in from the bottom edge, closes with the X or a tap outside.
export function BottomSheet({ children, onClose, title, visible }: { children: ReactNode; onClose: () => void; title: string; visible: boolean }) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="סגירה" onPress={onClose} style={styles.sheetBackdrop}>
          <Pressable accessibilityViewIsModal onPress={() => undefined} style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text accessibilityRole="header" style={styles.sheetTitle} weight="black">{title}</Text>
              <Pressable accessibilityLabel="סגירה" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
