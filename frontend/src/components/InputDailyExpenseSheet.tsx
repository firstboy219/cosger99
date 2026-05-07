// src/components/InputDailyExpenseSheet.tsx
import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { Field, Input, PrimaryButton } from './UI';
import { colors, spacing, radius, typography } from '../theme';
import { createItem } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { formatNumberInput, parseNumeric } from '../utils/format';
import { alertAsync } from '../utils/confirm';

const CATEGORIES: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'Food', label: 'Makanan', icon: 'fast-food-outline' },
  { id: 'Transport', label: 'Transport', icon: 'bus-outline' },
  { id: 'Shopping', label: 'Belanja', icon: 'bag-handle-outline' },
  { id: 'Utilities', label: 'Tagihan', icon: 'flash-outline' },
  { id: 'Entertainment', label: 'Hiburan', icon: 'film-outline' },
  { id: 'Others', label: 'Lainnya', icon: 'ellipsis-horizontal-circle-outline' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const InputDailyExpenseSheet: React.FC<Props> = ({ visible, onClose }) => {
  const { user, patchData } = useApp();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setTitle('');
    setAmount('');
    setCategory('Food');
    setNotes('');
  };

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) {
      alertAsync('Validasi', 'Nama pengeluaran wajib diisi');
      return;
    }
    const num = parseNumeric(amount);
    if (num <= 0) {
      alertAsync('Validasi', 'Jumlah harus > 0');
      return;
    }
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const item: any = {
      id: `de-${Date.now()}`,
      userId: user.id,
      title: title.trim(),
      amount: num,
      category,
      date: dateStr,
      notes: notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    setLoading(true);
    try {
      const res = await createItem('dailyExpenses', item);
      const saved = res?.data || res || item;
      patchData('dailyExpenses', saved, 'add');
      reset();
      onClose();
    } catch (e: any) {
      alertAsync('Gagal Simpan', e?.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="dailyexp-sheet">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Catat Pengeluaran</Text>
            <Text style={styles.subtitle}>Track pengeluaran harianmu</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="dailyexp-close">
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Field label="KATEGORI">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[styles.catChip, category === c.id && styles.catChipActive]}
                testID={`dailyexp-cat-${c.id}`}
              >
                <Ionicons
                  name={c.icon}
                  size={16}
                  color={category === c.id ? colors.surface : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.catChipText,
                    category === c.id && { color: colors.surface },
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Field>

        <Field label="DESKRIPSI">
          <Input
            testID="dailyexp-title-input"
            value={title}
            onChangeText={setTitle}
            placeholder="Contoh: Kopi pagi, ojek pulang kantor"
          />
        </Field>

        <Field label="JUMLAH (Rp)">
          <Input
            testID="dailyexp-amount-input"
            value={amount ? formatNumberInput(amount) : ''}
            onChangeText={(v) => setAmount(String(parseNumeric(v)))}
            placeholder="25.000"
            keyboardType="number-pad"
          />
        </Field>

        <Field label="CATATAN">
          <Input
            testID="dailyexp-notes-input"
            value={notes}
            onChangeText={setNotes}
            placeholder="Opsional"
          />
        </Field>

        <PrimaryButton
          label="Simpan Pengeluaran"
          onPress={handleSave}
          loading={loading}
          icon="checkmark-circle-outline"
          style={{ marginTop: spacing.md }}
          testID="dailyexp-save-button"
        />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.bodyMd, color: colors.textSecondary, marginTop: 2 },
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
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catChipText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
});

export default InputDailyExpenseSheet;
