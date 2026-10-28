// The whole game uses the logo's navy / light-blue palette (decision 12).
export const colors = {
  // Full screens are transparent over the shared brand gradient in _layout.
  screen: 'transparent',
  // Darkest navy: text on light buttons, inputs and deep wells.
  bg: '#04112F',
  surface: '#0C2466',
  surfaceMuted: '#0A1D55',
  border: '#1E3F95',
  textPrimary: '#FFFFFF',
  textSecondary: '#B8CBEA',
  // Primary actions and "your turn" (light blue, was turquoise).
  success: '#7CCBFF',
  // Correct-answer feedback keeps a real green.
  correct: '#3DDC97',
  accentGold: '#F8C95C',
  warning: '#FFB020',
  danger: '#FF4D4D',
  // Arena colors – one meaning each, in every board situation (decision 12):
  // floor = ordinary territory · active (light blue) = me / drawn / winner
  // target (blue + cyan outline) = can be attacked · selected (gold) = chosen
  // dark = not relevant right now (only while choosing a target).
  boardFrame: '#0B2470',
  boardFrameBorder: '#3FA9FF',
  arenaFloor: '#0A1F5C',
  arenaFloorBorder: '#1C3C8C',
  boardCellDark: '#06123A',
  boardCellDarkBorder: '#102456',
  territoryMeStart: '#B4EBFF',
  territoryMeEnd: '#7CCBFF',
  territoryMeBorder: '#D9F7FF',
  territoryTarget: '#1F6BFF',
  territoryTargetBorder: '#4DF3FF',
  territorySelected: '#FFD25A',
  overlay: 'rgba(3, 10, 36, 0.82)',
  successSoft: 'rgba(124, 203, 255, 0.18)',
  boardLabelMuted: 'rgba(4, 17, 47, 0.75)',
  // Brand palette from the THE ARENA logo (navy + light blue).
  brandNavyDeep: '#030A24',
  brandNavy: '#071A4D',
  brandSurface: '#0C2466',
  brandSurfaceRaised: '#123180',
  brandBorder: '#2B53B8',
  brandBlue: '#1F6BFF',
  brandSky: '#7CCBFF',
  brandSkySoft: 'rgba(124, 203, 255, 0.16)',
  brandInk: '#04112F',
  brandError: '#FF8A8A',
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
