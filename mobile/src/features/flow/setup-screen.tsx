import { Pressable, ScrollView, View } from 'react-native';
import { AppText as Text } from '@/design/app-text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORIES } from '@/content/categories';
import { styles } from './flow-styles';

export function SetupScreen({
  onBack,
  onSelect,
  onStart,
  selectedCategoryId,
}: {
  onBack: () => void;
  onSelect: (categoryId: string) => void;
  onStart: () => void;
  selectedCategoryId: string;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.setupScreen}>
        <Pressable accessibilityLabel="חזרה לבחירת משחק" onPress={onBack} style={styles.setupBackButton}>
          <Text style={styles.setupBackText}>→</Text>
        </Pressable>
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>המשחק מתחיל כאן</Text>
          <Text style={styles.heroTitle}>THE ARENA</Text>
          <Text style={styles.heroHebrew}>הזירה</Text>
          <Text style={styles.heroBody}>בחרו את קטגוריית ההתמחות שלכם וכבשו את כל 16 המשבצות.</Text>
        </View>

        <Text style={styles.sectionTitle}>בחירת קטגוריה</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((category) => {
            const selected = selectedCategoryId === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => onSelect(category.id)}
                style={[styles.categoryCard, selected && styles.categoryCardSelected]}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={[styles.categoryName, selected && styles.categoryNameSelected]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.prototypeNote}>
          <Text style={styles.prototypeNoteTitle}>גרסת אבטיפוס</Text>
          <Text style={styles.prototypeNoteText}>
            התמונות מיוצגות כרגע באיורים מובנים. מאגר התמונות המלא יתווסף לאחר אימות המשחקיות.
          </Text>
        </View>

        <Pressable onPress={onStart} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>כניסה לזירה</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
