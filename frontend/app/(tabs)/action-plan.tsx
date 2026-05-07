// app/(tabs)/action-plan.tsx — Action Plan (Tasks)
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
import { formatDate } from '../../src/utils/format';
import { createItem, updateItem, deleteItem } from '../../src/services/api';

type FilterKey = 'all' | 'pending' | 'completed';
const CATEGORIES = ['Administration', 'Payment', 'Negotiation', 'Investment', 'Business'] as const;

export default function ActionPlanScreen() {
  const { user, data, refresh, isSyncing, patchData } = useApp();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('Payment');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const tasks = data.tasks.filter((t) => !t._deleted);

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter === 'pending') list = list.filter((t) => t.status !== 'completed');
    if (filter === 'completed') list = list.filter((t) => t.status === 'completed');
    if (catFilter !== 'All') list = list.filter((t) => t.category === catFilter);
    return list.sort((a, b) => {
      if (a.status === b.status) return 0;
      return a.status === 'pending' ? -1 : 1;
    });
  }, [tasks, filter, catFilter]);

  const counts = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    return { total: tasks.length, pending, completed };
  }, [tasks]);

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert('Validasi', 'Judul tugas wajib diisi');
      return;
    }
    const item: any = {
      id: `task-${Date.now()}`,
      userId: user.id,
      title: title.trim(),
      category,
      status: 'pending',
      dueDate: dueDate.trim() || undefined,
      context: 'Manual',
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    try {
      const res = await createItem('tasks', item);
      const saved = res?.data || res || item;
      patchData('tasks', saved, 'add');
      setSheetOpen(false);
      setTitle('');
      setDueDate('');
      setCategory('Payment');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Simpan gagal');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: any) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const updated = { ...task, status: newStatus, updatedAt: new Date().toISOString() };
    patchData('tasks', updated, 'update'); // optimistic
    try {
      await updateItem('tasks', updated);
    } catch (e: any) {
      // rollback
      patchData('tasks', task, 'update');
      Alert.alert('Gagal', e?.message || 'Update gagal');
    }
  };

  const handleDelete = (task: any) => {
    Alert.alert('Hapus Tugas', `Yakin hapus "${task.title}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem('tasks', task.id);
            patchData('tasks', task, 'delete');
          } catch (e: any) {
            Alert.alert('Gagal', e?.message || 'Hapus gagal');
          }
        },
      },
    ]);
  };

  const catColor = (cat: string) => {
    switch (cat) {
      case 'Payment':
        return colors.secondary;
      case 'Investment':
        return colors.primary;
      case 'Negotiation':
        return colors.warning;
      case 'Business':
        return '#5C7CD9';
      default:
        return colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Action Plan</Text>
          <Text style={styles.subtitle}>Daftar aksi konkret menuju kebebasan finansial</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setSheetOpen(true)} testID="add-task-button">
          <Ionicons name="add" size={20} color={colors.surface} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{counts.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.secondaryLight }]}>
          <Text style={[styles.statValue, { color: colors.secondary }]}>{counts.completed}</Text>
          <Text style={styles.statLabel}>Selesai</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{counts.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Status Filter */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'completed'] as FilterKey[]).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            testID={`filter-${f}`}
          >
            <Text style={[styles.filterText, filter === f && { color: colors.surface }]}>
              {f === 'all' ? 'Semua' : f === 'pending' ? 'Belum' : 'Selesai'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {(['All', ...CATEGORIES] as string[]).map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCatFilter(c)}
            style={[styles.catChip, catFilter === c && { backgroundColor: catColor(c), borderColor: catColor(c) }]}
            testID={`catfilter-${c}`}
          >
            <Text style={[styles.catChipText, catFilter === c && { color: colors.surface }]}>
              {c === 'All' ? 'Semua' : c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.edge, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isSyncing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <Card>
            <Empty
              icon="checkmark-done-circle-outline"
              title="Belum ada tugas"
              subtitle="Buat action plan pertama untuk maju ke tujuan finansialmu"
              cta={{
                label: 'Tambah Tugas',
                onPress: () => setSheetOpen(true),
                testID: 'empty-add-task',
              }}
            />
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((t) => {
              const tone = catColor(t.category);
              const completed = t.status === 'completed';
              return (
                <Card
                  key={t.id}
                  style={[styles.taskCard, completed && { opacity: 0.65 }]}
                  testID={`task-${t.id}`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => handleToggle(t)}
                      style={[
                        styles.checkbox,
                        completed && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      testID={`task-toggle-${t.id}`}
                    >
                      {completed && <Ionicons name="checkmark" size={16} color={colors.surface} />}
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={[
                          styles.taskTitle,
                          completed && {
                            textDecorationLine: 'line-through',
                            color: colors.textSecondary,
                          } as any,
                        ]}
                        numberOfLines={2}
                      >
                        {t.title}
                      </Text>
                      <View style={styles.taskMetaRow}>
                        <View style={[styles.catBadge, { backgroundColor: tone + '22' }]}>
                          <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: tone }} />
                          <Text style={[styles.catBadgeText, { color: tone }]}>{t.category}</Text>
                        </View>
                        {t.dueDate && (
                          <Text style={styles.taskMetaText}>
                            <Ionicons name="calendar-outline" size={11} color={colors.textSecondary} /> {formatDate(t.dueDate)}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(t)} style={styles.deleteBtn} testID={`task-delete-${t.id}`}>
                      <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sheet */}
      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} testID="task-sheet">
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Tambah Tugas</Text>
              <Text style={styles.sheetSub}>Action Plan untuk progress finansialmu</Text>
            </View>
            <TouchableOpacity onPress={() => setSheetOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Field label="JUDUL TUGAS">
            <Input
              testID="task-title-input"
              value={title}
              onChangeText={setTitle}
              placeholder="Contoh: Bayar KPR sebelum tgl 5"
            />
          </Field>
          <Field label="KATEGORI">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    styles.smallChip,
                    category === c && { backgroundColor: catColor(c), borderColor: catColor(c) },
                  ]}
                  testID={`task-cat-${c}`}
                >
                  <Text style={[styles.smallChipText, category === c && { color: colors.surface }]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Field>
          <Field label="DEADLINE (YYYY-MM-DD)" hint="Opsional">
            <Input
              testID="task-duedate-input"
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="2026-06-15"
            />
          </Field>
          <PrimaryButton
            label="Simpan Tugas"
            onPress={handleSave}
            loading={saving}
            icon="checkmark-circle-outline"
            testID="task-save-button"
          />
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.edge,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.bodyMd, color: colors.textSecondary, marginTop: 2 },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.edge,
    gap: 8,
    marginTop: spacing.sm,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  statValue: { ...typography.h3, fontWeight: '800' },
  statLabel: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.edge,
    paddingTop: spacing.md,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '700' },
  catRow: {
    paddingHorizontal: spacing.edge,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
  taskCard: { padding: spacing.md },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: { ...typography.bodyLg, color: colors.textPrimary, fontWeight: '600' },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  catBadgeText: { ...typography.bodySm, fontSize: 11, fontWeight: '700' },
  taskMetaText: { ...typography.bodySm, fontSize: 11, color: colors.textSecondary },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
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
  smallChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallChipText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
});
