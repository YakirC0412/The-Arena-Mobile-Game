import type { ImageSourcePropType } from 'react-native';

import { GENERATED_ITEM_IMAGES } from './item-images.generated';

export const ITEM_IMAGES: Record<string, ImageSourcePropType> = {
  'animals-1': require('../../assets/items/animals/lion.png'),
  'animals-2': require('../../assets/items/animals/elephant.png'),
  'animals-3': require('../../assets/items/animals/dog.png'),
  'animals-4': require('../../assets/items/animals/tiger.png'),
  'animals-5': require('../../assets/items/animals/crocodile.png'),
  'animals-6': require('../../assets/items/animals/whale.png'),
  'animals-7': require('../../assets/items/animals/orangutan.png'),
  'animals-8': require('../../assets/items/animals/seal.png'),
  'animals-9': require('../../assets/items/animals/sloth.png'),
  'animals-10': require('../../assets/items/animals/zebra.png'),
  'animals-11': require('../../assets/items/animals/giraffe.png'),
  'animals-12': require('../../assets/items/animals/rhinoceros.png'),
  'fruit-1': require('../../assets/items/fruit/apple.png'),
  'fruit-2': require('../../assets/items/fruit/banana.png'),
  'fruit-3': require('../../assets/items/fruit/orange.png'),
  'fruit-4': require('../../assets/items/fruit/pineapple.png'),
  'fruit-5': require('../../assets/items/fruit/watermelon.png'),
  'fruit-6': require('../../assets/items/fruit/peach.png'),
  'fruit-7': require('../../assets/items/fruit/kiwi.png'),
  'fruit-8': require('../../assets/items/fruit/blueberries.png'),
  'fruit-9': require('../../assets/items/fruit/olive.png'),
  'fruit-10': require('../../assets/items/fruit/grapes.png'),
  'fruit-11': require('../../assets/items/fruit/mango.png'),
  'fruit-12': require('../../assets/items/fruit/pear.png'),
  // Pictures connected by scripts/build-item-images.js (npm run images).
  ...GENERATED_ITEM_IMAGES,
};
