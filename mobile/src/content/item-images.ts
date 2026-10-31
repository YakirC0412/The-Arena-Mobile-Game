import type { ImageSourcePropType } from 'react-native';

import { GENERATED_ITEM_IMAGES } from './item-images.generated';

// Every item picture is connected by scripts/build-item-images.js (npm run images).
export const ITEM_IMAGES: Record<string, ImageSourcePropType> = GENERATED_ITEM_IMAGES;
