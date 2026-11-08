import { useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/design/tokens';

// The picture of a duel inside a card that hugs it: the free area is measured, the picture is scaled to the largest
// size that fits (aspect ratio kept, never cropped) and the card's border follows the picture's own width and height.
// Works for any picture shape (square, tall, wide), whatever its resolution.
const PAD = spacing.xs;

type Props = {
  source: ImageSourcePropType | undefined;
  // Shown instead of a picture (emoji) in a card that fills the area.
  fallback?: React.ReactNode;
  // The card itself (border colour, glow...). Pass an Animated.View as `Card` to animate it.
  Card?: React.ComponentType<{ style?: StyleProp<ViewStyle>; children?: React.ReactNode }>;
  cardStyle?: StyleProp<ViewStyle>;
  minHeight?: number;
};

export function FittedPicture({ source, fallback, Card = View, cardStyle, minHeight = 64 }: Props) {
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea((current) => (current?.width === width && current?.height === height ? current : { width, height }));
  };
  // The picture's own size, read when it loads (resolveAssetSource does not exist on RN web).
  const [natural, setNatural] = useState<{ source: unknown; width: number; height: number } | null>(null);
  const known = natural && natural.source === source ? natural : null;
  const imageRef = useRef<unknown>(null);
  const onLoad = (event: { nativeEvent: { source?: { width: number; height: number } } }) => {
    // Native gives `source`; the web event carries nothing, so read the <img> inside the Image's element.
    const host = imageRef.current as { querySelector?: (selector: string) => { naturalWidth: number; naturalHeight: number } | null } | null;
    const element = host?.querySelector?.('img');
    const loaded = event.nativeEvent?.source?.width
      ? event.nativeEvent.source
      : element?.naturalWidth ? { width: element.naturalWidth, height: element.naturalHeight } : undefined;
    if (source && loaded?.width && loaded?.height) setNatural({ source, width: loaded.width, height: loaded.height });
  };

  let size: { width: number; height: number } | null = null;
  if (area && known) {
    const maxW = Math.max(0, area.width - 2 * PAD - 4);
    const maxH = Math.max(0, area.height - 2 * PAD - 4);
    const scale = Math.min(maxW / known.width, maxH / known.height);
    size = { width: Math.round(known.width * scale), height: Math.round(known.height * scale) };
  }

  return (
    <View onLayout={onLayout} style={[styles.area, { minHeight }]}>
      {source ? (
        // Until the size is known the picture is laid out (invisible) in the whole area, so it loads and reports it.
        <Card style={[styles.card, cardStyle, size
          ? { width: size.width + 2 * PAD + 4, height: size.height + 2 * PAD + 4 }
          : { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: 0 }]}>
          <Image ref={imageRef as never} accessibilityLabel="פריט לזיהוי" onLoad={onLoad as never} resizeMode="contain" source={source} style={styles.picture} />
        </Card>
      ) : (
        <Card style={[styles.card, cardStyle, styles.fallbackCard]}>{fallback}</Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Takes all the free height; the card is centred inside it.
  area: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderColor: colors.territoryMeBorder,
    padding: PAD,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  fallbackCard: { alignSelf: 'stretch', flex: 1, alignItems: 'center', justifyContent: 'center' },
  picture: { width: '100%', height: '100%', borderRadius: radii.control },
});
