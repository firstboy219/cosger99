// app/(tabs)/profile.tsx — Profile screen
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/contexts/AppContext';
import { Card } from '../../src/components/UI';
import { colors, spacing, radius, typography, shadows } from '../../src/theme';
import { formatCurrencyFull, formatCurrency } from '../../src/utils/format';
import { API_BASE_URL } from '../../src/services/api';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, signOut, data, refresh, isSyncing } = useApp();
  const router = useRouter();

  const stats = useMemo(() => {
    const totalDebt = data.debts
      .filter((d) => !d._deleted)
      .reduce((s, d) => s + (Number(d.remainingPrincipal) || Number(d.totalLiability) || 0), 0);
    const completedTasks = data.tasks.filter((t) => !t._deleted && t.status === 'completed').length;
    const sinkingFunds = data.sinkingFunds.filter((s) => !s._deleted).length;
    return { totalDebt, completedTasks, sinkingFunds };
  }, [data]);

  const target = user?.financialFreedomTarget || 3_000_000_000;
  const progress = useMemo(() => {
    const totalAssets = data.bankAccounts
      .filter((b) => !b._deleted)
      .reduce((s, b) => s + (Number(b.balance) || 0), 0);
    const sfAssets = data.sinkingFunds
      .filter((s) => !s._deleted)
      .reduce((s, sf) => s + (Number(sf.currentAmount) || 0), 0);
    const totalAvailable = totalAssets + sfAssets;
    const pct = target > 0 ? Math.min(100, (totalAvailable / target) * 100) : 0;
    return { totalAvailable, pct };
  }, [data, target]);

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin keluar dari akun?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  const menuItems = [
    {
      group: 'Akun',
      items: [
        {
          icon: 'person-outline' as const,
          label: 'Informasi Akun',
          value: user?.email || '-',
          testID: 'menu-account',
        },
        {
          icon: 'wallet-outline' as const,
          label: 'Mata Uang',
          value: user?.preferredCurrency || 'IDR',
          testID: 'menu-currency',
        },
        {
          icon: 'shield-checkmark-outline' as const,
          label: 'Status',
          value: user?.role === 'admin' ? 'Admin' : 'Pengguna Aktif',
          testID: 'menu-status',
        },
      ],
    },
    {
      group: 'Pengaturan',
      items: [
        {
          icon: 'sync-outline' as const,
          label: 'Sinkronisasi Data',
          value: isSyncing ? 'Memuat...' : 'Tarik data dari cloud',
          onPress: refresh,
          testID: 'menu-sync',
        },
        {
          icon: 'cloud-outline' as const,
          label: 'API Server',
          value: API_BASE_URL.replace('https://', ''),
          testID: 'menu-api',
        },
        {
          icon: 'information-circle-outline' as const,
          label: 'Versi Aplikasi',
          value: '1.0.0 (Mobile)',
          testID: 'menu-version',
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header / Avatar */}
        <View style={styles.heroWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.username || 'U').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name} testID="profile-name">
            {user?.username || 'Pengguna'}
          </Text>
          <Text style={styles.email} testID="profile-email">{user?.email || '-'}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark-outline" size={12} color={colors.primary} />
            <Text style={styles.roleText}>{(user?.role || 'user').toUpperCase()}</Text>
          </View>
        </View>

        {/* Financial Freedom Target Card */}
        <View style={{ paddingHorizontal: spacing.edge }}>
          <Card style={styles.targetCard}>
            <View style={styles.targetHeader}>
              <View style={styles.targetIcon}>
                <Ionicons name="trophy-outline" size={20} color={colors.surface} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.targetLabel}>Target Kebebasan Finansial</Text>
                <Text style={styles.targetValue}>{formatCurrencyFull(target)}</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${progress.pct}%` }]} />
            </View>
            <View style={styles.targetFooter}>
              <Text style={styles.targetFooterText}>
                {formatCurrency(progress.totalAvailable)} tersedia
              </Text>
              <Text style={styles.targetFooterPct}>{progress.pct.toFixed(1)}%</Text>
            </View>
          </Card>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.secondary }]}>
              {formatCurrency(stats.totalDebt)}
            </Text>
            <Text style={styles.statLabel}>Sisa Hutang</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {stats.completedTasks}
            </Text>
            <Text style={styles.statLabel}>Tugas Selesai</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              {stats.sinkingFunds}
            </Text>
            <Text style={styles.statLabel}>Sinking Fund</Text>
          </View>
        </View>

        {/* Menu groups */}
        {menuItems.map((g) => (
          <View key={g.group} style={{ paddingHorizontal: spacing.edge, marginTop: spacing.lg }}>
            <Text style={styles.groupLabel}>{g.group.toUpperCase()}</Text>
            <Card style={{ padding: 0 }}>
              {g.items.map((it, idx) => (
                <TouchableOpacity
                  key={`${g.group}-${idx}`}
                  style={[styles.menuRow, idx < g.items.length - 1 && styles.menuRowBorder]}
                  onPress={(it as any).onPress}
                  disabled={!(it as any).onPress}
                  activeOpacity={(it as any).onPress ? 0.7 : 1}
                  testID={(it as any).testID}
                >
                  <View style={styles.menuIcon}>
                    <Ionicons name={it.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuLabel}>{it.label}</Text>
                    <Text style={styles.menuValue} numberOfLines={1}>
                      {it.value}
                    </Text>
                  </View>
                  {(it as any).onPress && (
                    <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
                  )}
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        ))}

        {/* Logout */}
        <View style={{ paddingHorizontal: spacing.edge, marginTop: spacing.lg }}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.85}
            testID="logout-button"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>Keluar dari Akun</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Paydone Mobile · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.floating,
  },
  avatarText: { color: colors.surface, fontWeight: '800', fontSize: 32 },
  name: { ...typography.h3, color: colors.textPrimary },
  email: { ...typography.bodyMd, color: colors.textSecondary, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    marginTop: 8,
  },
  roleText: {
    ...typography.bodySm,
    color: colors.primary,
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 10,
  },
  targetCard: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  targetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  targetIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetLabel: { ...typography.bodySm, color: '#A6A9A2', fontWeight: '600' },
  targetValue: { ...typography.h4, color: colors.surface, marginTop: 2, fontWeight: '800' },
  progressTrack: {
    height: 8,
    backgroundColor: '#3F4339',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  targetFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  targetFooterText: { ...typography.bodySm, color: '#C2C5BC', fontWeight: '600' },
  targetFooterPct: { ...typography.bodyMd, color: colors.primary, fontWeight: '800' },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.edge,
    marginTop: spacing.md,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { ...typography.bodyLg, fontWeight: '800' },
  statLabel: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2, fontSize: 11 },
  groupLabel: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingLeft: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '700' },
  menuValue: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: colors.dangerBg,
    borderRadius: radius.pill,
  },
  logoutText: { ...typography.bodyLg, color: colors.danger, fontWeight: '700' },
  footer: {
    ...typography.bodySm,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
