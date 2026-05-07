// app/(tabs)/index.tsx — Home (Dashboard + Input Hutang/Penghasilan)
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useApp } from '../../src/contexts/AppContext';
import { Card, SectionTitle, Empty } from '../../src/components/UI';
import { InputHutangSheet } from '../../src/components/InputHutangSheet';
import { InputPenghasilanSheet } from '../../src/components/InputPenghasilanSheet';
import { colors, spacing, radius, typography, shadows } from '../../src/theme';
import { formatCurrency, formatCurrencyFull, monthKey } from '../../src/utils/format';
import { deleteItem } from '../../src/services/api';

const DSRRing: React.FC<{ value: number; size?: number }> = ({ value, size = 96 }) => {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = c * (1 - clamped / 100);
  const tone = value > 35 ? colors.danger : value > 20 ? colors.warning : colors.primary;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primaryLight}
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ ...typography.h3, color: colors.textPrimary, fontWeight: '800' }}>
          {Math.round(value)}%
        </Text>
        <Text style={{ ...typography.bodySm, color: colors.textSecondary, fontSize: 10 }}>DSR</Text>
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const { user, data, refresh, isSyncing, patchData } = useApp();
  const [showHutang, setShowHutang] = useState(false);
  const [showPenghasilan, setShowPenghasilan] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const totals = useMemo(() => {
    const totalDebt = data.debts
      .filter((d) => !d._deleted)
      .reduce((sum, d) => sum + (Number(d.remainingPrincipal) || Number(d.totalLiability) || 0), 0);
    const monthlyObligation = data.debts
      .filter((d) => !d._deleted)
      .reduce((sum, d) => sum + (Number(d.monthlyPayment) || 0), 0);
    const curKey = monthKey();
    const totalIncome = data.incomes
      .filter((i) => !i._deleted)
      .filter((i) => {
        if (i.frequency === 'monthly') {
          if (i.dateReceived) {
            const start = i.dateReceived.slice(0, 7);
            if (start > curKey) return false;
          }
          if (i.endDate) {
            const end = i.endDate.slice(0, 7);
            if (end < curKey) return false;
          }
          return true;
        }
        return i.dateReceived && String(i.dateReceived).startsWith(curKey);
      })
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const dsr = totalIncome > 0 ? (monthlyObligation / totalIncome) * 100 : 0;
    return { totalDebt, monthlyObligation, totalIncome, dsr };
  }, [data]);

  const recentDebts = data.debts.filter((d) => !d._deleted).slice(0, 4);
  const recentIncomes = data.incomes.filter((i) => !i._deleted).slice(0, 4);

  const handleDeleteDebt = (debt: any) => {
    Alert.alert('Hapus Hutang', `Yakin hapus "${debt.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem('debts', debt.id);
            patchData('debts', debt, 'delete');
          } catch (e: any) {
            Alert.alert('Gagal', e?.message || 'Hapus gagal');
          }
        },
      },
    ]);
  };

  const handleDeleteIncome = (inc: any) => {
    Alert.alert('Hapus Penghasilan', `Yakin hapus "${inc.source}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem('incomes', inc.id);
            patchData('incomes', inc, 'delete');
          } catch (e: any) {
            Alert.alert('Gagal', e?.message || 'Hapus gagal');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isSyncing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Halo, {user?.username || 'Sahabat'} 👋</Text>
            <Text style={styles.subgreeting}>Mari kita kelola keuangan kamu hari ini</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.username || 'U').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Hero Card with DSR */}
        <Card style={styles.heroCard} testID="dashboard-hero">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Total Hutang</Text>
              <Text style={styles.heroValue} testID="dashboard-total-debt">
                {formatCurrencyFull(totals.totalDebt)}
              </Text>
              <View style={styles.heroSubRow}>
                <View style={styles.heroSubItem}>
                  <Ionicons name="trending-down-outline" size={14} color={colors.danger} />
                  <Text style={styles.heroSubText}>
                    Cicilan: {formatCurrency(totals.monthlyObligation)}
                  </Text>
                </View>
              </View>
            </View>
            <DSRRing value={totals.dsr} />
          </View>
          <View style={styles.heroFooter}>
            <View style={styles.heroFooterItem}>
              <Text style={styles.footerLabel}>Pemasukan/bln</Text>
              <Text style={[styles.footerValue, { color: colors.primary }]} testID="dashboard-total-income">
                {formatCurrency(totals.totalIncome)}
              </Text>
            </View>
            <View style={styles.heroFooterDivider} />
            <View style={styles.heroFooterItem}>
              <Text style={styles.footerLabel}>Sisa Cashflow</Text>
              <Text
                style={[
                  styles.footerValue,
                  {
                    color:
                      totals.totalIncome - totals.monthlyObligation >= 0
                        ? colors.primary
                        : colors.danger,
                  },
                ]}
                testID="dashboard-cashflow"
              >
                {formatCurrency(totals.totalIncome - totals.monthlyObligation)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.secondaryLight }]}
            onPress={() => setShowHutang(true)}
            activeOpacity={0.85}
            testID="quick-input-hutang"
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name="trending-down" size={18} color={colors.surface} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickTitle}>Input Hutang</Text>
              <Text style={styles.quickSub}>Tambah hutang baru</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => setShowPenghasilan(true)}
            activeOpacity={0.85}
            testID="quick-input-income"
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="trending-up" size={18} color={colors.surface} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickTitle}>Input Penghasilan</Text>
              <Text style={styles.quickSub}>Catat pemasukan</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Hutang Section */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionTitle
            title="Hutang Aktif"
            action={
              data.debts.length > 0
                ? {
                    label: 'Tambah',
                    onPress: () => setShowHutang(true),
                    testID: 'add-debt-link',
                  }
                : undefined
            }
          />
          {recentDebts.length === 0 ? (
            <Card>
              <Empty
                icon="wallet-outline"
                title="Belum ada hutang dicatat"
                subtitle="Catat hutang pertamamu agar bisa diatur strategi pelunasan"
                cta={{
                  label: 'Tambah Hutang',
                  onPress: () => setShowHutang(true),
                  testID: 'empty-add-debt',
                }}
              />
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {recentDebts.map((d) => (
                <Card key={d.id} style={styles.itemCard} testID={`debt-item-${d.id}`}>
                  <View style={styles.itemRow}>
                    <View style={[styles.itemIcon, { backgroundColor: colors.secondaryLight }]}>
                      <Ionicons name="card-outline" size={18} color={colors.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{d.name}</Text>
                      <Text style={styles.itemSub}>
                        {d.type} {d.bankName ? `· ${d.bankName}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.itemValue}>{formatCurrency(d.remainingPrincipal || d.totalLiability || 0)}</Text>
                      <Text style={styles.itemSub}>{formatCurrency(d.monthlyPayment)}/bln</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteDebt(d)}
                      style={styles.deleteBtn}
                      testID={`delete-debt-${d.id}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        {/* Penghasilan Section */}
        <View style={{ marginTop: spacing.lg, marginBottom: 100 }}>
          <SectionTitle
            title="Penghasilan"
            action={
              data.incomes.length > 0
                ? {
                    label: 'Tambah',
                    onPress: () => setShowPenghasilan(true),
                    testID: 'add-income-link',
                  }
                : undefined
            }
          />
          {recentIncomes.length === 0 ? (
            <Card>
              <Empty
                icon="cash-outline"
                title="Belum ada penghasilan"
                subtitle="Catat pemasukan rutin & tambahan untuk hitung DSR"
                cta={{
                  label: 'Tambah Penghasilan',
                  onPress: () => setShowPenghasilan(true),
                  testID: 'empty-add-income',
                }}
              />
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {recentIncomes.map((i) => (
                <Card key={i.id} style={styles.itemCard} testID={`income-item-${i.id}`}>
                  <View style={styles.itemRow}>
                    <View style={[styles.itemIcon, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons
                        name={
                          i.type === 'passive'
                            ? 'leaf-outline'
                            : i.type === 'windfall'
                            ? 'gift-outline'
                            : 'briefcase-outline'
                        }
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{i.source}</Text>
                      <Text style={styles.itemSub}>
                        {i.frequency === 'monthly' ? 'Bulanan' : 'Sekali'} · {i.type}
                      </Text>
                    </View>
                    <Text style={[styles.itemValue, { color: colors.primary }]}>
                      {formatCurrency(i.amount)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteIncome(i)}
                      style={styles.deleteBtn}
                      testID={`delete-income-${i.id}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB Speed Dial */}
      {fabOpen && (
        <View style={styles.fabMenu}>
          <TouchableOpacity
            style={styles.fabAction}
            onPress={() => {
              setFabOpen(false);
              setShowHutang(true);
            }}
            testID="fab-action-hutang"
          >
            <View style={[styles.fabActionIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name="trending-down" size={18} color={colors.surface} />
            </View>
            <Text style={styles.fabActionText}>Input Hutang</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fabAction}
            onPress={() => {
              setFabOpen(false);
              setShowPenghasilan(true);
            }}
            testID="fab-action-income"
          >
            <View style={[styles.fabActionIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="trending-up" size={18} color={colors.surface} />
            </View>
            <Text style={styles.fabActionText}>Input Penghasilan</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity
        style={[styles.fab, fabOpen && { backgroundColor: colors.textPrimary }]}
        onPress={() => setFabOpen((s) => !s)}
        activeOpacity={0.85}
        testID="home-fab"
      >
        <Ionicons name={fabOpen ? 'close' : 'add'} size={28} color={colors.surface} />
      </TouchableOpacity>

      <InputHutangSheet visible={showHutang} onClose={() => setShowHutang(false)} />
      <InputPenghasilanSheet visible={showPenghasilan} onClose={() => setShowPenghasilan(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.edge, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  greeting: { ...typography.h3, color: colors.textPrimary },
  subgreeting: { ...typography.bodyMd, color: colors.textSecondary, marginTop: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.surface, fontWeight: '800', fontSize: 18 },
  heroCard: { padding: spacing.lg, borderRadius: radius.xxl },
  heroLabel: { ...typography.overline, color: colors.textSecondary },
  heroValue: { ...typography.h2, color: colors.textPrimary, marginTop: 4, fontWeight: '800' },
  heroSubRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  heroSubItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroSubText: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
  heroFooter: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  heroFooterItem: { flex: 1 },
  heroFooterDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  footerLabel: { ...typography.bodySm, color: colors.textSecondary },
  footerValue: { ...typography.h4, color: colors.textPrimary, fontWeight: '800', marginTop: 2 },
  quickRow: { gap: 10, marginTop: spacing.md },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.xl,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: { ...typography.bodyLg, fontWeight: '700', color: colors.textPrimary },
  quickSub: { ...typography.bodySm, color: colors.textSecondary },
  itemCard: { padding: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { ...typography.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  itemSub: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  itemValue: { ...typography.bodyLg, color: colors.textPrimary, fontWeight: '800' },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    right: spacing.edge,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
  },
  fabMenu: {
    position: 'absolute',
    right: spacing.edge,
    bottom: spacing.lg + 70,
    gap: 8,
  },
  fabAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingRight: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  fabActionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabActionText: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '700' },
});
