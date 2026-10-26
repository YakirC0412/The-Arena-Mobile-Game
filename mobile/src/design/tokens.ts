export const colors = {
  bg: '#0B1A24',
  surface: '#12293A',
  surfaceMuted: '#0F2230',
  border: '#24414E',
  textPrimary: '#FFFFFF',
  textSecondary: '#B9C8D1',
  success: '#21C7A8',
  accentGold: '#F8C95C',
  warning: '#FFB020',
  danger: '#FF4D4D',
  boardFrame: '#0A2A7A',
  boardFrameBorder: '#3FA9FF',
  boardCellDark: '#08122E',
  boardCellDarkBorder: '#14234F',
  territoryMeStart: '#B4EBFF',
  territoryMeEnd: '#58C4FF',
  territoryMeBorder: '#D9F7FF',
  territoryTarget: '#1747C9',
  territoryTargetBorder: '#4DF3FF',
  territorySelected: '#FFD25A',
  overlay: 'rgba(5, 14, 22, 0.78)',
  successSoft: 'rgba(33, 199, 168, 0.2)',
  boardLabelMuted: 'rgba(7, 21, 31, 0.75)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  cell: 8,
  control: 12,
  button: 14,
  card: 20,
  pill: 999,
} as const;

export const typeScale = {
  caption: 12,
  body: 14,
  button: 16,
  sectionTitle: 20,
  screenTitle: 28,
  clockInactive: 46,
  clockActive: 56,
} as const;

export const fontFamilies = {
  regular: 'Heebo_400Regular',
  medium: 'Heebo_500Medium',
  bold: 'Heebo_700Bold',
  black: 'Heebo_900Black',
} as const;

export const layout = {
  maxContentWidth: 430,
  minTouchTarget: 44,
  primaryButtonHeight: 56,
} as const;

export const motion = {
  instant: 100,
  fast: 150,
  standard: 250,
  dramatic: 400,
} as const;

export const tokens = {
  colors,
  fontFamilies,
  layout,
  motion,
  radii,
  spacing,
  typeScale,
} as const;
