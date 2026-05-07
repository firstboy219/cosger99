// app/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../src/contexts/AppContext';
import { colors, spacing, radius, typography, shadows } from '../src/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useApp();
  const [email, setEmail] = useState('user@paydone.id');
  const [password, setPassword] = useState('user');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Email dan password wajib diisi');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg = e?.message || 'Login gagal';
      setError(msg);
      // alertAsync from confirm utils ensures cross-platform display
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.logoBadge}>
              <Ionicons name="leaf-outline" size={28} color={colors.surface} />
            </View>
            <Text style={styles.brandTitle}>Paydone</Text>
            <Text style={styles.brandTagline}>Bayar, Selesai. Hidup tenang.</Text>
          </View>

          {/* Card */}
          <View style={styles.card} testID="login-card">
            <Text style={styles.welcome}>Selamat datang</Text>
            <Text style={styles.subtitle}>Masuk ke cockpit keuangan Anda</Text>

            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                testID="login-email-input"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@anda.com"
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  testID="login-password-input"
                  style={[styles.input, { flex: 1, paddingRight: 44 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textDisabled}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  testID="login-toggle-password"
                  onPress={() => setShowPwd((s) => !s)}
                  style={styles.eye}
                >
                  <Ionicons
                    name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox} testID="login-error">
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              testID="login-submit-button"
              style={[styles.btnPrimary, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <>
                  <Text style={styles.btnPrimaryText}>Masuk</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.surface} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.helpRow}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.helpText}>
                Demo: user@paydone.id / user
              </Text>
            </View>
          </View>

          <Text style={styles.footer}>© 2026 Paydone.id · Bayar, Selesai.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.edge, paddingVertical: spacing.lg },
  hero: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.floating,
  },
  brandTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 38,
    letterSpacing: -1,
  },
  brandTagline: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.lg + 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  welcome: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.bodyMd, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  label: { ...typography.overline, color: colors.textSecondary, marginBottom: spacing.xs },
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
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eye: { position: 'absolute', right: spacing.md, height: '100%', justifyContent: 'center' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.bodySm, color: colors.danger, flex: 1, marginLeft: 4 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  btnPrimaryText: { ...typography.h4, color: colors.textInverse, fontWeight: '700' },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  helpText: { ...typography.bodySm, color: colors.textSecondary, marginLeft: 4 },
  footer: {
    ...typography.bodySm,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
