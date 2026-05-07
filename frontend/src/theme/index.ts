// src/theme/index.ts
// Paydone Mobile App - Organic & Earthy Theme
// Based on /app/design_guidelines.json

export const colors = {
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  surfaceElevated: '#FCFAF8',
  primary: '#7D8F69',
  primaryActive: '#667655',
  primaryLight: '#E8ECE3',
  secondary: '#CD7D5C',
  secondaryLight: '#F8EFEA',
  textPrimary: '#2D312A',
  textSecondary: '#757971',
  textDisabled: '#A6A9A2',
  textInverse: '#FFFFFF',
  border: '#EAE6DF',
  borderFocus: '#7D8F69',
  success: '#7D8F69',
  warning: '#E8AA42',
  danger: '#CD7D5C',
  // soft tinted bg variants
  successBg: '#E8ECE3',
  warningBg: '#FBF1DC',
  dangerBg: '#F8EFEA',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 9999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  edge: 24,
};

export const typography = {
  h1: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 26, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  h3: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  h4: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, letterSpacing: -0.2 },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  bodySm: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.2 },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 1.2, textTransform: 'uppercase' as const },
};

export const shadows = {
  card: {
    shadowColor: '#2D312A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  floating: {
    shadowColor: '#2D312A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const theme = { colors, radius, spacing, typography, shadows };
export default theme;
