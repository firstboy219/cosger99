// app/(tabs)/strategi.tsx — Create Strategi: Extra Payment, Sinking Fund, Pos Allocation
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
import { useApp } from '../../src/contexts/AppContext';
import { Card, SectionTitle, Empty, Field, Input, PrimaryButton } from '../../src/components/UI';
import { BottomSheet } from '../../src/components/BottomSheet';
import { colors, spacing, radius, typography, shadows } from '../../src/theme';
import { formatCurrency, formatCurrencyFull, formatNumberInput, parseNumeric, monthKey, formatDate } from '../../src/utils/format';
import { createItem, updateItem, deleteItem } from '../../src/services/api';

type TabKey = 'extra' | 'sinking' | 'pos';

export default function StrategiScreen() {
  const { user, data, refresh, isSyncing, patchData } = useApp();
  const [tab, setTab] = useState<TabKey>('extra');

  // Extra Payment state
  const [extraSheetDebt, setExtraSheetDebt] = useState<any | null>(null);
  const [extraAmount, setExtraAmount] = useState('');
  const [extraMethod, setExtraMethod] = useState<'direct_extra' | 'sinking_fund'>('direct_extra');
  const [extraSaving, setExtraSaving] = useState(false);

  // Sinking Fund state
  const [sfSheetOpen, setSfSheetOpen] = useState(false);
  const [sfName, setSfName] = useState('');
  const [sfTarget, setSfTarget] = useState('');
  const [sfDeadline, setSfDeadline] = useState('');
  const [sfCategory, setSfCategory] = useState<
    'Emergency' | 'Holiday' | 'Gadget' | 'Vehicle' | 'Education' | 'Other'
  >('Emergency');
  const [sfSaving, setSfSaving] = useState(false);

  // Pos Allocation state
  const [posSheetOpen, setPosSheetOpen] = useState(false);
  const [posName, setPosName] = useState('');
  const [posAmount, setPosAmount] = useState('');
  const [posCategory, setPosCategory] = useState<'needs' | 'wants' | 'debt'>('needs');
  const [posSaving, setPosSaving] = useState(false);

  const activeDebts = data.debts.filter((d) => !d._deleted);
  const sinkingFunds = data.sinkingFunds.filter((s) => !s._deleted);
  const curMonthKey = monthKey();
  const monthlyAllocations = data.allocations.filter(
    (a) => !a._deleted && (a.monthKey === curMonthKey || !a.monthKey)
  );

  // ─── Extra Payment Handlers ─────────────────────────────────────────
  const openExtraSheet = (debt: any) => {
    setExtraSheetDebt(debt);
    setExtraAmount(String(debt.allocatedExtraBudget || ''));
    setExtraMethod(debt.payoffMethod || 'direct_extra');
  };

  const handleSaveExtra = async () => {
    if (!extraSheetDebt) return;
    const num = parseNumeric(extraAmount);
    if (num <= 0) {
      Alert.alert('Validasi', 'Jumlah extra payment harus > 0');
      return;
    }
    setExtraSaving(true);
    try {
      const updated = {
        ...extraSheetDebt,
        allocatedExtraBudget: num,
        payoffMethod: extraMethod,
        updatedAt: new Date().toISOString(),
      };
      const res = await updateItem('debts', updated);
      const saved = res?.data || res || updated;
      patchData('debts', { ...saved, id: extraSheetDebt.id }, 'update');
      setExtraSheetDebt(null);
      setExtraAmount('');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Update gagal');
    } finally {
      setExtraSaving(false);
    }
  };

  // ─── Sinking Fund Handlers ──────────────────────────────────────────
  const handleSaveSf = async () => {
    if (!user) return;
    if (!sfName.trim()) {
      Alert.alert('Validasi', 'Nama dana wajib diisi');
      return;
    }
    const num = parseNumeric(sfTarget);
    if (num <= 0) {
      Alert.alert('Validasi', 'Target nominal harus > 0');
      return;
    }
    const deadline = sfDeadline.trim() || (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    })();
    const item: any = {
      id: `sf-${Date.now()}`,
      userId: user.id,
      name: sfName.trim(),
      targetAmount: num,
      currentAmount: 0,
      deadline,
      icon: 'wallet',
      color: '#7D8F69',
      category: sfCategory,
      priority: 'Medium',
      updatedAt: new Date().toISOString(),
    };
    setSfSaving(true);
    try {
      const res = await createItem('sinkingFunds', item);
      const saved = res?.data || res || item;
      patchData('sinkingFunds', saved, 'add');
      setSfSheetOpen(false);
      setSfName('');
      setSfTarget('');
      setSfDeadline('');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Simpan gagal');
    } finally {
      setSfSaving(false);
    }
  };

  const handleDeleteSf = (sf: any) => {
    Alert.alert('Hapus Sinking Fund', `Yakin hapus "${sf.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem('sinkingFunds', sf.id);
            patchData('sinkingFunds', sf, 'delete');
          } catch (e: any) {
            Alert.alert('Gagal', e?.message || 'Hapus gagal');
          }
        },
      },
    ]);
  };

  // ─── Pos Allocation Handlers ────────────────────────────────────────
  const handleSavePos = async () => {
    if (!user) return;
    if (!posName.trim()) {
      Alert.alert('Validasi', 'Nama pos wajib diisi');
      return;
    }
    const num = parseNumeric(posAmount);
    if (num <= 0) {
      Alert.alert('Validasi', 'Jumlah harus > 0');
      return;
    }
    const item: any = {
      id: `alloc-${Date.now()}`,
      userId: user.id,
      name: posName.trim(),
      amount: num,
      category: posCategory,
      isTransferred: false,
      isRecurring: false,
      assignedAccountId: null,
      monthKey: curMonthKey,
      priority: monthlyAllocations.length + 1,
      updatedAt: new Date().toISOString(),
    };
    setPosSaving(true);
    try {
      const res = await createItem('allocations', item);
      const saved = res?.data || res || item;
      patchData('allocations', saved, 'add');
      setPosSheetOpen(false);
      setPosName('');
      setPosAmount('');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Simpan gagal');
    } finally {
      setPosSaving(false);
    }
  };

  const handleDeletePos = (item: any) => {
    Alert.alert('Hapus Pos', `Yakin hapus "${item.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem('allocations', item.id);
            patchData('allocations', item, 'delete');
          } catch (e: any) {
            Alert.alert('Gagal', e?.message || 'Hapus gagal');
          }
        },
      },
    ]);
  };

  // Pos summary
  const posSum = useMemo(() => {
    const init = { needs: 0, wants: 0, debt: 0 };
    return monthlyAllocations.reduce((acc, a) => {
      const cat = (a.category as 'needs' | 'wants' | 'debt') || 'needs';
      acc[cat] = (acc[cat] || 0) + Number(a.amount || 0);
      return acc;
    }, { ...init });
  }, [monthlyAllocations]);
  const posTotal = posSum.needs + posSum.wants + posSum.debt;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Create Strategi</Text>
        <Text style={styles.subtitle}>Rancang jalan menuju kebebasan finansial</Text>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        {(
          [
            { id: 'extra', label: 'Extra Payment', icon: 'flash-outline' },
            { id: 'sinking', label: 'Sinking Fund', icon: 'archive-outline' },
            { id: 'pos', label: 'Pos Alokasi', icon: 'pie-chart-outline' },
          ] as { id: TabKey; label: string; icon: any }[]
        ).map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            testID={`strategi-tab-${t.id}`}
          >
            <Ionicons
              name={t.icon}
              size={16}
              color={tab === t.id ? colors.textInverse : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                tab === t.id && { color: colors.textInverse },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.edge, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isSyncing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── TAB: EXTRA PAYMENT ─── */}
        {tab === 'extra' && (
          <View>
            <Card style={{ marginBottom: spacing.md, backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="bulb-outline" size={20} color={colors.primaryActive} />
                <Text style={[typography.bodyMd, { color: colors.primaryActive, flex: 1, fontWeight: '600' } as any]}>
                  Tambahkan extra budget per bulan untuk mempercepat pelunasan hutang.
                </Text>
              </View>
            </Card>

            {activeDebts.length === 0 ? (
              <Card>
                <Empty
                  icon="rocket-outline"
                  title="Belum ada hutang"
                  subtitle="Tambah hutang dulu di Home agar bisa dialokasikan extra payment"
                />
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {activeDebts.map((d) => (
                  <Card key={d.id} testID={`extra-debt-${d.id}`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.itemIcon, { backgroundColor: colors.secondaryLight }]}>
                        <Ionicons name="card-outline" size={18} color={colors.secondary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.itemTitle}>{d.name}</Text>
                        <Text style={styles.itemSub}>
                          {formatCurrency(d.monthlyPayment)}/bln · sisa {d.remainingMonths || '-'} bln
                        </Text>
                      </View>
                    </View>
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: colors.surfaceElevated, borderRadius: radius.lg }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' }}>
                          Extra Budget
                        </Text>
                        <Text style={{ ...typography.bodyLg, color: colors.primary, fontWeight: '800' }}>
                          {d.allocatedExtraBudget ? formatCurrency(d.allocatedExtraBudget) : '—'}
                        </Text>
                      </View>
                      {d.payoffMethod && (
                        <Text style={{ ...typography.bodySm, color: colors.textSecondary, marginTop: 2 }}>
                          Metode: {d.payoffMethod === 'direct_extra' ? 'Langsung' : 'Lewat Sinking Fund'}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => openExtraSheet(d)}
                      style={styles.smallBtn}
                      testID={`extra-set-${d.id}`}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                      <Text style={styles.smallBtnText}>
                        {d.allocatedExtraBudget ? 'Edit Extra Payment' : 'Set Extra Payment'}
                      </Text>
                    </TouchableOpacity>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ─── TAB: SINKING FUND ─── */}
        {tab === 'sinking' && (
          <View>
            <SectionTitle
              title="Sinking Fund"
              action={{
                label: '+ Tambah',
                onPress: () => setSfSheetOpen(true),
                testID: 'add-sinking-fund',
              }}
            />
            {sinkingFunds.length === 0 ? (
              <Card>
                <Empty
                  icon="archive-outline"
                  title="Belum ada Sinking Fund"
                  subtitle="Buat target tabungan untuk dana darurat, liburan, atau gadget"
                  cta={{
                    label: 'Buat Sinking Fund',
                    onPress: () => setSfSheetOpen(true),
                    testID: 'empty-add-sf',
                  }}
                />
              </Card>
            ) : (
              <View style={styles.sfGrid}>
                {sinkingFunds.map((sf) => {
                  const pct = sf.targetAmount > 0 ? Math.min(100, (sf.currentAmount / sf.targetAmount) * 100) : 0;
                  return (
                    <Card key={sf.id} style={styles.sfCard} testID={`sf-card-${sf.id}`}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={[styles.sfIcon, { backgroundColor: colors.primaryLight }]}>
                          <Ionicons name="archive-outline" size={18} color={colors.primary} />
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteSf(sf)} testID={`delete-sf-${sf.id}`}>
                          <Ionicons name="trash-outline" size={16} color={colors.textDisabled} />
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.itemTitle, { marginTop: 10 }]} numberOfLines={1}>
                        {sf.name}
                      </Text>
                      <Text style={styles.itemSub} numberOfLines={1}>
                        {sf.category || 'Other'} · {formatDate(sf.deadline)}
                      </Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressBar, { width: `${pct}%` }]} />
                      </View>
                      <Text style={[typography.bodySm, { color: colors.primary, fontWeight: '800', marginTop: 4 } as any]}>
                        {formatCurrency(sf.currentAmount)} / {formatCurrency(sf.targetAmount)}
                      </Text>
                      <Text style={[typography.bodySm, { color: colors.textSecondary, fontSize: 11 } as any]}>
                        {pct.toFixed(0)}% tercapai
                      </Text>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ─── TAB: POS ALOCASI ─── */}
        {tab === 'pos' && (
          <View>
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={{ ...typography.overline, color: colors.textSecondary }}>
                ALOKASI BULAN INI
              </Text>
              <Text style={[styles.itemTitle, { fontSize: 22, marginTop: 4 }]}>
                {formatCurrencyFull(posTotal)}
              </Text>
              <View style={styles.posLegend}>
                {(['needs', 'wants', 'debt'] as const).map((cat) => {
                  const v = posSum[cat] || 0;
                  const pct = posTotal > 0 ? (v / posTotal) * 100 : 0;
                  const color =
                    cat === 'needs' ? colors.primary : cat === 'wants' ? colors.warning : colors.secondary;
                  const label = cat === 'needs' ? 'Kebutuhan' : cat === 'wants' ? 'Keinginan' : 'Hutang';
                  return (
                    <View key={cat} style={{ marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color }} />
                          <Text style={{ ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' }}>
                            {label}
                          </Text>
                        </View>
                        <Text style={{ ...typography.bodySm, color: colors.textSecondary, fontWeight: '700' }}>
                          {formatCurrency(v)} ({pct.toFixed(0)}%)
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { marginTop: 4 }]}>
                        <View style={[styles.progressBar, { width: `${pct}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>

            <SectionTitle
              title="Pos Alokasi Bulan Ini"
              action={{
                label: '+ Tambah',
                onPress: () => setPosSheetOpen(true),
                testID: 'add-pos',
              }}
            />

            {monthlyAllocations.length === 0 ? (
              <Card>
                <Empty
                  icon="pie-chart-outline"
                  title="Belum ada pos alokasi"
                  subtitle="Pisahkan dompet kamu menjadi pos: Kebutuhan, Keinginan, dan Hutang"
                  cta={{
                    label: 'Buat Pos',
                    onPress: () => setPosSheetOpen(true),
                    testID: 'empty-add-pos',
                  }}
                />
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {monthlyAllocations.map((a) => {
                  const tone =
                    a.category === 'needs'
                      ? colors.primary
                      : a.category === 'wants'
                      ? colors.warning
                      : colors.secondary;
                  return (
                    <Card key={a.id} testID={`pos-item-${a.id}`}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View
                          style={[
                            styles.itemIcon,
                            { backgroundColor: tone + '22' },
                          ]}
                        >
                          <Ionicons
                            name={
                              a.category === 'needs'
                                ? 'home-outline'
                                : a.category === 'wants'
                                ? 'heart-outline'
                                : 'card-outline'
                            }
                            size={18}
                            color={tone}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{a.name}</Text>
                          <Text style={styles.itemSub}>
                            {a.category === 'needs'
                              ? 'Kebutuhan'
                              : a.category === 'wants'
                              ? 'Keinginan'
                              : 'Hutang'}
                            {a.isTransferred ? ' · ✓ Sudah disisihkan' : ''}
                          </Text>
                        </View>
                        <Text style={[styles.itemValue, { color: tone }]}>
                          {formatCurrency(a.amount)}
                        </Text>
                        <TouchableOpacity onPress={() => handleDeletePos(a)} style={styles.deleteBtn} testID={`delete-pos-${a.id}`}>
                          <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── SHEET: EXTRA PAYMENT ─── */}
      <BottomSheet
        visible={!!extraSheetDebt}
        onClose={() => setExtraSheetDebt(null)}
        testID="extra-sheet"
      >
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Set Extra Payment</Text>
              <Text style={styles.sheetSub}>{extraSheetDebt?.name}</Text>
            </View>
            <TouchableOpacity onPress={() => setExtraSheetDebt(null)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Field label="JUMLAH EXTRA / BULAN (Rp)">
            <Input
              testID="extra-amount-input"
              value={extraAmount ? formatNumberInput(extraAmount) : ''}
              onChangeText={(v) => setExtraAmount(String(parseNumeric(v)))}
              placeholder="500.000"
              keyboardType="number-pad"
            />
          </Field>
          <Field label="METODE">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { id: 'direct_extra', label: 'Langsung Bayar', icon: 'flash-outline' },
                { id: 'sinking_fund', label: 'Lewat Tabungan', icon: 'archive-outline' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setExtraMethod(m.id as any)}
                  style={[
                    styles.methodCard,
                    extraMethod === m.id && styles.methodCardActive,
                  ]}
                  testID={`extra-method-${m.id}`}
                >
                  <Ionicons
                    name={m.icon as any}
                    size={18}
                    color={extraMethod === m.id ? colors.surface : colors.primary}
                  />
                  <Text
                    style={[
                      styles.methodText,
                      extraMethod === m.id && { color: colors.surface },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <PrimaryButton
            label="Simpan Strategi"
            onPress={handleSaveExtra}
            loading={extraSaving}
            icon="checkmark-circle-outline"
            style={{ marginTop: spacing.md }}
            testID="extra-save-button"
          />
        </ScrollView>
      </BottomSheet>

      {/* ─── SHEET: SINKING FUND ─── */}
      <BottomSheet visible={sfSheetOpen} onClose={() => setSfSheetOpen(false)} testID="sf-sheet">
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Buat Sinking Fund</Text>
              <Text style={styles.sheetSub}>Tabung untuk target di masa depan</Text>
            </View>
            <TouchableOpacity onPress={() => setSfSheetOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Field label="NAMA TABUNGAN">
            <Input
              testID="sf-name-input"
              value={sfName}
              onChangeText={setSfName}
              placeholder="Contoh: Dana Darurat"
            />
          </Field>
          <Field label="KATEGORI">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(['Emergency', 'Holiday', 'Gadget', 'Vehicle', 'Education', 'Other'] as const).map(
                (c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSfCategory(c)}
                    style={[
                      styles.smallChip,
                      sfCategory === c && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    testID={`sf-cat-${c}`}
                  >
                    <Text
                      style={[
                        styles.smallChipText,
                        sfCategory === c && { color: colors.surface },
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </Field>
          <Field label="TARGET NOMINAL (Rp)">
            <Input
              testID="sf-target-input"
              value={sfTarget ? formatNumberInput(sfTarget) : ''}
              onChangeText={(v) => setSfTarget(String(parseNumeric(v)))}
              placeholder="50.000.000"
              keyboardType="number-pad"
            />
          </Field>
          <Field label="DEADLINE (YYYY-MM-DD)" hint="Kosongkan untuk default 1 tahun ke depan">
            <Input
              testID="sf-deadline-input"
              value={sfDeadline}
              onChangeText={setSfDeadline}
              placeholder="2027-05-31"
            />
          </Field>
          <PrimaryButton
            label="Simpan Sinking Fund"
            onPress={handleSaveSf}
            loading={sfSaving}
            icon="checkmark-circle-outline"
            testID="sf-save-button"
          />
        </ScrollView>
      </BottomSheet>

      {/* ─── SHEET: POS ALOKASI ─── */}
      <BottomSheet visible={posSheetOpen} onClose={() => setPosSheetOpen(false)} testID="pos-sheet">
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Tambah Pos Alokasi</Text>
              <Text style={styles.sheetSub}>Bulan {curMonthKey}</Text>
            </View>
            <TouchableOpacity onPress={() => setPosSheetOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Field label="KATEGORI">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { id: 'needs', label: 'Kebutuhan', icon: 'home-outline', tone: colors.primary },
                { id: 'wants', label: 'Keinginan', icon: 'heart-outline', tone: colors.warning },
                { id: 'debt', label: 'Hutang', icon: 'card-outline', tone: colors.secondary },
              ].map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setPosCategory(c.id as any)}
                  activeOpacity={0.85}
                  style={[
                    styles.posCatCard,
                    posCategory === c.id && { backgroundColor: c.tone, borderColor: c.tone },
                  ]}
                  testID={`pos-cat-${c.id}`}
                >
                  <Ionicons
                    name={c.icon as any}
                    size={20}
                    color={posCategory === c.id ? colors.surface : c.tone}
                  />
                  <Text
                    style={[
                      styles.posCatText,
                      posCategory === c.id && { color: colors.surface },
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <Field label="NAMA POS">
            <Input
              testID="pos-name-input"
              value={posName}
              onChangeText={setPosName}
              placeholder="Contoh: Belanja Bulanan"
            />
          </Field>
          <Field label="JUMLAH (Rp)">
            <Input
              testID="pos-amount-input"
              value={posAmount ? formatNumberInput(posAmount) : ''}
              onChangeText={(v) => setPosAmount(String(parseNumeric(v)))}
              placeholder="2.500.000"
              keyboardType="number-pad"
            />
          </Field>
          <PrimaryButton
            label="Simpan Pos"
            onPress={handleSavePos}
            loading={posSaving}
            icon="checkmark-circle-outline"
            testID="pos-save-button"
          />
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.edge, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.bodyMd, color: colors.textSecondary, marginTop: 2 },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.edge,
    paddingVertical: spacing.md,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '700' },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { ...typography.bodyLg, color: colors.textPrimary, fontWeight: '700' },
  itemSub: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  itemValue: { ...typography.bodyLg, fontWeight: '800' },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  smallBtnText: { ...typography.bodyMd, color: colors.primary, fontWeight: '700' },
  sfGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sfCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 150,
    padding: spacing.md,
  },
  sfIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  posLegend: { marginTop: spacing.md },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sheetTitle: { ...typography.h3, color: colors.textPrimary },
  sheetSub: { ...typography.bodyMd, color: colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  methodCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodText: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '700' },
  smallChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallChipText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
  posCatCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    gap: 4,
  },
  posCatText: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
});
