// src/components/UI.tsx - Shared lightweight UI building blocks
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadows } from '../theme';

// ─── Card ─────────────────────────────────────────────────────────────
export const Card: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ children, style, testID }) => (
  <View style={[uiStyles.card, style]} testID={testID}>
    {children}
  </View>
);

// ─── Section Title ────────────────────────────────────────────────────
export const SectionTitle: React.FC<{
  title: string;
  action?: { label: string; onPress: () => void; testID?: string };
}> = ({ title, action }) => (
  <View style={uiStyles.sectionRow}>
    <Text style={uiStyles.sectionTitle}>{title}</Text>
    {action && (
      <TouchableOpacity onPress={action.onPress} testID={action.testID}>
        <Text style={uiStyles.sectionAction}>{action.label}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Primary Button ───────────────────────────────────────────────────
export const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ label, onPress, loading, icon, disabled, style, testID }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    disabled={disabled || loading}
    style={[uiStyles.primaryBtn, (disabled || loading) && { opacity: 0.6 }, style]}
    testID={testID}
  >
    {loading ? (
      <ActivityIndicator color={colors.textInverse} />
    ) : (
      <>
        {icon && <Ionicons name={icon} size={18} color={colors.textInverse} />}
        <Text style={uiStyles.primaryBtnText}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

// ─── Secondary Button ─────────────────────────────────────────────────
export const SecondaryButton: React.FC<{
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}> = ({ label, onPress, icon, style, testID }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    style={[uiStyles.secondaryBtn, style]}
    testID={testID}
  >
    {icon && <Ionicons name={icon} size={18} color={colors.primary} />}
    <Text style={uiStyles.secondaryBtnText}>{label}</Text>
  </TouchableOpacity>
);

// ─── Ghost Pill (chip) ────────────────────────────────────────────────
export const Chip: React.FC<{
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}> = ({ label, active, onPress, testID }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[uiStyles.chip, active && uiStyles.chipActive]}
    testID={testID}
  >
    <Text style={[uiStyles.chipText, active && { color: colors.textInverse }]}>{label}</Text>
  </TouchableOpacity>
);

// ─── Field with Label ─────────────────────────────────────────────────
export const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ label, children, hint, style }) => (
  <View style={[{ marginBottom: spacing.md }, style]}>
    <Text style={uiStyles.fieldLabel}>{label}</Text>
    {children}
    {hint && <Text style={uiStyles.fieldHint}>{hint}</Text>}
  </View>
);

// ─── Text Input ───────────────────────────────────────────────────────
export const Input: React.FC<React.ComponentProps<typeof TextInput> & { testID?: string }> = ({
  style,
  ...props
}) => (
  <TextInput
    placeholderTextColor={colors.textDisabled}
    {...props}
    style={[uiStyles.input, style]}
  />
);

// ─── Empty State ──────────────────────────────────────────────────────
export const Empty: React.FC<{
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  cta?: { label: string; onPress: () => void; testID?: string };
}> = ({ icon = 'leaf-outline', title, subtitle, cta }) => (
  <View style={uiStyles.empty}>
    <View style={uiStyles.emptyIconWrap}>
      <Ionicons name={icon} size={28} color={colors.primary} />
    </View>
    <Text style={uiStyles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={uiStyles.emptySubtitle}>{subtitle}</Text>}
    {cta && (
      <TouchableOpacity onPress={cta.onPress} style={uiStyles.emptyCta} testID={cta.testID}>
        <Text style={uiStyles.emptyCtaText}>{cta.label}</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
      </TouchableOpacity>
    )}
  </View>
);

// ─── Stat Pill ────────────────────────────────────────────────────────
export const StatPill: React.FC<{ label: string; value: string; tone?: 'primary' | 'secondary' | 'neutral' }> = ({
  label,
  value,
  tone = 'neutral',
}) => {
  const bg =
    tone === 'primary' ? colors.primaryLight : tone === 'secondary' ? colors.secondaryLight : colors.surfaceElevated;
  const fg =
    tone === 'primary' ? colors.primaryActive : tone === 'secondary' ? colors.secondary : colors.textSecondary;
  return (
    <View style={[uiStyles.statPill, { backgroundColor: bg }]}>
      <Text style={[uiStyles.statPillLabel, { color: fg }]}>{label}</Text>
      <Text style={[uiStyles.statPillValue, { color: tone === 'neutral' ? colors.textPrimary : fg }]}>
        {value}
      </Text>
    </View>
  );
};

const uiStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 4,
    ...shadows.card,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.h4, color: colors.textPrimary },
  sectionAction: { ...typography.bodySm, color: colors.primary, fontWeight: '700' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  primaryBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
  fieldLabel: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  fieldHint: {
    ...typography.bodySm,
    color: colors.textDisabled,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.h4, color: colors.textPrimary, textAlign: 'center' },
  emptySubtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyCta: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  emptyCtaText: { ...typography.bodyMd, color: colors.primary, fontWeight: '700' },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  statPillLabel: { ...typography.bodySm, fontWeight: '700' },
  statPillValue: { ...typography.bodySm, fontWeight: '800' },
});

export default {
  Card,
  SectionTitle,
  PrimaryButton,
  SecondaryButton,
  Chip,
  Field,
  Input,
  Empty,
  StatPill,
};
